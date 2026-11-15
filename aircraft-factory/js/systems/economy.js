// 資金と資材。収支の記帳、資材の割当枠と仕入れ、月次の固定費、倒産判定。
(function (AF) {
  'use strict';
  var U = AF.core.util, L = AF.core.log;
  var economy = {};
  function C() { return AF.data.CONFIG; }
  function IDX() { return AF.data.index; }

  // ---- 記帳。cat は月報の科目になる ----
  economy.earn = function (state, amount, cat) {
    state.funds += amount;
    state.ledger.income[cat] = (state.ledger.income[cat] || 0) + amount;
    state.totals.revenue += amount;
  };
  economy.spend = function (state, amount, cat) {
    state.funds -= amount;
    state.ledger.expense[cat] = (state.ledger.expense[cat] || 0) + amount;
  };
  // useCredit=true のとき、CREDIT_LIMIT までのマイナスを許す(資材の仕入れ用)
  economy.canAfford = function (state, amount, useCredit) {
    return state.funds - amount >= (useCredit ? -C().CREDIT_LIMIT : 0);
  };

  // ---- 資材の割当 ----
  // 逼迫度(1=平常)。月が進むほど下がる。イベントの補正は state.modifiers で掛かる。
  economy.scarcity = function (state, matId) {
    var m = IDX().materials[matId];
    var mod = matId === 'alloy' ? state.modifiers.alloyQuota : 1;
    return U.curveAt(m.quotaCurve, U.monthIndex(state.day)) * mod;
  };
  economy.monthlyQuota = function (state, matId) {
    var Q = C().QUOTA;
    var m = IDX().materials[matId];
    var size = 1 + Q.perFacility * Math.max(0, AF.systems.facilities.totalCount(state) - 1);
    var rating = Q.ratingBase + (1 - Q.ratingBase) * (state.rlmRating / 50);
    return Math.round(m.baseQuota * economy.scarcity(state, matId) * size * rating);
  };
  economy.refreshMonthlyQuota = function (state) {
    AF.data.MATERIALS.forEach(function (m) { state.quotaBase[m.id] = economy.monthlyQuota(state, m.id); });
  };
  economy.quotaAvailable = function (state, matId) {
    return (state.quotaBase[matId] || 0) + (state.quotaGrant[matId] || 0);
  };
  // 契約に付く割当枠を足す。grants = { 資材id: 量 }
  economy.addGrant = function (state, grants) {
    Object.keys(grants).forEach(function (id) {
      state.quotaGrant[id] = (state.quotaGrant[id] || 0) + Math.round(grants[id]);
    });
  };

  // 割当枠の範囲で資材を買う
  economy.buyMaterial = function (state, matId, qty) {
    var m = IDX().materials[matId];
    qty = Math.min(Math.floor(qty), Math.floor(economy.quotaAvailable(state, matId)));
    if (!(qty > 0)) return { ok: false, reason: m.name + 'の割当枠が残っていません' };
    var cost = qty * m.price;
    if (!economy.canAfford(state, cost, true)) return { ok: false, reason: '資金が不足しています' };
    var fromBase = Math.min(qty, state.quotaBase[matId] || 0);
    state.quotaBase[matId] -= fromBase;
    state.quotaGrant[matId] -= (qty - fromBase);
    state.materials[matId] = (state.materials[matId] || 0) + qty;
    economy.spend(state, cost, 'materials');
    return { ok: true, qty: qty, cost: cost };
  };

  // needs = { 資材id: 量 } が在庫にあるか調べ、足りなければ(自動購入が有効なら)割当枠から買う。
  // 戻り値 { ok, short: {資材id: 不足量} }
  economy.ensureMaterials = function (state, needs) {
    var short = {}, cost = 0, possible = true;
    Object.keys(needs).forEach(function (id) {
      var lack = needs[id] - (state.materials[id] || 0);
      if (lack > 1e-9) {
        short[id] = lack;
        if (!state.autoBuy || Math.ceil(lack) > Math.floor(economy.quotaAvailable(state, id))) possible = false;
        cost += Math.ceil(lack) * IDX().materials[id].price;
      }
    });
    if (!Object.keys(short).length) return { ok: true, short: {} };
    if (!possible) return { ok: false, short: short };
    if (!economy.canAfford(state, cost, true)) return { ok: false, short: short, noFunds: true };
    Object.keys(short).forEach(function (id) { economy.buyMaterial(state, id, Math.ceil(short[id])); });
    return { ok: true, short: {} };
  };

  // ---- 月次の固定費 ----
  // 月給(人手不足で少しずつ上がる)。monthIndex 省略時は今月。
  economy.wage = function (state, type, monthIndex) {
    var mi = monthIndex == null ? U.monthIndex(state.day) : monthIndex;
    return C().WAGES[type] * (1 + C().WAGE_GROWTH_PER_MONTH * mi);
  };
  economy.monthlyCosts = function (state, monthIndex) {
    var shift = C().SHIFTS[state.shift];
    var wages = (state.staff.skilled * economy.wage(state, 'skilled', monthIndex) +
                 state.staff.general * economy.wage(state, 'general', monthIndex)) * shift.wageMul;
    var upkeep = 0, n = 0;
    AF.data.FACILITIES.forEach(function (f) {
      var c = state.facilities[f.id] || 0;
      upkeep += c * f.upkeep; n += c;
    });
    var overhead = C().OVERHEAD_PER_MONTH + C().OVERHEAD_PER_FACILITY * n;
    var interest = state.funds < 0 ? -state.funds * C().OVERDRAFT_INTEREST : 0;
    return { wages: wages, upkeep: upkeep, overhead: overhead, interest: interest };
  };

  // ---- 日次: 倒産判定(資金マイナスが続いた日数) ----
  economy.processDay = function (state) {
    if (state.funds < 0) {
      state.negativeDays += 1;
      var limit = C().BANKRUPTCY_DAYS;
      if (state.negativeDays === 1) L.add(state, '資金がマイナスになった。' + limit + '日続くと倒産する。', 'bad');
      else if (state.negativeDays === Math.floor(limit / 2)) L.add(state, '資金難が続いている。あと' + (limit - state.negativeDays) + '日で倒産する。', 'bad');
      if (state.negativeDays >= limit) {
        state.bankrupt = true;
        L.add(state, '資金が尽き、会社は倒産した。', 'bad');
      }
    } else {
      state.negativeDays = 0;
    }
  };

  AF.systems.economy = economy;
})(window.AF);
