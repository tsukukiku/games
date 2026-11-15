// 出来事の記録。systems は画面に直接触らず、ここへ書く。画面側が新着を通知として出す。
// level: info(記録のみ) / good / warn / bad(通知も出す)
(function (AF) {
  'use strict';
  var MAX = 300;

  AF.core.log = {
    add: function (state, text, level) {
      state.logSeq += 1;
      state.log.push({ seq: state.logSeq, day: state.day, text: text, level: level || 'info' });
      if (state.log.length > MAX) state.log.splice(0, state.log.length - MAX);
    },
    // 画面演出のきっかけ。type: jobDone / deliver / research / build。画面側(ui/map/effects.js)が seq を見て拾う。
    fx: function (state, type, data) {
      state.fxSeq += 1;
      var e = { seq: state.fxSeq, type: type };
      Object.keys(data || {}).forEach(function (k) { e[k] = data[k]; });
      state.fx.push(e);
      if (state.fx.length > 40) state.fx.splice(0, state.fx.length - 40);
    }
  };
})(window.AF);
