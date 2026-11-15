// 工場マップの上の動くもの: 歩く工員、納入のトラック、浮かぶ数字、火花やほこり。
// ゲームの状態(state)には入れない、見た目だけの存在。きっかけは state.fx(core/log.js の fx)から拾う。
(function (AF) {
  'use strict';
  var iso = AF.ui.iso;
  var fx = {
    workers: [],      // { u, v, tu, tv, wait, type, step }
    floaters: [],     // { u, v, z, text, icon, color, t }
    particles: [],    // { x, y, vx, vy, life, color } (ワールド座標)
    drops: {},        // 設置アニメ: 設備uid → 経過ms
    truck: null,      // { u, phase, t }
    truckQueue: 0,
    lastSeq: 0
  };
  function G() { return AF.data.CONFIG.GRID; }

  fx.reset = function (state) {
    fx.workers = []; fx.floaters = []; fx.particles = []; fx.drops = {}; fx.truck = null; fx.truckQueue = 0;
    fx.lastSeq = state ? state.fxSeq : 0;
  };

  function freeSpot(state) {
    for (var i = 0; i < 20; i++) {
      var x = Math.floor(Math.random() * G().w), y = Math.floor(Math.random() * G().h);
      if (!AF.systems.facilities.at(state, x, y)) return [x + 0.3 + Math.random() * 0.4, y + 0.3 + Math.random() * 0.4];
    }
    return [0.5, 0.5];
  }
  // 設備のすぐ手前(作業位置)
  function nearMachine(state) {
    if (!state.layout.length) return freeSpot(state);
    var p = state.layout[Math.floor(Math.random() * state.layout.length)];
    var s = AF.data.index.facilities[p.type].size;
    return [p.x + Math.random() * s[0], Math.min(G().h - 0.2, p.y + s[1] + 0.25)];
  }

  // 工員の人数を在籍数に合わせる(画面上は最大24人)
  function syncWorkers(state) {
    var want = [];
    for (var i = 0; i < Math.min(12, state.staff.skilled); i++) want.push('skilled');
    for (var j = 0; j < Math.min(12, state.staff.general); j++) want.push('general');
    while (fx.workers.length > want.length) fx.workers.pop();
    while (fx.workers.length < want.length) {
      var s = freeSpot(state);
      fx.workers.push({ u: s[0], v: s[1], tu: s[0], tv: s[1], wait: Math.random() * 2000, type: 'general', step: 0 });
    }
    fx.workers.forEach(function (w, k) { w.type = want[k]; });
  }

  // state.fx の新着を演出に変える
  function consume(state) {
    state.fx.forEach(function (e) {
      if (e.seq <= fx.lastSeq) return;
      if (e.type === 'jobDone') {
        var p = state.layout.filter(function (q) { return q.type === e.facility; })[0];
        if (p) {
          var icon = e.kind === 'part' ? e.itemId : 'plane';
          fx.floaters.push({ u: p.x + 0.5, v: p.y + 0.5, z: 34, text: '+' + e.qty, icon: icon, color: '#fff7e6', t: 0 });
          fx.burst(p.x + 0.5, p.y + 0.5, 20, '#f2c14e', 8);
        }
      } else if (e.type === 'deliver') {
        if (fx.truck) fx.truckQueue = Math.min(2, fx.truckQueue + 1);
        else fx.truck = { u: -6, phase: 0, t: 0 };
      } else if (e.type === 'build') {
        fx.drops[e.uid] = 0;
      }
    });
    fx.lastSeq = state.fxSeq;
  }

  // ぱっと散る粒
  fx.burst = function (u, v, z, color, n) {
    var s = iso.toScreen(u, v, z);
    for (var i = 0; i < n; i++) {
      fx.particles.push({ x: s[0], y: s[1], vx: (Math.random() - 0.5) * 0.06, vy: -Math.random() * 0.06 - 0.01, life: 500 + Math.random() * 300, color: color });
    }
  };

  // dt: 経過ms。running: 時計が動いているか(止まっている間、工員とトラックは止まる)
  fx.update = function (state, dt, running, speed) {
    syncWorkers(state);
    consume(state);
    var k = running ? Math.min(2.2, 0.8 + speed * 0.35) : 0;

    fx.workers.forEach(function (w) {
      if (!k) return;
      var du = w.tu - w.u, dv = w.tv - w.v, dist = Math.sqrt(du * du + dv * dv);
      if (dist < 0.05) {
        w.wait -= dt * k;
        if (w.wait <= 0) {
          var t = Math.random() < 0.65 ? nearMachine(state) : freeSpot(state);
          w.tu = t[0]; w.tv = t[1]; w.wait = 800 + Math.random() * 2600;
        }
        return;
      }
      var move = Math.min(dist, 0.0016 * dt * k);
      w.u += du / dist * move; w.v += dv / dist * move; w.step += dt * k;
    });

    if (fx.truck) {
      var tr = fx.truck, stop = G().w / 2 - 0.5;
      if (tr.phase === 0) { tr.u += 0.006 * dt; if (tr.u >= stop) { tr.u = stop; tr.phase = 1; tr.t = 0; } }
      else if (tr.phase === 1) { tr.t += dt; if (tr.t > 700) tr.phase = 2; }
      else { tr.u += 0.007 * dt; if (tr.u > G().w + 8) { fx.truck = fx.truckQueue-- > 0 ? { u: -6, phase: 0, t: 0 } : null; if (fx.truckQueue < 0) fx.truckQueue = 0; } }
    }

    fx.floaters.forEach(function (f) { f.t += dt; });
    fx.floaters = fx.floaters.filter(function (f) { return f.t < 1500; });
    fx.particles.forEach(function (p) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.00012 * dt; p.life -= dt; });
    fx.particles = fx.particles.filter(function (p) { return p.life > 0; });
    Object.keys(fx.drops).forEach(function (uid) {
      var before = fx.drops[uid];
      fx.drops[uid] += dt;
      if (before < 320 && fx.drops[uid] >= 320) {
        var p = state.layout.filter(function (q) { return q.uid === uid; })[0];
        if (p) { var s = AF.data.index.facilities[p.type].size; fx.burst(p.x + s[0] / 2, p.y + s[1] / 2, 2, '#d9cfb8', 14); }
      }
      if (fx.drops[uid] > 900) delete fx.drops[uid];
    });
  };

  // 設置アニメ中の、上からの落下量(画素)
  fx.dropOffset = function (uid) {
    var t = fx.drops[uid];
    if (t == null || t >= 320) return 0;
    var k = 1 - t / 320;
    return -Math.round(k * k * 36);
  };

  // 工員1人を描く(ワールド座標の ctx に)
  fx.drawWorker = function (ctx, w) {
    var s = iso.toScreen(w.u, w.v, 0), x = Math.round(s[0]) - 2, y = Math.round(s[1]) - 8;
    var skilled = w.type === 'skilled', walk = Math.floor(w.step / 140) % 2;
    ctx.fillStyle = 'rgba(43,34,51,0.25)'; ctx.fillRect(x - 1, y + 8, 6, 1);
    ctx.fillStyle = '#2b2233'; ctx.fillRect(x - 1, y - 1, 6, 4); ctx.fillRect(x - 2, y + 2, 8, 5); ctx.fillRect(x - 1, y + 6, 6, 3);
    ctx.fillStyle = skilled ? '#2f5d8a' : '#9a6a3f'; ctx.fillRect(x, y, 4, 1);          // 帽子
    ctx.fillStyle = '#f0c8a0'; ctx.fillRect(x, y + 1, 4, 2);                             // 顔
    ctx.fillStyle = skilled ? '#4f8fc0' : '#d9b380'; ctx.fillRect(x - 1, y + 3, 6, 3);   // 胴と腕
    ctx.fillStyle = '#f0c8a0'; ctx.fillRect(x - 1, y + 5, 1, 1); ctx.fillRect(x + 4, y + 5, 1, 1);
    ctx.fillStyle = skilled ? '#2f5d8a' : '#5f3d24';                                     // 脚(歩くと交互に動く)
    ctx.fillRect(x, y + 6, 2, walk ? 2 : 1); ctx.fillRect(x + 2, y + 6, 2, walk ? 1 : 2);
  };

  AF.ui.mapFx = fx;
})(window.AF);
