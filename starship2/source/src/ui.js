// ===================================================================
// GAME — mission flow, HUD, input, audio
// ===================================================================
(function () {
  'use strict';
  const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
  const D2R = Math.PI / 180, RE = SIM.RE, TAU = Math.PI * 2, clamp = SIM.clamp, CFG = SIM.CFG;
  const WARPS = [1, 2, 4, 8, 16, 32, 64], OMEGA = 7.2921e-5;   // Earth's spin, rad/s
  const cam = GFX.cam;
  let S = SIM.newState({ sats: 3 });
  const gx = { ignite: 0, arms: 0, booster: null, sats: [null, null, null], ufos: [null, null, null, null], laser: null, debris: null, exploded: false, satCam: null, rotE: 0 };
  const G = { mode: 'load', diff: 1, level: 'assist', paused: false, warp: 1, ctl: { sx: 0, sy: 0, thr: 0, precision: false, tx: 0, ty: 0 },
    haz: [], sat: null, satAcc: [], needReturn: false, okT: 0, ref: null, trail: [], entryR: 3500e3, tp: { u: 0, d: 0, f: 0, b: 0 }, satStick: { x: 0, y: 0 },
    countdown: -1, windows: [], ufo: null, milestone: -1, cp: null, score: { s1: 0, s2: 0, s3: 0 }, flags: {}, endT: -1, endKind: '',
    stick: { x: 0, y: 0 }, keys: {}, predT: 0, hudT: 0, actKey: '', teleKey: '', orbit0: 0, best: 0, prevScreen: null, small: false };
  const fmt = (v, d) => v.toFixed(d === undefined ? 0 : d);
  const km = v => fmt(v / 1000, Math.abs(v) < 99950 ? 1 : 0);

  // ----------------------------- audio -----------------------------
  const AU = { ctx: null, on: true,
    init() { if (this.ctx) return; try { const C = window.AudioContext || window.webkitAudioContext; const c = this.ctx = new C();
        const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = buf.getChannelData(0); let b = 0; for (let i = 0; i < d.length; i++) { b = b * 0.985 + (Math.random() * 2 - 1) * 0.12; d[i] = b; }
        const mk = (type, f) => { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; const g = c.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(this.master); s.start(); return { fl, g }; };
        this.master = c.createGain(); this.master.gain.value = 0.9; this.master.connect(c.destination);
        this.eng = mk('lowpass', 220); this.wind = mk('bandpass', 900);
      } catch (e) { this.ctx = null; } },
    set(eng, engF, wind) { if (!this.ctx) return; const t = this.ctx.currentTime, on = this.on && !G.paused && G.mode === 'play' ? 1 : 0;
      this.eng.g.gain.setTargetAtTime(eng * 2.2 * on, t, 0.08); this.eng.fl.frequency.setTargetAtTime(engF, t, 0.1); this.wind.g.gain.setTargetAtTime(wind * 0.9 * on, t, 0.1); },
    beep(f, d, type, vol) { if (!this.ctx || !this.on) return; try { const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type || 'sine'; o.frequency.value = f; g.gain.value = vol || 0.08; g.gain.setTargetAtTime(0, c.currentTime + d * 0.6, d * 0.2); o.connect(g); g.connect(this.master); o.start(); o.stop(c.currentTime + d + 0.2); } catch (e) {} },
    zap() { if (!this.ctx || !this.on) return; try { const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(1800, c.currentTime); o.frequency.exponentialRampToValueAtTime(240, c.currentTime + 0.16); g.gain.value = 0.06; g.gain.setTargetAtTime(0, c.currentTime + 0.1, 0.04); o.connect(g); g.connect(this.master); o.start(); o.stop(c.currentTime + 0.3); } catch (e) {} },
    boom() { if (!this.ctx || !this.on) return; try { const c = this.ctx, t = c.currentTime; this.eng.g.gain.cancelScheduledValues(t); this.eng.g.gain.setValueAtTime(3.2, t); this.eng.g.gain.setTargetAtTime(0, t + 0.15, 0.5); } catch (e) {} }
  };

  // --------------------------- messages ---------------------------
  function say(head, text, cls) {
    const p = document.createElement('p'); if (cls) p.className = cls; p.textContent = head; if (text) { const s = document.createElement('small'); s.textContent = text; p.appendChild(s); }
    const c = $('#comm'); c.appendChild(p); while (c.children.length > 3) c.removeChild(c.firstChild);
    setTimeout(() => p.classList.add('out'), 5200); setTimeout(() => p.remove(), 6200);
    AU.beep(cls === 'crit' ? 320 : cls === 'warn' ? 520 : 880, 0.14, cls === 'crit' ? 'square' : 'sine', 0.05);
  }
  const MILES = ['起飞', 'MAX-Q', '分离', '入轨', '部署', '离轨', '再入', '翻转', '捕获'];
  function mile(i) { if (i > G.milestone) G.milestone = i; drawLine(); }
  function drawLine() {
    const l = $('#line'); if (!l.dataset.b) { l.dataset.b = 1; MILES.forEach((m, i) => { const s = document.createElement('span'); s.textContent = m; s.style.left = (i / (MILES.length - 1) * 100) + '%'; l.appendChild(s); }); }
    $$('#line span').forEach((s, i) => s.classList.toggle('done', i <= G.milestone));
    l.querySelector('i').style.width = (Math.max(0, G.milestone) / (MILES.length - 1) * 100) + '%';
  }
  function warpCap(n) { if (G.warp > n) G.warp = n; }
  function flash(a) { const f = $('#flash'); f.style.transition = 'none'; f.style.opacity = a; requestAnimationFrame(() => { f.style.transition = 'opacity .6s'; f.style.opacity = 0; }); }

  // --------------------------- mission setup ---------------------------
  function resetGx() { Object.assign(gx, { ignite: 0, arms: 0, booster: null, sats: [null, null, null], ufos: [null, null, null, null], laser: null, debris: null, exploded: false, satCam: null, rotE: 0 }); $('#cheer').hidden = true; GFX.pPad.clear(); GFX.pShip.clear(); GFX.pFire.clear(); }
  function setView(v) { cam.view = v; $$('#cams button').forEach(b => b.classList.toggle('on', b.dataset.c === v)); }
  function camPreset(az, el, dist) { cam.az = az; cam.el = el; cam.dist = dist; }
  function applyLevel() {
    S.auto = G.level === 'auto'; S.assist = G.level !== 'manual';
    if (!S.auto) { G.ctl.thr = S.phase === 'PRE' ? 0 : S.thr; S.apDeorbit = S.apBurning = S.apReturn = false; S.apAvoid = 0; if (S.att === 'CMD') S.att = S.assist ? 'FD' : 'MAN'; }
    if (G.level === 'manual' && (S.att === 'FD' || S.att === 'PRO' || S.att === 'RETRO')) S.att = 'MAN';
    S.athr = G.level === 'assist' && S.phase === 'LAND';
    $$('#assist button,#massist button').forEach(b => b.classList.toggle('on', b.dataset.a === G.level));
    $('#adesc').textContent = { auto: '自动驾驶飞完全程，你下达关键指令：发射、部署、规避、离轨。得分 ×0.6。', assist: '你来飞。飞控计算机替你稳住姿态，你给目标：指引、攻角、落点。着陆时有自动油门。得分 ×1.0。', manual: '纯手动：摇杆直接驱动喷气、襟翼配平和发动机摆角，没有姿态保持。得分 ×1.4。' }[G.level];
  }
  function newMission() {
    S = SIM.newState({ sats: G.diff === 0 ? 1 : 3 }); resetGx();
    Object.assign(G, { countdown: -1, windows: [], haz: [], sat: null, satAcc: [], needReturn: false, okT: 0, ref: null, trail: [], ufo: null, milestone: -1, score: { s1: 0, s2: 0, s3: 0 }, flags: {}, warp: 1, endT: -1, paused: false, orbit0: 0, actKey: '', teleKey: '' });
    G.ctl.thr = 0; applyLevel(); setView('EXT'); camPreset(0.55, 0.06, 300); cam.offX = 0; drawLine();
    $('#comm').innerHTML = '';
  }
  function showScreen(id) { ['menu', 'card', 'load'].forEach(k => { $('#' + k).hidden = k !== id; }); $('#hud').hidden = !(G.mode === 'play' || (G.mode === 'card' && id === 'card')); }
  function toMenu() {
    G.mode = 'menu'; S = SIM.newState({ sats: 3 }); resetGx(); setView('EXT'); camPreset(0.9, 0.04, 330); cam.offX = innerWidth > innerHeight ? 0.42 : 0;
    showScreen('menu'); $('#bcont').hidden = !G.cp; $('#best').textContent = G.best ? 'BEST ' + G.best : '';
    $$('#diff .opt').forEach(b => { const on = +b.dataset.d === G.diff; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    applyLevel();
  }
  function startMission(cp) {
    AU.init(); if (AU.ctx && AU.ctx.state === 'suspended') AU.ctx.resume();
    G.mode = 'play'; cam.offX = 0;
    if (cp) restore(cp); else newMission();
    showScreen(null); $('#hud').hidden = false;
    if (innerHeight > innerWidth && !G.flags.rot) $('#rot').classList.add('show');
  }
  function checkpoint(stage) {
    const keep = S.pred, ks = S.std; S.pred = null; S.std = null;
    G.cp = { stage, diff: G.diff, S: JSON.stringify(S), windows: JSON.parse(JSON.stringify(G.windows)), haz: JSON.parse(JSON.stringify(G.haz)), satAcc: G.satAcc.slice(), needReturn: G.needReturn, ufoDone: !!(G.ufo && G.ufo.done), ufoKilled: G.ufo ? G.ufo.killed : 0, score: Object.assign({}, G.score), milestone: G.milestone, orbit0: G.orbit0, flags: Object.assign({}, G.flags) };
    S.pred = keep; S.std = ks;
    try { localStorage.setItem('mc.cp2', JSON.stringify(G.cp)); } catch (e) {}
  }
  function restore(cp) {
    G.diff = cp.diff; { const d = SIM.newState({ sats: 3 }), ps = JSON.parse(cp.S); ps.cue = Object.assign(d.cue, ps.cue); ps.eff = Object.assign(d.eff, ps.eff || {}); S = Object.assign(d, ps); }
    S.events = []; S.pred = null; S.std = null; SIM.derive(S); resetGx();
    Object.assign(G, { countdown: -1, windows: JSON.parse(JSON.stringify(cp.windows)), haz: JSON.parse(JSON.stringify(cp.haz || [])), satAcc: (cp.satAcc || []).slice(), needReturn: !!cp.needReturn, okT: 0, sat: null, ref: null, trail: [], ufo: cp.ufoDone ? { done: true, killed: cp.ufoKilled, total: 8, active: false } : null,
      milestone: cp.milestone, score: Object.assign({}, cp.score), flags: Object.assign({}, cp.flags), warp: 1, endT: -1, paused: false, orbit0: cp.orbit0, actKey: '', teleKey: '' });
    applyLevel(); G.ctl.thr = 0; drawLine(); $('#comm').innerHTML = '';
    if (S.phase === 'ENTRY' && S.spd > 700) makeRef();
    if (cp.stage === 3) { setView('EXT'); camPreset(-1.25, 0.3, 150); } else { setView('EXT'); camPreset(0.5, 0.25, 170); }
    say('CHECKPOINT', 'Stage ' + cp.stage + ' 起点');
  }

  // ------------------------------ cards ------------------------------
  function card(html, cls) { $('#sheet').className = 'sheet ' + (cls || ''); $('#sheet').innerHTML = html; G.prevMode = G.mode === 'card' ? G.prevMode : G.mode; G.mode = 'card'; G.paused = true; $('#card').hidden = false; $('#menu').hidden = true; const b = $('#sheet button'); if (b) b.focus(); }
  function closeCard() { $('#card').hidden = true; G.paused = false; G.mode = G.prevMode === 'menu' ? 'menu' : 'play'; if (G.mode === 'menu') $('#menu').hidden = false; }
  const stat = rows => '<dl class="stats">' + rows.map(r => `<dt>${r[0]}</dt><dd>${r[1]}</dd><dd class="pt">${r[2] === undefined ? '' : r[2]}</dd>`).join('') + '</dl>';
  function helpCard() {
    card(`<h2>操作说明<small>CONTROLS</small></h2>
    <dl class="keys">
      <dt>摇杆 / 方向键 WASD</dt><dd>上升与轨道：左右改变俯仰。再入：上下调攻角（上＝飞得更远），左右横移。着陆：推向哪边，飞船就往哪边平移，松手自动刹住。卫星离舰后：摇杆改为控制卫星喷气。</dd>
      <dt>平移推进 ▲▼◀▶ / I K J L</dt><dd>轨道上的侧向和轴向喷气。机头顺向时，▲▼ 改变垂直速度，◀▶ 改变切向速度。用它躲开危险带，再把三个偏差读数调回 0。</dd>
      <dt>油门条 / Shift Ctrl</dt><dd>拖动设定推力。Z 全开，X 关机。辅助模式着陆时油门自动，碰一下油门条就由你接管。</dd>
      <dt>主按钮 / 空格</dt><dd>发射、级间分离、关机、部署卫星、展开太阳翼、翻转点火。</dd>
      <dt>FD · PRO · RETRO</dt><dd>辅助模式的姿态保持：跟随指引、顺速度方向、逆速度方向。</dd>
      <dt>− N× + / , .</dt><dd>时间加速。滑行最高 64×，大气内和点火时自动受限。</dd>
      <dt>镜头 / 1–6</dt><dd>外部、襟翼、引擎、机头、地面跟踪、轨道图。外部和轨道图可拖动旋转、滚轮或双指缩放。</dd>
      <dt>精调 / F</dt><dd>降低摇杆灵敏度，最后对准塔架时用。</dd>
    </dl>
    <p>圆形姿态表：白色指针是机头，绿圈是速度方向，品红三角是预定姿态。把指针压在品红三角上就对了。</p>
    <p>姿态是真实转动出来的：真空里靠机头机尾的喷气，大气里靠前后襟翼，着陆时靠发动机摆角（力矩 τ = F·L·sinθ），转得多快取决于转动惯量。右侧"姿态执行机构"面板显示它们此刻在做什么。</p>
    <div class="btns"><button class="cta" data-act="close">明白</button></div>`);
  }
  function pauseCard() {
    card(`<h2>暂停<small>PAUSED</small></h2>
    <div class="btns" style="flex-direction:column;align-items:stretch">
      <button class="cta" data-act="close">继续飞行</button>
      ${G.cp ? `<button class="ghost" data-act="retry">从 Stage ${G.cp.stage} 检查点重试</button>` : ''}
      <button class="ghost" data-act="restart">重新开始任务</button>
      <button class="ghost" data-act="help">操作说明</button>
      <button class="ghost" data-act="sound">声音：${AU.on ? '开' : '关'}</button>
      <button class="ghost" data-act="menu">返回主菜单</button>
    </div>`);
  }
  function multiplier() { const a = S.flightTime > 0 ? clamp(S.autoTime / S.flightTime, 0, 1) : 0; return a * 0.6 + (1 - a) * (G.level === 'manual' ? 1.4 : 1); }
  function stage1Done() {
    const acc = 600 * (1 - Math.min(1, (Math.abs(S.ap - CFG.targetAlt) + Math.abs(S.pe - CFG.targetAlt)) / 120e3)), fu = 400 * Math.min(1, S.mS / 110e3);
    G.score.s1 = Math.round(acc + fu); mile(3); gx.booster = null; GFX.pShip.clear(); setupOrbit(); checkpoint(2);
    card(`<h2>入轨确认<small>STAGE 1 完成 · NOMINAL ORBIT INSERTION</small></h2>
      ${stat([['远地点 AP', km(S.ap) + ' km', ''], ['近地点 PE', km(S.pe) + ' km', '+' + Math.round(acc)], ['剩余推进剂', fmt(S.mS / 1000) + ' t', '+' + Math.round(fu)], ['最大动压', fmt(S.qMax / 1000, 1) + ' kPa', '']])}
      <p>${G.diff === 0 ? '下一步：飞到绿色窗口，机头顺向，释放卫星，再把它沿红色点线送到入轨点。' : '下一步：三个部署窗口，途中要先后躲开一片太空垃圾和一股碎石流，每次躲完都要回到 200 km 正轨。底部的轨道剖面图显示前方半圈的情况。'}滑行时用右上角的 + 加速时间。</p>
      <div class="btns"><button class="cta" data-act="close">进入轨道任务</button></div>`, 'ok');
  }
  function mkHaz(kind, off, lo, hi, ann) { return { kind, name: kind === 'rock' ? '碎石流' : '太空垃圾', phi: SIM.wrap2(S.phi + off * D2R), ang: S.ang + off * D2R, lo: CFG.targetAlt + lo, hi: CFG.targetAlt + hi, ann: S.ang + ann * D2R, state: 'idle' }; }
  function setupOrbit() {
    G.orbit0 = S.ang;
    const offs = G.diff === 0 ? [80] : [38, 190, 335];
    G.windows = offs.map((o, i) => ({ phi: SIM.wrap2(S.phi + o * D2R), half: 9 * D2R, done: false, n: i + 1 }));
    // junk: get 15 km above or below it. rocks: the stream reaches far up, so the only way past is underneath.
    G.haz = G.diff >= 1 ? [mkHaz('junk', 105, -15e3, 15e3, 50), mkHaz('rock', 262, -10e3, 60e3, 205)] : [];
    G.satAcc = []; G.sat = null; G.okT = 0; G.needReturn = !onOrbit();
    camPreset(0.5, 0.25, 170);
  }
  function stage2Done() {
    const dep = S.satsDeployed / S.sats, u = G.ufo, nh = G.haz.length, av = G.haz.filter(h => h.state === 'avoided').length;
    const acc = G.satAcc.length ? G.satAcc.reduce((a, b) => a + b, 0) / G.satAcc.length : 0;
    const sSat = (G.diff === 0 ? 1000 : G.diff === 1 ? 700 : 500) * dep * (0.5 + 0.5 * acc), sDeb = nh ? (G.diff === 1 ? 300 : 200) * av / nh : 0, sUfo = G.diff === 2 && u ? 300 * u.killed / u.total : 0;
    G.score.s2 = Math.round(sSat + sDeb + sUfo); mile(6); G.sat = null; gx.debris = null;
    S.z = (Math.random() < 0.5 ? -1 : 1) * (1200 + G.diff * 1500 + Math.random() * 1500);
    checkpoint(3); setView('EXT'); camPreset(-1.25, 0.3, 150); warpCap(4);
    const rows = [['卫星入轨', S.satsDeployed + ' / ' + S.sats + (G.satAcc.length ? ' · 精度 ' + fmt(acc * 100) + ' %' : ''), '+' + Math.round(sSat)]];
    if (nh) rows.push(['规避', av + ' / ' + nh + ' 次安全通过', '+' + Math.round(sDeb)]);
    if (G.diff === 2) rows.push(['UFO', (u ? u.killed : 0) + ' / 8', '+' + Math.round(sUfo)]);
    rows.push(['机体完好度', fmt(S.hull) + ' %', '']);
    card(`<h2>再入界面<small>STAGE 2 完成 · ENTRY INTERFACE 120 KM</small></h2>${stat(rows)}
      <p>像跳伞一样，用腹部迎风减速。前襟翼管机头、后襟翼管机尾，四片配合出俯仰和滚转力矩；空气稀薄时由喷气接手。你的任务：让攻角跟住预定值（品红三角），让白色轨迹贴住底部剖面图上的红色辅助线，别让温度越过 1427 °C。</p>
      <div class="btns"><button class="cta" data-act="close">开始再入</button></div>`, 'ok');
  }
  function payloadCard() {
    card(`<h2>全部卫星入轨<small>PAYLOAD COMPLETE · 祝贺</small></h2>${stat(G.satAcc.map((a, i) => ['卫星 ' + (i + 1) + ' 入轨精度', fmt(a * 100) + ' %', '']))}
      <p>太阳翼全部展开，星座开始工作。接下来回家：等离轨点火点转到前方，逆向点火，把落点拉到发射场。</p>
      <div class="btns"><button class="cta" data-act="close">继续</button></div>`, 'ok');
  }
  function cheer(a, b) { const c = $('#cheer'); c.querySelector('b').textContent = a; c.querySelector('span').textContent = b; c.hidden = false; c.style.animation = 'none'; void c.offsetWidth; c.style.animation = ''; clearTimeout(G.cheerT); G.cheerT = setTimeout(() => { c.hidden = true; }, 3600); AU.beep(660, 0.18); setTimeout(() => AU.beep(880, 0.18), 160); setTimeout(() => AU.beep(1320, 0.4), 320); }
  function finalCard() {
    const r = S.catchRes, s3 = Math.round(800 + 400 * (1 - r.err / CFG.catchTol) + 200 * (1 - Math.abs(r.vy) / CFG.catchVy) + 150 * (1 - r.tilt / CFG.catchTilt) + 250 * S.tps / 100 + 200 * S.hull / 100);
    G.score.s3 = s3; const m = multiplier(), tot = Math.round((G.score.s1 + G.score.s2 + s3) * m);
    const rank = tot >= 3600 ? 'S' : tot >= 3000 ? 'A' : tot >= 2200 ? 'B' : tot >= 1300 ? 'C' : 'D';
    if (tot > G.best) { G.best = tot; try { localStorage.setItem('mc.best', tot); } catch (e) {} }
    G.cp = null; try { localStorage.removeItem('mc.cp2'); } catch (e) {}
    card(`<span class="rank">${rank}</span><h2>捕获成功<small>MISSION COMPLETE · T+${clock(S.t)}</small></h2>
      ${stat([['横向误差', fmt(r.err, 1) + ' m', ''], ['接触下降率', fmt(Math.abs(r.vy), 1) + ' m/s', ''], ['姿态倾角', fmt(r.tilt / D2R, 1) + '°', ''], ['隔热瓦 / 机体', fmt(S.tps) + ' % / ' + fmt(S.hull) + ' %', ''], ['剩余推进剂', fmt(S.mS / 1000, 1) + ' t', ''],
        ['Stage 1 入轨', '', G.score.s1], ['Stage 2 轨道任务', '', G.score.s2], ['Stage 3 回收', '', s3], ['操控系数', '×' + fmt(m, 2), ''], ['总分', '', tot]])}
      <div class="btns"><button class="cta" data-act="restart">再飞一次</button><button class="ghost" data-act="menu">返回主菜单</button></div>`, 'ok');
  }
  const FAILS = {
    structure: ['结构解体', '动压和攻角载荷超过了箭体极限。穿过 Max-Q 时让机头贴着速度方向（绿圈），动压过 33 kPa 就收一点油门。'],
    suborbital: ['未能入轨', '水平速度不够，飞船落回了大气层。分离后尽早把机头压向地平线，跟住品红指引。'],
    burnup: ['再入烧毁', '隔热瓦失效，或者腹部没有迎向气流。再入时保持攻角在 50°–75°，温度逼近 1427 °C 时把攻角拉高一些。'],
    hull: ['机体损毁', '机体完好度归零。躲避危险带时，看底部剖面图：白线必须从红色方块的上方或下方绕过去。'],
    crash: ['坠毁', '撞击地面。翻转点火的高度要留够，推荐高度显示在按钮上。'],
    catch: ['捕获失败', '到达机械臂高度时超出了容差：位置 8 m、下降 6.5 m/s、水平 3.2 m/s、倾斜 9°。让黄色的预计轨迹贴住红色辅助线再下降。'],
    tower: ['撞上发射塔', '塔在捕获点北侧（靶标左方）。靠近时用精调。'],
    nocatch: ['落在场坪上', '飞船没有着陆腿，只能由机械臂接住。它错过了塔架。']
  };
  function failCard(why) {
    const f = FAILS[why] || FAILS.hull, r = S.catchRes;
    const extra = why === 'catch' && r ? stat([['横向误差', fmt(r.err, 1) + ' m', r.err <= CFG.catchTol ? '✓' : '✗'], ['下降率', fmt(Math.abs(r.vy), 1) + ' m/s', Math.abs(r.vy) <= CFG.catchVy ? '✓' : '✗'], ['水平速度', fmt(r.vh, 1) + ' m/s', r.vh <= CFG.catchVh ? '✓' : '✗'], ['倾角', fmt(r.tilt / D2R, 1) + '°', r.tilt <= CFG.catchTilt ? '✓' : '✗']]) : '';
    card(`<h2>${f[0]}<small>MISSION FAILED · T+${clock(S.t)}</small></h2><p>${f[1]}</p>${extra}
      <div class="btns">${G.cp ? `<button class="cta" data-act="retry">从 Stage ${G.cp.stage} 重试</button>` : ''}<button class="${G.cp ? 'ghost' : 'cta'}" data-act="restart">重新发射</button><button class="ghost" data-act="menu">主菜单</button></div>`, 'bad');
  }

  // the red guide line for entry: height against range-to-go of a nominal entry flown from here
  function makeRef() {
    const p = SIM.predict(S, CFG.alphaNom, 0, true); G.ref = []; G.trail = []; G.entryR = SIM.wrap2(-S.phi) * RE * 1.02;
    if (p.pts && p.pts.length > 4) { const n = p.pts.length / 2, pe = Math.atan2(p.pts[2 * n - 2], p.pts[2 * n - 1]); for (let i = 0; i < n; i++) { const x = p.pts[2 * i], y = p.pts[2 * i + 1]; G.ref.push(SIM.wrapPi(pe - Math.atan2(x, y)) * RE, Math.hypot(x, y) - RE); } G.ref.push(0, 1500); }
  }
  // ----------------------------- events -----------------------------
  function onEvent(e) {
    switch (e.name) {
      case 'LIFTOFF': say('LIFTOFF', '起飞', 'go'); mile(0); break;
      case 'MAXQ': say('MAX-Q', '最大动压 ' + fmt(e.data / 1000, 1) + ' kPa 已通过'); mile(1); break;
      case 'SEP': {
        const q = GFX.vq.clone(), n = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
        gx.booster = { x: -n.x * 72.8, y: -n.y * 72.8, z: -n.z * 72.8, vx: -n.x * 5, vy: -n.y * 5, vz: 0, q, t: 0, burn: 0, rot: 0 };
        for (let i = 0; i < 40; i++) { const a = Math.random() * 6.28; GFX.pShip.emit(-n.x * 2, -n.y * 2, 0, Math.cos(a) * 40 + n.x * 10, Math.sin(a) * 40, (Math.random() - 0.5) * 60, 1.2, 4, 30, 1, 0.9, 0.8, 0.6, 1); }
        say('STAGE SEP', '热分离，飞船发动机点火', 'go'); mile(2); G.ctl.thr = 1; cam.shake = 2; break; }
      case 'ORBIT': say('SECO', '发动机关机'); stage1Done(); break;
      case 'DEPLOY': startSat(e.data); break;
      case 'ENTRY': {
        say('ENTRY INTERFACE', '进入大气层');
        makeRef(); stage2Done(); break; }
      case 'TERMINAL': say('SUBSONIC', '亚音速，腹部朝下自由下落'); warpCap(1); if (cam.view === 'MAP') setView('EXT'); camPreset(-1.57, 0.5, 190); break;
      case 'FLIP': say('FLIP', '发动机点火，摆动喷管把飞船甩成竖直', 'go'); mile(7); warpCap(1); if (!S.auto) G.ctl.thr = 0.6; S.athr = !S.auto && G.level === 'assist'; if (cam.view === 'EXT') camPreset(-1.35, 0.1, 250); break;
      case 'CATCH': say('CATCH', '机械臂已接住飞船', 'go'); mile(8); G.endT = 3; G.endKind = 'win'; AU.beep(660, 0.2); setTimeout(() => AU.beep(990, 0.4), 180); break;
      case 'DRY': say('PROPELLANT DEPLETED', '推进剂耗尽', 'crit'); break;
      case 'FAIL': {
        const why = e.data; G.endT = why === 'suborbital' ? 0.8 : 2.4; G.endKind = why;
        if (why !== 'suborbital' && why !== 'nocatch') { gx.exploded = true; const c = GFX.shipPoint(0, 20, 0, {}); GFX.explode(c.x, c.y, c.z, true); flash(0.8); cam.shake = 5; AU.boom(); }
        say('ANOMALY', FAILS[why] ? FAILS[why][0] : '任务失败', 'crit'); break; }
    }
  }

  // ------------------------------ UFO ------------------------------
  function startUfo() {
    G.ufo = { active: true, wave: 0, waves: [2, 3, 3], energy: 100, cool: 0, killed: 0, total: 8, done: false, gap: 2.5 };
    G.warp = 1; setView('EXT'); camPreset(cam.az, 0.25, 190); say('PROXIMITY ALERT', '不明飞行物接近。点击目标开火', 'crit'); $('#laser').hidden = false;
  }
  function ufoUpdate(dt) {
    const u = G.ufo; if (!u || !u.active) return;
    u.energy = Math.min(100, u.energy + 16 * dt); u.cool -= dt; if (gx.laser) { gx.laser.t -= dt; if (gx.laser.t <= 0) gx.laser = null; }
    const alive = gx.ufos.filter(x => x && x.alive).length;
    if (alive === 0) {
      u.gap -= dt;
      if (u.gap <= 0) {
        if (u.wave >= u.waves.length) { u.active = false; u.done = true; gx.ufos = [null, null, null, null]; $('#laser').hidden = true; say('THREAT CLEAR', '威胁解除 · 击落 ' + u.killed + ' / ' + u.total, 'go'); return; }
        const n = u.waves[u.wave]; u.wave++; u.gap = 2.2;
        for (let i = 0; i < n; i++) { const a = Math.random() * TAU, el = (Math.random() - 0.3) * 1.2, d = 1400; gx.ufos[i] = { alive: true, hp: u.wave === 3 ? 3 : 2, x: Math.cos(a) * Math.cos(el) * d, y: Math.sin(el) * d + 25, z: Math.sin(a) * Math.cos(el) * d, tx: 0, ty: 0, tz: 0, re: 0, atk: 5 + Math.random() * 4 + i * 1.5, charge: 0, hitT: 0 }; }
        say('WAVE ' + u.wave, '第 ' + u.wave + ' 波 · ' + n + ' 个目标', 'warn');
      }
      return;
    }
    gx.ufos.forEach(o => {
      if (!o || !o.alive) return;
      o.re -= dt; if (o.re <= 0) { const a = Math.random() * TAU, el = (Math.random() - 0.35) * 1.3, d = 150 + Math.random() * 130; o.tx = Math.cos(a) * Math.cos(el) * d; o.ty = Math.sin(el) * d + 25; o.tz = Math.sin(a) * Math.cos(el) * d; o.re = 2.5 + Math.random() * 3; }
      const k = Math.min(1, dt * 1.3); o.x += (o.tx - o.x) * k; o.y += (o.ty - o.y) * k; o.z += (o.tz - o.z) * k; o.hitT -= dt;
      if (o.charge > 0) { o.charge -= dt; if (o.charge <= 0) { const c = GFX.shipPoint(0, 22, 0, {}); gx.laser = { ax: o.x, ay: o.y, az: o.z, bx: c.x, by: c.y, bz: c.z, t: 0.25, enemy: true }; S.hull -= 6; cam.shake = 2.5; flash(0.25); AU.beep(140, 0.25, 'square', 0.08); o.atk = 5 + Math.random() * 5; if (S.hull <= 0) SIM.fail(S, 'hull'); } }
      else { o.atk -= dt; if (o.atk <= 0) { o.charge = 1.7; AU.beep(1200, 0.1, 'square', 0.03); } }
    });
  }
  function fireAt(px, py) {
    const u = G.ufo; if (!u || !u.active || u.cool > 0 || u.energy < 12) return;
    let best = null, bd = 54 * 54; const o = {};
    gx.ufos.forEach(f => { if (!f || !f.alive) return; GFX.projectLocal(f.x, f.y, f.z, o); if (!o.vis) return; const d = (o.x - px) * (o.x - px) + (o.y - py) * (o.y - py); if (d < bd) { bd = d; best = f; } });
    if (!best) return;
    u.cool = 0.2; u.energy -= 12; AU.zap();
    const g = GFX.shipPoint(-4.6, 44, 0, {}); gx.laser = { ax: g.x, ay: g.y, az: g.z, bx: best.x, by: best.y, bz: best.z, t: 0.16, enemy: false };
    best.hp--; best.hitT = 0.15;
    if (best.hp <= 0) { best.alive = false; u.killed++; GFX.explode(best.x, best.y, best.z, false); AU.boom(); }
  }

  // --------------------------- game update ---------------------------
  const nextWin = () => G.windows.find(w => !w.done);
  const curHaz = () => G.haz.find(h => h.state === 'warn' || h.state === 'clear'), HM = 1500;
  const hazAlt = h => SIM.orbitRadiusAt(S, h.phi) - RE;                     // the height at which the ship will cross it
  function onOrbit() { const tol = G.diff === 0 ? 20e3 : CFG.orbitTol; return Math.abs(S.ap - CFG.targetAlt) <= tol && Math.abs(S.pe - CFG.targetAlt) <= tol; }
  function orbitTasks(dt) {
    const w = nextWin();
    if (w) { const inW = Math.abs(SIM.wrapPi(S.phi - w.phi)) < w.half; if (inW && !w.said) { w.said = true; warpCap(4); say('DEPLOY WINDOW', '进入卫星 ' + w.n + ' 的部署窗口', 'go'); } if (!inW) w.said = false; else if (S.auto && G.warp > 4) G.warp = 4; }
    let vis = null;
    G.haz.forEach(h => {
      const da = h.ang - S.ang, rr = RE + S.h;
      // the fly-past is drawn with distances squeezed about twentyfold, or nothing would be visible at 7.8 km/s
      if (h.state !== 'idle' && da < 0.027 && da > -0.012) { const T = 520, over = S.h - h.hi, under = h.lo - S.h;
        vis = { show: true, kind: h.kind, dx: da * rr * 0.05, dy: over > 0 ? -(150 + over * 0.04) - T / 2 : under > 0 ? 150 + under * 0.04 + T / 2 : 0, thick: T }; }
      if (h.state === 'hit' || h.state === 'avoided') return;
      h.phi = SIM.wrap2(h.phi - OMEGA * dt); h.ang -= OMEGA * dt;            // it keeps its place among the stars while the ground frame turns
      if (h.state === 'idle') { if (S.ang >= h.ann && !G.sat) { h.state = 'warn'; warpCap(4); say('CONJUNCTION ALERT', '前方发现' + h.name + '，看底部剖面图', 'crit'); } return; }
      // "clear" needs 1.5 km of margin, because the crossing point creeps as the Earth turns
      const alt = hazAlt(h), risk = alt > h.lo && alt < h.hi, safe = alt > h.hi + HM || alt < h.lo - HM;
      if (h.state === 'warn' && safe) { h.state = 'clear'; say('TRAJECTORY CLEAR', '通过高度已离开危险带', 'go'); }
      else if (h.state === 'clear' && risk) { h.state = 'warn'; say('CONJUNCTION', '通过高度又回到了危险带里', 'crit'); }
      if (S.apAvoid && (alt > h.hi + 3500 || alt < h.lo - 3500)) S.apAvoid = 0;
      if (da < 0.05 && !h.slow) { h.slow = true; warpCap(4); if (h.state === 'warn') say('CONJUNCTION', '即将穿过' + h.name, 'crit'); }
      if (da < 0.027) warpCap(1);
      if (da <= 0) {
        if (S.h > h.lo && S.h < h.hi) { h.state = 'hit'; S.hull -= 36; flash(0.7); cam.shake = 4; AU.boom(); say(h.kind === 'rock' ? 'METEOROID STRIKE' : 'DEBRIS STRIKE', '机体受损 −36 %', 'crit'); const c = GFX.shipPoint(0, 25, 0, {}); GFX.explode(c.x, c.y, c.z, false); if (S.hull <= 0) SIM.fail(S, 'hull'); }
        else { h.state = 'avoided'; say(h.kind === 'rock' ? 'METEOROIDS PASSED' : 'DEBRIS PASSED', h.name + '已安全通过', 'go'); }
        S.apAvoid = 0; G.needReturn = !onOrbit(); G.okT = 0;
        if (G.needReturn) setTimeout(() => say('RETURN TO ORBIT', S.auto ? '自动回归 200 km 正轨' : '现在回到 200 km 正轨：把三个偏差调回 0', 'warn'), 1400);
      }
    });
    gx.debris = vis;
    // back on the reference orbit?
    if (G.needReturn) {
      if (S.auto && !S.apReturn && !S.apAvoid && !curHaz() && !G.sat && S.pe > 95e3) S.apReturn = true;
      if (onOrbit() && S.thr === 0 && !S.rcsX && !S.rcsY) { G.okT += dt; if (G.okT > 4) { G.needReturn = false; G.okT = 0; say('ON ORBIT', '已回到正轨 ' + km(S.ap) + ' × ' + km(S.pe) + ' km', 'go'); } } else G.okT = 0;
    }
    const hazDone = G.haz.every(h => h.state === 'hit' || h.state === 'avoided');
    if (G.diff === 2 && !G.ufo && S.thr === 0 && hazDone && !G.needReturn && !G.sat && (S.satsDeployed >= S.sats || S.ang - G.orbit0 > 6.2)) startUfo();
    if (G.milestone < 5 && S.pe < 80e3 && S.thr === 0) { mile(5); say('DEORBIT BURN COMPLETE', '离轨点火完成，滑行至再入'); if (G.level === 'assist') { S.att = 'AOA'; say('ENTRY ATTITUDE', '飞控用喷气把飞船转成腹部朝前'); } }
    if (S.std && S.pe > 95e3 && !w && S.std.lead < 5 * D2R && (!G.flags.cueAng || S.ang - G.flags.cueAng > 5)) { G.flags.cueAng = S.ang; warpCap(S.auto ? 8 : 4); say('DEORBIT POINT', '离轨点火点临近', 'warn'); }
    if (S.apBurning) warpCap(4);
  }

  // ------------------- satellite: off the ship, down the red line, arrays out -------------------
  // The path is fixed to the ship: out of the bay on the leeward side and back toward the tail.
  const SATP = { bx: -5.4, by: 31, dx: -0.42, dy: -0.9075, L: 110, tol: 5 };
  function satModel(u, a, b, o) { o.x = SATP.bx + SATP.dx * u - SATP.dy * b; o.y = SATP.by + SATP.dy * u + SATP.dx * b; o.z = a; return o; }
  function startSat(n) {
    const k = 0.45 + G.diff * 0.3, r = () => (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.6) * k;
    G.sat = { n, u: 0, a: 0, b: 0, va: r(), vb: r(), t: 0, phase: 'drift', errSum: 0, errT: 0, err: 0, pan: 0, gust: 3 + Math.random() * 3, thrA: 0, thrB: 0, prevView: cam.view === 'SAT' ? 'EXT' : cam.view, doneT: 0, lost: false };
    gx.sats[n - 1] = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, pan: 0, spin: 0, mini: true };
    G.warp = 1; setView('SAT'); mile(4);
    say('DEPLOY', '卫星 ' + n + ' / ' + S.sats + ' 离舰，沿红色点线送到入轨点', 'go');
  }
  function satPanels() { const s = G.sat; if (!s || s.phase !== 'hold') return; s.phase = 'unfold'; say('SOLAR ARRAYS', '太阳翼展开中'); AU.beep(520, 0.3); }
  const SM = {}, SP0 = {}, SP1 = {}, SP2 = {};
  function satUpdate(dt, wdt) {
    const s = G.sat; if (!s) return; const o = gx.sats[s.n - 1]; s.t += dt;
    if (s.phase !== 'done') {
      if (s.u < SATP.L) s.u = Math.min(SATP.L, s.u + (1.4 + 3.2 * Math.min(1, s.t / 7)) * dt);
      else if (s.phase === 'drift') { s.phase = 'hold'; say('STATION', '到达入轨点。压住红线，展开太阳翼', 'go'); }
      let ax = 0, ay = 0;
      if (S.auto) { ax = clamp(-s.a * 0.5 - s.va * 1.4, -1, 1); ay = clamp(-s.b * 0.5 - s.vb * 1.4, -1, 1); }
      else if (s.phase !== 'unfold') {
        // the stick pushes the satellite the way it looks on screen: find the two side axes in screen space
        const jx = G.satStick.x, jy = -G.satStick.y, m = Math.hypot(jx, jy);
        if (m > 0.05) {
          const q0 = satModel(s.u, s.a, s.b, SM); GFX.projectLocal(...xyz(GFX.shipPoint(q0.x, q0.y, q0.z, SP0)), SP0);
          const q1 = satModel(s.u, s.a + 6, s.b, SM); GFX.projectLocal(...xyz(GFX.shipPoint(q1.x, q1.y, q1.z, SP1)), SP1);
          const q2 = satModel(s.u, s.a, s.b + 6, SM); GFX.projectLocal(...xyz(GFX.shipPoint(q2.x, q2.y, q2.z, SP2)), SP2);
          const ux = SP1.x - SP0.x, uy = SP1.y - SP0.y, vx = SP2.x - SP0.x, vy = SP2.y - SP0.y, det = ux * vy - uy * vx;
          if (Math.abs(det) > 1e-3) { let ca = (jx * vy - jy * vx) / det, cb = (ux * jy - uy * jx) / det; const n = Math.hypot(ca, cb) || 1; ax = ca / n * Math.min(m, 1); ay = cb / n * Math.min(m, 1); } else { ax = jx; ay = -jy; }
        }
      }
      // leftover gas venting nudges it off the line now and then
      s.gust -= dt; if (s.gust <= 0 && s.phase === 'drift') { s.gust = 4 + Math.random() * 4; const k = 0.22 + G.diff * 0.2; s.va += (Math.random() - 0.5) * 2 * k; s.vb += (Math.random() - 0.5) * 2 * k; }
      const A = (G.ctl.precision ? 0.35 : 1) * 0.9;
      s.va += ax * A * dt; s.vb += ay * A * dt; s.a += s.va * dt; s.b += s.vb * dt; s.thrA = ax; s.thrB = ay;
      s.err = Math.hypot(s.a, s.b); if (s.phase !== 'unfold') { s.errSum += s.err * dt; s.errT += dt; }
      if (s.err > 45 && s.phase === 'drift') { s.lost = true; s.phase = 'unfold'; say('OFF TRACK', '卫星偏离过大，改由星上电脑自主入轨', 'warn'); }
      if (s.phase === 'hold' && S.auto && s.err < SATP.tol * 0.6 && Math.hypot(s.va, s.vb) < 0.5) satPanels();
      if (s.phase === 'unfold') { s.va *= Math.exp(-dt * 1.5); s.vb *= Math.exp(-dt * 1.5); s.pan = Math.min(1, s.pan + dt / 2.6);
        if (s.pan >= 1) { const mean = s.errT ? s.errSum / s.errT : 0, acc = s.lost ? 0.2 : clamp(1 - Math.max(0, mean - 1.5) / 14, 0.3, 1); G.satAcc[s.n - 1] = acc; s.phase = 'done';
          cheer('卫星 ' + s.n + ' 入轨成功', '太阳翼已展开 · 入轨精度 ' + fmt(acc * 100) + ' %'); } }
      if (Math.hypot(ax, ay) > 0.1 && Math.random() < wdt * 30) { const q = satModel(s.u, s.a, s.b, SM), c = GFX.shipPoint(q.x, q.y, q.z, SP0), t1 = satModel(s.u, s.a - ax * 3, s.b - ay * 3, SM), d = GFX.shipPoint(t1.x, t1.y, t1.z, SP1); GFX.pFire.emit(c.x, c.y, c.z, (d.x - c.x) * 6, (d.y - c.y) * 6, (d.z - c.z) * 6, 0.45, 0.6, 3.2, 0.62, 0.78, 1, 0.5, 1.2); }
    } else {
      s.doneT += wdt; s.u += 2.5 * dt;
      if (s.doneT > 3.4) { // hand it over to free drift and give the camera back
        const d0 = GFX.shipPoint(0, 0, 0, SP0), d1 = GFX.shipPoint(SATP.dx, SATP.dy, 0, SP1); o.vx = (d1.x - d0.x) * 2.5; o.vy = (d1.y - d0.y) * 2.5; o.vz = (d1.z - d0.z) * 2.5; o.mini = false;
        setView(s.prevView); G.sat = null; gx.satCam = null;
        if (S.satsDeployed >= S.sats) payloadCard();
        return;
      }
    }
    const q = satModel(s.u, s.a, s.b, SM), c = GFX.shipPoint(q.x, q.y, q.z, SP0); o.x = c.x; o.y = c.y; o.z = c.z; o.pan = s.pan; o.spin = Math.sin(s.t * 0.25) * 0.12;
    const dc = Math.hypot(q.x + 7.6, q.y - 46.5); gx.satCam = { x: q.x + dc * 0.2, y: q.y - dc * 0.05, z: q.z * 0.8 };
  }
  const xyz = p => [p.x, p.y, p.z];
  function maxWarp() {
    if (G.countdown >= 0 || S.phase === 'PRE' || S.phase === 'LAND' || S.phase === 'CAUGHT' || S.phase === 'FAIL') return 1;
    if (G.ufo && G.ufo.active || G.sat) return 1;
    if (S.phase === 'ASCENT') return 4;
    if (S.phase === 'ORBIT') return S.thr > 0 ? 4 : S.rcsX || S.rcsY ? 8 : 64;
    if (S.phase === 'ENTRY') return S.spd > 700 ? 8 : S.h > CFG.catchH + 4000 ? 2 : 1;
    return 1;
  }
  function emitFx(dt, wdt) {
    const P = GFX.pPad, r = Math.hypot(S.x, S.y), ux = S.x / r, uy = S.y / r, hx = S.h;
    const nx = Math.cos(S.pit) * ux + Math.sin(S.pit) * uy, ny = Math.cos(S.pit) * uy - Math.sin(S.pit) * ux;
    const bx = S.x, by = S.y - RE, bz = S.z; // vehicle base in pad coordinates
    const rate = n => { let k = n * wdt; let c = Math.floor(k); if (Math.random() < k - c) c++; return c; };
    if (S.phase === 'PRE' && G.countdown > 3 || G.mode === 'menu') for (let i = rate(7); i > 0; i--) { const a = Math.random() * 6.28, y = 26 + Math.random() * 120; P.emit(Math.cos(a) * 4.8, y, Math.sin(a) * 4.8, 2.5 + Math.random() * 2, -1 - Math.random() * 2, (Math.random() - 0.5) * 2, 3.5, 2.5, 13, 1, 1, 1, 0.22, 0.2); }
    const lift = S.stage === 0 && (gx.ignite > 0 || S.thrust > 0);
    if (lift && hx < 900) for (let i = rate(70 * Math.max(gx.ignite, S.thr)); i > 0; i--) { const a = Math.random() * 6.28, sp = 35 + Math.random() * 95, hot = Math.random() < 0.25; P.emit(Math.cos(a) * 9, 3 + Math.random() * 6, Math.sin(a) * 9, Math.cos(a) * sp, 4 + Math.random() * 26, Math.sin(a) * sp, 5 + Math.random() * 5, 16, 95 + Math.random() * 50, 1, hot ? 0.82 : 0.97, hot ? 0.62 : 0.95, 0.55, 0.75); }
    if (S.thrust > 0 && hx < 28e3 && hx > 120 && S.phase === 'ASCENT') for (let i = rate(26); i > 0; i--) { const L = 150 + Math.random() * 80; P.emit(bx - nx * L, by - ny * L, bz, -nx * 60 + (Math.random() - 0.5) * 20, -ny * 60, (Math.random() - 0.5) * 20, 5 + Math.random() * 4, 22, 120, 0.93, 0.9, 0.86, 0.3 * Math.exp(-hx / 14e3), 0.5); }
    if (S.phase === 'LAND' && S.thrust > 0 && hx < 420) for (let i = rate(40 * S.thr); i > 0; i--) { const a = Math.random() * 6.28, sp = 20 + Math.random() * 60; P.emit(bx + Math.cos(a) * 6, 2, bz + Math.sin(a) * 6, Math.cos(a) * sp, 3 + Math.random() * 14, Math.sin(a) * sp, 3 + Math.random() * 3, 10, 70, 0.9, 0.86, 0.8, 0.4 * (1 - hx / 420), 0.9); }
    if (S.phase === 'CAUGHT') for (let i = rate(10); i > 0; i--) { const a = Math.random() * 6.28; P.emit(bx + Math.cos(a) * 5, by + 2, bz + Math.sin(a) * 5, Math.cos(a) * 4, -6, Math.sin(a) * 4, 3, 3, 16, 1, 1, 1, 0.25, 0.3); }
    const E = S.eff;
    if (S.stage === 1 && !gx.exploded && S.phase !== 'ASCENT' && (E.rcsU || E.rcsZ || S.rcsX || S.rcsY)) {
      // cold-gas jets: a nose and a tail cluster for turning and sideways pushes, plus axial ones
      const q = GFX.vq, puff = (mx, my, mz, dx, dy, dz, lvl) => { for (let i = rate(60 * Math.min(1, Math.abs(lvl)) + 6); i > 0; i--) { const c = GFX.shipPoint(mx, my, mz, {}), d = new THREE.Vector3(dx, dy, dz).applyQuaternion(q), sp = 34 + Math.random() * 22; GFX.pFire.emit(c.x, c.y, c.z, d.x * sp + (Math.random() - 0.5) * 8, d.y * sp + (Math.random() - 0.5) * 8, d.z * sp + (Math.random() - 0.5) * 8, 0.35 + Math.random() * 0.35, 1.1, 7, 0.75, 0.88, 1, 0.7, 1.0); } };
      const jn = (S.rcsY || 0) - E.rcsU, jt = (S.rcsY || 0) + E.rcsU;       // >0: that end is pushed toward the leeward side
      if (Math.abs(jn) > 0.02) puff(Math.sign(jn) * 3.4, 43, 0, Math.sign(jn), 0, 0, jn);
      if (Math.abs(jt) > 0.02) puff(Math.sign(jt) * 4.6, 4, 0, Math.sign(jt), 0, 0, jt);
      if (Math.abs(E.rcsZ) > 0.02) { puff(0, 43, Math.sign(E.rcsZ) * -3.4, 0, 0, -Math.sign(E.rcsZ), E.rcsZ); puff(0, 4, Math.sign(E.rcsZ) * 4.6, 0, 0, Math.sign(E.rcsZ), E.rcsZ); }
      if (S.rcsX) puff(-4.6, S.rcsX > 0 ? 3 : 40, 0, -0.5, -Math.sign(S.rcsX), 0, S.rcsX);
    }
    const heat = GFX.st.heat;
    if (heat > 0.05 && !gx.exploded) { const vv = Math.max(S.spd, 1), fx = -S.vh / vv, fy = -S.vr / vv; for (let i = rate(60 * heat); i > 0; i--) { const c = GFX.shipPoint(2 + Math.random() * 3, Math.random() * 48, (Math.random() - 0.5) * 16, {}); GFX.pFire.emit(c.x, c.y, c.z, fx * 160 + (Math.random() - 0.5) * 30, fy * 160 + (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, 0.3 + Math.random() * 0.35, 0.55, 0.1, 1, 0.45 + Math.random() * 0.25, 0.15, 0.9, 0); } }
  }
  function gameUpdate(dt, wdt) {
    // booster after separation (relative to the ship, local frame)
    const b = gx.booster;
    if (b) { b.t += dt; const a = (S.thrust || 0) / SIM.mass(S), n = new THREE.Vector3(0, 1, 0).applyQuaternion(GFX.vq);
      b.vx -= n.x * a * dt; b.vy -= n.y * a * dt;
      if (b.t > 2.5 && b.rot < 2.6) { const d = Math.min(0.22 * dt, 2.6 - b.rot); b.rot += d; b.q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), d)); }
      b.burn = b.t > 12 && b.t < 36 ? 1 : 0; if (b.burn) { const bn = new THREE.Vector3(0, 1, 0).applyQuaternion(b.q); b.vx += bn.x * 16 * dt; b.vy += bn.y * 16 * dt; }
      b.x += b.vx * dt; b.y += b.vy * dt; if (b.t > 90 || Math.hypot(b.x, b.y) > 70e3) gx.booster = null; }
    gx.sats.forEach((s, i) => { if (!s || s.mini) return; s.age += dt; s.spin += dt * 0.03; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; if (s.age > 400) gx.sats[i] = null; });
    if (S.phase === 'ORBIT') orbitTasks(dt);
    satUpdate(dt, wdt);
    if (S.phase === 'ENTRY' && S.spd > 700 && (!G.trail.length || S.t - G.trailT > 4)) { G.trailT = S.t; G.trail.push(-SIM.wrapPi(S.phi) * RE, S.h); }
    ufoUpdate(wdt);
    if (!S.auto && S.assist && S.phase === 'ENTRY' && S.spd < 700 && S.h < S.cue.flipH - 40) { SIM.flip(S); say('AUTO FLIP', '辅助系统接管翻转', 'warn'); }
    // tower arms
    let at = 0; if (S.phase === 'LAND') at = 0.5 * clamp(1 - (S.h - CFG.catchH - 20) / 120, 0, 1); if (S.phase === 'CAUGHT') at = 1;
    gx.arms += (at - gx.arms) * Math.min(1, wdt * 2.5);
    if (S.phase === 'CAUGHT') { const k = Math.min(1, wdt * 1.5); S.x += -S.x * k; S.z += -S.z * k; S.pit += -S.pit * k; S.yawT += -S.yawT * k; S.y += (RE + CFG.catchH - S.y) * k; S.thrust = 0; S.spd = 0; S.vr = 0; }
    // camera shake + vignette + audio
    const ob = cam.view !== 'EXT' && cam.view !== 'TOWER';
    let sh = 0; if (S.thrust > 0 && S.stage === 0) sh = 0.5 + S.q / 30000; else if (S.thrust > 0 && S.phase !== 'ORBIT') sh = 0.25; sh += GFX.st.heat * 0.9 + gx.ignite * 0.6;
    cam.shake = Math.max(cam.shake * Math.exp(-wdt * 3), sh * (ob ? 1 : cam.dist < 400 ? 1 : 0.4));
    $('#vig').style.opacity = (GFX.st.heat * 0.85).toFixed(2);
    const atm = Math.exp(-Math.max(S.h, 0) / 30000), tn = (S.thrust || 0) / 75e6 + gx.ignite * 0.5;
    AU.set(Math.min(1, Math.sqrt(tn) * (0.3 + 0.7 * atm) + (S.thrust > 0 ? 0.12 : 0)), 120 + 500 * atm, Math.min(1, S.q / 25000 + GFX.st.heat * 0.8));
    emitFx(dt, wdt);
    // automatic camera fallback
    if (cam.view === 'TOWER' && Math.hypot(S.x, S.y - RE) > 300e3) setView('EXT');
  }

  // ------------------------------- HUD -------------------------------
  function clock(t) { t = Math.abs(t); const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = Math.floor(t % 60); return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0'); }
  const ROWS = {
    ASCENT: [['高度', 'km', () => km(S.h)], ['速度', 'm/s', () => fmt(S.spd)], ['俯仰·指引', '°', () => fmt(S.pit / D2R) + '/' + fmt(S.cue.pit / D2R), () => Math.abs(SIM.wrapPi(S.pit - S.cue.pit)) > 12 * D2R ? 'warn' : ''],
      ['动压 Q', 'kPa', () => fmt(S.q / 1000, 1), () => S.q > 38e3 ? 'crit' : S.q > 33e3 ? 'warn' : ''], ['过载', 'g', () => fmt(S.gload, 1)], ['远地点', 'km', () => S.ap > -9e5 && isFinite(S.ap) ? km(S.ap) : '—'], ['近地点', 'km', () => S.pe > -9e5 ? km(S.pe) : '—', () => S.pe > CFG.orbitMinPe ? 'go' : ''], ['机体', '%', () => fmt(S.hull), () => S.hull < 50 ? 'crit' : S.hull < 99 ? 'warn' : '']],
    ORBIT: [['高度·正轨', 'km', () => km(S.h) + '/' + fmt(CFG.targetAlt / 1000)], ['高度偏差', 'km', () => sgn(S.dH / 1000, 1), () => dev(S.dH, 2e3, 8e3)], ['垂直速度', 'm/s', () => sgn(S.vr, 1), () => dev(S.vr, 2, 12)], ['切向偏差', 'm/s', () => sgn(S.dVt, 1), () => dev(S.dVt, 1.5, 6)],
      ['远/近地点', 'km', () => fmt(S.ap / 1000) + '/' + fmt(S.pe / 1000), () => onOrbit() ? 'go' : 'warn'], ['姿态偏差', '°', () => fmt(Math.abs(SIM.wrapPi(S.pit - needAtt())) / D2R), () => Math.abs(SIM.wrapPi(S.pit - needAtt())) < 5 * D2R ? 'go' : ''], ['卫星', '', () => S.satsDeployed + ' / ' + S.sats], ['机体', '%', () => fmt(S.hull), () => S.hull < 50 ? 'crit' : S.hull < 99 ? 'warn' : '']],
    ORBITd: [['高度', 'km', () => km(S.h)], ['速度', 'm/s', () => fmt(S.spd)], ['近地点', 'km', () => km(S.pe), () => S.pe < 60e3 ? 'go' : 'warn'], ['落点误差', 'km', () => S.pred ? sgn(S.pred.err / 1000, 0) : '—', () => S.pred ? (Math.abs(S.pred.err) < 30e3 ? 'go' : 'warn') : ''],
      ['攻角·预定', '°', () => fmt(SIM.wrapPi(S.pitPro - S.pit) / D2R) + '/' + fmt(CFG.alphaNom / D2R)], ['角速度', '°/s', () => sgn(S.pitRate / D2R, 1)], ['隔热瓦', '%', () => fmt(S.tps)], ['机体', '%', () => fmt(S.hull), () => S.hull < 50 ? 'crit' : S.hull < 99 ? 'warn' : '']],
    SAT: [['沿线距离', 'm', () => fmt(G.sat ? G.sat.u : 0) + '/' + SATP.L], ['偏离红线', 'm', () => fmt(G.sat ? G.sat.err : 0, 1), () => G.sat && G.sat.err <= SATP.tol ? 'go' : 'warn'], ['横向速度', 'm/s', () => fmt(G.sat ? Math.hypot(G.sat.va, G.sat.vb) : 0, 1)], ['太阳翼', '', () => !G.sat ? '' : G.sat.pan >= 1 ? '已展开' : G.sat.pan > 0 ? fmt(G.sat.pan * 100) + ' %' : '收拢'], ['高度', 'km', () => km(S.h)], ['卫星', '', () => S.satsDeployed + ' / ' + S.sats]],
    ENTRY: [['高度', 'km', () => km(S.h)], ['速度', 'm/s', () => fmt(S.spd)], ['温度', '°C', () => fmt(Math.max(S.temp - 273, 0)), () => S.temp > CFG.tileLimit ? 'crit' : S.temp > 1620 ? 'warn' : ''], ['过载', 'g', () => fmt(S.gload, 1), () => S.gload > 6 ? 'crit' : S.gload > 4.5 ? 'warn' : ''],
      ['攻角·预定', '°', () => fmt(S.eff.alpha / D2R) + '/' + fmt(S.cue.alpha / D2R), () => S.spd > 1500 && !S.bellyOK ? 'crit' : Math.abs(S.eff.alpha - S.cue.alpha) < 4 * D2R ? 'go' : 'warn'], ['倾斜·预定', '°', () => sgn(S.bankVis * 26, 0) + '/' + sgn(S.cue.bank * 26, 0), () => Math.abs(S.bankVis - S.cue.bank) < 0.2 ? 'go' : 'warn'],
      ['落点误差', () => S.spd > 700 ? 'km' : 'm', () => !S.pred ? '—' : S.spd > 700 ? sgn(S.pred.err / 1000, 1) : sgn(S.pred.err, 0), () => S.pred && Math.abs(S.pred.err) < (S.spd > 700 ? 8e3 : 150) ? 'go' : 'warn'], ['隔热瓦/机体', '%', () => fmt(S.tps) + '/' + fmt(S.hull), () => S.tps < 40 || S.hull < 50 ? 'crit' : S.tps < 99 || S.hull < 99 ? 'warn' : '']],
    LAND: [['距机械臂', 'm', () => fmt(Math.max(0, S.h - CFG.catchH))], ['下降·目标', 'm/s', () => fmt(-S.vr, 1) + '/' + fmt(-S.cue.vdes, 1), () => -S.vr > -S.cue.vdes + 6 ? 'crit' : -S.vr > -S.cue.vdes + 2.5 ? 'warn' : 'go'], ['水平速度', 'm/s', () => fmt(Math.hypot(S.vx, S.vz), 1), () => Math.hypot(S.vx, S.vz) > CFG.catchVh && S.h - CFG.catchH < 60 ? 'warn' : ''],
      ['横向误差', 'm', () => fmt(Math.hypot(S.x, S.z), 1), () => Math.hypot(S.x, S.z) <= CFG.catchTol ? 'go' : 'warn'], ['倾斜·预定', '°', () => fmt(tiltNow() / D2R) + '/' + fmt(Math.hypot(S.cue.tiltX, S.cue.tiltZ) / D2R), () => !S.flipDone ? 'warn' : tiltNow() > CFG.catchTilt && S.h - CFG.catchH < 60 ? 'warn' : ''], ['角速度', '°/s', () => fmt(Math.hypot(S.pitRate, S.yawRate) / D2R, 1)], ['推进剂', 't', () => fmt(S.mS / 1000, 1), () => S.mS < 8e3 ? 'crit' : '']]
  };
  const sgn = (v, d) => (v > 0 ? '+' : '') + fmt(v, d), dev = (v, ok, bad) => Math.abs(v) <= ok ? 'go' : Math.abs(v) >= bad ? 'warn' : '';
  const tiltNow = () => Math.acos(clamp(Math.cos(S.pit) * Math.cos(S.yawT), -1, 1));
  // attitude the current job calls for: retrograde for the deorbit burn, otherwise prograde
  function needAtt() { return S.pitPro + (!nextWin() && G.haz.every(h => h.state === 'hit' || h.state === 'avoided') && !G.needReturn && S.phase === 'ORBIT' && S.satsDeployed >= S.sats ? Math.PI : 0); }
  ROWS.PRE = ROWS.ASCENT; ROWS.CAUGHT = ROWS.LAND; ROWS.FAIL = ROWS.ASCENT;
  function hudTele() {
    const ph0 = S.phase === 'FAIL' ? (S.failPhase || 'ASCENT') : S.phase, ph = G.sat ? 'SAT' : ph0 === 'ORBIT' && S.pe <= 95e3 ? 'ORBITd' : ph0, key = ph + (ph === 'ENTRY' ? (S.spd > 700 ? 'h' : 't') : ''), rows = ROWS[ph] || ROWS.ASCENT, el = $('#tele');
    if (G.teleKey !== key) { G.teleKey = key; el.innerHTML = rows.map(r => `<div class="row"><span class="lab">${r[0]}</span><output></output></div>`).join(''); }
    const ch = el.children;
    rows.forEach((r, i) => { const o = ch[i].lastChild; let v; try { v = r[2](); } catch (e) { v = '—'; } const u = typeof r[1] === 'function' ? r[1]() : r[1]; o.innerHTML = v + (u ? `<small>${u}</small>` : ''); ch[i].className = 'row ' + (r[3] ? r[3]() : ''); });
  }
  const WHY = { window: '不在部署窗口内', attitude: '机头需对准顺向（绿圈）', rate: '姿态还在转动', altitude: '高度超出 160–320 km', orbit: '先回到正轨：远、近地点都要在 200 km 附近', thrust: '点火或喷气中不能部署', phase: '', empty: '' };
  const depTol = () => G.diff === 0 ? 20e3 : CFG.orbitTol;
  function action(id) {
    if (G.mode !== 'play' || G.paused) return;
    if (id === 'launch' && S.phase === 'PRE' && G.countdown < 0) { G.countdown = 10; say('GO FOR LAUNCH', '倒计时开始'); }
    else if (id === 'sep') { if (!SIM.stageSep(S)) return; }
    else if (id === 'seco') { G.ctl.thr = 0; S.thr = 0; }
    else if (id === 'relight') { G.ctl.thr = 1; }
    else if (id === 'deploy') { const w = nextWin(); if (w && !G.sat && !SIM.deployCheck(S, w, depTol())) { SIM.deploy(S); w.done = true; } }
    else if (id === 'panels') { const t = G.sat; if (t && t.phase === 'hold' && t.err <= SATP.tol && Math.hypot(t.va, t.vb) < 1.2) satPanels(); }
    else if (id === 'avoid') { const h = curHaz(); if (h) { S.apReturn = false; S.apAvoid = h.kind === 'rock' ? -1 : 1; say('AVOIDANCE', h.kind === 'rock' ? '喷气向下，从碎石流下方钻过去' : '喷气向上，从垃圾带上方越过去'); } }
    else if (id === 'deorbit') { S.apDeorbit = !S.apDeorbit; S.apBurning = false; say(S.apDeorbit ? 'DEORBIT ARMED' : 'DEORBIT CANCELLED', S.apDeorbit ? '自动驾驶将在点火点执行离轨' : ''); }
    else if (id === 'flip') { SIM.flip(S); }
    else if (id === 'athr') { S.athr = !S.athr; if (!S.athr) G.ctl.thr = S.thr; }
    hudActions(true);
  }
  function hudActions(force) {
    const el = $('#acts'); let a = [], why = '';
    const auto = S.auto, pre = S.phase === 'PRE';
    if (pre) a.push(G.countdown < 0 ? ['launch', '启动发射', 'LAUNCH', 'pri'] : ['', 'T−' + Math.ceil(G.countdown), 'COUNTDOWN', '', true]);
    else if (S.phase === 'ASCENT' && S.stage === 0) { const meco = SIM.engine(S, S.h).T === 0; if (!auto) a.push(['sep', '级间分离', 'STAGE SEP', meco ? 'hot' : '', !meco && S.mB > CFG.boosterProp * 0.12]); }
    else if (S.phase === 'ASCENT') { if (!auto) { if (S.thr > 0) a.push(['seco', '发动机关机', 'SECO', S.pe > CFG.orbitMinPe && S.sma >= RE + CFG.targetAlt - 500 ? 'hot' : '']); else a.push(['relight', '重新点火', 'RELIGHT', 'pri']); } }
    else if (S.phase === 'ORBIT' && G.sat) {
      const t = G.sat;
      if (t.phase === 'hold' && !auto) { const ok = t.err <= SATP.tol && Math.hypot(t.va, t.vb) < 1.2; a.push(['panels', '展开太阳翼', 'DEPLOY ARRAYS', ok ? 'hot' : '', !ok]); if (!ok) why = '先把卫星拉回红线并稳住（偏差 ≤ ' + SATP.tol + ' m）'; }
      else a.push(['', t.phase === 'drift' ? '卫星离舰中' : t.phase === 'done' ? '入轨成功' : '太阳翼展开', 'SATELLITE ' + t.n, '', true]);
    }
    else if (S.phase === 'ORBIT' && !(G.ufo && G.ufo.active)) {
      const w = nextWin(), hz = curHaz();
      if (w && S.pe > 95e3) { const r = SIM.deployCheck(S, w, depTol()); a.push(['deploy', '部署卫星 ' + w.n, 'DEPLOY', r ? '' : 'hot', !!r]); if (r && r !== 'window') why = WHY[r]; }
      if (auto) { if (hz && hz.state === 'warn' && !S.apAvoid) a.push(['avoid', '规避机动', 'AVOID', 'hot']); a.push(['deorbit', S.apDeorbit ? '取消离轨' : '自动离轨', 'DEORBIT', !w && !S.apDeorbit && !G.needReturn ? 'pri' : '']); }
    } else if (S.phase === 'ENTRY' && !auto && S.spd < 700) { const ok = S.h < 6000, now = S.h < S.cue.flipH + 250; a.push(['flip', '翻转点火', 'FLIP · ' + fmt(S.cue.flipH) + ' m', now ? 'hot' : ok ? 'pri' : '', !ok]); }
    else if (S.phase === 'LAND' && !auto && G.level === 'assist') a.push(['athr', S.athr ? '自动油门：开' : '自动油门：关', 'AUTO THROTTLE', S.athr ? 'pri' : '']);
    const key = a.map(x => x.join('|')).join('#');
    if (key !== G.actKey || force) { G.actKey = key; el.innerHTML = a.map(x => `<button class="act ${x[3] || ''}" data-id="${x[0]}" ${x[4] ? 'disabled' : ''}>${x[1]}<small>${x[2]}</small></button>`).join(''); }
    $('#why').textContent = why;
    const sas = !auto && G.level === 'assist' && !G.sat && (S.phase === 'ASCENT' || S.phase === 'ORBIT');
    $('#sas').hidden = !sas; if (sas) $$('#sas button').forEach(b => { b.classList.toggle('on', S.att === b.dataset.m); b.hidden = b.dataset.m === 'FD' && S.phase !== 'ASCENT'; });
  }
  function objective() {
    const auto = S.auto;
    if (S.phase === 'PRE') return G.countdown < 0 ? ['飞船已加注完毕。点击【启动发射】。'] : ['倒计时中。T−3 发动机点火。'];
    if (S.phase === 'ASCENT' && S.stage === 0) {
      if (SIM.engine(S, S.h).T === 0) return [auto ? '助推器关机，热分离。' : 'MECO。点击【级间分离】。', 'alert'];
      if (auto) return ['自动驾驶正在执行重力转弯。'];
      return S.h < 400 ? ['垂直爬升。过了塔顶，把摇杆缓缓推向右。'] : [G.level === 'assist' ? '跟住品红指引（或按 FD 让姿态自动跟随）。动压超过 33 kPa 就收油门。' : '把白色指针压在品红指引上。动压超过 33 kPa 就收油门。'];
    }
    if (S.phase === 'ASCENT') {
      if (S.thr === 0) return ['近地点还不到 140 km。重新点火，继续顺向加速。', 'alert'];
      if (S.pe > CFG.orbitMinPe && S.sma >= RE + CFG.targetAlt - 500) return [auto ? '入轨。' : '已达轨道速度。现在关机（SECO）。', 'go'];
      return [auto ? '飞船正在加速到轨道速度 7.8 km/s。' : '跟住指引压低机头，把近地点抬到 140 km 以上，目标 200 × 200 km。'];
    }
    if (S.phase === 'ORBIT') {
      if (G.ufo && G.ufo.active) return ['点击 UFO 开火。红色光环表示它在蓄能，优先打掉。拖动画面环顾四周。', 'alert'];
      const st = G.sat, w = nextWin(), hz = curHaz(), tA = a => clock(a / (S.vh / (RE + S.h)));
      if (st) {
        if (st.phase === 'drift') return [auto ? '卫星正沿红色点线离舰。' : '目送卫星离舰。它被排气推偏时，用摇杆点喷气把它推回红色点线。偏差 ' + fmt(st.err, 1) + ' m。', st.err > SATP.tol ? 'alert' : ''];
        if (st.phase === 'hold') return [auto ? '到达入轨点。' : (st.err <= SATP.tol ? '卫星在入轨点上。点击【展开太阳翼】。' : '到达入轨点。先把卫星推回红圈里并稳住。'), st.err <= SATP.tol ? 'go' : 'alert'];
        return [st.phase === 'done' ? '卫星 ' + st.n + ' 入轨成功。' : '太阳翼展开中。', 'go'];
      }
      if (S.pe > 95e3 && hz) {
        const alt = hazAlt(hz), da = hz.ang - S.ang, band = fmt(hz.lo / 1000) + '–' + fmt(hz.hi / 1000) + ' km', t = '还有 ' + tA(Math.max(da, 0));
        if (hz.state === 'clear') return ['通过高度 ' + km(alt) + ' km，已离开' + hz.name + '的危险带（' + band + '）。保持，' + t + '后通过。', 'go'];
        if (auto) return ['前方有' + hz.name + '（' + band + '）。点击【规避机动】。', 'alert'];
        return hz.kind === 'rock' ? ['碎石流占满 ' + band + '，只能从下方钻过去。机头顺向，按住平移 ▼，让通过高度降到 ' + fmt((hz.lo - HM) / 1000, 1) + ' km 以下。现在 ' + km(alt) + ' km，' + t + '。', 'alert']
          : ['太空垃圾在 ' + band + '。机头顺向，按住平移 ▲ 或 ▼，让通过高度升到 ' + fmt((hz.hi + HM) / 1000, 1) + ' km 以上或降到 ' + fmt((hz.lo - HM) / 1000, 1) + ' km 以下。现在 ' + km(alt) + ' km，' + t + '。', 'alert'];
      }
      if (S.pe > 95e3 && G.needReturn) return [auto ? '自动驾驶正在用喷气回到 200 km 正轨。' : (onOrbit() ? '已在正轨容差内，松开喷气稳住几秒。' : '回归正轨：机头顺向，用平移 ▲▼ 把高度偏差和垂直速度调回 0，用 ◀▶ 把切向偏差调回 0。三项都变绿就对了。'), onOrbit() ? 'go' : 'alert'];
      if (w && S.pe > 95e3) { const ahead = SIM.wrap2(w.phi - S.phi), inW = Math.abs(SIM.wrapPi(S.phi - w.phi)) < w.half; return inW ? ['在窗口内。机头保持顺向，点击【部署卫星】。', 'go'] : ['卫星 ' + w.n + ' 的窗口在前方 ' + fmt((ahead - w.half) / D2R) + '°，约 ' + tA(Math.max(0, ahead - w.half)) + '。用 + 加速时间。']; }
      if (S.pe < 95e3) return S.pred ? ['离轨完成。落点误差 ' + fmt(S.pred.err / 1000) + ' km。' + (G.level === 'manual' ? '进入大气前，用摇杆点喷气把机头抬到攻角 62°，腹部朝前。' : '飞控正用喷气把飞船转成腹部朝前。') + '可以加速时间。', Math.abs(S.pred.err) < 60e3 ? 'go' : 'alert'] : ['滑行至再入界面。'];
      if (auto) return [S.apDeorbit ? (S.apBurning ? '离轨点火中。' : '已预约离轨。点火点在前方 ' + (S.std ? fmt(S.std.lead / D2R) + '°' : '—') + '，可以加速时间。') : '载荷任务完成。点击【自动离轨】。'];
      if (S.std) { const l = S.std.lead; return l < 3 * D2R || l > TAU - 4 * D2R ? ['到达点火点。逆向（RETRO）点火，直到落点误差接近 0。', 'go'] : ['离轨点火点在前方 ' + fmt(l / D2R) + '°，约 ' + tA(l) + '（它随地球自转一起东移）。到点后逆向点火，把落点拉到发射场。']; }
      return ['规划离轨。'];
    }
    if (S.phase === 'ENTRY') {
      const E = S.eff, da = (E.alpha - S.cue.alpha) / D2R;
      if (S.spd > 700) { if (S.spd > 1500 && !S.bellyOK) return ['腹部没有迎向气流。把攻角调回 50°–75°。', 'alert']; if (S.temp > 1620) return ['温度接近隔热瓦极限。拉高攻角，让飞船在高空多减速。', 'alert'];
        if (auto) return ['飞控用前后襟翼保持攻角，修正落点。'];
        if (G.level === 'manual') return [S.q < 600 ? '空气还太稀，襟翼不起作用。用摇杆上下直接点喷气，把攻角转到预定值并停住。' : '摇杆上下改变襟翼配平，飞船会晃着靠向新攻角。让攻角贴住预定值，轨迹贴住红色辅助线。', Math.abs(da) > 8 ? 'alert' : ''];
        return ['让攻角跟住预定值（品红三角）：现在偏 ' + sgn(da, 0) + '°。摇杆上＝压低攻角飞得远，下＝抬高攻角落得近；左右修正倾斜。白色轨迹要贴住红色辅助线。', Math.abs(da) > 8 ? 'alert' : '']; }
      return [auto ? '腹部朝下自由下落，襟翼控制落点。' : (S.h < S.cue.flipH + 250 ? '现在翻转点火。' : '像跳伞一样腹部朝下。用摇杆让黄色预计落点 ✕ 压在红色辅助线的落脚点上，到 ' + fmt(S.cue.flipH) + ' m 时翻转点火。'), S.h < S.cue.flipH + 250 ? 'alert' : ''];
    }
    if (S.phase === 'LAND') {
      if (!S.flipDone) return ['翻转中：发动机摆动喷管产生力矩，前襟翼张开帮忙。', 'alert'];
      if (auto) return ['着陆点火，对准机械臂。'];
      if (G.level === 'manual') return ['摇杆直接摆动发动机喷管：推一下飞船就开始转，要反推才能停住。让倾斜跟住预定值，油门跟住目标下降率。', ''];
      return [S.athr ? (Math.hypot(S.x, S.z) > 3.5 ? '自动油门在机械臂上方悬停等你。摇杆推向红色辅助线，松手即刹住；把横向误差压到 3.5 m 内。推进剂有限。' : '已对准，保持住，飞船正在降入机械臂。') : '油门控制下降率（跟住目标值），摇杆推向红色辅助线。在机械臂高度做到误差 8 m 内、下降 6.5 m/s 内。'];
    }
    if (S.phase === 'CAUGHT') return ['飞船回到了塔上。', 'go'];
    return [''];
  }
  function hudSlow() {
    hudTele(); hudActions();
    const o = objective(), ob = $('#obj'); if (ob.textContent !== o[0]) ob.textContent = o[0]; ob.className = o[1] || '';
    const stage = S.phase === 'PRE' || S.phase === 'ASCENT' ? 1 : S.phase === 'ORBIT' ? 2 : 3;
    $$('#stages span').forEach(s => { const n = +s.dataset.s; s.classList.toggle('on', n === stage); s.classList.toggle('done', n < stage); });
    const mw = maxWarp(); if (G.warp > mw) G.warp = mw;
    $('#wv').textContent = G.warp + '×'; $('#warp').classList.toggle('hot', G.warp > 1);
    $('#clock').textContent = (S.phase === 'PRE' ? 'T−' + clock(G.countdown < 0 ? 10 : Math.ceil(G.countdown)) : 'T+' + clock(S.t));
    $('#gspd').textContent = fmt(S.spd * 3.6); $('#galt').textContent = km(S.h < 60 ? 0 : S.h);
    const fb = S.mB / CFG.boosterProp, fs = S.mS / CFG.shipProp;
    $('#fb').hidden = S.stage !== 0; $('#fb i').style.height = (fb * 100) + '%'; $('#fs i').style.height = (fs * 100) + '%'; $('#fs').classList.toggle('low', fs < 0.02);
    const t = S.phase === 'PRE' ? 0 : S.thr, te = $('#thr'); te.querySelector('i').style.height = (t * 100) + '%'; te.querySelector('b').style.bottom = (t * 100) + '%'; te.querySelector('span').textContent = fmt(t * 100); te.classList.toggle('ro', S.auto || S.phase === 'ENTRY');
    const lab = G.sat ? ['上', '下', '左', '右'] : S.phase === 'ENTRY' ? ['远', '近', '左', '右'] : S.phase === 'LAND' ? ['前', '后', '左', '右'] : ['', '', '◄ 俯仰', '俯仰 ►'];
    $$('#stick em').forEach((e, i) => { if (e.textContent !== lab[i]) e.textContent = lab[i]; });
    $('#scope').hidden = !(S.phase === 'ENTRY' || S.phase === 'LAND' || S.phase === 'CAUGHT' || (S.phase === 'ORBIT' && S.pred));
    const ufo = G.ufo && G.ufo.active, ops = S.phase === 'ORBIT' && S.pe > 95e3 && !G.sat && !ufo;
    $('#tpad').hidden = !(ops && !S.auto);
    $('#prof').hidden = !(ops || (S.phase === 'ENTRY' && S.spd > 700 && G.ref && G.ref.length > 4));
    $('#line').hidden = !$('#prof').hidden;
    $('#eff').hidden = !(S.stage === 1 && !G.sat && !ufo && (S.phase === 'ENTRY' || S.phase === 'LAND' || (S.phase === 'ORBIT' && (S.pe <= 95e3 || G.level === 'manual'))));
    if (G.ufo && G.ufo.active) $('#laser i').style.width = G.ufo.energy + '%';
  }
  // --- attitude dial
  let dpr = 1;
  function fit(c) { const r = c.getBoundingClientRect(), w = Math.round(r.width * dpr), h = Math.round(r.height * dpr); if (w && (c.width !== w || c.height !== h)) { c.width = w; c.height = h; } return c.getContext('2d'); }
  function drawDial() {
    const c = $('#dial'), g = fit(c), w = c.width, R = w / 2 - 2 * dpr; if (!w) return;
    g.clearRect(0, 0, w, w); g.save(); g.translate(w / 2, w / 2);
    g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fillStyle = 'rgba(5,9,15,.6)'; g.fill(); g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = dpr; g.stroke();
    g.beginPath(); g.moveTo(-R, 0); g.lineTo(R, 0); g.strokeStyle = 'rgba(143,216,255,.35)'; g.stroke();
    g.fillStyle = 'rgba(40,70,110,.25)'; g.beginPath(); g.arc(0, 0, R, 0, Math.PI); g.fill();
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.beginPath(); g.moveTo(Math.sin(a) * R, -Math.cos(a) * R); g.lineTo(Math.sin(a) * R * 0.9, -Math.cos(a) * R * 0.9); g.strokeStyle = 'rgba(255,255,255,.3)'; g.stroke(); }
    const mark = (ang, col, kind) => { const x = Math.sin(ang) * R * 0.78, y = -Math.cos(ang) * R * 0.78; g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1.6 * dpr;
      if (kind === 'o') { g.beginPath(); g.arc(x, y, R * 0.11, 0, TAU); g.stroke(); g.beginPath(); g.arc(x, y, R * 0.025, 0, TAU); g.fill(); }
      else if (kind === 'x') { const s = R * 0.08; g.beginPath(); g.moveTo(x - s, y - s); g.lineTo(x + s, y + s); g.moveTo(x + s, y - s); g.lineTo(x - s, y + s); g.stroke(); }
      else { g.save(); g.translate(Math.sin(ang) * R, -Math.cos(ang) * R); g.rotate(ang); g.beginPath(); g.moveTo(0, R * 0.2); g.lineTo(-R * 0.11, 0); g.lineTo(R * 0.11, 0); g.closePath(); g.fill(); g.restore(); } };
    if (S.spd > 5) { mark(S.pitPro, '#74e6a8', 'o'); mark(S.pitPro + Math.PI, '#ff4f5e', 'x'); }
    if (S.phase === 'ASCENT' || S.phase === 'PRE') mark(S.cue.pit, '#ff62d4', 't');
    if (S.phase === 'ENTRY' && S.spd > 30) mark(S.pitPro - S.cue.alpha, '#ff62d4', 't');
    if (S.phase === 'LAND') mark(S.flipDone ? S.cue.tiltX : 0, '#ff62d4', 't');
    if (S.phase === 'ORBIT') mark(S.pe <= 95e3 ? S.pitPro - CFG.alphaNom : needAtt(), '#ff62d4', 't');
    g.rotate(S.pit);
    if (S.stage === 1 && S.phase !== 'ASCENT') { // thruster puffs and the gimballed plume, in the ship's own frame
      const E = S.eff, jn = (S.rcsY || 0) - E.rcsU, jt = (S.rcsY || 0) + E.rcsU; g.strokeStyle = '#8fd8ff'; g.lineWidth = 2.2 * dpr; g.beginPath();
      if (Math.abs(jn) > 0.02) { g.moveTo(Math.sign(jn) * R * 0.1, -R * 0.6); g.lineTo(Math.sign(jn) * R * (0.14 + 0.3 * Math.min(1, Math.abs(jn))), -R * 0.6); }
      if (Math.abs(jt) > 0.02) { g.moveTo(Math.sign(jt) * R * 0.1, R * 0.24); g.lineTo(Math.sign(jt) * R * (0.14 + 0.3 * Math.min(1, Math.abs(jt))), R * 0.24); }
      g.stroke();
      if (S.thrust > 0) { const L = R * (0.2 + 0.3 * S.thr), a = E.gim * 2.5; g.strokeStyle = '#ff7a45'; g.lineWidth = 3 * dpr; g.beginPath(); g.moveTo(0, R * 0.3); g.lineTo(Math.sin(a) * L, R * 0.3 + Math.cos(a) * L); g.stroke(); }
    } g.fillStyle = '#eef2f6'; g.beginPath(); g.moveTo(0, -R * 0.74); g.quadraticCurveTo(R * 0.11, -R * 0.5, R * 0.09, R * 0.3); g.lineTo(-R * 0.09, R * 0.3); g.quadraticCurveTo(-R * 0.11, -R * 0.5, 0, -R * 0.74); g.fill();
    g.fillStyle = '#15171b'; g.fillRect(0, -R * 0.5, R * 0.09, R * 0.8); // belly side
    g.restore();
    g.fillStyle = '#94a1b0'; g.font = `500 ${9 * dpr}px Saira Condensed,sans-serif`; g.textAlign = 'center'; g.fillText('ATT ' + (S.att === 'MAN' ? 'MAN' : S.att), w / 2, w - 5 * dpr);
  }
  // --- landing / entry target scope (top-down: up = downrange, right = +cross-range)
  function drawScope() {
    const c = $('#scope'); if (c.hidden) return; const g = fit(c), w = c.width, R = w / 2 - 2 * dpr; if (!w) return;
    g.clearRect(0, 0, w, w); g.save(); g.translate(w / 2, w / 2);
    g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fillStyle = 'rgba(5,9,15,.6)'; g.fill(); g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = dpr; g.stroke();
    const far = S.phase === 'ORBIT' || (S.phase === 'ENTRY' && S.spd > 700);
    let px, pz, sx = null, sz = null;
    if (far) { px = S.pred ? S.pred.err : 0; pz = S.pred ? S.z + S.vz * Math.min(S.pred.tgo, 60) : 0; }
    else if (S.phase === 'ENTRY') { px = S.pred ? S.pred.err : S.x; pz = S.z + S.vz * 5; sx = S.x; sz = S.z; }
    else { px = S.x + S.vx * 2.5; pz = S.z + S.vz * 2.5; sx = S.x; sz = S.z; }
    const need = Math.max(Math.hypot(px, pz), sx === null ? 0 : Math.hypot(sx, sz)) * 1.25, scales = [16, 40, 100, 400, 2000, 10e3, 50e3, 250e3, 1500e3];
    let sc = scales[scales.length - 1]; for (const s of scales) if (need <= s) { sc = s; break; }
    const k = R / sc;
    g.strokeStyle = 'rgba(255,255,255,.18)'; for (const f of [0.5, 1]) { g.beginPath(); g.arc(0, 0, R * f, 0, TAU); g.stroke(); }
    g.beginPath(); g.moveTo(-R, 0); g.lineTo(R, 0); g.moveTo(0, -R); g.lineTo(0, R); g.stroke();
    if (sc <= 100) { g.beginPath(); g.arc(0, 0, CFG.catchTol * k, 0, TAU); g.strokeStyle = '#74e6a8'; g.lineWidth = 1.5 * dpr; g.stroke(); g.fillStyle = 'rgba(148,161,176,.5)'; g.fillRect(-6 * k, -21 * k, 12 * k, 10 * k); }
    else { g.fillStyle = '#74e6a8'; g.fillRect(-2 * dpr, -2 * dpr, 4 * dpr, 4 * dpr); }
    const cl = (x, z) => { let X = z * k, Y = -x * k; const d = Math.hypot(X, Y); if (d > R * 0.93) { X *= R * 0.93 / d; Y *= R * 0.93 / d; } return [X, Y]; };
    if (sx !== null) { const p = cl(sx, sz), q = cl(px, pz); g.strokeStyle = '#eef2f6'; g.lineWidth = 1.5 * dpr; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke(); g.fillStyle = '#eef2f6'; g.beginPath(); g.arc(p[0], p[1], 3.2 * dpr, 0, TAU); g.fill(); }
    if (far || S.phase === 'ENTRY') { const q = cl(px, pz), s = 4.5 * dpr; g.strokeStyle = S.pred ? '#ffc44d' : 'rgba(255,196,77,.3)'; g.lineWidth = 2 * dpr; g.beginPath(); g.moveTo(q[0] - s, q[1] - s); g.lineTo(q[0] + s, q[1] + s); g.moveTo(q[0] + s, q[1] - s); g.lineTo(q[0] - s, q[1] + s); g.stroke(); }
    g.restore();
    if (S.phase === 'LAND') { // descent-rate tape on the right edge
      const x = w - 5 * dpr, mid = w / 2, f = v => clamp(v / 40, -1, 1) * R * 0.8; g.strokeStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.moveTo(x, mid - R * 0.8); g.lineTo(x, mid + R * 0.8); g.stroke();
      g.fillStyle = '#ff62d4'; g.fillRect(x - 4 * dpr, mid + f(-S.cue.vdes) - dpr, 8 * dpr, 2 * dpr); g.fillStyle = '#eef2f6'; g.beginPath(); const y = mid + f(-S.vr); g.moveTo(x - 6 * dpr, y); g.lineTo(x, y - 3 * dpr); g.lineTo(x, y + 3 * dpr); g.fill(); }
    g.fillStyle = '#94a1b0'; g.font = `500 ${9 * dpr}px Saira Condensed,sans-serif`; g.textAlign = 'center';
    g.fillText((sc >= 1000 ? fmt(sc / 1000) + ' km' : fmt(sc) + ' m') + (far ? ' · 预测落点' : ''), w / 2, w - 5 * dpr);
  }
  // --- strip chart above the clock: the orbit ahead, or the entry glide path
  function drawProf() {
    const c = $('#prof'); if (c.hidden) return; const g = fit(c), w = c.width, h = c.height; if (!w) return;
    g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(5,9,15,.55)'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = dpr; g.strokeRect(0.5, 0.5, w - 1, h - 1);
    g.font = `500 ${9 * dpr}px Saira Condensed,"Noto Sans SC",sans-serif`; g.textBaseline = 'middle';
    const txt = (t, x, y, col, al) => { g.fillStyle = col; g.textAlign = al || 'left'; g.fillText(t, x, y); };
    if (S.phase === 'ORBIT') {
      const span = 200 * D2R, x0 = 26 * dpr, X = a => x0 + a / span * (w - x0 - 5 * dpr), tol = G.diff === 0 ? 20e3 : CFG.orbitTol;
      let lo = 172e3, hi = 228e3; const inc = v => { if (isFinite(v)) { lo = Math.min(lo, v - 6e3); hi = Math.max(hi, v + 6e3); } };
      inc(S.h); inc(clamp(S.ap, 120e3, 330e3)); inc(clamp(S.pe, 120e3, 330e3));
      const hz = curHaz(); if (hz) { inc(hz.lo); inc(Math.min(hz.hi, hz.lo + 34e3)); }
      const top = 4 * dpr, bot = h - 11 * dpr, Y = v => bot - (clamp(v, lo, hi) - lo) / (hi - lo) * (bot - top);
      g.fillStyle = 'rgba(116,230,168,.13)'; g.fillRect(x0, Y(CFG.targetAlt + tol), w - x0 - 1, Y(CFG.targetAlt - tol) - Y(CFG.targetAlt + tol));
      g.strokeStyle = '#74e6a8'; g.setLineDash([5 * dpr, 4 * dpr]); g.beginPath(); g.moveTo(x0, Y(CFG.targetAlt)); g.lineTo(w, Y(CFG.targetAlt)); g.stroke(); g.setLineDash([]);
      txt('正轨 200', w - 4 * dpr, Y(CFG.targetAlt) - 6 * dpr, '#74e6a8', 'right');
      G.haz.forEach(z => { if (z.state !== 'warn' && z.state !== 'clear') return; const a = z.ang - S.ang; if (a < 0 || a > span) return; const x = X(a), y1 = Y(z.hi), y2 = Y(z.lo), col = z.state === 'warn' ? '#ff4f5e' : '#ffc44d';
        g.fillStyle = z.state === 'warn' ? 'rgba(255,79,94,.4)' : 'rgba(255,196,77,.3)'; g.fillRect(x - 7 * dpr, y1, 14 * dpr, y2 - y1); g.strokeStyle = col; g.strokeRect(x - 7 * dpr, y1, 14 * dpr, y2 - y1); txt(z.name, x + 10 * dpr, clamp((y1 + y2) / 2, top + 5 * dpr, bot - 5 * dpr), col); });
      G.windows.forEach(wd => { if (wd.done) return; let a = SIM.wrap2(wd.phi - S.phi); if (a > TAU - wd.half) a -= TAU; const a0 = Math.max(a - wd.half, 0), a1 = Math.min(a + wd.half, span); if (a1 <= a0) return;
        g.fillStyle = '#74e6a8'; g.fillRect(X(a0), bot + 2 * dpr, X(a1) - X(a0), 3 * dpr); txt('窗口 ' + wd.n, (X(a0) + X(a1)) / 2, bot + 7 * dpr, '#74e6a8', 'center'); });
      if (S.std && !nextWin()) { const a = S.std.lead; if (a < span) { g.fillStyle = '#ff7a45'; g.fillRect(X(a) - dpr, top, 2 * dpr, bot - top); txt('离轨点火点', X(a) + 4 * dpr, top + 5 * dpr, '#ff7a45'); } }
      g.strokeStyle = '#eef2f6'; g.lineWidth = 1.6 * dpr; g.beginPath(); for (let i = 0; i <= 50; i++) { const a = i / 50 * span, y = Y(SIM.orbitRadiusAt(S, S.phi + a) - RE); if (i) g.lineTo(X(a), y); else g.moveTo(X(a), y); } g.stroke();
      const ys = Y(S.h); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x0 + 6 * dpr, ys); g.lineTo(x0 - 3 * dpr, ys - 4 * dpr); g.lineTo(x0 - 3 * dpr, ys + 4 * dpr); g.fill();
      txt(fmt(hi / 1000), 3 * dpr, top + 4 * dpr, '#94a1b0'); txt(fmt(lo / 1000), 3 * dpr, bot - 3 * dpr, '#94a1b0'); txt('km', 3 * dpr, (top + bot) / 2, '#94a1b0');
      txt('前方半圈 →', w - 4 * dpr, bot + 7 * dpr, '#94a1b0', 'right');
    } else {
      const R = G.entryR, top = 4 * dpr, bot = h - 4 * dpr, X = d => 4 * dpr + (1 - Math.sqrt(clamp(d / R, 0, 1))) * (w - 12 * dpr), Y = v => bot - clamp(v / 125e3, 0, 1) * (bot - top);
      const line = (arr, col, lw, dash) => { g.beginPath(); for (let i = 0; i < arr.length; i += 2) { const x = X(arr[i]), y = Y(arr[i + 1]); if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.strokeStyle = col; g.lineWidth = lw * dpr; g.setLineDash(dash || []); g.stroke(); g.setLineDash([]); };
      g.fillStyle = 'rgba(255,255,255,.07)'; for (const km of [40e3, 80e3, 120e3]) g.fillRect(4 * dpr, Y(km), w - 8 * dpr, dpr);
      line(G.ref, '#ff4f5e', 2, [2 * dpr, 4 * dpr]);
      if (S.pred && S.pred.pts && S.pred.pts.length > 4) { const a = [-SIM.wrapPi(S.phi) * RE, S.h], pts = S.pred.pts; for (let i = 0; i < pts.length; i += 2) a.push(-SIM.wrapPi(Math.atan2(pts[i], pts[i + 1])) * RE, Math.hypot(pts[i], pts[i + 1]) - RE); line(a, '#ffc44d', 1.4, [5 * dpr, 4 * dpr]); }
      line(G.trail.concat([-SIM.wrapPi(S.phi) * RE, S.h]), '#eef2f6', 1.8);
      const sx = X(-SIM.wrapPi(S.phi) * RE), sy = Y(S.h); g.fillStyle = '#fff'; g.beginPath(); g.arc(sx, sy, 3.5 * dpr, 0, TAU); g.fill();
      g.fillStyle = '#74e6a8'; g.fillRect(w - 8 * dpr, bot - 10 * dpr, 3 * dpr, 10 * dpr);
      txt('红点线 = 辅助线', 7 * dpr, bot - 6 * dpr, '#ff4f5e'); txt('黄 = 预测', 7 * dpr, bot - 17 * dpr, '#ffc44d'); txt('发射塔', w - 12 * dpr, bot - 5 * dpr, '#74e6a8', 'right'); txt('高度 120 km', 7 * dpr, top + 5 * dpr, '#94a1b0');
    }
    g.textBaseline = 'alphabetic';
  }
  // --- attitude effectors: what the thrusters, flaps and gimbal are doing, and the torque they make
  function drawEff() {
    const c = $('#eff'); if (c.hidden) return; const g = fit(c), w = c.width, h = c.height; if (!w) return; const E = S.eff, u = h / 100;
    g.clearRect(0, 0, w, h); g.textBaseline = 'middle';
    const air = (S.q || 0) > 60 && S.phase !== 'LAND', burn = S.thrust > 0, cx = w * 0.19, top = 22 * u, bot = 78 * u, bw = 6.5 * u;
    // hull, seen from the side: nose up, heat-shield (belly) to the right
    g.fillStyle = '#cfd6de'; g.beginPath(); g.moveTo(cx, top - 12 * u); g.quadraticCurveTo(cx + bw, top - 4 * u, cx + bw, top + 6 * u); g.lineTo(cx + bw, bot); g.lineTo(cx - bw, bot); g.lineTo(cx - bw, top + 6 * u); g.quadraticCurveTo(cx - bw, top - 4 * u, cx, top - 12 * u); g.fill();
    g.fillStyle = '#15171b'; g.beginPath(); g.moveTo(cx, top - 12 * u); g.quadraticCurveTo(cx + bw, top - 4 * u, cx + bw, top + 6 * u); g.lineTo(cx + bw, bot); g.lineTo(cx, bot); g.fill();
    // flaps: the wider they open, the harder the air pushes that end
    const flap = (y, d, len) => { const a = (8 + 64 * d) * D2R; g.strokeStyle = air ? '#ff7a45' : '#5c6470'; g.lineWidth = 3 * u; g.beginPath(); g.moveTo(cx + bw, y); g.lineTo(cx + bw + Math.sin(a) * len, y + Math.cos(a) * len); g.stroke(); };
    flap(top + 4 * u, E.dF, 13 * u); flap(bot - 26 * u, E.dA, 19 * u);
    // thrusters
    const jn = (S.rcsY || 0) - E.rcsU, jt = (S.rcsY || 0) + E.rcsU;
    const jet = (y, v) => { if (Math.abs(v) < 0.02) return; const sg = Math.sign(v), L = (5 + 13 * Math.min(1, Math.abs(v))) * u, x = cx + sg * (bw + 1.5 * u); g.fillStyle = '#8fd8ff'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + sg * L, y - 3.2 * u); g.lineTo(x + sg * L, y + 3.2 * u); g.fill(); };
    jet(top - 1 * u, jn); jet(bot - 4 * u, jt);
    // engine and gimbal
    g.fillStyle = '#5c6470'; g.fillRect(cx - 3 * u, bot, 6 * u, 3 * u);
    if (burn) { const a = E.gim * 2.2, L = (8 + 12 * S.thr) * u, ex = cx + Math.sin(a) * L, ey = bot + 3 * u + Math.cos(a) * L; g.fillStyle = '#ff7a45'; g.beginPath(); g.moveTo(cx - 2.6 * u, bot + 3 * u); g.lineTo(cx + 2.6 * u, bot + 3 * u); g.lineTo(ex, ey); g.fill(); }
    // numbers
    const fs = Math.max(8 * dpr, Math.min(12 * dpr, w / 19)), xL = w * 0.36, xR = w - 5 * dpr, rows = [
      ['力矩 τ', sgn(E.tau / 1e6, 2) + ' MN·m'], ['角速度 ω', sgn(S.pitRate / D2R, 1) + ' °/s'], ['角加速度 τ/I', sgn((E.tau + (E.Mp || 0)) / E.I / D2R, 1) + ' °/s²'],
      ['前 / 后襟翼', air || S.phase === 'LAND' ? fmt(E.dF * 100) + ' / ' + fmt(E.dA * 100) + ' %' : '无气流'], ['发动机摆角 θ', burn ? sgn(E.gim / D2R, 1) + '°' : '未点火'], ['喷气', Math.abs(E.rcsU) > 0.02 ? (E.rcsU > 0 ? '压低机头' : '抬起机头') : S.rcsY ? '平移' : '关']];
    g.font = `600 ${fs}px Saira Condensed,"Noto Sans SC",sans-serif`; g.textAlign = 'left'; g.fillStyle = '#eef2f6'; g.fillText('姿态执行机构', 4 * dpr, 6.5 * u);
    g.textAlign = 'right'; g.fillStyle = '#8fd8ff'; g.fillText(S.auto || S.assist ? '飞控' : '直控', xR, 6.5 * u);
    rows.forEach((r, i) => { const y = (20 + i * 11.6) * u; g.font = `500 ${fs * 0.86}px "Noto Sans SC",sans-serif`; g.textAlign = 'left'; g.fillStyle = '#94a1b0'; g.fillText(r[0], xL, y); g.font = `600 ${fs}px Saira Condensed,"Noto Sans SC",sans-serif`; g.textAlign = 'right'; g.fillStyle = '#eef2f6'; g.fillText(r[1], xR, y); });
    const aG = Math.abs(E.tauG), aF = Math.abs(E.tauF), aR = Math.abs(E.tauR), m = Math.max(aG, aF, aR);
    const f = m < 1 ? '转动：角加速度 = τ / I' : m === aG ? 'τ = F·L·sinθ = ' + fmt(S.thrust / 1e6, 1) + ' MN × 20 m × sin ' + fmt(Math.abs(E.gim) / D2R, 1) + '°' : m === aF ? 'τ = q·Cn·K·(后襟翼 − 前襟翼)' : 'τ = 2·F·L = 2 × 55 kN × 21 m';
    g.font = `500 ${fs * 0.82}px Saira Condensed,"Noto Sans SC",sans-serif`; g.textAlign = 'left'; g.fillStyle = '#ffc44d'; g.fillText(f, 4 * dpr, 93.5 * u, w - 8 * dpr);
    g.textBaseline = 'alphabetic';
  }
  // --- full-screen overlay: orbit map + markers
  const P1 = {}, P2 = {};
  function drawOverlay() {
    const c = $('#ov'), w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr); if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const g = c.getContext('2d'); g.clearRect(0, 0, w, h); if (G.mode !== 'play' && G.mode !== 'card') return;
    g.lineJoin = 'round'; g.font = `600 ${11 * dpr}px Saira Condensed,"Noto Sans SC",sans-serif`;
    const label = (p, t, col, dy) => { g.fillStyle = 'rgba(0,0,0,.55)'; const m = g.measureText(t).width; g.fillRect(p.x * dpr + 8 * dpr, p.y * dpr + (dy || -8) * dpr - 10 * dpr, m + 8 * dpr, 14 * dpr); g.fillStyle = col; g.textAlign = 'left'; g.fillText(t, p.x * dpr + 12 * dpr, p.y * dpr + (dy || -8) * dpr + 1 * dpr); };
    if (cam.view === 'MAP') {
      const path = (fn, n, col, lw, dash) => { g.beginPath(); let pen = false; for (let i = 0; i <= n; i++) { const q = fn(i); if (!q) { pen = false; continue; } GFX.projectInertial(q[0], q[1], 0, P1); if (!P1.vis) { pen = false; continue; } if (pen) g.lineTo(P1.x * dpr, P1.y * dpr); else g.moveTo(P1.x * dpr, P1.y * dpr); pen = true; } g.strokeStyle = col; g.lineWidth = lw * dpr; g.setLineDash(dash ? [6 * dpr, 5 * dpr] : []); g.stroke(); g.setLineDash([]); };
      const orbPt = a => { const r = SIM.orbitRadiusAt(S, a); return r > RE + 1000 ? [Math.sin(a) * r, Math.cos(a) * r] : null; };
      if (S.phase !== 'PRE' && isFinite(S.sma)) path(i => orbPt(i / 180 * TAU), 180, 'rgba(238,242,246,.85)', 1.6);
      G.windows.forEach(wd => { if (wd.done) return; path(i => orbPt(wd.phi - wd.half + i / 12 * wd.half * 2), 12, '#74e6a8', 5); const q = orbPt(wd.phi); if (q) { GFX.projectInertial(q[0], q[1], 0, P1); if (P1.vis) label(P1, '卫星 ' + wd.n + ' 窗口', '#74e6a8'); } });
      G.haz.forEach(d => { if (d.state !== 'warn' && d.state !== 'clear') return; const rc = RE + (d.lo + Math.min(d.hi, d.lo + 30e3)) / 2; GFX.projectInertial(Math.sin(d.phi) * rc, Math.cos(d.phi) * rc, 0, P1);
        if (P1.vis) { const col = d.state === 'warn' ? '#ff4f5e' : '#ffc44d', x = P1.x * dpr, y = P1.y * dpr, pu = 1 + 0.25 * Math.sin(performance.now() / 160);
          g.fillStyle = col; g.globalAlpha = 0.35; g.beginPath(); g.arc(x, y, 13 * dpr * pu, 0, TAU); g.fill(); g.globalAlpha = 1; g.beginPath(); g.arc(x, y, 5 * dpr, 0, TAU); g.fill();
          label(P1, d.name + ' · ' + fmt(d.lo / 1000) + '–' + fmt(d.hi / 1000) + ' km' + (d.state === 'clear' ? ' · 已避开' : ''), col); } });
      if (S.pred && S.pred.pts) { const pts = S.pred.pts; path(i => [pts[i * 2], pts[i * 2 + 1]], pts.length / 2 - 1, '#ffc44d', 1.6, true); const n = pts.length; if (n > 2) { GFX.projectInertial(pts[n - 2], pts[n - 1], 0, P1); if (P1.vis) { const s = 6 * dpr; g.strokeStyle = '#ffc44d'; g.lineWidth = 2 * dpr; g.beginPath(); g.moveTo(P1.x * dpr - s, P1.y * dpr - s); g.lineTo(P1.x * dpr + s, P1.y * dpr + s); g.moveTo(P1.x * dpr + s, P1.y * dpr - s); g.lineTo(P1.x * dpr - s, P1.y * dpr + s); g.stroke(); label(P1, '落点 ' + (S.pred.err > 0 ? '+' : '') + fmt(S.pred.err / 1000) + ' km', '#ffc44d', 14); } } }
      if (S.std && S.pe > 95e3) { const q = orbPt(S.phi + S.std.lead); if (q) { GFX.projectInertial(q[0], q[1], 0, P1); if (P1.vis) { g.fillStyle = '#ff7a45'; g.beginPath(); g.arc(P1.x * dpr, P1.y * dpr, 5 * dpr, 0, TAU); g.fill(); label(P1, '离轨点火点', '#ff7a45'); } } }
      if (isFinite(S.sma) && S.ecc > 0.0012 && S.pe > 0) { const en = Math.hypot(S.ex, S.ey), aP = Math.atan2(S.ex / en, S.ey / en); let q = orbPt(aP + Math.PI); if (q) { GFX.projectInertial(q[0], q[1], 0, P1); if (P1.vis) label(P1, 'AP ' + km(S.ap), '#94a1b0', 16); } q = orbPt(aP); if (q) { GFX.projectInertial(q[0], q[1], 0, P1); if (P1.vis) label(P1, 'PE ' + km(S.pe), '#94a1b0', 16); } }
      GFX.projectInertial(0, RE, 0, P1); if (P1.vis) { g.fillStyle = '#8fd8ff'; g.fillRect(P1.x * dpr - 2 * dpr, P1.y * dpr - 9 * dpr, 4 * dpr, 9 * dpr); label(P1, 'STARBASE 发射塔', '#8fd8ff', 14); }
      GFX.projectInertial(S.x, S.y, 0, P1); if (P1.vis) { g.fillStyle = '#fff'; g.beginPath(); g.arc(P1.x * dpr, P1.y * dpr, 4.5 * dpr, 0, TAU); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = dpr; g.beginPath(); g.arc(P1.x * dpr, P1.y * dpr, 9 * dpr, 0, TAU); g.stroke(); label(P1, 'STARSHIP ' + km(S.h) + ' km', '#fff'); }
      g.fillStyle = '#94a1b0'; g.textAlign = 'center'; g.fillText('地球自转 15°/小时 · 已转过 ' + fmt(gx.rotE / D2R, 1) + '° · 发射塔、部署窗口、离轨点火点随地面东移', w / 2, ($('#bot').getBoundingClientRect().top - 9) * dpr);
      return;
    }
    // near view markers
    if (G.ufo && G.ufo.active) gx.ufos.forEach(u => { if (!u || !u.alive) return; GFX.projectLocal(u.x, u.y, u.z, P1); if (!P1.vis) return; const s = 20 * dpr, x = P1.x * dpr, y = P1.y * dpr; g.strokeStyle = u.charge > 0 ? '#ff4f5e' : '#74e6a8'; g.lineWidth = 2 * dpr; g.beginPath();
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) { g.moveTo(x + sx * s, y + sy * s * 0.5); g.lineTo(x + sx * s, y + sy * s); g.lineTo(x + sx * s * 0.5, y + sy * s); } g.stroke(); });
    const P3 = {}, proj = (x, y, z, o) => { const q = GFX.padLocal(x, y, z, P3); return GFX.projectLocal(q.x, q.y, q.z, o); };
    const dots = (pts, col, rad) => { g.fillStyle = col; for (const q of pts) { if (!q.vis) continue; g.beginPath(); g.arc(q.x * dpr, q.y * dpr, rad * dpr, 0, TAU); g.fill(); } };
    if (G.sat && cam.view !== 'MAP') { // the satellite's planned path, fixed to the ship
      const t = G.sat, pts = [], Q = {}; for (let u = 4; u <= SATP.L; u += 4) { const m = satModel(u, 0, 0, SM), c = GFX.shipPoint(m.x, m.y, m.z, Q), o = {}; GFX.projectLocal(c.x, c.y, c.z, o); pts.push(o); }
      dots(pts, '#ff4f5e', 2.2);
      const end = satModel(SATP.L, 0, 0, SM), ce = GFX.shipPoint(end.x, end.y, end.z, Q), pe = GFX.projectLocal(ce.x, ce.y, ce.z, {}), er = satModel(SATP.L, SATP.tol, 0, SM), cr = GFX.shipPoint(er.x, er.y, er.z, Q), pr = GFX.projectLocal(cr.x, cr.y, cr.z, {});
      if (pe.vis) { const rad = Math.max(7, Math.hypot(pr.x - pe.x, pr.y - pe.y)) * dpr; g.strokeStyle = '#ff4f5e'; g.lineWidth = 1.6 * dpr; g.beginPath(); g.arc(pe.x * dpr, pe.y * dpr, rad, 0, TAU); g.stroke(); label(pe, '入轨点', '#ff4f5e', 16); }
      const sm = satModel(t.u, t.a, t.b, SM), cs = GFX.shipPoint(sm.x, sm.y, sm.z, Q), ps = GFX.projectLocal(cs.x, cs.y, cs.z, {}), lm = satModel(t.u, 0, 0, SM), cl = GFX.shipPoint(lm.x, lm.y, lm.z, Q), pl = GFX.projectLocal(cl.x, cl.y, cl.z, {});
      if (ps.vis && pl.vis && t.phase !== 'done') { const ok = t.err <= SATP.tol; g.strokeStyle = ok ? '#74e6a8' : '#ffc44d'; g.lineWidth = 1.5 * dpr; g.beginPath(); g.moveTo(ps.x * dpr, ps.y * dpr); g.lineTo(pl.x * dpr, pl.y * dpr); g.stroke(); label(ps, '偏离 ' + fmt(t.err, 1) + ' m', ok ? '#74e6a8' : '#ffc44d'); }
    }
    const term = S.phase === 'ENTRY' && S.spd < 700, lnd = S.phase === 'LAND';
    if ((term || lnd) && cam.view !== 'MAP') {
      // red dotted guide: fall belly-first over the aim point, flip, then straight down between the arms
      const fh = Math.max(S.cue.flipH, CFG.catchH + 300), kx = -CFG.flipKick, mid = CFG.catchH + 0.35 * (fh - CFG.catchH), pts = [];
      const seg = (x0, y0, x1, y1, step) => { const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / step)); for (let i = 0; i <= n; i++) pts.push(proj(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, 0, {})); };
      if (term) seg(kx, Math.min(S.h + 2500, 12000), kx, fh, 90);
      seg(kx, fh, 0, mid, 22); seg(0, mid, 0, CFG.catchH, 14);
      g.strokeStyle = 'rgba(255,79,94,.35)'; g.lineWidth = dpr; g.beginPath(); let pen = false; for (const q of pts) { if (!q.vis) { pen = false; continue; } if (pen) g.lineTo(q.x * dpr, q.y * dpr); else g.moveTo(q.x * dpr, q.y * dpr); pen = true; } g.stroke();
      dots(pts, '#ff4f5e', 2.6);
      const foot = proj(0, CFG.catchH, 0, {}); if (foot.vis) { g.strokeStyle = '#ff4f5e'; g.lineWidth = 1.6 * dpr; g.beginPath(); g.arc(foot.x * dpr, foot.y * dpr, 7 * dpr, 0, TAU); g.stroke(); }
      // yellow: where the ship is heading
      const o0 = GFX.projectLocal(0, 0, 0, {}); let tx, ty, tz, fx, fz;
      if (term) { const tf = Math.max((S.h - fh) / Math.max(-S.vr, 20), 0); fx = S.pred ? S.pred.err : S.x + CFG.flipKick; fz = S.z + S.vz * Math.min(tf, 40); tx = fx - CFG.flipKick; ty = fh; tz = fz; }
      else { const tg = clamp((S.h - CFG.catchH) / Math.max(-S.vr, 3), 0, 7); tx = fx = S.x + S.vx * tg; tz = fz = S.z + S.vz * tg; ty = Math.max(CFG.catchH, S.h + S.vr * tg); }
      const o1 = proj(tx, ty, tz, {}), o2 = proj(fx, CFG.catchH, fz, {});
      g.strokeStyle = '#ffc44d'; g.lineWidth = 1.6 * dpr; g.setLineDash([6 * dpr, 4 * dpr]); g.beginPath(); if (o0.vis && o1.vis) { g.moveTo(o0.x * dpr, o0.y * dpr); g.lineTo(o1.x * dpr, o1.y * dpr); if (o2.vis) g.lineTo(o2.x * dpr, o2.y * dpr); } g.stroke(); g.setLineDash([]);
      if (o2.vis) { const sz = 6 * dpr, x = o2.x * dpr, y = o2.y * dpr; g.lineWidth = 2 * dpr; g.beginPath(); g.moveTo(x - sz, y - sz); g.lineTo(x + sz, y + sz); g.moveTo(x + sz, y - sz); g.lineTo(x - sz, y + sz); g.stroke(); label(o2, '预计落点 偏 ' + fmt(Math.hypot(fx, fz)) + ' m', '#ffc44d', 16); }
    }
    if (term || lnd) { const p = GFX.padLocal(0, CFG.catchH + 36, 0, {}); GFX.projectLocal(p.x, p.y, p.z, P1); const dist = Math.hypot(p.x, p.y, p.z); if (P1.vis && dist > 400) { const x = P1.x * dpr, y = P1.y * dpr, s = 8 * dpr; g.strokeStyle = '#74e6a8'; g.lineWidth = 1.6 * dpr; g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s, y); g.lineTo(x, y + s); g.lineTo(x - s, y); g.closePath(); g.stroke(); label(P1, '塔架 ' + (dist > 2000 ? fmt(dist / 1000, 1) + ' km' : fmt(dist) + ' m'), '#74e6a8'); } }
  }

  // ------------------------------ input ------------------------------
  function bindInput() {
    const st = $('#stick'), knob = st.querySelector('i'); let sid = null;
    const setStick = e => { const r = st.getBoundingClientRect(), R = r.width / 2; let x = (e.clientX - r.left - R) / (R * 0.72), y = -(e.clientY - r.top - R) / (R * 0.72); const d = Math.hypot(x, y); if (d > 1) { x /= d; y /= d; } G.stick.x = x; G.stick.y = y; knob.style.transform = `translate(${x * R * 0.6}px,${-y * R * 0.6}px)`; };
    st.addEventListener('pointerdown', e => { sid = e.pointerId; st.setPointerCapture(sid); setStick(e); e.preventDefault(); });
    st.addEventListener('pointermove', e => { if (e.pointerId === sid) setStick(e); });
    const rel = e => { if (e.pointerId === sid) { sid = null; G.stick.x = G.stick.y = 0; knob.style.transform = ''; } };
    st.addEventListener('pointerup', rel); st.addEventListener('pointercancel', rel);
    const th = $('#thr'); let tid = null;
    const setThr = e => { if (S.auto) return; if (S.athr) { S.athr = false; say('MANUAL THROTTLE', '你已接管油门', 'warn'); } const r = th.getBoundingClientRect(); let v = clamp(1 - (e.clientY - r.top) / r.height, 0, 1); if (v < 0.04) v = 0; if (v > 0.97) v = 1; G.ctl.thr = v; };
    th.addEventListener('pointerdown', e => { tid = e.pointerId; th.setPointerCapture(tid); setThr(e); e.preventDefault(); });
    th.addEventListener('pointermove', e => { if (e.pointerId === tid) setThr(e); });
    th.addEventListener('pointerup', e => { if (e.pointerId === tid) tid = null; }); th.addEventListener('pointercancel', () => { tid = null; });
    // camera drag / pinch / tap on the 3-D view
    const cv = $('#gl'), pts = new Map(); let pinch = 0, moved = 0, downT = 0;
    cv.addEventListener('pointerdown', e => { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); try { cv.setPointerCapture(e.pointerId); } catch (x) {} moved = 0; downT = performance.now(); if (pts.size === 2) { const a = [...pts.values()]; pinch = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); } });
    cv.addEventListener('pointermove', e => { const p = pts.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
      if (pts.size === 1) { if (cam.view === 'MAP') { cam.mapAz -= dx * 0.006; cam.mapEl = clamp(cam.mapEl + dy * 0.005, -1.4, 1.4); } else if (cam.view === 'EXT' && G.mode !== 'menu') { cam.az -= dx * 0.007; cam.el = clamp(cam.el + dy * 0.005, -1.3, 1.45); } }
      else if (pts.size === 2) { const a = [...pts.values()], d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); if (pinch > 0) zoom(pinch / d); pinch = d; } });
    const up = e => { if (pts.has(e.pointerId) && pts.size === 1 && moved < 10 && performance.now() - downT < 400) fireAt(e.clientX, e.clientY); pts.delete(e.pointerId); pinch = 0; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', e => { pts.delete(e.pointerId); });
    const zoom = f => { if (cam.view === 'MAP') cam.mapDist = clamp(cam.mapDist * f, 9000, 60000); else if (cam.view === 'EXT') cam.dist = clamp(cam.dist * f, 45, 6000); };
    cv.addEventListener('wheel', e => { zoom(Math.exp(e.deltaY * 0.0012)); e.preventDefault(); }, { passive: false });
    // translation thrusters: hold to fire
    $$('#tpad button').forEach(b => { const k = b.dataset.t, on = e => { G.tp[k] = 1; b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch (x) {} e.preventDefault(); }, off = () => { G.tp[k] = 0; b.classList.remove('on'); };
      b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', off); });
    // buttons
    $('#cams').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { if (G.sat) G.sat.prevView = b.dataset.c; setView(b.dataset.c); } });
    $('#acts').addEventListener('click', e => { const b = e.target.closest('button'); if (b && !b.disabled) action(b.dataset.id); });
    $('#sas').addEventListener('click', e => { const b = e.target.closest('button'); if (b && !S.auto) S.att = b.dataset.m; hudActions(); });
    const lvl = e => { const b = e.target.closest('button'); if (b) { G.level = b.dataset.a; applyLevel(); } };
    $('#assist').addEventListener('click', lvl); $('#massist').addEventListener('click', lvl);
    const wstep = d => { const i = WARPS.indexOf(G.warp), n = WARPS[clamp(i + d, 0, WARPS.length - 1)]; G.warp = Math.min(n, maxWarp()); hudSlow(); };
    $('#wup').addEventListener('click', () => wstep(1)); $('#wdn').addEventListener('click', () => wstep(-1));
    $('#bpause').addEventListener('click', () => { if (G.mode === 'play') pauseCard(); });
    $('#prec').addEventListener('click', () => { G.ctl.precision = !G.ctl.precision; $('#prec').classList.toggle('on', G.ctl.precision); });
    $('#diff').addEventListener('click', e => { const b = e.target.closest('.opt'); if (b) { G.diff = +b.dataset.d; $$('#diff .opt').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); }); } });
    $('#bstart').addEventListener('click', () => startMission(null));
    $('#bcont').addEventListener('click', () => { if (G.cp) startMission(G.cp); });
    $('#bhelp').addEventListener('click', helpCard);
    $('#rotok').addEventListener('click', () => { G.flags.rot = 1; $('#rot').classList.remove('show'); });
    $('#sheet').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const a = b.dataset.act;
      if (a === 'close') { closeCard(); if (G.pendingMenu) { G.pendingMenu = false; } }
      else if (a === 'retry') { $('#card').hidden = true; G.paused = false; startMission(G.cp); }
      else if (a === 'restart') { $('#card').hidden = true; G.paused = false; startMission(null); }
      else if (a === 'menu') { $('#card').hidden = true; G.paused = false; toMenu(); }
      else if (a === 'help') helpCard();
      else if (a === 'sound') { AU.on = !AU.on; pauseCard(); } });
    addEventListener('keydown', e => { if (e.repeat) return; const k = e.key.toLowerCase(); G.keys[k] = 1;
      if (G.mode === 'card') { if (k === 'escape' || k === 'p') { const b = $('#sheet [data-act=close]'); if (b) closeCard(); } return; }
      if (G.mode !== 'play') return;
      if (k === ' ') { const b = $('#acts button:not(:disabled)'); if (b) action(b.dataset.id); e.preventDefault(); }
      else if (k === 'z') { G.ctl.thr = 1; S.athr = false; } else if (k === 'x') { G.ctl.thr = 0; S.athr = false; } else if (k === 'f') $('#prec').click();
      else if (k === '.' || k === '>') wstep(1); else if (k === ',' || k === '<') wstep(-1); else if (k === 'p' || k === 'escape') pauseCard();
      else if (k >= '1' && k <= '6') setView(['EXT', 'FLAP', 'ENG', 'NOSE', 'TOWER', 'MAP'][+k - 1]);
      else if (k === 'm') setView(cam.view === 'MAP' ? 'EXT' : 'MAP');
      if (k.startsWith('arrow')) e.preventDefault(); });
    addEventListener('keyup', e => { G.keys[e.key.toLowerCase()] = 0; });
    addEventListener('blur', () => { G.keys = {}; G.tp.u = G.tp.d = G.tp.f = G.tp.b = 0; $$('#tpad button').forEach(b => b.classList.remove('on')); });
    addEventListener('resize', () => { GFX.resize(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && G.mode === 'play' && !G.paused) pauseCard(); });
  }

  // ------------------------------- loop -------------------------------
  // one step of the running mission: input, physics, events, game rules (no drawing)
  function advance(wdt) {
    if (G.mode !== 'play' || G.paused) return 0;
    const K = G.keys, kx = (K.arrowright || K.d ? 1 : 0) - (K.arrowleft || K.a ? 1 : 0), ky = (K.arrowup || K.w ? 1 : 0) - (K.arrowdown || K.s ? 1 : 0);
    G.ctl.sx = clamp(G.stick.x + kx, -1, 1); G.ctl.sy = clamp(G.stick.y + ky, -1, 1);
    G.ctl.tx = clamp(G.tp.f - G.tp.b + (K.l ? 1 : 0) - (K.j ? 1 : 0), -1, 1); G.ctl.ty = clamp(G.tp.u - G.tp.d + (K.i ? 1 : 0) - (K.k ? 1 : 0), -1, 1);
    if (G.sat) { G.satStick.x = G.ctl.sx; G.satStick.y = G.ctl.sy; G.ctl.sx = G.ctl.sy = G.ctl.tx = G.ctl.ty = 0; }   // the stick flies the satellite; the ship holds still
    if (!S.auto) { if (K.shift || K.control) S.athr = false; if (K.shift) G.ctl.thr = Math.min(1, G.ctl.thr + wdt * 0.7); if (K.control) G.ctl.thr = Math.max(0, G.ctl.thr - wdt * 0.7); }
    if (G.countdown >= 0) { G.countdown -= wdt; gx.ignite = clamp((3 - G.countdown) / 2.6, 0, 1); const c = Math.ceil(G.countdown); if (c !== G.lastC) { G.lastC = c; const poll = { 9: ['PROPELLANT', '推进剂加注完成 · GO'], 7: ['ENGINES', '33 台发动机预冷完成 · GO'], 5: ['FLIGHT CONTROL', '姿态控制自检通过 · GO'], 3: ['IGNITION', '点火，塔架脱开'] }[c]; if (poll) say(poll[0], poll[1], c === 3 ? 'go' : ''); if (c > 0 && c <= 10) AU.beep(c <= 3 ? 990 : 660, 0.09); }
      if (G.countdown <= 0) { G.countdown = -1; SIM.liftoff(S); G.ctl.thr = 1; gx.ignite = 0; } }
    G.warp = Math.min(G.warp, maxWarp()); const dt = wdt * G.warp;
    SIM.step(S, G.ctl, dt); gx.rotE = OMEGA * Math.max(S.t, 0);
    if (S.athr && S.phase === 'LAND' && !S.auto) G.ctl.thr = S.thr;
    // landing prediction: refreshed on simulated time, so guidance stays sharp under time warp
    G.predT -= wdt; const hot = S.phase === 'ENTRY' || S.thr > 0;
    if (G.predT <= 0 || Math.abs(S.t - (G.predS || 0)) > (hot ? 0.25 : 3)) { G.predT = hot ? 0.22 : 0.5; G.predS = S.t; SIM.updatePrediction(S, cam.view === 'MAP' || S.phase === 'ENTRY'); }
    while (S.events.length) onEvent(S.events.shift());
    gameUpdate(dt, wdt);
    if (G.endT >= 0) { G.endT -= wdt; if (G.endT < 0) { if (G.endKind === 'win') finalCard(); else failCard(G.endKind); } }
    return dt;
  }
  let last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const wdt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now; dpr = Math.min(window.devicePixelRatio || 1, 2);
    let dt = 0;
    if (G.mode === 'menu') { cam.az += wdt * 0.035; emitFx(0, wdt); GFX.update(S, gx, wdt, wdt); GFX.render(S, gx, wdt); return; }
    if (G.mode === 'load') return;
    if (G.mode === 'play' && !G.paused) dt = advance(wdt);
    else AU.set(0, 200, 0);
    GFX.update(S, gx, dt, G.paused ? 0 : wdt); GFX.render(S, gx, wdt);
    drawDial(); drawScope(); drawProf(); drawEff(); drawOverlay();
    G.hudT -= wdt; if (G.hudT <= 0) { G.hudT = 0.1; hudSlow(); }
  }

  // ------------------------------- boot -------------------------------
  async function boot(data) {
    G.small = Math.min(innerWidth, innerHeight) < 520 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    try { G.best = +localStorage.getItem('mc.best') || 0; const c = localStorage.getItem('mc.cp2'); if (c) G.cp = JSON.parse(c); } catch (e) {}
    if (data && data.cp) G.cp = data.cp; if (data && data.diff !== undefined) G.diff = data.diff; if (data && data.level) G.level = data.level;
    try { await GFX.init($('#gl'), G.small, p => { $('#lbar').style.width = (p * 100) + '%'; }); }
    catch (e) { $('#ltxt').textContent = '无法启动 3D 渲染：这个浏览器不支持 WebGL。'; console.error(e); return; }
    bindInput(); drawLine(); toMenu(); requestAnimationFrame(frame);
    window.GAME = { G, gx, get S() { return S; }, set S(v) { S = v; }, startMission, action, setView, SIM, GFX, advance, satModel };
  }
  const hot = window.claude && window.claude.hot;
  if (hot && hot.snapshot) hot.snapshot(() => ({ cp: G.cp, diff: G.diff, level: G.level }));
  if (hot && hot.ready) hot.ready(boot); else boot((hot && hot.data) || {});
})();
