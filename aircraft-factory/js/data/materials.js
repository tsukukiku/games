// 資材。毎月の割当枠 = baseQuota × quotaCurve(月) × 工場規模 × 評価 (systems/economy.js)
// quotaCurve: [月インデックス(0=1939年9月), 倍率] の折れ線。軽合金は戦争が進むと逼迫する。
(function (AF) {
  'use strict';

  AF.data.MATERIALS = [
    { id: 'alloy', name: '軽合金', unit: 'kg', price: 3.0, baseQuota: 400,
      quotaCurve: [[0, 1.0], [8, 0.95], [16, 0.85], [22, 0.75], [27, 0.65]] }, // TODO: 要確認(逼迫の度合い)
    { id: 'steel', name: '鋼',     unit: 'kg', price: 0.6, baseQuota: 1500,
      quotaCurve: [[0, 1.0], [27, 0.9]] },
    { id: 'wood',  name: '木材',   unit: 'kg', price: 0.3, baseQuota: 400,
      quotaCurve: [[0, 1.0], [27, 1.0]] },
    { id: 'fuel',  name: '燃料',   unit: 'L',  price: 0.5, baseQuota: 300,
      quotaCurve: [[0, 1.0], [20, 0.9], [27, 0.75]] }
  ];
})(window.AF);
