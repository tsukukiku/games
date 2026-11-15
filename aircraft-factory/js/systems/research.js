// 研究ツリー。データは js/data/research.js、状態は state.research。
//   state.research = { done: {ノードid: true}, active: [{id, daysLeft, days}], slots: 同時進行数, revealed: {条件解放ノードid: true} }
(function (AF) {
  'use strict';
  var U = AF.core.util, L = AF.core.log;
  var research = {};
  function IDX() { return AF.data.index; }

  // 着手できない理由の一覧(空なら着手できる)
  research.blockers = function (state, node) {
    var out = [], c = node.cost;
    node.requires.forEach(function (id) { if (!state.research.done[id]) out.push('前提: ' + IDX().research[id].name); });
    (c.facilities || []).forEach(function (id) { if (!(state.facilities[id] > 0)) out.push(IDX().facilities[id].name + 'が必要'); });
    if (c.rlmRating && state.rlmRating < c.rlmRating) out.push('RLM評価 ' + c.rlmRating + ' 以上');
    if (c.relation && (state.relations[c.relation.company] || 0) < c.relation.min) {
      out.push(IDX().companies[c.relation.company].name + 'との関係 ' + c.relation.min + ' 以上');
    }
    return out;
  };

  // ノードの状態: 'done' / 'active' / 'available' / 'blocked' / 'hidden'(条件解放で未公開)
  research.nodeStatus = function (state, nodeId) {
    var node = IDX().research[nodeId];
    if (!node) return 'hidden';
    if (state.research.done[nodeId]) return 'done';
    if (research.activeEntry(state, nodeId)) return 'active';
    if (node.source === 'conditional' && !state.research.revealed[nodeId]) return 'hidden';
    return research.blockers(state, node).length ? 'blocked' : 'available';
  };
  research.activeEntry = function (state, nodeId) {
    return state.research.active.filter(function (a) { return a.id === nodeId; })[0] || null;
  };

  research.start = function (state, nodeId) {
    var node = IDX().research[nodeId], status = research.nodeStatus(state, nodeId);
    if (status === 'done' || status === 'active') return { ok: false, reason: 'すでに研究済みか、研究中です' };
    if (status === 'hidden') return { ok: false, reason: 'まだ研究できません' };
    if (status === 'blocked') return { ok: false, reason: research.blockers(state, node).join('、') };
    if (state.research.active.length >= state.research.slots) return { ok: false, reason: '同時に進められる研究は ' + state.research.slots + ' 件までです' };
    if (!AF.systems.economy.canAfford(state, node.cost.funds)) return { ok: false, reason: '資金が不足しています' };
    AF.systems.economy.spend(state, node.cost.funds, node.source === 'license' ? 'license' : 'research');
    state.research.active.push({ id: nodeId, daysLeft: node.cost.days, days: node.cost.days });
    L.add(state, '研究「' + node.name + '」を始めた(' + node.cost.days + '日)。', 'info');
    return { ok: true };
  };

  // 完了時の効果
  research.applyUnlocks = function (state, node) {
    var u = node.unlocks || {};
    (u.units || []).forEach(function (id) { state.unlockedUnits[id] = true; });
    Object.keys(u.facilityMods || {}).forEach(function (fid) {
      var cur = state.facilityMods[fid] || { capMul: 1 };
      cur.capMul = (cur.capMul || 1) * (u.facilityMods[fid].capMul || 1);
      state.facilityMods[fid] = cur;
    });
    if (u.researchSlots) state.research.slots += u.researchSlots;
    if (u.materialMul) state.modifiers.materialMul *= u.materialMul;
    if (u.defectMul) state.modifiers.defectMul *= u.defectMul;
    if (u.partPrice) state.modifiers.partPrice *= u.partPrice;
    // u.parts は production.partUnlocked が state.research.done を見るので、ここでは何もしない
  };

  research.complete = function (state, nodeId) {
    var node = IDX().research[nodeId];
    state.research.done[nodeId] = true;
    state.research.active = state.research.active.filter(function (a) { return a.id !== nodeId; });
    research.applyUnlocks(state, node);
    L.add(state, '研究「' + node.name + '」が完了した。' + node.desc + '。', 'good');
    L.fx(state, 'research', { id: nodeId });
  };

  // 条件解放ノードの公開判定
  research.checkConditional = function (state) {
    var mi = U.monthIndex(state.day);
    AF.data.RESEARCH.forEach(function (node) {
      if (node.source !== 'conditional' || state.research.revealed[node.id]) return;
      var c = node.condition || {};
      if (c.minMonth != null && mi < c.minMonth) return;
      if (c.minRating != null && state.rlmRating < c.minRating) return;
      if (c.materialScarcity && AF.systems.economy.scarcity(state, c.materialScarcity.material) >= c.materialScarcity.below) return;
      // TODO(戦況の実装後): c.front / c.minWarValue を state.war.fronts で判定する
      state.research.revealed[node.id] = true;
      L.add(state, '新しい研究「' + node.name + '」が研究ツリーに現れた。', 'good');
    });
  };

  // ライセンス料: 許諾で製造できるようになったユニットを含む機体の売上から、許諾元へ払う
  research.royaltyFor = function (state, slots, revenue) {
    var rate = 0;
    AF.data.RESEARCH.forEach(function (node) {
      if (!node.cost.royaltyRate || !state.research.done[node.id]) return;
      var used = (node.unlocks.units || []).some(function (uid) {
        return AF.data.CONFIG.SLOTS.some(function (s) { return slots[s.id] === uid; });
      });
      if (used) rate += node.cost.royaltyRate;
    });
    return revenue * Math.min(rate, 0.25);
  };
  // TODO(ライバルの実装後): 許諾元との関係が悪化したら許諾を打ち切る

  // 日次: 研究を1日進める
  research.processDay = function (state) {
    state.research.active.slice().forEach(function (a) {
      a.daysLeft -= 1;
      if (a.daysLeft <= 0) research.complete(state, a.id);
    });
    if (state.day % 5 === 0) research.checkConditional(state);
  };

  // 月末に monthEnd.run から呼ばれる(いまは日次で進めているので何もしない)
  research.updateMonthly = function (state) {};

  AF.systems.research = research;
})(window.AF);
