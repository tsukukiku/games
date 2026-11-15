// 設備(6種)。capacity = 1台が1日にこなす工数。staff = 1台を動かすのに必要な人員。
// size: 床の上で占める升目 [幅, 奥行き]。
// alwaysStaffed: 生産ジョブがなくても常に人員を取る設備。effect: 保有しているだけで効く効果。
(function (AF) {
  'use strict';

  AF.data.FACILITIES = [
    { id: 'lathe', name: '旋盤', size: [1, 1], capacity: 10, cost: 10000, upkeep: 300, maxCount: 4,
      staff: { skilled: 2, general: 1 }, alwaysStaffed: false, effect: {},
      desc: '金具・ファスナー・降着装置部品など。武装ユニットもここで作る。' },
    { id: 'press', name: 'プレス機', size: [1, 1], capacity: 12, cost: 22000, upkeep: 500, maxCount: 4,
      staff: { skilled: 1, general: 3 }, alwaysStaffed: false, effect: {},
      desc: 'リブ・外板・風防枠。主翼ユニットもここで作る。' },
    { id: 'weld', name: '溶接設備', size: [1, 1], capacity: 9, cost: 14000, upkeep: 350, maxCount: 4,
      staff: { skilled: 2, general: 1 }, alwaysStaffed: false, effect: {},
      desc: '配管・排気管・エンジン架・燃料タンク。胴体ユニットもここで作る。' },
    { id: 'jig', name: '組立ジグ', size: [2, 2], capacity: 8, cost: 36000, upkeep: 800, maxCount: 3,
      staff: { skilled: 3, general: 4 }, alwaysStaffed: false, effect: {},
      desc: '機体の最終組立と、エンジン・電子機器ユニットの組立。機体組立の解放に必要。' },
    { id: 'test', name: '試験場', size: [2, 2], capacity: 0, cost: 24000, upkeep: 600, maxCount: 1,
      staff: { skilled: 1, general: 2 }, alwaysStaffed: true, effect: {},
      desc: '完成機の試験飛行。機体組立の解放に必要。' },
    { id: 'inspect', name: '検査設備', size: [1, 1], capacity: 0, cost: 16000, upkeep: 400, maxCount: 1,
      staff: { skilled: 2, general: 0 }, alwaysStaffed: true, effect: { defectMul: 0.5 },
      desc: '工程内検査で不良率を半減し、納入後のクレームを減らす。機体組立の解放に必要。' }
  ];
})(window.AF);
