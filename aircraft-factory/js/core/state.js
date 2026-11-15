// ゲーム状態(state)の生成と、現在の state を持つ store。
// state は JSON にそのまま書き出せる素のオブジェクトにする(関数・DOM・循環参照を入れない)。
// 項目を足すときは create() に初期値を書く。古いセーブには core/save.js が初期値を補う。
(function (AF) {
  'use strict';

  var stateApi = {};

  stateApi.create = function (companyName, seed) {
    var C = AF.data.CONFIG;
    var U = AF.core.util;
    var state = {
      version: C.SAVE_VERSION,
      companyName: companyName || C.DEFAULT_COMPANY_NAME,
      rngSeed: (seed == null ? 20391 : seed) | 0,

      // ---- 進行 ----
      day: 0,                 // 開始日からの通算日
      phase: 1,               // 1=部品製造 2=機体の組立
      finished: false,        // 1941年12月末まで到達
      bankrupt: false,
      negativeDays: 0,        // 資金マイナスの連続日数

      // ---- 資源 ----
      funds: C.START_FUNDS,
      rlmRating: C.START_RLM_RATING,
      monthStartRating: C.START_RLM_RATING,
      relations: {},          // 会社id → 関係値
      staff: U.deepCopy(C.START_STAFF),
      hirePool: U.deepCopy(C.HIRE_POOL),
      shift: 'normal',
      facilities: U.deepCopy(C.START_FACILITIES),
      facilityMods: {},       // 設備id → { capMul } (研究で変わる)
      layout: [],             // 設備の配置 [{ uid, type, x, y }]。台数は facilities と一致させる
      layoutSeq: 0,
      materials: U.deepCopy(C.START_MATERIALS),
      quotaBase: {},          // 今月の割当枠の残り(毎月リセット)
      quotaGrant: {},         // 契約に付いた割当枠の残り(持ち越す)
      autoBuy: true,          // 生産開始時に不足資材を割当枠から自動で買う

      // ---- 在庫と生産 ----
      inventory: { parts: {}, units: {}, aircraft: {} }, // aircraft は 設計id → 機数
      jobs: [],
      jobSeq: 0,
      lastStaffFactor: 1,

      // ---- 受注 ----
      contracts: { offers: [], active: [], history: [] },
      contractSeq: 0,
      contractStats: { onTime: 0, late: 0, failed: 0 },
      autoDeliver: true,
      spotSold: {},           // 部品id → 今月スポットで売った数
      unitMarket: {},         // ユニットid → 今月買える残り

      // ---- 設計 ----
      designs: [],            // { id, name, slots: {engine, fuselage, wing, armament, avionics} }
      designSeq: 0,
      unlockedUnits: {},      // ユニットid → true (自社で製造できる)

      // ---- 集計 ----
      ledger: { income: {}, expense: {} },
      monthStats: newMonthStats(),
      totals: { revenue: 0, partsDelivered: 0, partsRevenue: 0, aircraftProduced: 0, aircraftDelivered: 0 },
      reports: [],
      log: [],
      logSeq: 0,
      fx: [],                 // 画面演出用の出来事(core/log.js の fx)。直近ぶんだけ持つ
      fxSeq: 0,
      score: null,

      // ---- 後の段階で使う項目(段階1では初期値のまま) ----
      research: { done: {}, active: [], slots: 1, revealed: {} },  // active: [{ id, daysLeft, days }]
      war: { fronts: {}, deliveredThisMonth: [], deliveredLog: [], contribution: 0 },
      events: { fired: {}, schedule: {}, omens: [] },
      rivals: {},             // 会社id → { capacity, tech, rlmRating }
      marketShare: { parts: {}, aircraft: {} },
      modifiers: { partDemand: 1, fighterDemand: 1, attackDemand: 1, alloyQuota: 1, laborPool: 1, materialMul: 1, defectMul: 1, partPrice: 1 },

      debug: false
    };

    AF.data.COMPANIES.forEach(function (c) {
      if (c.type !== 'agency') state.relations[c.id] = C.START_RELATION;
      if (c.type === 'rival') state.rivals[c.id] = U.deepCopy(c.stats);
    });
    AF.data.UNITS.forEach(function (u) { if (u.unlocked) state.unlockedUnits[u.id] = true; });
    AF.data.MATERIALS.forEach(function (m) { state.quotaBase[m.id] = 0; state.quotaGrant[m.id] = 0; });
    AF.data.FRONTS.forEach(function (f) {
      state.war.fronts[f.id] = { open: f.openMonth === 0, value: f.baseCurve[0][1], playerTotal: 0 };
    });

    AF.systems.facilities.syncLayout(state);  // 開始時の設備を床に置く
    AF.systems.monthEnd.startMonth(state); // 初月の割当・採用枠・契約提示
    AF.core.log.add(state, state.companyName + ' を開業した。まずは部品の受注から。', 'info');
    return state;
  };

  function newMonthStats() {
    return { partsProduced: 0, unitsProduced: 0, aircraftProduced: 0, partsDelivered: 0, aircraftDelivered: 0,
             defects: 0, contractsDone: 0, contractsLate: 0, contractsFailed: 0 };
  }
  stateApi.newMonthStats = newMonthStats;

  // ---- store: 現在の state と、変更通知 ----
  // reason: 'load'(state差し替え) / 'day'(日が進んだ) / 'tick'(日の途中) / 'action'(操作) / 'speed'
  var store = {
    state: null,
    _subs: [],
    subscribe: function (fn) { this._subs.push(fn); },
    notify: function (reason) { this._subs.forEach(function (fn) { fn(reason); }); },
    setState: function (state) { this.state = state; this.notify('load'); }
  };

  AF.core.state = stateApi;
  AF.core.store = store;
})(window.AF);
