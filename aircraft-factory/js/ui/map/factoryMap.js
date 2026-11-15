// 工場マップ(クォータービュー)。升目の床に設備を置く。画面の主役で、常に描き続ける。
//   操作: ドラッグ(指1本)で移動 / ホイール・ピンチ(指2本)で拡大縮小 / タップで設備を選ぶ・置く
//   map.placing = { type }(新しく買って置く)か { type, moveUid }(置き直す)のとき、設置モード。
(function (AF) {
  'use strict';
  var iso = AF.ui.iso, fx = AF.ui.mapFx;
  var MARGIN = 5, FAR = '#5f9a4c';
  var BUBBLE_Z = { lathe: 22, weld: 26, inspect: 26, press: 40, jig: 36, test: 30 };  // 吹き出しを出す高さ(設備の背丈)
  var map = { canvas: null, ctx: null, zoom: 3, panX: 0, panY: 0, hover: null, placing: null, selected: null, _bg: null, _last: 0 };
  function G() { return AF.data.CONFIG.GRID; }
  function state() { return AF.core.store.state; }

  // ---- 背景(草地・道・壁・床・木)は一度だけ描いて使い回す ----
  function hash(a, b) { var n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return n - Math.floor(n); }
  function buildBackground() {
    var W = G().w, H = G().h;
    var bgx = (H + 2 * MARGIN) * 16, bgy = MARGIN * 16 + 56;
    var c = AF.ui.pix.canvas((W + H + 4 * MARGIN) * 16, (W + H + 4 * MARGIN) * 8 + 70), ctx = c.getContext('2d');
    var u, v;
    // 草地
    for (u = -MARGIN; u < W + MARGIN; u++) for (v = -MARGIN; v < H + MARGIN; v++) {
      iso.tile(ctx, bgx, bgy, u, v, hash(u, v) > 0.5 ? '#6fae56' : '#69a851');
      if (hash(u + 9, v) > 0.7) { var s = iso.toScreen(u + 0.5, v + 0.5, 0); ctx.fillStyle = '#4f9044'; ctx.fillRect(bgx + s[0] | 0, bgy + s[1] | 0, 2, 1); }
      if (hash(u, v + 5) > 0.93) { var q = iso.toScreen(u + 0.3, v + 0.6, 0); ctx.fillStyle = '#f2e27a'; ctx.fillRect(bgx + q[0] | 0, bgy + q[1] | 0, 1, 1); }
    }
    // 道(床の手前を横切る)
    for (u = -MARGIN; u < W + MARGIN; u++) {
      iso.tile(ctx, bgx, bgy, u, H + 1, '#8f8778', 1, 1.2);
      if (u % 2 === 0) iso.tile(ctx, bgx, bgy, u + 0.2, H + 1.55, '#d9cfb8', 0.6, 0.08);
    }
    iso.tile(ctx, bgx, bgy, W / 2 - 1, H, '#a39a88', 2, 1); // 門から道へ
    // 奥の木
    var trees = [];
    for (u = -MARGIN; u < W + MARGIN; u++) for (v = -MARGIN; v < H + MARGIN; v++) {
      var inside = u >= -1 && u <= W && v >= -1 && v <= H + 2;
      if (!inside && hash(u * 3, v * 7) > 0.72) trees.push([u, v]);
    }
    trees.filter(function (t) { return t[0] < 0 || t[1] < 0; }).forEach(function (t) {
      var p = iso.toScreen(t[0], t[1], 0);
      ctx.drawImage(iso.treeSprite((t[0] + t[1]) & 1), bgx + p[0] - 16, bgy + p[1] - 34);
    });
    // 奥の壁(窓つき)
    var wall = '#e6d3ae', glass = '#a8dbe0';
    function P(a, b, z) { var p = iso.toScreen(a, b, z); return [p[0] + bgx, p[1] + bgy]; }
    for (u = 0; u < W; u++) {
      iso.box(ctx, bgx, bgy, u, -0.2, 1, 0.2, 0, 24, wall);
      iso.poly(ctx, [P(u + .25, 0, 18), P(u + .75, 0, 18), P(u + .75, 0, 9), P(u + .25, 0, 9)], glass);
    }
    for (v = 0; v < H; v++) {
      iso.box(ctx, bgx, bgy, -0.2, v, 0.2, 1, 0, 24, wall);
      iso.poly(ctx, [P(0, v + .25, 18), P(0, v + .75, 18), P(0, v + .75, 9), P(0, v + .25, 9)], glass);
    }
    iso.box(ctx, bgx, bgy, -0.2, -0.2, 0.2, 0.2, 0, 28, '#c8433a');
    // 床(板張りの市松)
    iso.tile(ctx, bgx, bgy, -0.06, -0.06, '#7a5f45', W + 0.12, H + 0.12);
    for (u = 0; u < W; u++) for (v = 0; v < H; v++) {
      iso.tile(ctx, bgx, bgy, u + 0.03, v + 0.03, (u + v) % 2 ? '#dcc59a' : '#d2ba8c', 0.94, 0.94);
    }
    // 手前の木
    trees.filter(function (t) { return !(t[0] < 0 || t[1] < 0); }).forEach(function (t) {
      var p = iso.toScreen(t[0], t[1], 0);
      ctx.drawImage(iso.treeSprite((t[0] + t[1]) & 1), bgx + p[0] - 16, bgy + p[1] - 34);
    });
    c.ox = bgx; c.oy = bgy;
    return c;
  }

  // ---- カメラ ----
  map.center = function () {
    var W = G().w, H = G().h, r = map.canvas.getBoundingClientRect();
    map.zoom = Math.max(2, Math.min(4, Math.floor(Math.min(r.width / ((W + H) * 18), r.height / ((W + H) * 10)))));
    map.panX = r.width / 2 - (W - H) * 8 * map.zoom;
    map.panY = r.height / 2 - (W + H) * 4 * map.zoom + 10;
  };
  function zoomAt(cx, cy, factor) {
    var z = Math.max(1, Math.min(8, map.zoom * factor));
    map.panX = cx - (cx - map.panX) * z / map.zoom;
    map.panY = cy - (cy - map.panY) * z / map.zoom;
    map.zoom = z;
  }
  function tileAt(cx, cy) {
    var t = iso.toTile((cx - map.panX) / map.zoom, (cy - map.panY) / map.zoom);
    return { x: Math.floor(t[0]), y: Math.floor(t[1]) };
  }
  function resize() {
    var c = map.canvas, dpr = window.devicePixelRatio || 1;
    c.width = Math.round(c.clientWidth * dpr); c.height = Math.round(c.clientHeight * dpr);
  }

  // ---- 入力(マウス・タッチ共通の pointer イベント) ----
  function bindInput(c) {
    var pts = {}, moved = 0, pinch = 0, last = null;
    function pos(e) { var r = c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function list() { return Object.keys(pts).map(function (k) { return pts[k]; }); }
    c.addEventListener('pointerdown', function (e) {
      c.setPointerCapture(e.pointerId);
      pts[e.pointerId] = pos(e);
      var l = list();
      if (l.length === 1) { moved = 0; last = l[0]; }
      if (l.length === 2) { pinch = Math.hypot(l[0].x - l[1].x, l[0].y - l[1].y); moved = 99; }
    });
    c.addEventListener('pointermove', function (e) {
      var p = pos(e);
      if (!pts[e.pointerId]) { map.hover = tileAt(p.x, p.y); return; }
      var prev = pts[e.pointerId];
      pts[e.pointerId] = p;
      var l = list();
      if (l.length === 1) {
        map.panX += p.x - prev.x; map.panY += p.y - prev.y;
        moved += Math.abs(p.x - prev.x) + Math.abs(p.y - prev.y);
        map.hover = tileAt(p.x, p.y);
      } else if (l.length === 2) {
        var d = Math.hypot(l[0].x - l[1].x, l[0].y - l[1].y);
        if (pinch > 0) zoomAt((l[0].x + l[1].x) / 2, (l[0].y + l[1].y) / 2, d / pinch);
        pinch = d;
        map.panX += (p.x - prev.x) / 2; map.panY += (p.y - prev.y) / 2;
      }
    });
    function up(e) {
      var p = pts[e.pointerId];
      delete pts[e.pointerId];
      if (p && moved < 8 && e.type === 'pointerup') tap(p.x, p.y);
      if (e.pointerType !== 'mouse') map.hover = map.placing ? map.hover : null;
    }
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('pointerleave', function () { if (!Object.keys(pts).length) map.hover = null; });
    c.addEventListener('wheel', function (e) {
      e.preventDefault();
      var p = pos(e);
      zoomAt(p.x, p.y, e.deltaY < 0 ? 1.18 : 1 / 1.18);
    }, { passive: false });
  }

  function tap(cx, cy) {
    var st = state();
    if (!st) return;
    var t = tileAt(cx, cy);
    if (map.placing) {
      map.hover = t;
      AF.ui.run('map.place', { x: t.x, y: t.y });
      return;
    }
    var hit = AF.systems.facilities.at(st, t.x, t.y);
    map.selected = hit ? hit.uid : null;
    AF.core.store.notify('action');
  }

  // 設備の種類ごとの稼働状況 { type: { on, waiting, job } }
  function workStatus(st) {
    var out = {};
    st.jobs.forEach(function (j) {
      if (out[j.facility]) { if (!out[j.facility].on && (j.status === 'active' || j.status === 'rework')) { out[j.facility] = { on: true, job: j }; } return; }
      out[j.facility] = { on: j.status === 'active' || j.status === 'rework', waiting: j.status === 'waiting', job: j };
    });
    return out;
  }

  // ---- 1コマ描く ----
  map.frame = function (now) {
    requestAnimationFrame(map.frame);
    var st = state(), c = map.canvas, ctx = map.ctx;
    if (!st || !c.clientWidth) return;
    var dt = Math.min(100, now - (map._last || now)); map._last = now;
    var dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(c.clientWidth * dpr) || c.height !== Math.round(c.clientHeight * dpr)) resize();
    var clock = AF.core.clock, running = clock.speed > 0 && !st.finished && !st.bankrupt;
    fx.update(st, dt, running, clock.speed);
    if (AF.ui.hud) AF.ui.hud.tick(st, dt);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = FAR; ctx.fillRect(0, 0, c.width, c.height);
    var z = map.zoom * dpr;
    ctx.setTransform(z, 0, 0, z, Math.round(map.panX * dpr), Math.round(map.panY * dpr));
    ctx.imageSmoothingEnabled = false;
    if (!map._bg) map._bg = buildBackground();
    ctx.drawImage(map._bg, -map._bg.ox, -map._bg.oy);

    var S = AF.systems, IDX = AF.data.index;
    var frame = running ? Math.floor(now / 170) % 4 : 0;
    var work = workStatus(st);

    // 設置モードの下敷き(置ける=緑、置けない=赤)
    if (map.placing && map.hover) {
      var size = IDX.facilities[map.placing.type].size;
      var ok = S.facilities.canPlace(st, map.placing.type, map.hover.x, map.hover.y, map.placing.moveUid);
      iso.tile(ctx, 0, 0, map.hover.x, map.hover.y, ok ? 'rgba(106,168,79,0.75)' : 'rgba(200,67,58,0.75)', size[0], size[1]);
    } else if (map.hover && map.hover.x >= 0 && map.hover.y >= 0 && map.hover.x < G().w && map.hover.y < G().h) {
      iso.tile(ctx, 0, 0, map.hover.x, map.hover.y, 'rgba(255,247,230,0.35)');
    }

    // 奥から手前へ並べて描く
    var items = [];
    st.layout.forEach(function (p) {
      if (map.placing && map.placing.moveUid === p.uid) return;
      var s = IDX.facilities[p.type].size;
      items.push({ depth: p.x + s[0] + p.y + s[1] - 0.5, fac: p });
    });
    fx.workers.forEach(function (w) { items.push({ depth: w.u + w.v, worker: w }); });
    items.sort(function (a, b) { return a.depth - b.depth; });
    items.forEach(function (it) {
      if (it.worker) { fx.drawWorker(ctx, it.worker); return; }
      var p = it.fac, sz = IDX.facilities[p.type].size, w = work[p.type];
      var top = iso.toScreen(p.x, p.y, 0);
      if (map.selected === p.uid) iso.tile(ctx, 0, 0, p.x, p.y, 'rgba(242,193,78,0.8)', sz[0], sz[1]);
      else iso.tile(ctx, 0, 0, p.x + 0.08, p.y + 0.08, 'rgba(43,34,51,0.18)', sz[0], sz[1]);
      var spr = iso.facilitySprite(p.type, frame, !!(w && w.on && running));
      ctx.drawImage(spr, top[0] - spr.ox, top[1] - spr.oy + fx.dropOffset(p.uid));
    });

    // トラック
    if (fx.truck) {
      var tp = iso.toScreen(fx.truck.u, G().h + 1.1, 0), ts = iso.truckSprite();
      ctx.drawImage(ts, Math.round(tp[0]) - 24, Math.round(tp[1]) - 26 + (fx.truck.phase !== 1 && Math.floor(now / 120) % 2 ? 1 : 0));
    }

    // 設置モードのゴースト
    if (map.placing && map.hover) {
      var g = iso.facilitySprite(map.placing.type, 0, false), gp = iso.toScreen(map.hover.x, map.hover.y, 0);
      ctx.globalAlpha = 0.7; ctx.drawImage(g, gp[0] - g.ox, gp[1] - g.oy); ctx.globalAlpha = 1;
    }

    // 吹き出し: 作っている品目のアイコンと進み具合 / 不足は「!」
    var seen = {};
    st.layout.forEach(function (p) {
      var w = work[p.type];
      if (!w || seen[p.type]) return;
      seen[p.type] = true;
      var sz = IDX.facilities[p.type].size, a = iso.toScreen(p.x + sz[0] / 2, p.y + sz[1] / 2, BUBBLE_Z[p.type] || 26);
      var bx = Math.round(a[0]) - 10, by = Math.round(a[1]) - 20 + (running ? Math.round(Math.sin(now / 300) * 1.5) : 0);
      ctx.fillStyle = '#2b2233'; ctx.fillRect(bx - 1, by, 22, 20); ctx.fillRect(bx, by - 1, 20, 22); ctx.fillRect(bx + 8, by + 21, 4, 2);
      ctx.fillStyle = w.waiting && !w.on ? '#f0d2cb' : '#fff7e6'; ctx.fillRect(bx, by, 20, 20); ctx.fillRect(bx + 9, by + 20, 2, 2);
      if (w.waiting && !w.on) {
        ctx.fillStyle = '#c8433a'; ctx.fillRect(bx + 8, by + 3, 4, 9); ctx.fillRect(bx + 8, by + 14, 4, 3);
      } else {
        var name = w.job.kind === 'part' ? w.job.itemId : (w.job.kind === 'aircraft' ? 'plane' : 'work');
        ctx.drawImage(AF.ui.pix.iconCanvas(name), bx + 2, by + 1);
        ctx.fillStyle = '#5a5560'; ctx.fillRect(bx + 2, by + 17, 16, 2);
        ctx.fillStyle = '#6aa84f'; ctx.fillRect(bx + 2, by + 17, Math.round(16 * Math.min(1, w.job.workDone / (w.job.workTotal || 1))), 2);
      }
    });

    // 粒
    fx.particles.forEach(function (p) { ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); });

    // 浮かぶ数字(画面座標で描く)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = '16px PixelLatin, PixelJP, monospace'; ctx.textBaseline = 'top';
    fx.floaters.forEach(function (f) {
      var s = iso.toScreen(f.u, f.v, f.z), k = f.t / 1500;
      var x = Math.round(s[0] * map.zoom + map.panX) - 18, y = Math.round(s[1] * map.zoom + map.panY - k * 46);
      ctx.globalAlpha = k > 0.75 ? (1 - k) * 4 : 1;
      if (f.icon) { ctx.imageSmoothingEnabled = false; ctx.drawImage(AF.ui.pix.iconCanvas(f.icon), x - 20, y - 2, 16 * 1.25, 16 * 1.25); }
      ctx.fillStyle = '#2b2233';
      [[-2, 0], [2, 0], [0, -2], [0, 2]].forEach(function (o) { ctx.fillText(f.text, x + o[0], y + o[1]); });
      ctx.fillStyle = f.color; ctx.fillText(f.text, x, y);
      ctx.globalAlpha = 1;
    });
  };

  map.init = function (canvas) {
    map.canvas = canvas; map.ctx = canvas.getContext('2d');
    resize(); map.center(); bindInput(canvas);
    window.addEventListener('resize', resize);
    requestAnimationFrame(map.frame);
  };
  // 設置モードを始める/やめる
  map.startPlacing = function (type, moveUid) { map.placing = { type: type, moveUid: moveUid || null }; map.selected = null; };
  map.stopPlacing = function () { map.placing = null; };

  AF.ui.map = map;
})(window.AF);
