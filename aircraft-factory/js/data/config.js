// ゲーム全体の定数とバランス値。数値の調整は、まずこのファイルを見る。
(function (AF) {
  'use strict';

  AF.data.CONFIG = {
    SAVE_VERSION: 1,
    SAVE_KEY: 'af_factory_save_v1',
    DEFAULT_COMPANY_NAME: 'ミュラー航空部品製作所',

    // ---- 期間と時間 ----
    START_YEAR: 1939,
    START_MONTH: 9,
    TOTAL_MONTHS: 28,        // 1939年9月〜1941年12月
    DAYS_PER_MONTH: 30,
    MS_PER_DAY: 10000,       // 等速で1日=10秒(1か月=約5分)
    SPEEDS: [1, 2, 4],
    DEBUG_SPEED: 60,

    // ---- 開始状態 ----
    START_FUNDS: 50000,
    START_RLM_RATING: 40,    // 0〜100
    START_RELATION: 50,      // 各社との関係値 0(対立)〜100(友好)
    START_STAFF: { skilled: 3, general: 3 },
    START_FACILITIES: { lathe: 1 },
    GRID: { w: 10, h: 10 },   // 工場の床(升目)。設備はこの上に配置する
    START_MATERIALS: { alloy: 150, steel: 500, wood: 100, fuel: 50 },

    // ---- 人員 ----
    STAFF_TYPES: [
      { id: 'skilled', name: '熟練工' },
      { id: 'general', name: '一般工' }
    ],
    WAGES: { skilled: 280, general: 180 },       // RM/月。TODO: 要確認(当時の賃金水準)
    HIRE_COST: { skilled: 300, general: 100 },
    HIRE_POOL: { skilled: 4, general: 8 },       // 1か月に採用できる人数
    WAGE_GROWTH_PER_MONTH: 0.02,                 // 人手不足による賃金の上昇(月あたり、開始時比)
    STAFF_WEIGHT: { skilled: 0.7, general: 0.3 },// 人員係数への寄与
    MIN_STAFF_FACTOR: 0.15,
    SHIFTS: {
      normal:   { name: '通常',  rate: 1.0,  wageMul: 1.0, defectAdd: 0 },
      overtime: { name: '残業',  rate: 1.25, wageMul: 1.3, defectAdd: 0.03 }
    },

    // ---- 資金 ----
    OVERHEAD_PER_MONTH: 2000,         // 固定費(地代・事務)
    OVERHEAD_PER_FACILITY: 400,       // 設備1台ごとの間接費
    CREDIT_LIMIT: 15000,              // 資材の仕入れに限り、ここまで資金マイナスを許す
    OVERDRAFT_INTEREST: 0.02,         // マイナス残高への月利
    BANKRUPTCY_DAYS: 60,              // 資金マイナスがこの日数続くと倒産
    FACILITY_COST_STEP: 0.35,         // 同じ設備の2台目以降の値上がり率(台数ごと)

    // ---- 資材の割当 ----
    QUOTA: {
      perFacility: 0.12,  // 設備1台増えるごとに月次割当 +12%
      ratingBase: 0.6,    // 割当 = 基本 × (ratingBase + (1-ratingBase) × RLM評価/50)
      grantRatio: 0.6     // 部品契約の受注時に付く契約割当(必要資材に対する割合)
    },

    // ---- 機体 ----
    STATS: [
      { id: 'attack',      name: '攻撃',   short: '攻' },
      { id: 'defense',     name: '防御',   short: '防' },
      { id: 'maneuver',    name: '機動',   short: '機' },
      { id: 'speed',       name: '速度',   short: '速' },
      { id: 'range',       name: '航続',   short: '航' },
      { id: 'reliability', name: '信頼性', short: '信' }
    ],
    SLOTS: [
      { id: 'engine',   name: 'エンジン' },
      { id: 'fuselage', name: '胴体' },
      { id: 'wing',     name: '主翼' },
      { id: 'armament', name: '武装' },
      { id: 'avionics', name: '電子機器' }
    ],
    ROLES: {
      fighter:  { name: '戦闘機', stats: ['maneuver', 'speed'] },
      attacker: { name: '攻撃機', stats: ['attack', 'defense'] }
    },
    // 最終組立のレシピ(ユニット5個に加えて必要なもの)
    AIRCRAFT_ASSEMBLY: {
      facility: 'jig',
      requiresFacility: 'test',   // 試験飛行のため試験場が必要
      work: 40,
      materials: { fuel: 60 },
      parts: { fastener: 20, piping: 2, control_pulley: 2 }
    },
    AIRCRAFT_PRICE: { base: 5000, perPoint: 430 },  // 目安価格 = base + perPoint × 6数値の合計
    UNIT_BUY_MIN_RELATION: 35,                      // これ未満の関係値の会社からはユニットを買えない

    // ---- フェーズ2(機体の組立)の解放条件 ----
    PHASE2: { facilities: ['jig', 'test', 'inspect'], rlmRating: 50 },

    // ---- 品質 ----
    QUALITY: {
      reworkRatio: 0.5,        // 不良1個の手直し工数 = 1個の工数 × この値
      unitBase: 0.14, unitPerRel: 0.02, unitMin: 0.03, unitMax: 0.20,
      aircraftBase: 0.30, aircraftPerRel: 0.03, aircraftMin: 0.04, aircraftMax: 0.35,
      complaintNoInspect: 0.08, // 部品納入時のクレーム発生率(検査設備なし)
      complaintInspect: 0.02,   // 同(検査設備あり)
      complaintRefund: 0.10     // クレーム時の返金率
    },

    // ---- 受注 ----
    CONTRACT: {
      weight: { rating: 0.45, capacity: 0.30, onTime: 0.25, capacityRef: 60 }, // 配分の重み
      defaultOnTimeRate: 0.7,
      partOffersBase: 3, partOffersPerWeight: 6, partOffersMin: 2, partOffersMax: 9,
      teaserChance: 0.15,          // 未保有設備向けの部品契約が混ざる確率
      partLoad: [0.15, 0.45],      // 1契約の規模(その設備の月間能力に対する割合)
      partDeadline: [18, 45],      // 納期(日)
      deadlineSlack: 1.6,          // 納期は「必要日数×この値」を下回らない
      rushDays: 25, rushBonus: 1.08,
      priceVar: [0.94, 1.10],
      aircraftOffersBase: 0.5, aircraftOffersPerWeight: 2.5, aircraftOffersMax: 5,
      aircraftDeadlineBase: 45, aircraftDeadlinePerUnit: 8, aircraftDeadlineVar: 15,
      aircraftPriceVar: [0.97, 1.06],
      aircraftAdvanceRate: 0.3,    // 機体契約は受注時に総額のこの割合を前渡金として受け取る(残りは納入時)
      graceDays: 15,               // 納期超過後、この日数で契約打ち切り
      latePriceMul: 0.8,           // 納期超過後の単価
      failPenaltyRate: 0.10        // 打ち切り時の違約金(未納分の金額に対する割合)
    },
    RATING: {
      partOnTime: 1.5, aircraftOnTime: 3, otherBuyerRlm: 0.5,
      late: -3, fail: -5, complaint: -1,
      gainSoftCap: 60,   // 評価が高いほど上がりにくい: 上昇量 × min(1, (100-評価)/gainSoftCap)
      relationOnTime: 3, relationLate: -3, relationFail: -6
    },

    // ---- スポット販売 ----
    SPOT: { priceMul: 0.75 }
  };
})(window.AF);
