// 1日ぶんの進行。実時間の時計(core/clock.js)と自動プレイ(dev/simulate.js)の両方がこれを呼ぶ。
// DOMに触らないこと。処理の順番を変えるとバランスに響くので注意。
(function (AF) {
  'use strict';
  var gameLoop = {};

  gameLoop.advanceDay = function (state) {
    if (state.finished || state.bankrupt) return;
    AF.systems.production.processDay(state);   // 生産の進捗と完成
    AF.systems.contracts.processDay(state);    // 自動納入、納期の確認
    AF.systems.research.processDay(state);     // 研究の進行
    AF.systems.economy.processDay(state);      // 倒産判定
    AF.systems.progression.checkPhase2(state); // 機体組立の解放
    if (state.bankrupt) return;

    state.day += 1;
    if (state.day % AF.data.CONFIG.DAYS_PER_MONTH === 0) {
      AF.systems.monthEnd.run(state);          // 月末集計 → 翌月の準備
    }
  };

  AF.systems.gameLoop = gameLoop;
})(window.AF);
