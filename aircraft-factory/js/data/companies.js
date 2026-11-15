// 企業と発注元。type: rival(ライバル5社) / supplier(供給元) / agency(官公庁など、関係値を持たない)
// stats: 生産能力・技術力・対RLM評価(0〜100)。timeline: 史実に合わせた変化(段階2で systems/rivals.js が使う)
// buysParts/partWeight/priceMul: 部品契約の発注元になるか、その頻度と単価倍率
(function (AF) {
  'use strict';

  AF.data.COMPANIES = [
    { id: 'rlm', type: 'agency', name: 'RLM(航空省)', focus: '発注元・下請けの斡旋',
      buysParts: true, partWeight: 3, priceMul: 1.0, buysAircraft: true },
    { id: 'depot', type: 'agency', name: '修理・補給廠', focus: '修理・補給用の部品',
      buysParts: true, partWeight: 2, priceMul: 0.96, buysAircraft: false },

    { id: 'messerschmitt', type: 'rival', name: 'Messerschmitt', focus: '戦闘機・量産',
      buysParts: true, partWeight: 2, priceMul: 1.06,
      stats: { capacity: 70, tech: 75, rlmRating: 80 },
      timeline: [ // TODO: 要確認(時期)
        { month: 8,  delta: { capacity: 5 },  note: 'Bf 109Eの増産' },
        { month: 16, delta: { tech: 8 },      note: 'Bf 109Fの配備' }
      ] },
    { id: 'junkers', type: 'rival', name: 'Junkers', focus: '爆撃機・エンジン',
      buysParts: true, partWeight: 2, priceMul: 1.05,
      stats: { capacity: 85, tech: 70, rlmRating: 78 },
      timeline: [
        { month: 6,  delta: { capacity: 5 }, note: '生産の拡大' },
        { month: 20, delta: { tech: 5 },     note: 'Ju 87の改良型' }
      ] },
    { id: 'heinkel', type: 'rival', name: 'Heinkel', focus: '爆撃機・新技術',
      buysParts: true, partWeight: 1.5, priceMul: 1.05,
      stats: { capacity: 75, tech: 80, rlmRating: 65 },
      timeline: [
        { month: 12, delta: { tech: 4 }, note: '新技術の試作' }
      ] },
    { id: 'focke_wulf', type: 'rival', name: 'Focke-Wulf', focus: '戦闘機・長距離機',
      buysParts: true, partWeight: 1, priceMul: 1.08,
      stats: { capacity: 45, tech: 72, rlmRating: 60 },
      timeline: [
        { month: 22, delta: { tech: 10, rlmRating: 8, capacity: 8 }, note: 'Fw 190Aの配備' }
      ] },
    { id: 'dornier', type: 'rival', name: 'Dornier', focus: '爆撃機',
      buysParts: true, partWeight: 1, priceMul: 1.04,
      stats: { capacity: 55, tech: 62, rlmRating: 62 },
      timeline: [
        { month: 14, delta: { capacity: 4 }, note: '生産の拡大' }
      ] },

    { id: 'daimler_benz', type: 'supplier', name: 'Daimler-Benz', focus: '航空エンジン',
      buysParts: false, partWeight: 0, priceMul: 1.0 }
  ];
})(window.AF);
