// 機体のピクセル画像。sprites.js のSVG部品を小さなキャンバスに描き、縁を固めて拡大表示する。
// 画像化は非同期なので、HTMLには <canvas data-air="…"> を置き、app.render のあとに paintAll() で絵を入れる。
// 試験飛行シーン(ui/scenes/testFlight.js)も、ここの画像を使う。
(function (AF) {
  'use strict';
  var ap = {};
  var SLOT_ORDER = ['engine', 'fuselage', 'wing', 'armament', 'avionics'];
  var cache = {}, waiting = {};

  // ユニット単体のアイコンで切り出す範囲 [x, y, 幅, 高さ](SVG座標)と縮尺
  var CROP = {
    engine:   { box: [20, 28, 116, 100], scale: 0.5 },
    fuselage: { box: [122, 10, 290, 108], scale: 0.2 },
    wing:     { box: [136, 14, 130, 142], scale: 0.34 },
    armament: { box: [96, 48, 176, 96], scale: 0.32 },
    avionics: { box: [150, 10, 250, 110], scale: 0.24 }
  };
  var FULL = { box: [0, 0, 440, 180], scale: 0.5 };

  function keyOf(slots, only) {
    return SLOT_ORDER.map(function (s) { return (!only || only === s) ? (slots[s] || '') : ''; }).join('|') + '#' + (only || '');
  }
  function spec(only) { return only ? CROP[only] : FULL; }
  function sizeOf(only) {
    var s = spec(only);
    return [Math.round(s.box[2] * s.scale), Math.round(s.box[3] * s.scale)];
  }

  // 画像を用意する。done(canvas) は用意でき次第呼ばれる(キャッシュ済みならすぐ)。
  ap.get = function (slots, only, done) {
    var key = keyOf(slots, only);
    if (cache[key]) { if (done) done(cache[key]); return cache[key]; }
    if (waiting[key]) { if (done) waiting[key].push(done); return null; }
    waiting[key] = done ? [done] : [];
    var s = spec(only), size = sizeOf(only);
    var part = {};
    SLOT_ORDER.forEach(function (id) { if (!only || only === id || id === 'fuselage') part[id] = slots[id]; });
    // ユニット単体でも、アンテナや爆弾の位置合わせのために胴体の情報だけは渡す(描くのは only のスロット)
    var svg = AF.ui.aircraftSvg.raw(part, s.box, size, only);
    var img = new Image();
    img.onload = function () {
      var c = AF.ui.pix.canvas(size[0], size[1]);
      c.getContext('2d').drawImage(img, 0, 0, size[0], size[1]);
      AF.ui.pix.harden(c);
      AF.ui.pix.outline(c, '#2b2233');
      cache[key] = c;
      var list = waiting[key]; delete waiting[key];
      list.forEach(function (fn) { fn(c); });
      ap.paintAll();
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    return null;
  };

  function canvasHtml(slots, only, displayWidth) {
    var size = sizeOf(only);
    var w = displayWidth || size[0] * 2, h = Math.round(w * size[1] / size[0]);
    return '<canvas class="air" data-air="' + SLOT_ORDER.map(function (s) { return slots[s] || ''; }).join('|') + '" data-only="' + (only || '') +
      '" width="' + size[0] + '" height="' + size[1] + '" style="width:' + w + 'px;height:' + h + 'px"></canvas>';
  }
  // 機体全体(表示幅を指定。既定は2倍表示の440px)
  ap.html = function (slots, displayWidth) { return canvasHtml(slots, null, displayWidth); };
  // ユニット単体
  ap.unitHtml = function (unitId, maxPx) {
    var u = AF.data.index.units[unitId];
    if (!u) return '';
    var slots = {}; slots[u.slot] = unitId;
    var size = sizeOf(u.slot), k = Math.max(1, Math.floor((maxPx || 64) / Math.max(size[0], size[1]) * 2) / 2);
    return canvasHtml(slots, u.slot, Math.round(size[0] * k));
  };

  // 画面上の <canvas data-air> に絵を入れる
  ap.paintAll = function () {
    var list = document.querySelectorAll('canvas[data-air]');
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (el.dataset.done) continue;
      var ids = el.dataset.air.split('|'), slots = {};
      SLOT_ORDER.forEach(function (s, j) { if (ids[j]) slots[s] = ids[j]; });
      var c = ap.get(slots, el.dataset.only || null);
      if (c) { el.getContext('2d').drawImage(c, 0, 0); el.dataset.done = '1'; }
    }
  };

  AF.ui.aircraftPixel = ap;
})(window.AF);
