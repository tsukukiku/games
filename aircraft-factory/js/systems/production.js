// 生産。ジョブのキュー、日々の進捗、完成時の品質判定と手直し。
//
// ジョブ: { id, kind: 'part'|'unit'|'aircraft', itemId, name, qty, facility,
//           workPer, workTotal, workDone, started, reworked, defects, status, note }
// status: queued(待ち) / waiting(資材・部品待ち) / active(作業中) / rework(手直し中) / done
//
// 進め方: 設備の種類ごとに、1日の能力 = 設備能力 × 人員係数 × 稼働 を、キューの上から順に使う。
// 必要な資材・部品・ユニットは、ジョブの着手時にまとめて消費する。足りないジョブは飛ばして次へ進む。
(function (AF) {
  'use strict';
  var U = AF.core.util, L = AF.core.log;
  var production = {};
  function C() { return AF.data.CONFIG; }
  function IDX() { return AF.data.index; }

  // ---- レシピ(1個あたり) ----
  // 戻り値 { name, facility, work, materials, parts, units, defectRate } / 不明なら null
  production.getRecipe = function (state, kind, itemId) {
    var Q = C().QUALITY;
    if (kind === 'part') {
      var p = IDX().parts[itemId];
      if (!p) return null;
      return { name: p.name, facility: p.facility, work: p.work, materials: p.materials, parts: {}, units: {}, defectRate: p.defectRate };
    }
    if (kind === 'unit') {
      var u = IDX().units[itemId];
      if (!u) return null;
      return { name: u.name, facility: u.facility, work: u.work, materials: u.materials, parts: u.parts, units: {},
               defectRate: U.clamp(Q.unitBase - Q.unitPerRel * u.stats.reliability, Q.unitMin, Q.unitMax) };
    }
    if (kind === 'aircraft') {
      var d = AF.systems.aircraft.getDesign(state, itemId);
      if (!d) return null;
      var A = C().AIRCRAFT_ASSEMBLY;
      var units = {};
      C().SLOTS.forEach(function (slot) { units[d.slots[slot.id]] = (units[d.slots[slot.id]] || 0) + 1; });
      var calc = AF.systems.aircraft.computeAircraftStats(d.slots);
      return { name: d.name, facility: A.facility, work: A.work, materials: A.materials, parts: A.parts, units: units,
               defectRate: U.clamp(Q.aircraftBase - Q.aircraftPerRel * calc.stats.reliability, Q.aircraftMin, Q.aircraftMax) };
    }
    return null;
  };

  // 実際の不良率(検査設備・残業・研究の補正込み)
  production.defectRate = function (state, recipe) {
    var rate = recipe.defectRate + C().SHIFTS[state.shift].defectAdd;
    rate *= AF.systems.facilities.effectMul(state, 'defectMul') * state.modifiers.defectMul;
    return U.clamp(rate, 0, 0.9);
  };

  // qty 個ぶんの必要量 { materials, parts, units }
  production.requirements = function (state, recipe, qty) {
    function scale(map, mul) {
      var out = {};
      Object.keys(map).forEach(function (k) { out[k] = map[k] * qty * mul; });
      return out;
    }
    return { materials: scale(recipe.materials, state.modifiers.materialMul), parts: scale(recipe.parts, 1), units: scale(recipe.units, 1) };
  };

  // その部品を作る研究が済んでいるか
  production.partUnlocked = function (state, partId) {
    var p = IDX().parts[partId];
    return !!p && (!p.research || !!state.research.done[p.research]);
  };
  // 設備も研究もそろっていて、いま作れる部品か
  production.canMakePart = function (state, partId) {
    var p = IDX().parts[partId];
    return !!p && state.facilities[p.facility] > 0 && production.partUnlocked(state, partId);
  };

  // キューに入れられるか
  production.canQueue = function (state, kind, itemId) {
    var recipe = production.getRecipe(state, kind, itemId);
    if (!recipe) return { ok: false, reason: '品目を選んでください' };
    var fac = IDX().facilities[recipe.facility];
    if (!(state.facilities[recipe.facility] > 0)) return { ok: false, reason: fac.name + 'がありません' };
    if (kind === 'part' && !production.partUnlocked(state, itemId)) return { ok: false, reason: 'この部品はまだ研究していません' };
    if (kind !== 'part' && state.phase < 2) return { ok: false, reason: '機体の組立はまだ解放されていません' };
    if (kind === 'unit' && !state.unlockedUnits[itemId]) return { ok: false, reason: 'このユニットは自社で製造できません(購入のみ)' };
    if (kind === 'aircraft') {
      var need = C().AIRCRAFT_ASSEMBLY.requiresFacility;
      if (need && !(state.facilities[need] > 0)) return { ok: false, reason: IDX().facilities[need].name + 'がありません' };
    }
    return { ok: true, recipe: recipe };
  };

  production.addJob = function (state, kind, itemId, qty) {
    qty = Math.floor(Number(qty));
    if (!(qty >= 1)) return { ok: false, reason: '数量を1以上で入力してください' };
    if (qty > 2000) return { ok: false, reason: '数量が多すぎます(2000まで)' };
    var can = production.canQueue(state, kind, itemId);
    if (!can.ok) return can;
    var r = can.recipe;
    state.jobSeq += 1;
    var job = { id: 'J' + state.jobSeq, kind: kind, itemId: itemId, name: r.name, qty: qty, facility: r.facility,
                workPer: r.work, workTotal: r.work * qty, workDone: 0, started: false, reworked: false, defects: 0,
                status: 'queued', note: '' };
    state.jobs.push(job);
    return { ok: true, job: job };
  };

  function findIndex(state, jobId) {
    for (var i = 0; i < state.jobs.length; i++) if (state.jobs[i].id === jobId) return i;
    return -1;
  }

  // 取り消し。未着手なら何も失わない。着手後は消費した資材・部品・ユニットは戻らない。
  production.cancelJob = function (state, jobId) {
    var i = findIndex(state, jobId);
    if (i < 0) return { ok: false, reason: 'ジョブが見つかりません' };
    var job = state.jobs[i];
    state.jobs.splice(i, 1);
    if (job.started) L.add(state, job.name + ' の生産を中止した(投入済みの資材は戻らない)。', 'warn');
    return { ok: true };
  };

  // 順番の入れ替え。dir = -1(上へ) / +1(下へ)
  production.moveJob = function (state, jobId, dir) {
    var i = findIndex(state, jobId), j = i + dir;
    if (i < 0 || j < 0 || j >= state.jobs.length) return { ok: false };
    var tmp = state.jobs[i]; state.jobs[i] = state.jobs[j]; state.jobs[j] = tmp;
    return { ok: true };
  };

  // 最優先にする(キューの先頭へ)
  production.prioritizeJob = function (state, jobId) {
    var i = findIndex(state, jobId);
    if (i < 0) return { ok: false };
    state.jobs.unshift(state.jobs.splice(i, 1)[0]);
    return { ok: true };
  };

  // 未着手のユニット・機体ジョブが使う予定の部品。自動納入はこのぶんを残す。
  production.reservedParts = function (state) {
    var reserved = {};
    state.jobs.forEach(function (j) {
      if (j.started || j.kind === 'part') return;
      var r = production.getRecipe(state, j.kind, j.itemId);
      if (!r) return;
      Object.keys(r.parts).forEach(function (id) { reserved[id] = (reserved[id] || 0) + r.parts[id] * j.qty; });
    });
    return reserved;
  };

  // 目安の所要日数(その設備を独占できた場合)
  production.estimateDays = function (state, facility, work) {
    var cap = AF.systems.facilities.capacity(state, facility) * AF.systems.workforce.staffFactor(state, [facility]) * C().SHIFTS[state.shift].rate;
    return cap > 0 ? Math.ceil(work / cap) : Infinity;
  };

  // ---- 着手: 必要なものがそろっていれば消費する ----
  function tryStart(state, job) {
    var recipe = production.getRecipe(state, job.kind, job.itemId);
    if (!recipe) { job.status = 'waiting'; job.note = '設計が見つかりません'; return false; }
    var req = production.requirements(state, recipe, job.qty);
    var lacks = [];
    Object.keys(req.units).forEach(function (id) {
      var lack = req.units[id] - (state.inventory.units[id] || 0);
      if (lack > 0) lacks.push(IDX().units[id].name + ' ' + lack);
    });
    Object.keys(req.parts).forEach(function (id) {
      var lack = req.parts[id] - (state.inventory.parts[id] || 0);
      if (lack > 0) lacks.push(IDX().parts[id].name + ' ' + lack);
    });
    if (lacks.length) { job.status = 'waiting'; job.note = '不足: ' + lacks.join('、'); return false; }

    var mat = AF.systems.economy.ensureMaterials(state, req.materials);
    if (!mat.ok) {
      job.status = 'waiting';
      job.note = (mat.noFunds ? '資金不足で仕入れ不可: ' : '資材不足: ') + Object.keys(mat.short).map(function (id) {
        return IDX().materials[id].name + ' ' + U.fmt1(mat.short[id]) + IDX().materials[id].unit;
      }).join('、');
      return false;
    }
    Object.keys(req.units).forEach(function (id) { state.inventory.units[id] -= req.units[id]; });
    Object.keys(req.parts).forEach(function (id) { state.inventory.parts[id] -= req.parts[id]; });
    Object.keys(req.materials).forEach(function (id) { state.materials[id] -= req.materials[id]; });
    job.started = true; job.status = 'active'; job.note = '';
    return true;
  }

  // ---- 完成: 品質判定。不良があれば1回だけ手直しに回す ----
  function finishOrRework(state, job) {
    if (!job.reworked) {
      var recipe = production.getRecipe(state, job.kind, job.itemId);
      var rate = recipe ? production.defectRate(state, recipe) : 0;
      var defects = 0;
      for (var i = 0; i < job.qty; i++) if (U.rand(state) < rate) defects += 1;
      if (defects > 0) {
        job.reworked = true; job.defects = defects; job.status = 'rework';
        job.workTotal += defects * job.workPer * C().QUALITY.reworkRatio;
        job.note = '不良 ' + defects + ' 個を手直し中';
        state.monthStats.defects += defects;
        if (job.kind !== 'part') L.add(state, job.name + ' の検査で不良が見つかった。手直しで納期が延びる。', 'warn');
        return;
      }
    }
    job.status = 'done';
    L.fx(state, 'jobDone', { facility: job.facility, kind: job.kind, itemId: job.itemId, qty: job.qty });
    var inv = state.inventory;
    if (job.kind === 'part') {
      inv.parts[job.itemId] = (inv.parts[job.itemId] || 0) + job.qty;
      state.monthStats.partsProduced += job.qty;
    } else if (job.kind === 'unit') {
      inv.units[job.itemId] = (inv.units[job.itemId] || 0) + job.qty;
      state.monthStats.unitsProduced += job.qty;
    } else {
      inv.aircraft[job.itemId] = (inv.aircraft[job.itemId] || 0) + job.qty;
      state.monthStats.aircraftProduced += job.qty;
      state.totals.aircraftProduced += job.qty;
      L.add(state, '機体「' + job.name + '」が ' + job.qty + ' 機完成した。', 'good');
    }
  }

  // ---- 日次処理 ----
  production.processDay = function (state) {
    if (!state.jobs.length) { state.lastStaffFactor = AF.systems.workforce.staffFactor(state, []); return; }
    var types = {};
    state.jobs.forEach(function (j) { types[j.facility] = true; });
    var typeList = Object.keys(types);
    var staffFactor = AF.systems.workforce.staffFactor(state, typeList);
    var rate = C().SHIFTS[state.shift].rate;
    state.lastStaffFactor = staffFactor;

    typeList.forEach(function (type) {
      // 進捗 += 設備能力 × 人員係数 × 稼働
      var budget = AF.systems.facilities.capacity(state, type) * staffFactor * rate;
      if (budget <= 0) return;
      for (var i = 0; i < state.jobs.length && budget > 1e-9; i++) {
        var job = state.jobs[i];
        if (job.facility !== type || job.status === 'done') continue;
        if (!job.started && !tryStart(state, job)) continue;
        var use = Math.min(budget, job.workTotal - job.workDone);
        job.workDone += use; budget -= use;
        if (job.workDone >= job.workTotal - 1e-9) finishOrRework(state, job);
      }
    });
    state.jobs = state.jobs.filter(function (j) { return j.status !== 'done'; });
  };

  AF.systems.production = production;
})(window.AF);
