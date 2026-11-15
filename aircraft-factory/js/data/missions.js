// 任務(3種)・戦線・結果の区分と文面。段階1ではデータのみで、判定は段階3で systems/missions.js に実装する。
//
// 結果値 = Σ(w_i × 機体の数値_i) + 乱数ε − 敵の強さR
// MISSIONS[].weights: 6数値の重みw / FRONTS[].enemy: [月インデックス, 敵の強さR] の折れ線
// FRONTS[].baseCurve: 史実の基準カーブ [月インデックス, 戦況値0〜100]
// 数値は概算。TODO: 要確認
(function (AF) {
  'use strict';

  AF.data.MISSIONS = [
    { id: 'intercept', name: '迎撃',
      weights: { attack: 0.6, defense: 0.2, maneuver: 0.8, speed: 1.0, range: 0.0, reliability: 0.4 } },
    { id: 'air_superiority', name: '制空',
      weights: { attack: 0.7, defense: 0.3, maneuver: 1.0, speed: 0.6, range: 0.4, reliability: 0.3 } },
    { id: 'ground_attack', name: '対地攻撃',
      weights: { attack: 1.0, defense: 0.8, maneuver: 0.1, speed: 0.1, range: 0.5, reliability: 0.5 } }
  ];

  AF.data.FRONTS = [
    { id: 'west', name: '西部戦線', openMonth: 0,
      baseCurve: [[0, 55], [8, 70], [10, 72], [13, 58], [20, 52], [27, 48]],
      enemy: [[0, 6], [8, 9], [11, 13], [20, 14], [27, 16]] },
    { id: 'east', name: '東部戦線', openMonth: 21, // バルバロッサ作戦で開く(イベントで前後する)
      baseCurve: [[21, 65], [24, 60], [27, 45]],
      enemy: [[21, 8], [24, 11], [27, 14]] }
  ];

  AF.data.WAR = {
    playerMonthlyCap: 5,    // プレイヤーによる戦況値の補正は月±5まで
    playerTotalCap: 15,     // 累計±15まで
    noise: 2,               // 毎月の小さな乱数の幅
    epsilon: 3              // 任務判定の乱数εの幅
  };

  // 結果の区分。min 以上でその結果になる(上から順に判定)。
  AF.data.MISSION_OUTCOMES = [
    { id: 'great',    name: '大成功', min: 6,         war: 2,  rating: 2,  followUp: 'extra_order',
      texts: [
        '納入機は期待を上回る働きを見せた。部隊から追加の要望が届いている。',
        '搭乗員の報告は上々だ。「この機体なら任せられる」との声。',
        '作戦は完全に成功した。航空省の担当官が工場の名を覚えた。'
      ] },
    { id: 'success',  name: '成功',   min: 0,         war: 1,  rating: 1,  followUp: null,
      texts: [
        '納入機は任務を果たした。目立った不具合の報告はない。',
        '作戦は予定どおりに進んだ。機体は部隊に受け入れられている。',
        '損害は軽く、任務は達成された。'
      ] },
    { id: 'struggle', name: '苦戦',   min: -6,        war: -1, rating: 0,  followUp: 'improvement_request',
      texts: [
        '納入機は苦しい戦いを強いられた。部隊から改善の要求が来ている。',
        '任務は半ばで切り上げられた。性能の不足が指摘されている。',
        '稼働率が上がらない、との報告。整備側から注文が付いた。'
      ] },
    { id: 'failure',  name: '失敗',   min: -Infinity, war: -2, rating: -2, followUp: 'contract_review',
      texts: [
        '納入機は任務を果たせなかった。航空省は契約の見直しを通告してきた。',
        '損害が大きく、作戦は中止された。工場への視線は厳しい。',
        '部隊は機体の受け取りを渋っている。次の契約は減らされるだろう。'
      ] }
  ];
})(window.AF);
