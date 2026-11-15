// 自動プレイ。28か月を1周し、資金の推移をコンソールに出す。バランス調整用。
//   ブラウザ: コンソールで AF.dev.simulateRun()  (遊んでいるゲームの状態には触らない)
//   Node:     node tools/run-sim.js [seed]
// 自動プレイの方針は「部品契約を堅実にこなし、設備を順に買い、解放後は基本ユニットの機体を作る」という単純なもの。
(function (AF) {
  'use strict';
  var dev = AF.dev;

  // 設備投資の順番(この台数に達するまで、上から順に買う)
  var DEFAULT_PLAN = [
    { id: 'press', count: 1 }, { id: 'weld', count: 1 },
    { id: 'jig', count: 1 }, { id: 'test', count: 1 }, { id: 'inspect', count: 1 },
    { id: 'jig', count: 2 }, { id: 'press', count: 2 }, { id: 'lathe', count: 2 }, { id: 'weld', count: 2 },
    { id: 'jig', count: 3 }, { id: 'press', count: 3 }, { id: 'lathe', count: 3 }, { id: 'weld', count: 3 },
    { id: 'press', count: 4 }, { id: 'lathe', count: 4 }
  ];

  function basicSlots(state) {
    var slots = {};
    AF.data.CONFIG.SLOTS.forEach(function (slot) {
      var u = AF.data.UNITS.filter(function (x) { return x.slot === slot.id && state.unlockedUnits[x.id]; })[0];
      slots[slot.id] = u.id;
    });
    return slots;
  }

  // 機体1機を部品から全部自社で作る場合の、設備ごとの工数と資材
  dev.treeRequirements = function (state, slots) {
    var IDX = AF.data.index, A = AF.data.CONFIG.AIRCRAFT_ASSEMBLY;
    var work = {}, materials = {};
    function addWork(f, w) { work[f] = (work[f] || 0) + w; }
    function addMat(map, mul) { Object.keys(map).forEach(function (k) { materials[k] = (materials[k] || 0) + map[k] * mul; }); }
    function addParts(map) {
      Object.keys(map).forEach(function (id) {
        var p = IDX.parts[id];
        addWork(p.facility, p.work * map[id]); addMat(p.materials, map[id]);
      });
    }
    AF.data.CONFIG.SLOTS.forEach(function (slot) {
      var u = IDX.units[slots[slot.id]];
      addWork(u.facility, u.work); addMat(u.materials, 1); addParts(u.parts);
    });
    addWork(A.facility, A.work); addMat(A.materials, 1); addParts(A.parts);
    return { work: work, materials: materials };
  };

  // 今の設備で、基本機体を月に何機作れるかの目安
  function monthlyAircraftCapacity(state, slots) {
    var S = AF.systems, req = dev.treeRequirements(state, slots), min = Infinity;
    Object.keys(req.work).forEach(function (f) {
      min = Math.min(min, S.facilities.capacity(state, f) * 30 / req.work[f]);
    });
    return min;
  }

  // 部品の必要数: 未着手のユニット・機体ジョブが使うぶん(jobs)と、受注中の部品契約(contracts)
  function partNeeds(state) {
    var needContracts = {};
    state.contracts.active.forEach(function (c) {
      if (c.kind === 'part') needContracts[c.itemId] = (needContracts[c.itemId] || 0) + (c.qty - c.delivered);
    });
    return { jobs: AF.systems.production.reservedParts(state), contracts: needContracts };
  }

  function queuedQty(state) {
    var q = {};
    state.jobs.forEach(function (j) { q[j.kind + ':' + j.itemId] = (q[j.kind + ':' + j.itemId] || 0) + j.qty; });
    return q;
  }

  // 機体づくりに関わるジョブは最優先でキューに入れる
  function addPriorityJob(state, kind, itemId, qty) {
    var r = AF.systems.production.addJob(state, kind, itemId, qty);
    if (r.ok) AF.systems.production.prioritizeJob(state, r.job.id);
    return r;
  }

  function wantOffer(state, offer, bot) {
    var S = AF.systems, IDX = AF.data.index;
    var daysLeft = offer.deadlineDay - state.day + 1;
    if (offer.kind === 'part') {
      var part = IDX.parts[offer.itemId];
      if (!S.production.canMakePart(state, part.id)) return false;
      var load = 0;
      state.contracts.active.forEach(function (c) {
        if (c.kind === 'part' && IDX.parts[c.itemId].facility === part.facility) load += (c.qty - c.delivered) * IDX.parts[c.itemId].work;
      });
      var cap = S.facilities.capacity(state, part.facility) * daysLeft * (state.phase >= 2 ? 0.5 : 0.85);
      return load + offer.qty * part.work <= cap;
    }
    if (state.phase < 2 || !state.designs.length) return false;
    if (!S.aircraft.eligibleDesigns(state, offer.minSpec).length) return false;
    var committed = 0;
    state.contracts.active.forEach(function (c) { if (c.kind === 'aircraft') committed += c.qty - c.delivered; });
    // 部品契約と設備を分け合うので、機体に回せるのは能力の半分ほどと見積もる
    var perMonth = monthlyAircraftCapacity(state, state.designs[0].slots) * 0.5;
    return committed + offer.qty <= Math.max(1, Math.floor(perMonth * daysLeft / 30));
  }

  function botDay(state, bot) {
    var S = AF.systems, IDX = AF.data.index, C = AF.data.CONFIG, i;

    // 1) 設備投資(固定費1か月ぶん + 予備 は手元に残す)
    for (i = 0; i < bot.plan.length; i++) {
      var step = bot.plan[i];
      if ((state.facilities[step.id] || 0) < step.count) {
        var fixed = S.economy.monthlyCosts(state);
        var reserve = bot.reserve + fixed.wages + fixed.upkeep + fixed.overhead;
        if (state.funds >= S.facilities.cost(state, step.id) + reserve) S.facilities.buy(state, step.id);
        break;
      }
    }
    // 1b) 研究: 部品の研究を優先し、あとは安いものから(固定費ぶんは残す)
    if (state.research.active.length < state.research.slots) {
      var fx = S.economy.monthlyCosts(state), keep = fx.wages + fx.upkeep + fx.overhead;
      var cand = AF.data.RESEARCH.filter(function (n) { return n.source === 'base' && (n.tree === 'parts' || state.phase >= 2) && S.research.nodeStatus(state, n.id) === 'available'; })
        .sort(function (a, b) { return (a.tree === 'parts' ? 0 : 1) - (b.tree === 'parts' ? 0 : 1) || a.cost.funds - b.cost.funds; })[0];
      if (cand && state.funds >= cand.cost.funds + (cand.cost.funds <= 4000 ? 2000 : keep + bot.reserve)) S.research.start(state, cand.id);
    }
    // 2) 人員: 全設備を動かせる人数まで雇う
    var req = S.workforce.required(state);
    ['skilled', 'general'].forEach(function (t) {
      while (state.staff[t] < req[t] && S.workforce.hire(state, t, 1).ok) { /* 採用枠が尽きるまで */ }
    });
    // 3) 設計
    if (state.phase >= 2 && !state.designs.length) S.aircraft.saveDesign(state, { name: '試作1号', slots: basicSlots(state) });
    // 4) 受注
    state.contracts.offers.slice().forEach(function (o) { if (wantOffer(state, o, bot)) S.contracts.accept(state, o.id); });

    // 5) 生産計画: 機体 → ユニット → 部品 の順に不足分をキューへ
    var queued = queuedQty(state);
    if (state.phase >= 2 && state.designs.length) {
      var d = state.designs[0];
      var needAir = 0;
      state.contracts.active.forEach(function (c) { if (c.kind === 'aircraft') needAir += c.qty - c.delivered; });
      needAir -= (state.inventory.aircraft[d.id] || 0) + (queued['aircraft:' + d.id] || 0);
      for (i = 0; i < needAir; i++) addPriorityJob(state, 'aircraft', d.id, 1);
      var waitingAir = state.jobs.filter(function (j) { return j.kind === 'aircraft' && !j.started; }).length;
      C.SLOTS.forEach(function (slot) {
        var uid = d.slots[slot.id];
        var needUnit = waitingAir - (state.inventory.units[uid] || 0) - (queued['unit:' + uid] || 0);
        for (var k = 0; k < needUnit; k++) addPriorityJob(state, 'unit', uid, 1);
      });
    }
    queued = queuedQty(state);
    var need = partNeeds(state);
    var ids = {};
    Object.keys(need.jobs).concat(Object.keys(need.contracts)).forEach(function (id) { ids[id] = true; });
    Object.keys(ids).forEach(function (id) {
      if (!S.production.canMakePart(state, id)) return;
      var have = (state.inventory.parts[id] || 0) + (queued['part:' + id] || 0);
      var lackJobs = Math.max(0, (need.jobs[id] || 0) - have);
      var lackContracts = Math.max(0, (need.jobs[id] || 0) + (need.contracts[id] || 0) - have - lackJobs);
      if (lackJobs > 0) addPriorityJob(state, 'part', id, Math.ceil(lackJobs));
      if (lackContracts > 0) S.production.addJob(state, 'part', id, Math.ceil(lackContracts));
    });

    // 6) スポット: 手の空いた設備で、まだ売れる部品を少し作る。余った在庫は売る。
    AF.data.FACILITIES.forEach(function (f) {
      if (!f.capacity || !(state.facilities[f.id] > 0)) return;
      if (state.jobs.some(function (j) { return j.facility === f.id; })) return;
      var best = null, bestRoom = 0;
      AF.data.PARTS.forEach(function (p) {
        if (p.facility !== f.id || !S.production.canMakePart(state, p.id)) return;
        var room = S.contracts.spotRemaining(state, p.id) - (state.inventory.parts[p.id] || 0);
        if (room > bestRoom) { best = p; bestRoom = room; }
      });
      if (best) S.production.addJob(state, 'part', best.id, Math.max(1, Math.min(bestRoom, Math.floor(S.facilities.capacity(state, f.id) * 3 / best.work))));
    });
    AF.data.PARTS.forEach(function (p) {
      var surplus = (state.inventory.parts[p.id] || 0) - (need.jobs[p.id] || 0) - (need.contracts[p.id] || 0);
      if (surplus > 0 && S.contracts.spotRemaining(state, p.id) > 0) S.contracts.sellSpot(state, p.id, surplus);
    });
  }

  // 28か月を自動で1周する。opts = { seed, plan, reserve, silent }
  dev.simulateRun = function (opts) {
    opts = opts || {};
    var state = AF.core.state.create('自動プレイ工場', opts.seed == null ? 12345 : opts.seed);
    var bot = { plan: opts.plan || DEFAULT_PLAN, reserve: opts.reserve == null ? 4000 : opts.reserve };
    var rows = [], firstAircraft = null, phase2Month = null;
    var total = AF.core.util.totalDays();

    while (state.day < total && !state.bankrupt && !state.finished) {
      botDay(state, bot);
      var before = state.reports.length;
      AF.systems.gameLoop.advanceDay(state);
      if (state.reports.length > before) {
        var r = state.reports[state.reports.length - 1];
        if (phase2Month == null && r.phase >= 2) phase2Month = r.label;
        if (firstAircraft == null && r.stats.aircraftDelivered > 0) firstAircraft = r.label;
        rows.push({ '月': r.label, '資金': Math.round(r.fundsEnd), '収入': Math.round(r.incomeTotal), '支出': Math.round(r.expenseTotal),
                    '損益': Math.round(r.net), '機体納入': r.stats.aircraftDelivered, 'RLM評価': Math.round(r.rlmRating), 'フェーズ': r.phase, '研究': Object.keys(state.research.done).length,
                    '設備数': AF.systems.facilities.totalCount(state), '人員': state.staff.skilled + state.staff.general });
      }
    }
    var score = state.score || AF.systems.progression.computeScore(state);
    var summary = { seed: state.rngSeed, bankrupt: state.bankrupt, phase2Month: phase2Month, firstAircraftMonth: firstAircraft,
                    aircraftDelivered: state.totals.aircraftDelivered, finalFunds: Math.round(state.funds),
                    contractStats: state.contractStats, score: score.total };
    if (!opts.silent) {
      if (console.table) console.table(rows); else console.log(rows);
      console.log('simulateRun 結果:', JSON.stringify(summary));
    }
    return { rows: rows, summary: summary, state: state };
  };
})(window.AF);
