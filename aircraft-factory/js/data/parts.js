// 汎用部品(12種)。単体で売れる。facility の設備を持っていれば作れる。
// work = 1個の工数 / materials = 1個の必要資材 / price = 基準単価(RM)
// research = 作るのに必要な研究ノード(なければ最初から作れる)
// defectRate = 不良率 / spotDemand = スポット販売の月間上限 / lot = 契約の最小数量
(function (AF) {
  'use strict';

  AF.data.PARTS = [
    // ---- 旋盤 ----
    { id: 'fitting',        name: '金具',               facility: 'lathe', work: 0.5, materials: { steel: 0.5 },             price: 14,  defectRate: 0.04, spotDemand: 60, lot: 20 },
    { id: 'fastener',       name: 'ファスナー(箱)',     facility: 'lathe', work: 0.4, materials: { steel: 0.3, alloy: 0.2 }, price: 12,  defectRate: 0.03, spotDemand: 60, lot: 20 },
    { id: 'gear_strut',     name: '降着装置の支柱部品', research: 'p_gear', facility: 'lathe', work: 3.0, materials: { steel: 8 },               price: 85,  defectRate: 0.07, spotDemand: 8,  lot: 4 },
    { id: 'wheel_hub',      name: '車輪ハブ', research: 'p_gear',           facility: 'lathe', work: 2.0, materials: { alloy: 3, steel: 1 },     price: 62,  defectRate: 0.06, spotDemand: 12, lot: 4 },
    { id: 'control_pulley', name: '操縦索・滑車セット', facility: 'lathe', work: 1.0, materials: { steel: 1, alloy: 0.5 },   price: 30,  defectRate: 0.05, spotDemand: 25, lot: 10 },
    // ---- プレス機 ----
    { id: 'rib',            name: 'リブ',               facility: 'press', work: 0.8, materials: { alloy: 1.5 },             price: 26,  defectRate: 0.05, spotDemand: 30, lot: 10 },
    { id: 'skin_panel',     name: '外板パネル',         facility: 'press', work: 1.2, materials: { alloy: 4 },               price: 44,  defectRate: 0.05, spotDemand: 16, lot: 10 },
    { id: 'canopy_frame',   name: '風防枠', research: 'p_canopy',             facility: 'press', work: 4.0, materials: { alloy: 3, steel: 1 },     price: 120, defectRate: 0.08, spotDemand: 6,  lot: 2 },
    // ---- 溶接設備 ----
    { id: 'piping',         name: '配管セット',         facility: 'weld',  work: 1.5, materials: { steel: 2, alloy: 0.5 },   price: 44,  defectRate: 0.06, spotDemand: 16, lot: 5 },
    { id: 'exhaust',        name: '排気管',             facility: 'weld',  work: 2.0, materials: { steel: 4 },               price: 58,  defectRate: 0.06, spotDemand: 12, lot: 4 },
    { id: 'engine_mount',   name: 'エンジン架', research: 'p_tank',         facility: 'weld',  work: 5.0, materials: { steel: 12 },              price: 150, defectRate: 0.08, spotDemand: 5,  lot: 2 },
    { id: 'fuel_tank',      name: '燃料タンク', research: 'p_tank',         facility: 'weld',  work: 6.0, materials: { alloy: 10 },              price: 190, defectRate: 0.09, spotDemand: 4,  lot: 2 }
  ];
})(window.AF);
