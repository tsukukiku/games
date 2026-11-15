// 人員。雇用・解雇と、生産に掛かる人員係数。
(function (AF) {
  'use strict';
  var U = AF.core.util;
  var workforce = {};
  function C() { return AF.data.CONFIG; }

  // 設備の種類 types を動かすのに必要な人員。types 省略時は保有する全設備。
  workforce.required = function (state, types) {
    var need = { skilled: 0, general: 0 };
    AF.data.FACILITIES.forEach(function (f) {
      var n = state.facilities[f.id] || 0;
      if (!n) return;
      if (types && types.indexOf(f.id) < 0 && !f.alwaysStaffed) return;
      need.skilled += n * f.staff.skilled;
      need.general += n * f.staff.general;
    });
    return need;
  };

  // 人員係数(MIN_STAFF_FACTOR〜1)。今日ジョブのある設備 + 常時人員の要る設備に対する充足率。
  workforce.staffFactor = function (state, activeTypes) {
    var need = workforce.required(state, activeTypes || []);
    var W = C().STAFF_WEIGHT;
    var fs = need.skilled ? Math.min(1, state.staff.skilled / need.skilled) : 1;
    var fg = need.general ? Math.min(1, state.staff.general / need.general) : 1;
    return U.clamp(W.skilled * fs + W.general * fg, C().MIN_STAFF_FACTOR, 1);
  };

  workforce.hire = function (state, type, n) {
    n = n || 1;
    if ((state.hirePool[type] || 0) < n) return { ok: false, reason: '今月はこれ以上採用できません' };
    var cost = C().HIRE_COST[type] * n;
    if (!AF.systems.economy.canAfford(state, cost)) return { ok: false, reason: '資金が不足しています' };
    state.hirePool[type] -= n;
    state.staff[type] += n;
    AF.systems.economy.spend(state, cost, 'hiring');
    return { ok: true };
  };

  workforce.fire = function (state, type, n) {
    n = n || 1;
    if (state.staff[type] < n) return { ok: false, reason: 'これ以上減らせません' };
    state.staff[type] -= n;
    return { ok: true };
  };

  // 月初: 採用枠を戻す
  workforce.refreshPool = function (state) {
    var P = C().HIRE_POOL;
    state.hirePool = {
      skilled: Math.max(1, Math.round(P.skilled * state.modifiers.laborPool)),
      general: Math.max(1, Math.round(P.general * state.modifiers.laborPool))
    };
  };

  AF.systems.workforce = workforce;
})(window.AF);
