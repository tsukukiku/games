// 機体ユニット(5スロット、計18種)と、その出自(元の実機)。
//
// stats: 6数値。各 -3〜+10 の整数。スロットの主な影響を大きく、他は小さく。
//   エンジン=速度・機動 / 胴体=防御・航続 / 主翼=機動・航続 / 武装=攻撃 / 電子機器=攻撃・信頼性
// source: 入手経路。研究ノードの source と対応する (base / license / conditional)
// unlocked: 開始時に自社で製造できるか(状態は state.unlockedUnits にコピーされる)
// purchasable + supplier: 他社から完成品を買えるか、どの会社からか('market' は一般市場)
// trait: 固有特性。指定の任務でだけ stat に mod が付く(±1〜2)
// facility/work/materials/parts: 自社製造のレシピ / buyPrice, marketSupply: 購入単価と月間の購入上限
// sprite: js/ui/sprites.js の描画キー
//
// 性能値・装備の組み合わせは遊びやすさ優先の概算。TODO: 要確認(実機の細かい仕様)
(function (AF) {
  'use strict';

  AF.data.ORIGINS = {
    hs123:  { name: 'Hs 123A', color: '#a79d6c' },
    bf109e: { name: 'Bf 109E', color: '#7f917c' },
    ju87b:  { name: 'Ju 87B',  color: '#56684f' },
    bf109f: { name: 'Bf 109F', color: '#8598a6' },
    own:    { name: '自社設計', color: '#b88d5c' }
  };

  var ENGINE_PARTS = { fitting: 20, fastener: 20, exhaust: 4, piping: 3, engine_mount: 1 };
  var FUSELAGE_PARTS = { rib: 20, skin_panel: 16, fastener: 30, canopy_frame: 1, fuel_tank: 1, control_pulley: 4 };
  var WING_PARTS = { rib: 30, skin_panel: 20, fastener: 30, gear_strut: 2, wheel_hub: 2, fitting: 10 };
  var ARM_PARTS = { fitting: 10, fastener: 10 };
  var AVI_PARTS = { fitting: 5, fastener: 5 };

  function s(attack, defense, maneuver, speed, range, reliability) {
    return { attack: attack, defense: defense, maneuver: maneuver, speed: speed, range: range, reliability: reliability };
  }

  AF.data.UNITS = [
    // ================= エンジン =================
    { id: 'eng_bmw132', slot: 'engine', name: 'BMW 132系 星型', origin: 'hs123', source: 'base', unlocked: true,
      purchasable: true, supplier: 'market', stats: s(0, 0, 1, 2, 1, 2),
      trait: { label: '空冷で被弾に強い', mission: 'ground_attack', stat: 'defense', mod: 1 },
      facility: 'jig', work: 60, materials: { steel: 120, alloy: 60 }, parts: ENGINE_PARTS,
      buyPrice: 4300, marketSupply: 4, sprite: 'eng_radial' },
    { id: 'eng_jumo211', slot: 'engine', name: 'Jumo 211系', origin: 'ju87b', source: 'license', unlocked: false,
      purchasable: true, supplier: 'junkers', stats: s(0, 1, 1, 4, 2, 1),
      trait: { label: '低空での粘り', mission: 'ground_attack', stat: 'speed', mod: 1 },
      facility: 'jig', work: 90, materials: { steel: 160, alloy: 90 }, parts: ENGINE_PARTS,
      buyPrice: 5900, marketSupply: 3, sprite: 'eng_jumo211' },
    { id: 'eng_db601a', slot: 'engine', name: 'DB 601A', origin: 'bf109e', source: 'license', unlocked: false,
      purchasable: true, supplier: 'daimler_benz', stats: s(0, 0, 2, 6, 0, 1),
      trait: { label: '燃料噴射', mission: 'intercept', stat: 'maneuver', mod: 1 },
      facility: 'jig', work: 100, materials: { steel: 150, alloy: 110 }, parts: ENGINE_PARTS,
      buyPrice: 7000, marketSupply: 3, sprite: 'eng_db601a' },
    { id: 'eng_db601e', slot: 'engine', name: 'DB 601E', origin: 'bf109f', source: 'conditional', unlocked: false,
      purchasable: false, supplier: 'daimler_benz', stats: s(0, 0, 3, 8, 1, 1),
      trait: { label: '高高度性能', mission: 'intercept', stat: 'speed', mod: 2 },
      facility: 'jig', work: 120, materials: { steel: 160, alloy: 130 }, parts: ENGINE_PARTS,
      buyPrice: 9000, marketSupply: 2, sprite: 'eng_db601e' },

    // ================= 胴体 =================
    { id: 'fus_hs123', slot: 'fuselage', name: 'Hs 123系 胴体', origin: 'hs123', source: 'base', unlocked: true,
      purchasable: true, supplier: 'market', stats: s(0, 2, 1, 0, 1, 1),
      trait: { label: '頑丈な骨組', mission: 'ground_attack', stat: 'reliability', mod: 1 },
      facility: 'weld', work: 50, materials: { alloy: 120, steel: 40 }, parts: FUSELAGE_PARTS,
      buyPrice: 3100, marketSupply: 4, sprite: 'fus_hs123' },
    { id: 'fus_ju87b', slot: 'fuselage', name: 'Ju 87B系 胴体', origin: 'ju87b', source: 'license', unlocked: false,
      purchasable: true, supplier: 'junkers', stats: s(0, 6, -1, -2, 3, 1),
      trait: { label: '後方銃座', mission: 'ground_attack', stat: 'defense', mod: 2 },
      facility: 'weld', work: 80, materials: { alloy: 220, steel: 80 }, parts: FUSELAGE_PARTS,
      buyPrice: 4700, marketSupply: 3, sprite: 'fus_ju87b' },
    { id: 'fus_bf109e', slot: 'fuselage', name: 'Bf 109E系 胴体', origin: 'bf109e', source: 'license', unlocked: false,
      purchasable: true, supplier: 'messerschmitt', stats: s(0, 3, 1, 2, 2, 0),
      trait: { label: '小型で見つかりにくい', mission: 'air_superiority', stat: 'defense', mod: 1 },
      facility: 'weld', work: 70, materials: { alloy: 170, steel: 40 }, parts: FUSELAGE_PARTS,
      buyPrice: 4700, marketSupply: 3, sprite: 'fus_bf109e' },
    { id: 'fus_bf109f', slot: 'fuselage', name: 'Bf 109F系 胴体', origin: 'bf109f', source: 'conditional', unlocked: false,
      purchasable: false, supplier: 'messerschmitt', stats: s(0, 4, 1, 3, 2, 0),
      trait: { label: '空力の洗練', mission: 'air_superiority', stat: 'speed', mod: 1 },
      facility: 'weld', work: 85, materials: { alloy: 190, steel: 40 }, parts: FUSELAGE_PARTS,
      buyPrice: 5900, marketSupply: 2, sprite: 'fus_bf109f' },

    // ================= 主翼 =================
    { id: 'wng_hs123', slot: 'wing', name: 'Hs 123系 一葉半翼', origin: 'hs123', source: 'base', unlocked: true,
      purchasable: true, supplier: 'market', stats: s(0, 0, 3, -1, 1, 1),
      trait: { label: '低速での小回り', mission: 'ground_attack', stat: 'maneuver', mod: 1 },
      facility: 'press', work: 45, materials: { alloy: 100, wood: 30 }, parts: WING_PARTS,
      buyPrice: 2700, marketSupply: 4, sprite: 'wng_hs123' },
    { id: 'wng_ju87b', slot: 'wing', name: 'Ju 87B系 逆ガル翼', origin: 'ju87b', source: 'license', unlocked: false,
      purchasable: true, supplier: 'junkers', stats: s(1, 1, 1, -2, 4, 1),
      trait: { label: '急降下ブレーキ', mission: 'ground_attack', stat: 'attack', mod: 2 },
      facility: 'press', work: 75, materials: { alloy: 200, steel: 50 }, parts: WING_PARTS,
      buyPrice: 4300, marketSupply: 3, sprite: 'wng_ju87b' },
    { id: 'wng_bf109e', slot: 'wing', name: 'Bf 109E系 主翼', origin: 'bf109e', source: 'license', unlocked: false,
      purchasable: true, supplier: 'messerschmitt', stats: s(0, 0, 5, 1, 2, 0),
      trait: { label: '前縁スラット', mission: 'air_superiority', stat: 'maneuver', mod: 1 },
      facility: 'press', work: 70, materials: { alloy: 160, steel: 30 }, parts: WING_PARTS,
      buyPrice: 4700, marketSupply: 3, sprite: 'wng_bf109e' },
    { id: 'wng_wood', slot: 'wing', name: '代用材(木製)主翼', origin: 'own', source: 'conditional', unlocked: false,
      purchasable: false, supplier: 'market', stats: s(0, -1, 3, 0, 2, -1),
      trait: { label: '湿気に弱い', mission: 'intercept', stat: 'reliability', mod: -1 },
      facility: 'press', work: 60, materials: { wood: 260, alloy: 20, steel: 20 }, parts: WING_PARTS,
      buyPrice: 3000, marketSupply: 2, sprite: 'wng_wood' },

    // ================= 武装 =================
    { id: 'arm_mg17', slot: 'armament', name: 'MG 17 機銃×2', origin: 'hs123', source: 'base', unlocked: true,
      purchasable: true, supplier: 'market', stats: s(3, 0, 0, 0, 0, 1),
      trait: { label: '弾数が多い', mission: 'air_superiority', stat: 'attack', mod: 1 },
      facility: 'lathe', work: 15, materials: { steel: 40 }, parts: ARM_PARTS,
      buyPrice: 1200, marketSupply: 6, sprite: 'arm_mg17' },
    { id: 'arm_mgff', slot: 'armament', name: 'MG FF 20mm機関砲×2', origin: 'bf109e', source: 'base', unlocked: false,
      purchasable: true, supplier: 'market', stats: s(6, 0, -1, -1, 0, 0),
      trait: { label: '20mm炸裂弾', mission: 'intercept', stat: 'attack', mod: 2 },
      facility: 'lathe', work: 25, materials: { steel: 70 }, parts: ARM_PARTS,
      buyPrice: 2200, marketSupply: 4, sprite: 'arm_mgff' },
    { id: 'arm_bomb', slot: 'armament', name: '爆弾架(250kg)', origin: 'ju87b', source: 'base', unlocked: false,
      purchasable: true, supplier: 'market', stats: s(8, 0, -2, -2, -1, 0),
      trait: { label: '250kg爆弾', mission: 'ground_attack', stat: 'attack', mod: 2 },
      facility: 'lathe', work: 25, materials: { steel: 90 }, parts: ARM_PARTS,
      buyPrice: 2000, marketSupply: 4, sprite: 'arm_bomb' },

    // ================= 電子機器 =================
    { id: 'avi_fug7', slot: 'avionics', name: 'FuG VII 無線機', origin: 'hs123', source: 'base', unlocked: true,
      purchasable: true, supplier: 'market', stats: s(1, 0, 0, 0, 0, 1),
      trait: { label: '機上無線', mission: 'air_superiority', stat: 'reliability', mod: 1 },
      facility: 'jig', work: 10, materials: { steel: 5, alloy: 5 }, parts: AVI_PARTS,
      buyPrice: 800, marketSupply: 6, sprite: 'avi_radio' },
    { id: 'avi_revi', slot: 'avionics', name: 'Revi 反射式照準器+無線機', origin: 'bf109e', source: 'base', unlocked: false,
      purchasable: true, supplier: 'market', stats: s(3, 0, 0, 0, 0, 1),
      trait: { label: '反射式照準器', mission: 'intercept', stat: 'attack', mod: 1 },
      facility: 'jig', work: 15, materials: { steel: 5, alloy: 8 }, parts: AVI_PARTS,
      buyPrice: 1700, marketSupply: 4, sprite: 'avi_revi' },
    { id: 'avi_ju87auto', slot: 'avionics', name: '自動引き起こし装置+照準器', origin: 'ju87b', source: 'license', unlocked: false,
      purchasable: true, supplier: 'junkers', stats: s(2, 1, 0, 0, 0, 2),
      trait: { label: '自動引き起こし', mission: 'ground_attack', stat: 'reliability', mod: 2 },
      facility: 'jig', work: 18, materials: { steel: 8, alloy: 8 }, parts: AVI_PARTS,
      buyPrice: 2000, marketSupply: 3, sprite: 'avi_ju87' }
  ];
})(window.AF);
