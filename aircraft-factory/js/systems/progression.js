// 進行。フェーズ2(機体の組立)の解放と、最終スコア。
(function (AF) {
  'use strict';
  var U = AF.core.util;
  var progression = {};
  function C() { return AF.data.CONFIG; }

  // 解放条件の達成状況(画面表示にも使う)
  progression.phase2Status = function (state) {
    var P = C().PHASE2;
    var items = P.facilities.map(function (id) {
      return { label: AF.data.index.facilities[id].name + 'を購入', ok: (state.facilities[id] || 0) > 0 };
    });
    items.push({ label: 'RLM評価 ' + P.rlmRating + ' 以上(現在 ' + Math.floor(state.rlmRating) + ')', ok: state.rlmRating >= P.rlmRating });
    return { items: items, ok: items.every(function (i) { return i.ok; }) };
  };

  progression.checkPhase2 = function (state) {
    if (state.phase >= 2) return;
    if (!progression.phase2Status(state).ok) return;
    state.phase = 2;
    AF.systems.contracts.addAircraftOffers(state);
    AF.core.log.fx(state, 'phase2', {});
    AF.core.log.add(state, '機体の組立が解放された。ユニットを作り(または買い)、機体を設計して納入できる。受注タブに機体の契約が届いている。', 'good');
  };

  // 最終スコア = 市場シェア + 総生産機数 + 研究済みノード数 + 戦況への貢献 (配点は仮)
  progression.computeScore = function (state) {
    var months = Math.max(1, Math.min(C().TOTAL_MONTHS, U.monthIndex(state.day)));
    var marketAircraft = 0;
    for (var m = 0; m < months; m++) marketAircraft += U.curveAt(AF.data.MARKET.aircraftCurve, m);
    var aircraftShare = marketAircraft ? state.totals.aircraftDelivered / marketAircraft * 100 : 0;
    var partsShare = state.totals.partsRevenue / (AF.data.MARKET.partsValuePerMonth * months) * 100;
    var researchCount = Object.keys(state.research.done).length;
    var contribution = state.war.contribution;
    var total = Math.round(aircraftShare * 1000 + partsShare * 300 + state.totals.aircraftProduced * 10 + researchCount * 20 + contribution * 10);
    return { aircraftShare: aircraftShare, partsShare: partsShare, aircraftProduced: state.totals.aircraftProduced,
             aircraftDelivered: state.totals.aircraftDelivered, researchCount: researchCount, contribution: contribution, total: total };
  };

  AF.systems.progression = progression;
})(window.AF);
