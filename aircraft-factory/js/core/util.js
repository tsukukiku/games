// 共通の小道具: 乱数、日付、書式、補間。
(function (AF) {
  'use strict';
  var util = {};
  function C() { return AF.data.CONFIG; }

  util.clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };
  util.deepCopy = function (o) { return JSON.parse(JSON.stringify(o)); };

  // ---- 乱数(state.rngSeed を進める。セーブと simulateRun で再現できるようにするため) ----
  util.rand = function (state) {
    var t = (state.rngSeed = (state.rngSeed + 0x6D2B79F5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  util.randRange = function (state, a, b) { return a + (b - a) * util.rand(state); };
  util.randInt = function (state, a, b) { return Math.floor(util.randRange(state, a, b + 1)); };
  util.pick = function (state, arr) { return arr[Math.floor(util.rand(state) * arr.length)]; };
  util.weightedPick = function (state, items, weightFn) {
    var total = 0, i;
    var weights = items.map(function (it) { var w = Math.max(0, weightFn(it)); total += w; return w; });
    var r = util.rand(state) * total;
    for (i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
    return items[items.length - 1];
  };

  // ---- 折れ線の補間。points = [[x, y], ...] (x昇順) ----
  util.curveAt = function (points, x) {
    if (x <= points[0][0]) return points[0][1];
    for (var i = 1; i < points.length; i++) {
      if (x <= points[i][0]) {
        var a = points[i - 1], b = points[i];
        return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
      }
    }
    return points[points.length - 1][1];
  };

  // ---- 日付。state.day は開始日からの通算日(0始まり) ----
  util.monthIndex = function (day) { return Math.floor(day / C().DAYS_PER_MONTH); };
  util.dateOf = function (day) {
    var mi = util.monthIndex(day);
    var abs = (C().START_MONTH - 1) + mi;
    return { year: C().START_YEAR + Math.floor(abs / 12), month: abs % 12 + 1, day: day % C().DAYS_PER_MONTH + 1, monthIndex: mi };
  };
  util.formatDate = function (day) {
    var d = util.dateOf(day);
    return d.year + '年' + d.month + '月' + d.day + '日';
  };
  util.formatMonth = function (monthIndex) {
    var d = util.dateOf(monthIndex * C().DAYS_PER_MONTH);
    return d.year + '年' + d.month + '月';
  };
  util.totalDays = function () { return C().TOTAL_MONTHS * C().DAYS_PER_MONTH; };

  // ---- 書式 ----
  util.fmt = function (n) { return Math.round(n).toLocaleString('ja-JP'); };
  util.fmt1 = function (n) { return (Math.round(n * 10) / 10).toLocaleString('ja-JP'); };
  util.money = function (n) { return util.fmt(n) + ' RM'; };
  util.round1 = function (n) { return Math.round(n * 10) / 10; };

  // 契約数量を切りのよい数にする
  util.niceQty = function (q) {
    if (q < 10) return Math.max(1, Math.round(q));
    if (q < 50) return Math.round(q / 5) * 5;
    if (q < 200) return Math.round(q / 10) * 10;
    return Math.round(q / 50) * 50;
  };

  AF.core.util = util;
})(window.AF);
