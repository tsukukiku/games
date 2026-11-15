// シーン「試験飛行」(下準備の版)。設計した機体が滑走路を走り、離陸して飛び去る。
// 機体の絵は aircraftPixel.js の画像(220×90、機首が左)をそのまま使う。
// これから足す場所: 機体の数値(速度・機動)で動きを変える / 不具合の演出 / 着陸 / 結果の表示。
//   → update() の段取り(PHASES)と、draw() の各レイヤー(空・雲・地面・機体)に手を入れる。
(function (AF) {
  'use strict';
  var GROUND = 214;                       // 地面の高さ(y)
  // 段取り: [開始ms, 名前]。t がここを過ぎると次へ。
  var PHASES = [[0, '始動'], [1600, '滑走'], [4600, '離陸'], [6200, '上昇'], [9000, '通過'], [12500, '完了']];

  function phaseAt(t) {
    var p = 0;
    for (var i = 0; i < PHASES.length; i++) if (t >= PHASES[i][0]) p = i;
    return p;
  }
  function rect(ctx, c, x, y, w, h) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
  function cloud(ctx, x, y, s) {
    rect(ctx, '#fff7e6', x, y, 26 * s, 6 * s); rect(ctx, '#fff7e6', x + 5 * s, y - 4 * s, 14 * s, 5 * s); rect(ctx, '#e6ddd0', x + 2 * s, y + 6 * s, 22 * s, 2 * s);
  }

  AF.ui.scenes.register('testFlight', {
    title: '試験飛行',

    init: function (params, sc) {
      var self = this;
      this.sc = sc;
      this.img = null;
      this.name = params.name || '';
      this.x = 250; this.y = GROUND - 80; this.speed = 0; this.scroll = 0; this.tilt = 0;
      this.calc = AF.systems.aircraft.computeAircraftStats(params.slots);
      AF.ui.aircraftPixel.get(params.slots, null, function (c) { self.img = c; });
      sc.caption(this.name);
    },

    update: function (dt, t) {
      var p = phaseAt(t), k = dt / 16;
      // 速度の数値が高い機体ほど加速がよい(見た目だけの差)
      var accel = 0.012 + Math.max(0, this.calc.stats.speed) * 0.0012;
      if (p === 0) this.speed = 0;
      else if (p === 1) this.speed = Math.min(5, this.speed + accel * k);
      else this.speed = Math.min(7, this.speed + accel * 1.5 * k);
      this.scroll += this.speed * k;
      if (p === 1) this.x = Math.max(150, this.x - 0.25 * k);
      if (p === 2) { this.y -= 0.35 * k; this.tilt = Math.min(5, this.tilt + 0.1 * k); }
      if (p === 3) { this.y -= 0.6 * k; this.x -= 0.2 * k; }
      if (p === 4) { this.y -= 0.15 * k; this.x -= 2.6 * k; this.tilt = Math.max(0, this.tilt - 0.1 * k); }
      this.sc.caption(this.name + ' — ' + PHASES[p][1]);
      return p >= PHASES.length - 1;
    },

    draw: function (ctx, t) {
      var W = this.sc.w, H = this.sc.h, s = this.scroll, i;
      // 空(帯で段をつける)と太陽
      ['#8fc7e8', '#a3d3ec', '#b9dff0', '#d0eaf2', '#e6f2ee'].forEach(function (c, n) { rect(ctx, c, 0, n * 36, W, 36); });
      rect(ctx, '#e6f2ee', 0, 180, W, 40);
      rect(ctx, '#fff3c4', 392, 28, 28, 28); rect(ctx, '#fff3c4', 388, 32, 36, 20); rect(ctx, '#fff3c4', 396, 24, 20, 36);
      // 雲(遠いほどゆっくり)
      for (i = 0; i < 5; i++) cloud(ctx, ((i * 137 + s * 0.15) % (W + 120)) - 80, 30 + (i * 53) % 90, 1 + (i % 2));
      // 遠くの丘と森
      for (i = 0; i < 9; i++) {
        var hx = ((i * 97 + s * 0.3) % (W + 160)) - 120;
        rect(ctx, '#7fb07a', hx, GROUND - 26, 110, 26); rect(ctx, '#7fb07a', hx + 18, GROUND - 36, 70, 10); rect(ctx, '#6b9f68', hx + 40, GROUND - 42, 30, 6);
      }
      // 地面と滑走路
      rect(ctx, '#6fae56', 0, GROUND, W, H - GROUND);
      rect(ctx, '#5f9a4c', 0, GROUND, W, 3);
      rect(ctx, '#8f8778', 0, GROUND + 10, W, 26);
      rect(ctx, '#77705f', 0, GROUND + 34, W, 2);
      for (i = -1; i < 9; i++) rect(ctx, '#e8dcc0', ((i * 64 + s * 2) % (W + 64)) - 64, GROUND + 21, 30, 3);
      // 格納庫と吹き流し(滑走路の脇を流れていく)
      var gx = 330 + s * 2;
      if (gx < W + 200) {
        rect(ctx, '#2b2233', gx - 1, GROUND - 47, 122, 58); rect(ctx, '#b3bba8', gx, GROUND - 46, 120, 56);
        rect(ctx, '#8d9686', gx, GROUND - 46, 120, 12); rect(ctx, '#3d3a34', gx + 20, GROUND - 26, 80, 36);
        rect(ctx, '#e8dcc0', gx + 150, GROUND - 50, 2, 60);
        rect(ctx, '#e0813a', gx + 132 + (Math.floor(t / 200) % 2), GROUND - 50, 18, 6);
      }
      // 手前の草
      for (i = 0; i < 14; i++) rect(ctx, '#4f9044', ((i * 53 + s * 3) % (W + 40)) - 20, GROUND + 44 + (i * 7) % 18, 6, 2);

      // 機体(影 → 本体 → プロペラ)
      if (this.img) {
        var px = Math.round(this.x), py = Math.round(this.y), alt = (GROUND - 80) - this.y;
        if (px > -240) {
          rect(ctx, 'rgba(43,34,51,0.25)', px + 30 + alt * 0.3, GROUND + 20, Math.max(20, 150 - alt), 4);
          ctx.save();
          ctx.translate(px + 110, py + 45); ctx.rotate(this.tilt * Math.PI / 180); ctx.translate(-110, -45);
          ctx.drawImage(this.img, 0, 0);
          if (this.speed > 0.05 || phaseAt(t) === 0) {
            // プロペラの残像(機首は画像の左端あたり)
            var spin = Math.floor(t / (phaseAt(t) === 0 ? 120 : 40)) % 3;
            ctx.fillStyle = 'rgba(255,247,230,' + (phaseAt(t) === 0 ? 0.5 : 0.75) + ')';
            ctx.fillRect(26 + spin, 18, 2, 46); ctx.fillRect(22, 30 + spin * 4, 10, 2);
          }
          ctx.restore();
          // 滑走中の土ぼこり
          if (alt < 4 && this.speed > 1) for (i = 0; i < 4; i++) rect(ctx, '#d9cfb8', px + 100 + i * 14 + (t / 30 + i * 9) % 12, GROUND + 14 - (i * 3 + t / 60) % 8, 3, 3);
        }
      } else {
        rect(ctx, '#2b2233', 200, 120, 80, 4);
      }
      // 完了の印
      if (phaseAt(t) === PHASES.length - 1) {
        rect(ctx, '#2b2233', 150, 96, 180, 48); rect(ctx, '#fff7e6', 153, 99, 174, 42);
        ctx.fillStyle = '#c8433a'; ctx.font = '32px PixelLatin, PixelJP, monospace'; ctx.textBaseline = 'top'; ctx.textAlign = 'center';
        ctx.fillText('飛行 完了', 240, 103); ctx.textAlign = 'left';
      }
    }
  });
})(window.AF);
