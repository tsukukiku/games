// ピクセルアートの土台。色の表、小さなキャンバス作り、自動の縁取り、アイコンのHTML。
// 画像ファイルは使わず、すべてコードで描いてキャッシュする。
(function (AF) {
  'use strict';
  var pix = {};

  // 1文字の色名 → 色。アイコン定義(icons.js)とマップの描画で共通に使う。
  pix.PAL = {
    k: '#2b2233', w: '#fff7e6', g: '#c9c2b8', G: '#8e8a86', d: '#5a5560',
    s: '#7d8fa3', S: '#50607a', a: '#dfe6ee', y: '#f2c14e', o: '#e0813a',
    r: '#c8433a', R: '#8a2b2b', b: '#4f8fc0', B: '#2f5d8a', n: '#9a6a3f',
    N: '#5f3d24', t: '#d9b380', e: '#6aa84f', E: '#3f7a3a', c: '#a8dbe0', p: '#f0c8a0'
  };

  pix.canvas = function (w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d', { willReadFrequently: true }); // 縁取りなどで画素を読むため
    return c;
  };

  // 色を明るく/暗くする(amount: -1〜+1)
  pix.shade = function (hex, amount) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    function f(v) { return Math.max(0, Math.min(255, Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount))); }
    return '#' + ((1 << 24) + (f(r) << 16) + (f(g) << 8) + f(b)).toString(16).slice(1);
  };

  // 不透明な画素のまわりに1画素の縁取りを付ける
  pix.outline = function (canvas, color) {
    var ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
    var src = ctx.getImageData(0, 0, w, h).data;
    function solid(x, y) { return x >= 0 && y >= 0 && x < w && y < h && src[(y * w + x) * 4 + 3] > 127; }
    ctx.fillStyle = color || pix.PAL.k;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) ctx.fillRect(x, y, 1, 1);
    }
    return canvas;
  };

  // 半透明の画素をなくす(SVGを小さく描いたあとの仕上げ)
  pix.harden = function (canvas) {
    var ctx = canvas.getContext('2d'), img = ctx.getImageData(0, 0, canvas.width, canvas.height), d = img.data;
    for (var i = 3; i < d.length; i += 4) d[i] = d[i] > 110 ? 255 : 0;
    ctx.putImageData(img, 0, 0);
    return canvas;
  };

  // アイコン定義 "色 x y w h; 色 x y w h; ..." から 16×16 のキャンバスを作る
  pix.fromRects = function (spec, size) {
    var c = pix.canvas(size || 16, size || 16), ctx = c.getContext('2d');
    spec.split(';').forEach(function (part) {
      var t = part.trim().split(/\s+/);
      if (t.length < 5) return;
      ctx.fillStyle = pix.PAL[t[0]] || t[0];
      ctx.fillRect(+t[1], +t[2], +t[3], +t[4]);
    });
    return pix.outline(c);
  };

  // ---- アイコン ----
  // name: icons.js の名前 / 'fac_設備id'(クォータービューの設備) / 'unit:ユニットid'(機体ユニット)
  var canvasCache = {}, urlCache = {};
  pix.iconCanvas = function (name) {
    if (canvasCache[name]) return canvasCache[name];
    var c;
    if (name.indexOf('fac_') === 0) c = AF.ui.iso.facilityIcon(name.slice(4));
    else c = pix.fromRects(AF.ui.ICONS[name] || AF.ui.ICONS.unknown);
    canvasCache[name] = c;
    return c;
  };
  pix.iconUrl = function (name) {
    if (!urlCache[name]) urlCache[name] = pix.iconCanvas(name).toDataURL();
    return urlCache[name];
  };
  // <img> のHTML。px は表示の大きさ(16の倍数がきれい)。
  pix.icon = function (name, px, cls) {
    if (name.indexOf('unit:') === 0) return AF.ui.aircraftPixel.unitHtml(name.slice(5), px || 32);
    px = px || 32;
    var c = pix.iconCanvas(name), h = Math.round(px * c.height / c.width);
    return '<img class="pix ' + (cls || '') + '" src="' + pix.iconUrl(name) + '" width="' + px + '" height="' + h + '" alt="">';
  };

  AF.ui.pix = pix;
})(window.AF);
