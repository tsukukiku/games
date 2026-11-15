// 【ひな形・段階2で実装】戦況値。データは js/data/missions.js の FRONTS / WAR、状態は state.war。
//   state.war.fronts[戦線id] = { open, value(0〜100), playerTotal(プレイヤー補正の累計) }
//   state.war.deliveredThisMonth = 今月の納入機の記録(contracts.deliver が積む)
(function (AF) {
  'use strict';
  var U = AF.core.util;
  var war = {};

  // 史実の基準カーブの値
  war.baseValue = function (frontId, monthIndex) {
    return U.curveAt(AF.data.index.fronts[frontId].baseCurve, monthIndex);
  };

  // 月末に monthEnd.run から呼ばれる。
  // TODO(段階2): 毎月の戦況値 = 基準カーブの変化 + 納入機の戦力と数による補正 + 小さな乱数。
  //   プレイヤーの補正は月±WAR.playerMonthlyCap、累計±WAR.playerTotalCap まで。
  //   任務判定(段階3)の結果もここで戦況値に反映する。
  war.updateMonthly = function (state) {
    // 段階1: 納入記録を履歴へ移すだけ(任務判定はまだ行わない)
    var log = state.war.deliveredLog;
    state.war.deliveredThisMonth.forEach(function (rec) { log.push(rec); });
    if (log.length > 200) log.splice(0, log.length - 200);
    state.war.deliveredThisMonth = [];
  };

  AF.systems.war = war;
})(window.AF);
