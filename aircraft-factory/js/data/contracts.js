// 市場規模と、機体契約のひな形。
(function (AF) {
  'use strict';

  AF.data.MARKET = {
    // RLMの総発注量(機/月)の目安。[月インデックス, 機数]。需要倍率は初月との比で使う。
    // TODO: 要確認(ドイツ全体の航空機生産数)
    aircraftCurve: [[0, 700], [4, 750], [8, 900], [12, 950], [16, 1000], [21, 1100], [27, 1300]],
    // 部品市場の規模(RM/月)。市場シェアの分母に使う仮の値。
    partsValuePerMonth: 2000000
  };

  // 機体契約のひな形。minSpec は6数値の最低条件(null は条件なし)。
  // fromMonth: 出現し始める月 / weight: 出やすさ / qty: 数量の範囲
  // grant: 受注時に付く1機あたりの資材の契約割当 / mission, role: 段階2の需要イベントと任務判定で使う
  function spec(attack, defense, maneuver, speed, range, reliability) {
    return { attack: attack, defense: defense, maneuver: maneuver, speed: speed, range: range, reliability: reliability };
  }
  var GRANT = { alloy: 500, steel: 300, wood: 30, fuel: 60 };

  AF.data.AIRCRAFT_SPECS = [
    { id: 'light_fighter', name: '軽戦闘機', mission: 'air_superiority', role: 'fighter',
      fromMonth: 0, weight: 3, minSpec: spec(3, null, 4, null, null, 4), price: 14200, qty: [1, 2], grant: GRANT },
    { id: 'light_attacker', name: '軽攻撃機', mission: 'ground_attack', role: 'attacker',
      fromMonth: 0, weight: 3, minSpec: spec(4, 2, null, null, null, 5), price: 14200, qty: [1, 2], grant: GRANT },
    { id: 'interceptor', name: '迎撃戦闘機', mission: 'intercept', role: 'fighter',
      fromMonth: 5, weight: 2, minSpec: spec(4, null, 5, 7, null, null), price: 19000, qty: [1, 3], grant: GRANT },
    { id: 'ground_attacker', name: '対地攻撃機', mission: 'ground_attack', role: 'attacker',
      fromMonth: 7, weight: 2, minSpec: spec(9, 6, null, null, 4, 4), price: 18000, qty: [1, 3], grant: GRANT },
    { id: 'air_superiority', name: '制空戦闘機', mission: 'air_superiority', role: 'fighter',
      fromMonth: 14, weight: 2, minSpec: spec(6, null, 7, 8, 3, null), price: 20500, qty: [1, 3], grant: GRANT }
  ];
})(window.AF);
