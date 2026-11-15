// 月末の集計(固定費の支払い、月報の作成)と、月初の準備(割当・採用枠・契約提示)。
(function (AF) {
  'use strict';
  var U = AF.core.util, L = AF.core.log;
  var monthEnd = {};

  // 月報の科目名
  monthEnd.LEDGER_LABELS = {
    parts: '部品の契約', spot: '部品のスポット販売', aircraft: '機体の納入', advance: '機体契約の前渡金',
    advanceReturn: '前渡金の返還',
    materials: '資材', units: 'ユニットの購入', facilities: '設備の購入', hiring: '採用費',
    wages: '賃金', upkeep: '設備の維持費', overhead: '固定費', interest: '借越の利息',
    refunds: 'クレームの返金', penalties: '違約金', research: '研究', license: 'ライセンス料'
  };

  function sum(map) { return Object.keys(map).reduce(function (a, k) { return a + map[k]; }, 0); }

  // state.day はすでに翌月1日を指している状態で呼ばれる
  monthEnd.run = function (state) {
    var eco = AF.systems.economy;
    var monthIndex = U.monthIndex(state.day) - 1;

    // 1) 固定費
    var costs = eco.monthlyCosts(state, monthIndex);
    eco.spend(state, costs.wages, 'wages');
    eco.spend(state, costs.upkeep, 'upkeep');
    eco.spend(state, costs.overhead, 'overhead');
    if (costs.interest > 0) eco.spend(state, costs.interest, 'interest');

    // 2) 後の段階の月次処理(段階1ではほぼ何もしない)
    var missionResults = AF.systems.missions.resolveMonthly(state);
    AF.systems.war.updateMonthly(state);
    AF.systems.events.updateMonthly(state);
    AF.systems.rivals.updateMonthly(state);
    AF.systems.research.updateMonthly(state);

    // 3) 月報
    var income = sum(state.ledger.income), expense = sum(state.ledger.expense);
    var report = {
      monthIndex: monthIndex,
      label: U.formatMonth(monthIndex),
      income: state.ledger.income,
      expense: state.ledger.expense,
      incomeTotal: income,
      expenseTotal: expense,
      net: income - expense,
      fundsEnd: state.funds,
      stats: state.monthStats,
      rlmRating: state.rlmRating,
      ratingDelta: state.rlmRating - state.monthStartRating,
      phase: state.phase,
      missions: missionResults || []
    };
    state.reports.push(report);
    L.add(state, report.label + 'の月報: 損益 ' + (report.net >= 0 ? '+' : '') + U.money(report.net) + '、資金 ' + U.money(state.funds) + '。',
          report.net >= 0 ? 'good' : 'warn');

    // 4) 集計のリセット
    state.ledger = { income: {}, expense: {} };
    state.monthStats = AF.core.state.newMonthStats();

    // 5) 期間終了、または翌月の準備
    if (state.day >= U.totalDays()) {
      state.finished = true;
      state.score = AF.systems.progression.computeScore(state);
      L.add(state, '1941年12月が終わった。ここで一区切りとする。', 'info');
    } else {
      monthEnd.startMonth(state);
    }
    return report;
  };

  // 月初: 資材の割当枠、採用枠、ユニット市場、スポットの枠を戻し、契約を提示する
  monthEnd.startMonth = function (state) {
    state.monthStartRating = state.rlmRating;
    AF.systems.economy.refreshMonthlyQuota(state);
    AF.systems.workforce.refreshPool(state);
    AF.systems.aircraft.refreshUnitMarket(state);
    state.spotSold = {};
    AF.systems.contracts.generateMonthlyOffers(state);
  };

  AF.systems.monthEnd = monthEnd;
})(window.AF);
