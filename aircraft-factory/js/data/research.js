// 研究ノード(全ノード共通の形式)。動作は systems/research.js、ツリーの画面は ui/panels/research.js。
//
// tree: どのツリーに出すか (parts=部品 / factory=工場 / aircraft=機体)。col, row: ツリー上の位置(row が下ほど後段)
// source: base(自社研究) / license(他社からの許諾) / conditional(条件を満たすと出現)
// icon: ui/pix/icons.js のアイコン名
// cost:   funds=費用 days=所要日数 facilities=必要設備
//         relation={company,min}=必要な関係値 rlmRating=必要なRLM評価 royaltyRate=機体の売上から許諾元へ払う割合
// requires: 前提ノード(ツリーの線になる) / licensor: 許諾元の会社
// unlocks: parts=作れるようになる部品 units=製造可能になるユニット facilityMods={設備id:{capMul}}
//          researchSlots=同時研究数の増分 materialMul=資材消費の倍率 defectMul=不良率の倍率 partPrice=部品契約の単価倍率
// condition/hint: conditional のみ。条件を満たすまで「???」とhintだけを見せる。
//   condition: { minMonth, minRating, materialScarcity: {material, below}, front/minWarValue(戦況の実装後に使う) }
(function (AF) {
  'use strict';

  AF.data.RESEARCH_TREES = [
    { id: 'parts', name: '部品' },
    { id: 'factory', name: '工場' },
    { id: 'aircraft', name: '機体' }
  ];

  AF.data.RESEARCH = [
    // ================= 部品ツリー =================
    { id: 'p_gear', tree: 'parts', col: 0, row: 0, source: 'base', icon: 'gear_strut', name: '降着装置の加工', desc: '支柱部品と車輪ハブを作れる',
      cost: { funds: 3000, days: 25, facilities: ['lathe'] }, requires: [], unlocks: { parts: ['gear_strut', 'wheel_hub'] } },
    { id: 'p_canopy', tree: 'parts', col: 1, row: 0, source: 'base', icon: 'canopy_frame', name: '風防枠の成形', desc: '風防枠を作れる',
      cost: { funds: 3500, days: 25, facilities: ['press'] }, requires: [], unlocks: { parts: ['canopy_frame'] } },
    { id: 'p_tank', tree: 'parts', col: 2, row: 0, source: 'base', icon: 'fuel_tank', name: '大物の溶接', desc: 'エンジン架と燃料タンクを作れる',
      cost: { funds: 3500, days: 25, facilities: ['weld'] }, requires: [], unlocks: { parts: ['engine_mount', 'fuel_tank'] } },
    { id: 'p_std', tree: 'parts', col: 0, row: 1, source: 'base', icon: 'contracts', name: '規格部品の認証', desc: '部品契約の単価 +5%',
      cost: { funds: 6000, days: 45, facilities: ['lathe'] }, requires: ['p_gear'], unlocks: { partPrice: 1.05 } },
    { id: 'material_saving', tree: 'parts', col: 1, row: 1, source: 'base', icon: 'alloy', name: '歩留まり改善', desc: '資材の消費 -10%',
      cost: { funds: 9000, days: 60, facilities: ['press'] }, requires: ['p_canopy'], unlocks: { materialMul: 0.9 } },
    { id: 'inprocess_inspection', tree: 'parts', col: 2, row: 1, source: 'base', icon: 'check', name: '工程内検査', desc: '不良率 -20%',
      cost: { funds: 6000, days: 45, facilities: ['inspect'] }, requires: ['p_tank'], unlocks: { defectMul: 0.8 } },

    // ================= 工場ツリー =================
    { id: 'precision_lathe', tree: 'factory', col: 0, row: 0, source: 'base', icon: 'fac_lathe', name: '精密旋削', desc: '旋盤の能力 +15%',
      cost: { funds: 6000, days: 45, facilities: ['lathe'] }, requires: [], unlocks: { facilityMods: { lathe: { capMul: 1.15 } } } },
    { id: 'auto_lathe', tree: 'factory', col: 0, row: 1, source: 'base', icon: 'fac_lathe', name: '自動旋盤', desc: '旋盤の能力 さらに +20%',
      cost: { funds: 14000, days: 60, facilities: ['lathe'] }, requires: ['precision_lathe'], unlocks: { facilityMods: { lathe: { capMul: 1.2 } } } },
    { id: 'press_dies', tree: 'factory', col: 1, row: 0, source: 'base', icon: 'fac_press', name: 'プレス型の改良', desc: 'プレス機の能力 +15%',
      cost: { funds: 8000, days: 45, facilities: ['press'] }, requires: [], unlocks: { facilityMods: { press: { capMul: 1.15 } } } },
    { id: 'big_press', tree: 'factory', col: 1, row: 1, source: 'base', icon: 'fac_press', name: '大型プレス', desc: 'プレス機の能力 さらに +20%',
      cost: { funds: 16000, days: 60, facilities: ['press'] }, requires: ['press_dies'], unlocks: { facilityMods: { press: { capMul: 1.2 } } } },
    { id: 'weld_fixture', tree: 'factory', col: 2, row: 0, source: 'base', icon: 'fac_weld', name: '溶接治具の改良', desc: '溶接設備の能力 +15%',
      cost: { funds: 7000, days: 45, facilities: ['weld'] }, requires: [], unlocks: { facilityMods: { weld: { capMul: 1.15 } } } },
    { id: 'spot_weld', tree: 'factory', col: 2, row: 1, source: 'base', icon: 'fac_weld', name: '点溶接', desc: '溶接設備の能力 さらに +20%',
      cost: { funds: 14000, days: 60, facilities: ['weld'] }, requires: ['weld_fixture'], unlocks: { facilityMods: { weld: { capMul: 1.2 } } } },
    { id: 'line_assembly', tree: 'factory', col: 3, row: 0, source: 'base', icon: 'fac_jig', name: '流れ作業の組立', desc: '組立ジグの能力 +20%',
      cost: { funds: 12000, days: 60, facilities: ['jig'] }, requires: [], unlocks: { facilityMods: { jig: { capMul: 1.2 } } } },
    { id: 'design_office', tree: 'factory', col: 4, row: 0, source: 'base', icon: 'research', name: '設計室の拡張', desc: '研究の同時進行 +1',
      cost: { funds: 15000, days: 60, facilities: [] }, requires: [], unlocks: { researchSlots: 1 } },

    // ================= 機体ツリー =================
    { id: 'gunsight_install', tree: 'aircraft', col: 0, row: 0, source: 'base', icon: 'unit:avi_revi', name: '照準器の組付け', desc: 'Revi 照準器+無線機 を自社製造',
      cost: { funds: 6000, days: 45, facilities: ['jig', 'inspect'] }, requires: [], unlocks: { units: ['avi_revi'] } },
    { id: 'cannon_mount', tree: 'aircraft', col: 1, row: 0, source: 'base', icon: 'unit:arm_mgff', name: '20mm機関砲の搭載改修', desc: 'MG FF 20mm機関砲 を自社製造',
      cost: { funds: 8000, days: 45, facilities: ['lathe', 'jig'] }, requires: [], unlocks: { units: ['arm_mgff'] } },
    { id: 'bomb_rack', tree: 'aircraft', col: 2, row: 0, source: 'base', icon: 'unit:arm_bomb', name: '爆弾架の自社設計', desc: '爆弾架(250kg) を自社製造',
      cost: { funds: 7000, days: 45, facilities: ['weld', 'jig'] }, requires: [], unlocks: { units: ['arm_bomb'] } },
    { id: 'lic_bf109e_airframe', tree: 'aircraft', col: 3, row: 0, source: 'license', icon: 'unit:fus_bf109e', name: 'Bf 109E系 胴体・主翼', desc: 'Messerschmittから製造許諾',
      licensor: 'messerschmitt',
      cost: { funds: 30000, days: 60, facilities: ['jig'], relation: { company: 'messerschmitt', min: 60 }, rlmRating: 60, royaltyRate: 0.08 },
      requires: [], unlocks: { units: ['fus_bf109e', 'wng_bf109e'] } },
    { id: 'lic_ju87b_airframe', tree: 'aircraft', col: 4, row: 0, source: 'license', icon: 'unit:fus_ju87b', name: 'Ju 87B系 主翼・胴体', desc: 'Junkersから製造許諾',
      licensor: 'junkers',
      cost: { funds: 28000, days: 60, facilities: ['jig'], relation: { company: 'junkers', min: 60 }, rlmRating: 60, royaltyRate: 0.08 },
      requires: [], unlocks: { units: ['wng_ju87b', 'fus_ju87b', 'avi_ju87auto'] } },
    { id: 'lic_jumo211', tree: 'aircraft', col: 4, row: 1, source: 'license', icon: 'unit:eng_jumo211', name: 'Jumo 211系エンジン', desc: 'Junkersから製造許諾',
      licensor: 'junkers',
      cost: { funds: 25000, days: 90, facilities: ['jig', 'test'], relation: { company: 'junkers', min: 55 }, rlmRating: 55, royaltyRate: 0.08 },
      requires: ['lic_ju87b_airframe'], unlocks: { units: ['eng_jumo211'] } },
    { id: 'lic_db601a', tree: 'aircraft', col: 3, row: 1, source: 'license', icon: 'unit:eng_db601a', name: 'DB 601Aエンジン', desc: 'Daimler-Benzから製造許諾',
      licensor: 'daimler_benz',
      cost: { funds: 35000, days: 90, facilities: ['jig', 'test'], relation: { company: 'daimler_benz', min: 60 }, rlmRating: 65, royaltyRate: 0.10 },
      requires: ['lic_bf109e_airframe'], unlocks: { units: ['eng_db601a'] } },
    { id: 'cond_bf109f', tree: 'aircraft', col: 3, row: 2, source: 'conditional', icon: 'unit:fus_bf109f', name: 'Bf 109F系ユニット', desc: 'DB 601E と Bf 109F系胴体',
      hint: '1941年に入り、評価が高ければ、新型の話が回ってくるかもしれない。',
      condition: { minMonth: 16, minRating: 65, front: 'west', minWarValue: 55 }, // TODO: 要確認(しきい値)。戦況の条件は戦況値の実装後に有効化
      licensor: 'messerschmitt',
      cost: { funds: 40000, days: 90, facilities: ['jig', 'test'], rlmRating: 65, royaltyRate: 0.10 },
      requires: ['lic_db601a'], unlocks: { units: ['eng_db601e', 'fus_bf109f'] } },
    { id: 'cond_wood', tree: 'aircraft', col: 5, row: 0, source: 'conditional', icon: 'wood', name: '代用材(木製)主翼', desc: '軽合金をほとんど使わない主翼',
      hint: '軽合金が足りなくなれば、別の材料を考えることになる。',
      condition: { materialScarcity: { material: 'alloy', below: 0.8 } },
      cost: { funds: 10000, days: 60, facilities: ['press'] },
      requires: [], unlocks: { units: ['wng_wood'] } }
  ];
})(window.AF);
