// クォータービュー(斜め見下ろし)の描画。升目の座標 → 画面座標、箱の描画、設備・木・トラックのスプライト。
//
// 座標: 升目 (u, v) と高さ z(画素)。1升 = 横32×縦16画素。
//   画面x = (u - v) × 16   画面y = (u + v) × 8 − z
// 見えている面は、上面・左手前の面(v が大きい側)・右手前の面(u が大きい側)。
// 設備は box(箱)を奥から手前へ積んで描く。f はアニメのコマ(0〜3)、active は稼働中か。
(function (AF) {
  'use strict';
  var iso = { TW: 32, TH: 16, HMAX: 44 };
  function pix() { return AF.ui.pix; }

  iso.toScreen = function (u, v, z) { return [(u - v) * 16, (u + v) * 8 - (z || 0)]; };
  // 画面(ワールド)座標 → 升目(小数)
  iso.toTile = function (wx, wy) { return [(wx / 16 + wy / 8) / 2, (wy / 8 - wx / 16) / 2]; };

  // 凸多角形を、にじみのない画素で塗る
  iso.poly = function (ctx, pts, color) {
    var minY = Infinity, maxY = -Infinity, i;
    for (i = 0; i < pts.length; i++) { minY = Math.min(minY, pts[i][1]); maxY = Math.max(maxY, pts[i][1]); }
    ctx.fillStyle = color;
    for (var y = Math.floor(minY); y < Math.ceil(maxY); y++) {
      var yy = y + 0.5, x0 = Infinity, x1 = -Infinity;
      for (i = 0; i < pts.length; i++) {
        var a = pts[i], b = pts[(i + 1) % pts.length];
        if ((a[1] <= yy && b[1] > yy) || (b[1] <= yy && a[1] > yy)) {
          var x = a[0] + (b[0] - a[0]) * (yy - a[1]) / (b[1] - a[1]);
          x0 = Math.min(x0, x); x1 = Math.max(x1, x);
        }
      }
      if (x1 > x0) ctx.fillRect(Math.round(x0), y, Math.max(1, Math.round(x1) - Math.round(x0)), 1);
    }
  };

  // 箱。(u, v) から (du, dv) の底面、床からの高さ z、箱の高さ h。color は上面の色(側面は自動で暗くする)。
  iso.box = function (ctx, ox, oy, u, v, du, dv, z, h, color) {
    function P(a, b, c) { var s = iso.toScreen(a, b, c); return [s[0] + ox, s[1] + oy]; }
    var top = z + h;
    iso.poly(ctx, [P(u, v + dv, top), P(u + du, v + dv, top), P(u + du, v + dv, z), P(u, v + dv, z)], pix().shade(color, -0.22));
    iso.poly(ctx, [P(u + du, v + dv, top), P(u + du, v, top), P(u + du, v, z), P(u + du, v + dv, z)], pix().shade(color, -0.42));
    iso.poly(ctx, [P(u, v, top), P(u + du, v, top), P(u + du, v + dv, top), P(u, v + dv, top)], color);
  };
  // 升目1つぶんの菱形
  iso.tile = function (ctx, ox, oy, u, v, color, du, dv) {
    function P(a, b) { var s = iso.toScreen(a, b, 0); return [s[0] + ox, s[1] + oy]; }
    du = du || 1; dv = dv || 1;
    iso.poly(ctx, [P(u, v), P(u + du, v), P(u + du, v + dv), P(u, v + dv)], color);
  };
  function dot(ctx, ox, oy, u, v, z, color, w, h) {
    var s = iso.toScreen(u, v, z);
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(s[0] + ox), Math.round(s[1] + oy), w || 1, h || 1);
  }

  // ---- 設備の絵。draw(b, f, active): b(u,v,du,dv,z,h,色) で箱を置く。d(u,v,z,色,w,h) で点を打つ ----
  var FAC = {
    lathe: function (b, d, f, on) {
      b(.1, .2, .8, .6, 0, 2, '#6b6570');
      b(.15, .32, .26, .4, 2, 13, '#3f8f86');
      b(.41, .38, .34, .3, 2, 5, '#55a89d');
      b(.41, .44, .08, .16, 8, 5, '#c9c2b8');
      b(.49, .49, .24, .07, 10, 2, on && f % 2 ? '#fff7e6' : '#b9b2a6');
      b(.74, .42, .12, .2, 2, 10, '#3f8f86');
      b(.52, .64, .12, .1, 2, 9, '#f2c14e');
      if (on) { d(.55 + f * .03, .62, 12 + f, '#f2c14e'); d(.6, .66 - f * .02, 10, '#fff7e6'); }
    },
    press: function (b, d, f, on) {
      b(.14, .14, .72, .72, 0, 5, '#b5483c');
      b(.24, .24, .52, .52, 5, 2, '#8e8a86');
      b(.18, .18, .1, .1, 7, 20, '#50607a');
      b(.72, .18, .1, .1, 7, 20, '#50607a');
      b(.18, .72, .1, .1, 7, 20, '#50607a');
      b(.3, .3, .4, .4, on ? [17, 13, 8, 13][f] : 17, 7, '#c9c2b8');
      b(.72, .72, .1, .1, 7, 20, '#50607a');
      b(.14, .14, .72, .72, 27, 6, '#c8433a');
      if (on && f === 2) { d(.5, .8, 8, '#f2c14e', 2, 1); d(.82, .5, 9, '#fff7e6'); }
    },
    weld: function (b, d, f, on) {
      b(.72, .16, .16, .16, 0, 17, '#3f7a3a');
      b(.76, .2, .08, .08, 17, 3, '#c9c2b8');
      b(.12, .3, .58, .48, 0, 8, '#8a7a66');
      b(.14, .32, .54, .44, 8, 1, '#8e8a86');
      b(.28, .44, .26, .2, 9, 2, '#b9b2a6');
      b(.16, .34, .06, .06, 9, 11, '#5a5560');
      b(.16, .34, .22, .05, 19, 2, '#5a5560');
      if (on) {
        d(.4, .54, 13, f % 2 ? '#fff7e6' : '#f2c14e', 2, 2);
        d(.4 + (f - 1.5) * .08, .54, 15 + f, '#f2c14e'); d(.46, .5 + f * .03, 16 - f, '#e0813a'); d(.36, .6, 14 + (f % 2) * 2, '#fff7e6');
      }
    },
    inspect: function (b, d, f) {
      b(.12, .24, .76, .5, 0, 9, '#e8dcc0');
      b(.22, .34, .16, .16, 9, 7, '#7d8fa3');
      b(.5, .52, .22, .14, 9, 1, '#fff7e6');
      b(.7, .3, .05, .05, 9, 12, '#5a5560');
      b(.56, .3, .18, .1, 20, 2, '#f2c14e');
      d(.3, .5, 14, f < 2 ? '#6aa84f' : '#3f7a3a', 2, 2);
    },
    jig: function (b, d, f, on) {
      var Y = '#d9a441';
      b(.15, .15, 1.7, 1.7, 0, 1, '#77705f');
      b(.2, .2, .1, .1, 1, 27, Y); b(.2, .2, 1.6, .08, 26, 3, Y); b(.2, .2, .08, 1.6, 26, 3, Y);
      b(1.7, .2, .1, .1, 1, 27, Y); b(.2, 1.7, .1, .1, 1, 27, Y);
      b(.72, .96, .1, .1, 1, 7, '#5a5560'); b(1.3, .96, .1, .1, 1, 7, '#5a5560');
      b(.8, .5, .34, 1.0, 10, 2, '#a3b39c');
      b(.5, .86, 1.12, .3, 8, 7, '#8fa08a');
      b(.34, .9, .16, .22, 9, 5, '#5a5560');
      b(1.52, .98, .1, .06, 15, 8, '#8fa08a');
      b(.62, .94, .2, .14, 15, 3, '#a8dbe0');
      if (on) { b(.7 + f * .22, 1.0, .06, .06, 19, 8, '#3d3a34'); d(.9 + f * .2, 1.2, 12, '#f2c14e', 2, 1); }
      b(1.7, 1.7, .1, .1, 1, 27, Y); b(.2, 1.72, 1.6, .08, 26, 3, Y); b(1.72, .2, .08, 1.6, 26, 3, Y);
    },
    test: function (b, d, f) {
      b(.05, .05, 1.9, 1.9, 0, 1, '#77726c');
      b(.15, .15, 1.0, 1.5, 1, 15, '#b3bba8');
      b(.3, .15, .7, 1.5, 16, 5, '#8d9686');
      b(1.15, .45, .02, .9, 1, 12, '#3d3a34');
      d(1.5, .4, 2, '#fff7e6', 3, 1); d(1.5, .9, 2, '#fff7e6', 3, 1); d(1.5, 1.4, 2, '#fff7e6', 3, 1);
      b(1.62, 1.62, .05, .05, 1, 24, '#e8dcc0');
      d(1.66, 1.64, 25 - (f % 2), '#e0813a', 5, 3); d(1.66, 1.64, 24 - (f % 2), '#fff7e6', 2, 2);
    }
  };

  // 設備のスプライト(キャッシュ)。原点は足元の升目の上の頂点。
  var cache = {};
  iso.facilitySprite = function (type, f, on) {
    var key = type + '|' + f + '|' + (on ? 1 : 0);
    if (cache[key]) return cache[key];
    var size = AF.data.index.facilities[type].size, w = size[0], h = size[1];
    var c = pix().canvas((w + h) * 16, (w + h) * 8 + iso.HMAX), ctx = c.getContext('2d');
    var ox = h * 16, oy = iso.HMAX;
    FAC[type](function (u, v, du, dv, z, hh, col) { iso.box(ctx, ox, oy, u, v, du, dv, z, hh, col); },
              function (u, v, z, col, pw, ph) { dot(ctx, ox, oy, u, v, z, col, pw, ph); }, f, on);
    pix().outline(c, '#2b2233');
    c.ox = ox; c.oy = oy;
    cache[key] = c;
    return c;
  };
  // パネル用のアイコン(余白を切り詰めたもの)
  iso.facilityIcon = function (type) {
    var s = iso.facilitySprite(type, 0, false), ctx = s.getContext('2d');
    var d = ctx.getImageData(0, 0, s.width, s.height).data, top = s.height, bottom = 0;
    for (var y = 0; y < s.height; y++) for (var x = 0; x < s.width; x++) {
      if (d[(y * s.width + x) * 4 + 3] > 0) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
    }
    var side = Math.max(s.width, bottom - top + 1);
    var c = pix().canvas(side, side);
    c.getContext('2d').drawImage(s, Math.floor((side - s.width) / 2), Math.floor((side - (bottom - top + 1)) / 2) - top);
    return c;
  };

  // 木(kind で少し形が変わる)
  var treeCache = {};
  iso.treeSprite = function (kind) {
    if (treeCache[kind]) return treeCache[kind];
    var c = pix().canvas(32, 16 + 34), ctx = c.getContext('2d');
    function b(u, v, du, dv, z, h, col) { iso.box(ctx, 16, 34, u, v, du, dv, z, h, col); }
    b(.44, .44, .12, .12, 0, 6, '#7a5230');
    if (kind % 2) { b(.2, .2, .6, .6, 6, 9, '#4f9a4a'); b(.3, .3, .4, .4, 15, 7, '#6ab85a'); }
    else { b(.18, .18, .64, .64, 5, 6, '#3f8a45'); b(.28, .28, .44, .44, 11, 6, '#4f9a4a'); b(.38, .38, .24, .24, 17, 6, '#6ab85a'); }
    pix().outline(c, '#234a2a');
    treeCache[kind] = c;
    return c;
  };

  // トラック(荷台に木箱)
  var truck = null;
  iso.truckSprite = function () {
    if (truck) return truck;
    var c = pix().canvas(64, 32 + 26), ctx = c.getContext('2d');
    function b(u, v, du, dv, z, h, col) { iso.box(ctx, 24, 26, u, v, du, dv, z, h, col); }
    b(.1, .25, 1.2, .5, 3, 3, '#5a5560');
    b(.1, .25, .8, .5, 6, 7, '#9a6a3f');
    b(.2, .3, .6, .4, 13, 3, '#d9b380');
    b(.95, .25, .4, .5, 6, 9, '#4f8fc0');
    b(1.2, .3, .15, .4, 9, 4, '#a8dbe0');
    b(.25, .7, .16, .08, 0, 4, '#2b2233'); b(1.0, .7, .16, .08, 0, 4, '#2b2233');
    pix().outline(c, '#2b2233');
    truck = c;
    return c;
  };

  AF.ui.iso = iso;
})(window.AF);
