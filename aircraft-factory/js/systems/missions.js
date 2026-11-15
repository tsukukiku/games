// 【ひな形・段階3で実装】任務判定。データは js/data/missions.js。
//   結果値 = Σ(w_i × 機体の数値_i) + 乱数ε − 敵の強さR
(function (AF) {
  'use strict';
  var U = AF.core.util;
  var missions = {};

  // 結果値の計算(乱数εは呼び出し側で渡す)。固有特性の補正は computeAircraftStats が加える。
  missions.resultValue = function (slots, missionId, enemyStrength, epsilon) {
    var mission = AF.data.index.missions[missionId];
    var calc = AF.systems.aircraft.computeAircraftStats(slots, { mission: missionId });
    var sum = 0;
    AF.data.CONFIG.STATS.forEach(function (s) { sum += (mission.weights[s.id] || 0) * calc.stats[s.id]; });
    return sum + (epsilon || 0) - enemyStrength;
  };

  // 結果値から区分(大成功・成功・苦戦・失敗)を引く
  missions.outcomeFor = function (value) {
    var list = AF.data.MISSION_OUTCOMES;
    for (var i = 0; i < list.length; i++) if (value >= list[i].min) return list[i];
    return list[list.length - 1];
  };

  // 敵の強さ(戦線と時期ごと)
  missions.enemyStrength = function (frontId, monthIndex) {
    return U.curveAt(AF.data.index.fronts[frontId].enemy, monthIndex);
  };

  // 月末に monthEnd.run から呼ばれる。
  // TODO(段階3): state.war.deliveredThisMonth の納入機を、開いている戦線の任務(迎撃・制空・対地攻撃)へ
  //   自動で振り分け、resultValue → outcomeFor で判定する。結果ごとに、戦況値・RLM評価・追加注文/改善要求/契約見直しを
  //   反映し、outcome.texts から1つ選んで月報に載せる。戻り値は月報用の配列 [{mission, front, outcome, text}]。
  missions.resolveMonthly = function (state) { return []; };

  AF.systems.missions = missions;
})(window.AF);
