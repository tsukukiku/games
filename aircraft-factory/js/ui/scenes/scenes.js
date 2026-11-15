// シーン(全画面のピクセルアニメーション)の管理。試験飛行などの演出はここに登録して使う。
//
// 新しいシーンの作り方:
//   AF.ui.scenes.register('名前', {
//     title: '見出し',
//     init: function (params, sc) { … sc.w, sc.h は描画サイズ(480×270)。準備した値は this に持つ },
//     update: function (dt, t) { … dt: 経過ms, t: 開始からのms。true を返すと終了(最後のコマで止まる) },
//     draw: function (ctx, t) { … 480×270 のキャンバスに描く(にじみなしで画面いっぱいに拡大される) }
//   });
//   AF.ui.scenes.open('名前', { 任意の引数 });
// シーンの表示中、ゲームの時計は止まる(閉じると元の速度に戻る)。
(function (AF) {
  'use strict';
  var W = 480, H = 270;
  var scenes = { registry: {}, current: null, _raf: 0 };

  scenes.register = function (name, def) { scenes.registry[name] = def; };

  scenes.open = function (name, params) {
    var def = scenes.registry[name];
    if (!def) return;
    scenes.close();
    var root = document.getElementById('scene-root');
    root.innerHTML = '<div class="scene"><div class="scene-frame"><canvas width="' + W + '" height="' + H + '"></canvas>' +
      '<div class="scene-bar"><b>' + AF.ui.esc(def.title || '') + '</b><span id="scene-caption"></span>' +
      '<button data-action="scene.replay">もう一度</button><button class="primary" data-action="scene.close">とじる</button></div></div></div>';
    var canvas = root.querySelector('canvas'), ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    var inst = Object.create(def);
    var cur = { name: name, params: params, inst: inst, ctx: ctx, t: 0, last: 0, ended: false, prevSpeed: AF.core.clock.speed };
    scenes.current = cur;
    AF.core.clock.setSpeed(0);
    inst.init(params || {}, { w: W, h: H, caption: function (text) { var el = document.getElementById('scene-caption'); if (el) el.textContent = text; } });
    function loop(now) {
      if (scenes.current !== cur) return;
      var dt = Math.min(60, now - (cur.last || now)); cur.last = now;
      if (!cur.ended) { cur.t += dt; cur.ended = !!inst.update(dt, cur.t); }
      inst.draw(ctx, cur.t);
      scenes._raf = requestAnimationFrame(loop);
    }
    scenes._raf = requestAnimationFrame(loop);
  };

  scenes.close = function () {
    var cur = scenes.current;
    if (!cur) return;
    scenes.current = null;
    cancelAnimationFrame(scenes._raf);
    document.getElementById('scene-root').innerHTML = '';
    AF.core.clock.setSpeed(cur.prevSpeed);
  };

  AF.ui.on('scene.close', function () { scenes.close(); });
  AF.ui.on('scene.replay', function () {
    var cur = scenes.current;
    if (cur) { var speed = cur.prevSpeed; scenes.open(cur.name, cur.params); scenes.current.prevSpeed = speed; }
  });

  AF.ui.scenes = scenes;
})(window.AF);
