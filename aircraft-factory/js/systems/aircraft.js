// 機体(キメラ)。合計値の計算、役割、設計の保存、ユニットの入手可否と購入。
(function (AF) {
  'use strict';
  var U = AF.core.util;
  var aircraft = {};
  function C() { return AF.data.CONFIG; }
  function IDX() { return AF.data.index; }

  // ★ 機体の合計値を計算する処理はここ1か所。
  //   重量・出力の適合ルールを足すときは、この関数の中に追加する。
  //   slots = { engine, fuselage, wing, armament, avionics } (ユニットid)
  //   ctx.mission を渡すと、その任務での固有特性の補正を加える(任務判定用)。
  //   戻り値 { stats, total, traits, complete }
  aircraft.computeAircraftStats = function (slots, ctx) {
    var stats = {};
    C().STATS.forEach(function (s) { stats[s.id] = 0; });
    var traits = [], complete = true;

    C().SLOTS.forEach(function (slot) {
      var unit = IDX().units[slots && slots[slot.id]];
      if (!unit) { complete = false; return; }
      C().STATS.forEach(function (s) { stats[s.id] += unit.stats[s.id] || 0; });
      if (unit.trait) traits.push({ unitId: unit.id, label: unit.trait.label, mission: unit.trait.mission, stat: unit.trait.stat, mod: unit.trait.mod });
    });

    if (ctx && ctx.mission) {
      traits.forEach(function (t) { if (t.mission === ctx.mission) stats[t.stat] += t.mod; });
    }
    // TODO(後の段階): 重量・出力の適合ルールによる補正をここに入れる

    var total = 0;
    C().STATS.forEach(function (s) { total += stats[s.id]; });
    return { stats: stats, total: total, traits: traits, complete: complete };
  };

  // 役割の自動判定。戦闘機=機動と速度が高い、攻撃機=攻撃と防御が高い。
  aircraft.getRole = function (stats) {
    var R = C().ROLES;
    function sum(keys) { return keys.reduce(function (a, k) { return a + stats[k]; }, 0); }
    var id = sum(R.fighter.stats) >= sum(R.attacker.stats) ? 'fighter' : 'attacker';
    return { id: id, name: R[id].name };
  };

  // 最低仕様を満たすか。minSpec の null は条件なし。
  aircraft.meetsSpec = function (stats, minSpec) {
    return C().STATS.every(function (s) { return minSpec[s.id] == null || stats[s.id] >= minSpec[s.id]; });
  };

  // 目安価格(RM)
  aircraft.basePrice = function (total) {
    var P = C().AIRCRAFT_PRICE;
    return P.base + P.perPoint * total;
  };

  // ---- ユニットの入手 ----
  // 'make'(自社製造できる) / 'buy'(購入のみ) / 'locked'(未解放)
  aircraft.unitAvailability = function (state, unitId) {
    var u = IDX().units[unitId];
    if (!u) return 'locked';
    if (state.unlockedUnits[unitId]) return 'make';
    if (aircraft.canBuyUnit(state, unitId).ok) return 'buy';
    return 'locked';
  };
  aircraft.canBuyUnit = function (state, unitId) {
    var u = IDX().units[unitId];
    if (!u || !u.purchasable) return { ok: false, reason: 'まだ市場に出ていません' };
    if (u.supplier !== 'market') {
      var rel = state.relations[u.supplier];
      if (rel != null && rel < C().UNIT_BUY_MIN_RELATION) {
        return { ok: false, reason: IDX().companies[u.supplier].name + 'との関係が悪く、売ってもらえません' };
      }
    }
    return { ok: true };
  };
  aircraft.buyUnit = function (state, unitId, qty) {
    qty = qty || 1;
    var u = IDX().units[unitId];
    if (state.phase < 2) return { ok: false, reason: '機体の組立が解放されてから購入できます' };
    var can = aircraft.canBuyUnit(state, unitId);
    if (!can.ok) return can;
    if ((state.unitMarket[unitId] || 0) < qty) return { ok: false, reason: '今月の供給はもうありません' };
    var cost = u.buyPrice * qty;
    if (!AF.systems.economy.canAfford(state, cost)) return { ok: false, reason: '資金が不足しています' };
    AF.systems.economy.spend(state, cost, 'units');
    state.unitMarket[unitId] -= qty;
    state.inventory.units[unitId] = (state.inventory.units[unitId] || 0) + qty;
    return { ok: true };
  };
  // 月初: ユニット市場の供給を戻す
  aircraft.refreshUnitMarket = function (state) {
    AF.data.UNITS.forEach(function (u) { state.unitMarket[u.id] = u.purchasable ? u.marketSupply : 0; });
  };

  // ---- 設計 ----
  aircraft.getDesign = function (state, id) {
    for (var i = 0; i < state.designs.length; i++) if (state.designs[i].id === id) return state.designs[i];
    return null;
  };
  // design = { id?, name, slots }。id があれば上書き、なければ新規。
  aircraft.saveDesign = function (state, design) {
    var name = String(design.name || '').trim().slice(0, 30);
    if (!name) return { ok: false, reason: '機体の名前を入力してください' };
    var slots = {}, missing = false, locked = null;
    C().SLOTS.forEach(function (slot) {
      var id = design.slots && design.slots[slot.id];
      if (!IDX().units[id] || IDX().units[id].slot !== slot.id) { missing = true; return; }
      if (aircraft.unitAvailability(state, id) === 'locked') locked = IDX().units[id];
      slots[slot.id] = id;
    });
    if (missing) return { ok: false, reason: '5つのスロットすべてにユニットを選んでください' };
    if (locked) return { ok: false, reason: locked.name + 'はまだ使えません' };

    var existing = design.id ? aircraft.getDesign(state, design.id) : null;
    if (existing) {
      var changed = C().SLOTS.some(function (slot) { return existing.slots[slot.id] !== slots[slot.id]; });
      if (changed && aircraft.designInUse(state, existing.id)) {
        return { ok: false, reason: '在庫や生産中の機体がある設計は、構成を変えられません(別名で新規保存してください)' };
      }
      existing.name = name;
      existing.slots = slots;
      return { ok: true, id: existing.id };
    }
    state.designSeq += 1;
    var id = 'D' + state.designSeq;
    state.designs.push({ id: id, name: name, slots: slots });
    return { ok: true, id: id };
  };
  aircraft.designInUse = function (state, id) {
    if ((state.inventory.aircraft[id] || 0) > 0) return true;
    return state.jobs.some(function (j) { return j.kind === 'aircraft' && j.itemId === id; });
  };
  aircraft.deleteDesign = function (state, id) {
    if (aircraft.designInUse(state, id)) return { ok: false, reason: '在庫や生産中の機体がある設計は削除できません' };
    state.designs = state.designs.filter(function (d) { return d.id !== id; });
    return { ok: true };
  };

  // 最低仕様を満たす設計の一覧(合計値の低い順)
  aircraft.eligibleDesigns = function (state, minSpec) {
    return state.designs.map(function (d) {
      return { design: d, calc: aircraft.computeAircraftStats(d.slots) };
    }).filter(function (x) {
      return x.calc.complete && aircraft.meetsSpec(x.calc.stats, minSpec);
    }).sort(function (a, b) { return a.calc.total - b.calc.total; });
  };

  // 設計の費用の目安: ユニットを全部買う場合と、直接の工数
  aircraft.designCost = function (slots) {
    var buy = 0, work = C().AIRCRAFT_ASSEMBLY.work, buyable = true;
    C().SLOTS.forEach(function (slot) {
      var u = IDX().units[slots[slot.id]];
      if (!u) return;
      buy += u.buyPrice; work += u.work;
      if (!u.purchasable) buyable = false;
    });
    return { buyCost: buy, work: work, allPurchasable: buyable };
  };

  AF.systems.aircraft = aircraft;
})(window.AF);
