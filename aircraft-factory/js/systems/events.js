// 【ひな形・段階2で実装】史実イベントと汎用イベント。データは js/data/events.js、状態は state.events。
//   state.events = { fired: {イベントid: 発生した月}, schedule: {イベントid: 発生予定の月}, omens: [{id, text}] }
(function (AF) {
  'use strict';
  var events = {};

  // 基準日を月インデックスに直す
  events.baseMonth = function (ev) {
    var C = AF.data.CONFIG;
    return (ev.baseDate.year - C.START_YEAR) * 12 + (ev.baseDate.month - C.START_MONTH);
  };

  // TODO(段階2): 条件(戦況値のしきい値など)を調べ、満たせば前倒し、満たさなければ遅延させて
  //   発生月を決める(advanceMax / delayMax の範囲内)。
  events.scheduledMonth = function (state, ev) { return events.baseMonth(ev); };

  // TODO(段階2): 発生月の omenMonths か月前から、予兆(omenText)を state.events.omens に載せる。
  events.currentOmens = function (state) { return []; };

  // TODO(段階2): 効果を当てる。type ごとの意味は js/data/events.js の冒頭を参照。
  //   demand → state.modifiers.xxxDemand / quota → state.modifiers.alloyQuota / laborPool → state.modifiers.laborPool
  //   openFront → state.war.fronts[front].open = true / rating → RLM評価
  //   期間つきの効果は、終了月を覚えておいて戻す。
  events.applyEffect = function (state, effect) {};

  // 月末に monthEnd.run から呼ばれる。TODO(段階2): 史実イベントの発生判定、汎用イベントの抽選、期限切れ効果の解除。
  events.updateMonthly = function (state) {};

  AF.systems.events = events;
})(window.AF);
