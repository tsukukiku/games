// ===================================================================
// SIM — flight physics, guidance and autopilot (no DOM / no rendering)
// Units: metres, seconds, kilograms, radians.
// The flight plane is 2-D (x, y) around Earth's centre with a small
// cross-range axis z. The pad sits at (0, RE).
// ===================================================================
const SIM = (function () {
  'use strict';
  const MU = 3.986004418e14, RE = 6371000, G0 = 9.80665, D2R = Math.PI / 180, TAU = Math.PI * 2;
  const CFG = {
    boosterDry: 200e3, boosterProp: 3400e3, boosterReserve: 0.06,
    boosterThrust: 75.9e6, boosterIspVac: 350, boosterIspSL: 327,
    shipDry: 120e3, shipProp: 1500e3, satMass: 12e3,
    shipThrust: 14.7e6, shipIspVac: 364, shipIspSL: 340,
    omsThrust: 0.6e6, omsIsp: 370,
    landThrust: 4.4e6, landIsp: 330,
    stackOffset: 72.8, padH: 18, catchH: 91,
    targetAlt: 200e3, orbitMinPe: 140e3,
    areaAxial: 63.6, areaBelly: 545, areaStackSide: 1100,
    cn: 1.15, ca: 0.45,
    tileLimit: 1700, steelLimit: 1100,
    catchTol: 8, catchVy: 6.5, catchVh: 3.2, catchTilt: 9 * D2R,
    // attitude effectors: cold-gas thrusters at nose and tail, four flaps, engine gimbal
    rcsForce: 55e3, rcsArm: 21, rcsAcc: 1.0, bodyLen: 50,
    flapK: 1140, cpSlope: 3.0, alpha0: 80 * D2R, aeroZeta: 0.3,
    gimbalMax: 15 * D2R, gimbalArm: 20, orbitTol: 8e3, flipKick: 105,
    alphaNom: 62 * D2R, deorbitDv: (typeof process !== 'undefined' && process.env.DV ? +process.env.DV : 75)
  };
  const R0 = RE + CFG.targetAlt, H0 = Math.sqrt(MU * R0);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const sstep = (a, b, x) => { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
  const wrapPi = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
  const wrap2 = a => { a %= TAU; return a < 0 ? a + TAU : a; };
  const heatT = (d, v) => Math.pow(1.7415e-4 * Math.sqrt(d / 4) * v * v * v / 4.82e-8, 0.25);
  const rho = h => h > 150e3 ? 0 : 1.225 * Math.exp(-Math.max(h, -500) / 7200);

  function newState(opt) {
    opt = opt || {};
    const nSat = opt.sats == null ? 3 : opt.sats;
    return {
      t: 0, phase: 'PRE', stage: 0,
      x: 0, y: RE + CFG.padH, z: 0, vx: 0, vy: 0, vz: 0, ang: 0,
      pit: 0, pitRate: 0, yawT: 0, bank: 0, bankVis: 0,
      thr: 0, mB: CFG.boosterProp, mS: CFG.shipProp, sats: nSat, satsDeployed: 0,
      hull: 100, tps: 100, temp: 290, q: 0, gload: 1, heat: 0, qMax: 0, maxQDone: false,
      att: 'MAN', pitCmd: 0, alphaSet: CFG.alphaNom, tiltX: 0, tiltZ: 0, flipT: -1,
      auto: false, assist: true, apDeorbit: false, apBurning: false, apAvoid: false,
      h: CFG.padH, vr: 0, vh: 0, spd: 0, aoa: 0, ap: 0, pe: -RE, twr: 0,
      pred: null, std: null, cue: { pit: 0, thr: 1, flipH: 0, vdes: 0, alpha: CFG.alphaNom, bank: 0, tiltX: 0, tiltZ: 0, err: 0, tgo: 200 },
      yawRate: 0, rcsX: 0, rcsY: 0, apReturn: false, dH: 0, dVt: 0, cnA: 0, flipDone: false,
      eff: { gim: 0, gimZ: 0, dF: 0.5, dA: 0.5, rcsU: 0, rcsZ: 0, tau: 0, tauG: 0, tauF: 0, tauR: 0, I: 1, Mp: 0, alpha: 0 },
      events: [], fail: null, catchRes: null, autoTime: 0, flightTime: 0,
      padX: 0, engines: 0
    };
  }
  function mass(S) {
    const pay = (S.sats - S.satsDeployed) * CFG.satMass;
    return S.stage === 0 ? CFG.boosterDry + S.mB + CFG.shipDry + S.mS + pay : CFG.shipDry + S.mS + pay;
  }
  // Engine set available right now → {T: max thrust (N), mdot: kg/s at full throttle}
  function engine(S, h) {
    const pr = Math.exp(-Math.max(h, 0) / 7200);
    if (S.stage === 0) {
      if (S.mB <= CFG.boosterProp * CFG.boosterReserve) return { T: 0, mdot: 0, n: 33 };
      const md = CFG.boosterThrust / (CFG.boosterIspVac * G0);
      return { T: md * (CFG.boosterIspVac - (CFG.boosterIspVac - CFG.boosterIspSL) * pr) * G0, mdot: md, n: 33 };
    }
    if (S.mS <= 0) return { T: 0, mdot: 0, n: 0 };
    if (S.phase === 'ASCENT') {
      const md = CFG.shipThrust / (CFG.shipIspVac * G0);
      return { T: md * (CFG.shipIspVac - (CFG.shipIspVac - CFG.shipIspSL) * pr) * G0, mdot: md, n: 6 };
    }
    if (S.phase === 'ORBIT') return { T: CFG.omsThrust, mdot: CFG.omsThrust / (CFG.omsIsp * G0), n: 1 };
    if (S.phase === 'LAND') return { T: CFG.landThrust * (1 - 0.07 * pr), mdot: CFG.landThrust / (350 * G0), n: 2 };
    return { T: 0, mdot: 0, n: 0 };
  }
  function derive(S) {
    const r = Math.hypot(S.x, S.y), ux = S.x / r, uy = S.y / r, dx = uy, dy = -ux;
    S.h = r - RE; S.vr = S.vx * ux + S.vy * uy; S.vh = S.vx * dx + S.vy * dy;
    S.spd = Math.hypot(S.vx, S.vy, S.vz);
    const v2 = S.vx * S.vx + S.vy * S.vy, eps = v2 / 2 - MU / r;
    const hm = S.x * S.vy - S.y * S.vx;
    S.dH = S.h - CFG.targetAlt; S.dVt = (-hm - H0) / R0;   // offsets from the 200 km circular reference orbit
    if (eps < 0) {
      const a = -MU / (2 * eps), e = Math.sqrt(Math.max(0, 1 + 2 * eps * hm * hm / (MU * MU)));
      S.sma = a; S.ecc = e; S.ap = a * (1 + e) - RE; S.pe = a * (1 - e) - RE;
      const rv = S.x * S.vx + S.y * S.vy;
      S.ex = ((v2 - MU / r) * S.x - rv * S.vx) / MU; S.ey = ((v2 - MU / r) * S.y - rv * S.vy) / MU;
    } else { S.sma = Infinity; S.ecc = 1; S.ap = Infinity; S.pe = S.h; S.ex = 0; S.ey = 1; }
    S.phi = wrap2(Math.atan2(S.x, S.y));
    S.pitPro = Math.atan2(S.vh, S.vr);
    return r;
  }
  // radius of current orbit at downrange angle phi (rad from pad)
  function orbitRadiusAt(S, phi) {
    if (!isFinite(S.sma)) return RE;
    const px = Math.sin(phi), py = Math.cos(phi);
    const en = Math.hypot(S.ex, S.ey);
    const cosNu = en > 1e-9 ? (px * S.ex + py * S.ey) / en : 1;
    return S.sma * (1 - S.ecc * S.ecc) / (1 + S.ecc * cosNu);
  }

  // ---------------- aerodynamic + thrust acceleration ----------------
  // returns non-gravitational acceleration and fills diagnostic fields in o
  function forces(S, st, pit, yawT, bank, thr, o) {
    const r = Math.hypot(st.x, st.y), ux = st.x / r, uy = st.y / r, dx = uy, dy = -ux, h = r - RE;
    const cp = Math.cos(pit), sp = Math.sin(pit);
    const ax = cp * ux + sp * dx, ay = cp * uy + sp * dy;
    const bx = cp * dx - sp * ux, by = cp * dy - sp * uy;
    const cy = Math.cos(yawT), sy = Math.sin(yawT);
    const nx = ax * cy, ny = ay * cy, nz = sy;
    const m = st.m, v = Math.hypot(st.vx, st.vy, st.vz), d = rho(h), q = 0.5 * d * v * v;
    let fx = 0, fy = 0, fz = 0, cn = 0, ca = 1, Fn = 0;
    if (q > 0.01 && v > 1) {
      const hx = st.vx / v, hy = st.vy / v, hz = st.vz / v;
      cn = hx * bx + hy * by; ca = hx * nx + hy * ny + hz * nz;
      const An = S.stage === 0 ? CFG.areaStackSide : CFG.areaBelly;
      Fn = q * An * CFG.cn * cn * Math.abs(cn);
      const Fa = q * CFG.areaAxial * CFG.ca * ca * Math.abs(ca);
      fx = -(Fn * bx + Fa * nx); fy = -(Fn * by + Fa * ny); fz = -(Fa * nz) + bank * 0.4 * Math.abs(Fn);
      fz -= q * CFG.areaBelly * 0.6 * hz * Math.abs(hz) + q * 120 * hz; // lateral drag keeps cross-range damped
    }
    let T = 0;
    if (thr > 0) { const e = engine(S, h); T = e.T * thr; o.mdot = e.mdot * thr; } else o.mdot = 0;
    // gimballed thrust: the nozzle swings by eff.gim, so a slice of thrust pushes the tail sideways
    const E = S.eff, sg = Math.sin(E.gim), sgz = Math.sin(E.gimZ);
    o.ax = (T * (nx - sg * bx) + fx) / m; o.ay = (T * (ny - sg * by) + fy) / m; o.az = (T * (nz - sgz) + fz) / m;
    // translation thrusters (orbit only): rcsX along the nose, rcsY toward the leeward side
    if (S.rcsX || S.rcsY) { o.ax += CFG.rcsAcc * (S.rcsX * ax - S.rcsY * bx); o.ay += CFG.rcsAcc * (S.rcsX * ay - S.rcsY * by); }
    o.q = q; o.cn = cn; o.ca = ca; o.rho = d; o.v = v; o.h = h; o.T = T;
    return o;
  }

  // ----------------------------- prediction ---------------------------
  // Fly the ship forward unpowered at angle of attack `alpha` (belly first)
  // and report where it comes down. dv>0 applies an instant retrograde burn first.
  function predict(S, alpha, dv, keepPts) {
    let x = S.x, y = S.y, vx = S.vx, vy = S.vy;
    if (dv) { const v = Math.hypot(vx, vy); vx -= vx / v * dv; vy -= vy / v * dv; }
    const m = CFG.shipDry + S.mS + (S.sats - S.satsDeployed) * CFG.satMass;
    let ang = 0, t = 0, peakT = 0, peakG = 0;
    const pts = keepPts ? [] : null;
    const acc = (x, y, vx, vy, o) => {
      const r = Math.hypot(x, y), h = r - RE, k = -MU / (r * r * r);
      o.gx = k * x; o.gy = k * y; o.fx = 0; o.fy = 0; o.r = r; o.h = h;
      const d = rho(h);
      if (d > 0) {
        const ux = x / r, uy = y / r, dx = uy, dy = -ux, v = Math.hypot(vx, vy);
        const vr = vx * ux + vy * uy, vh = vx * dx + vy * dy;
        const a = v > 700 ? alpha : 90 * D2R;
        const pit = Math.atan2(vh, vr) - a, cp = Math.cos(pit), sp = Math.sin(pit);
        const nx = cp * ux + sp * dx, ny = cp * uy + sp * dy, bx = cp * dx - sp * ux, by = cp * dy - sp * uy;
        const q = 0.5 * d * v * v, cn = (vx * bx + vy * by) / v, ca = (vx * nx + vy * ny) / v;
        const Fn = q * CFG.areaBelly * CFG.cn * cn * Math.abs(cn), Fa = q * CFG.areaAxial * CFG.ca * ca * Math.abs(ca);
        o.fx = -(Fn * bx + Fa * nx) / m; o.fy = -(Fn * by + Fa * ny) / m;
        const g = Math.hypot(o.fx, o.fy) / G0; if (g > peakG) peakG = g;
        if (v > 1500) { const Te = heatT(d, v); if (Te > peakT) peakT = Te; }
      }
    };
    const o = {};
    for (let i = 0; i < 20000; i++) {
      acc(x, y, vx, vy, o);
      const h = o.h, r = o.r;
      if (h < 1500) return { ang, t, pts, peakT, peakG, hit: true };
      const dt = h > 150e3 ? 4 : h > 100e3 ? 1 : 0.25;
      const fx = o.fx, fy = o.fy;
      vx += (o.gx + fx) * dt * 0.5; vy += (o.gy + fy) * dt * 0.5;
      const xo = x, yo = y;
      x += vx * dt; y += vy * dt;
      const r1 = Math.hypot(x, y), k1 = -MU / (r1 * r1 * r1);
      vx += (k1 * x + fx) * dt * 0.5; vy += (k1 * y + fy) * dt * 0.5;
      ang += Math.atan2(x * yo - y * xo, xo * x + yo * y);
      t += dt;
      if (pts && (i & 15) === 0) pts.push(x, y);
      if (ang > TAU * 1.2) break;
    }
    return { ang, t, pts, hit: false, peakT, peakG };
  }
  // refresh S.pred (current trajectory) and S.std (if a standard deorbit burn were made now)
  function updatePrediction(S, withPts) {
    if (S.stage !== 1) { S.pred = null; S.std = null; return; }
    const rem = wrap2(-S.phi);
    if (S.pe < 95e3 && S.phase !== 'LAND' && S.phase !== 'ASCENT') {
      const p = predict(S, S.alphaSet, 0, withPts);
      if (p.hit) {
        let e = p.ang - rem; e = wrapPi(e);
        S.pred = { err: e * RE + (S.phase === 'ENTRY' && S.spd <= 700 ? CFG.flipKick : 0), tgo: p.t, ang: p.ang, pts: p.pts, peakT: p.peakT, peakG: p.peakG };
      } else S.pred = null;
    } else S.pred = null;
    // the guidance cue flies its own angle of attack; give it its own landing prediction
    if (S.phase === 'ENTRY') {
      if (S.pred && (S.auto || S.spd <= 700 || Math.abs(S.alphaSet - S.cue.alpha) < 1e-4)) { S.cue.err = S.pred.err; S.cue.tgo = S.pred.tgo; }
      else { const p = predict(S, S.cue.alpha, 0, false); if (p.hit) { S.cue.err = wrapPi(p.ang - rem) * RE; S.cue.tgo = p.t; } }
    }
    if (S.phase === 'ORBIT' && S.pe > 95e3) {
      const p = predict(S, CFG.alphaNom, CFG.deorbitDv, false);
      S.std = p.hit ? { ang: p.ang, lead: wrap2(rem - p.ang) } : null; // lead = angle until ideal burn point
    } else S.std = null;
  }

  // ------------------------------ guidance ----------------------------
  // Ascent pitch program for the full stack (angle from vertical, downrange positive)
  function boosterPitch(S) {
    const hh = S.h - CFG.padH;
    if (hh < 250) return 0;
    const prog = 71 * D2R * Math.pow(clamp((hh - 250) / 70e3, 0, 1), 0.62);
    // through dense air stay within a few degrees of the airflow
    if (S.q > 6000 && S.spd > 120) { const lim = 3 * D2R; return clamp(prog, S.pitPro - lim, S.pitPro + lim); }
    return prog;
  }
  // Upper-stage closed loop steering to a circular orbit at targetAlt
  function shipPitch(S) {
    const r = RE + S.h, e = engine(S, S.h), aT = Math.max(e.T / mass(S), 0.1);
    const vorb = Math.sqrt(MU / (RE + CFG.targetAlt));
    const tgo = Math.max((vorb - S.vh) / aT, 1);
    const gEff = MU / (r * r) - S.vh * S.vh / r;
    const tau = Math.max(12, tgo * 0.45);
    const vrDes = clamp((CFG.targetAlt - S.h) / tau, -200, 900);
    const arDes = (vrDes - S.vr) / Math.max(6, tgo * 0.22);
    const s = clamp((gEff + arDes) / aT, -0.25, 0.75);
    return Math.PI / 2 - Math.asin(s);
  }
  function landProfile(S) {
    const m = mass(S), e = engine({ stage: 1, mS: S.mS, phase: 'LAND' }, S.h);
    const aNet = e.T / m - G0, ad = 0.55 * aNet, dh = S.h - CFG.catchH;
    S.cue.vdes = -Math.min(120, Math.sqrt(2 * ad * Math.max(dh - 1.5, 0)) + 1.2);
    S.cue.flipH = CFG.catchH + S.vr * S.vr / (2 * ad) + Math.abs(S.vr) * 3.4 + 45;
    S.cue.aT = e.T / m; S.cue.ad = ad;
  }

  // Landing-burn throttle that tracks the descent profile; holds ~14 m above the arms until lined up.
  // Sets S.thr and returns the full-throttle acceleration.
  function landThrottle(S) {
    const c = S.cue, m = mass(S), e = engine(S, S.h), aT = Math.max(e.T / m, 1);
    const tilt = Math.cos(S.pit) * Math.cos(S.yawT);
    const herr = Math.hypot(S.x, S.z), hv = Math.hypot(S.vx, S.vz);
    let vdes = c.vdes;
    if (herr > 3.5 || hv > 1.1) vdes = Math.max(vdes, -(S.h - CFG.catchH - 14) * 0.45);
    const law = clamp((G0 + (vdes === c.vdes && S.h - CFG.catchH > 3 ? c.ad : 0) + 1.6 * (vdes - S.vr)) / (aT * Math.max(tilt, 0.5)), 0.12, 1);
    S.thr = S.flipDone ? law : Math.max(0.6, law);      // keep the engines up through the flip: gimbal torque needs thrust
    return aT;
  }

  // Entry guidance: the angle of attack and bank that would bring the ship down on the tower.
  function entryGuide(S, dt) {
    const c = S.cue;
    if (S.spd > 700) {
      c.alpha = clamp(c.alpha + clamp(c.err / 1000 * 0.06, -2.5, 2.5) * D2R * dt, 44 * D2R, 87 * D2R);
      const tgo = Math.max(c.tgo || 200, 20);
      c.bank = clamp((-S.z / (tgo * 0.45) - S.vz) * 0.03, -1, 1);
    } else {
      const tf = Math.max((S.h - c.flipH) / Math.max(-S.vr, 20), 1), e = S.pred ? S.pred.err : S.x + CFG.flipKick;
      c.alpha = 90 * D2R + clamp(e / 30, -24, 24) * D2R;
      c.bank = clamp((clamp(-S.z / Math.max(tf * 0.5, 3), -45, 45) - S.vz) * 0.12, -1, 1);
    }
  }
  // Landing guidance: the tilt that walks the ship onto the catch point.
  // Tilt that gives the wanted ground velocity. It steers the centre of percussion (the point a gimbal
  // kick does not shove sideways) rather than the centre of mass, which keeps the loop from fighting itself.
  const LP = CFG.bodyLen * CFG.bodyLen / 12 / CFG.gimbalArm;
  function landTilt(S, vdx, vdz, o) {
    const aNow = Math.max(Math.max(engine(S, S.h).T / mass(S), 1) * S.thr, 4), kv = 0.8;
    o.x = clamp(kv * (vdx - S.vx - S.pitRate * LP) / aNow, -0.3, 0.3); o.z = clamp(kv * (vdz - S.vz - S.yawRate * LP) / aNow, -0.3, 0.3);
    return o;
  }
  const TL = { x: 0, z: 0 };
  function landGuide(S) {
    const c = S.cue, kp = 0.25, px = S.x + Math.sin(S.pit) * LP, pz = S.z + Math.sin(S.yawT) * LP;
    landTilt(S, clamp(-px * kp, -20, 20), clamp(-pz * kp, -20, 20), TL); c.tiltX = TL.x; c.tiltZ = TL.z;
  }
  // Back to the reference orbit with the translation thrusters: null height error, climb rate and speed error together.
  function returnGuide(S) {
    const x = S.dH, xd = S.vr, w = S.dVt, n = Math.sqrt(MU / (R0 * R0 * R0));
    if (Math.abs(wrapPi(S.pit - S.pitPro)) > 5 * D2R) return;
    if (Math.abs(x) < 200 && Math.abs(xd) < 0.3 && Math.abs(w) < 0.12) { S.apReturn = false; return; }
    S.rcsX = clamp(-w * 0.8, -1, 1); if (Math.abs(S.rcsX) < 0.05) S.rcsX = 0;
    const vd = -Math.sign(x) * Math.min(Math.sqrt(0.9 * CFG.rcsAcc * Math.abs(x)), Math.abs(x) * 0.06, 90);
    S.rcsY = clamp(((vd - xd) * 0.5 - (-n * n * x + 2 * n * w)) / CFG.rcsAcc, -1, 1); if (Math.abs(S.rcsY) < 0.04) S.rcsY = 0;
  }
  // One rotation axis of the flight computer: wanted angular acceleration for an angle error,
  // with a rate ceiling low enough that the available torque can still stop the turn.
  function axisCtl(err, rate, rateCmd, wMax, aMax, kW, kLin) {
    let wDes = rateCmd;
    if (wDes === null) { const a = Math.abs(err); wDes = Math.sign(err) * Math.min(a * kLin, Math.sqrt(1.3 * aMax * a), wMax); }
    return clamp((wDes - rate) * kW, -aMax, aMax);
  }
  // Rotational dynamics of the ship alone. Torque comes from three effectors:
  //   thrusters  tau = 2 F L            (vacuum and thin air)
  //   flaps      tau = q Cn K (dAft-dFwd)  (needs dynamic pressure)
  //   gimbal     tau = F L sin(theta)   (needs an engine burning)
  // and angular acceleration is tau / I with I = m L^2 / 12.
  function attitudeDyn(S, ctl, dt) {
    const E = S.eff, m = mass(S), I = m * CFG.bodyLen * CFG.bodyLen / 12;
    const land = S.phase === 'LAND', entry = S.phase === 'ENTRY', q = S.q || 0, cnA = S.cnA || 0, T = S.thrust || 0;
    const hand = !S.auto && !S.assist;
    const tR = 2 * CFG.rcsForce * CFG.rcsArm * (1 - sstep(600, 3000, q));
    const tF = land ? 0 : q * CFG.cn * cnA * CFG.flapK;
    const tG = T * CFG.gimbalArm * Math.sin(CFG.gimbalMax);
    // passive aerodynamics: the centre of pressure moves aft as angle of attack grows, so the hull trims near alpha0
    let Mp = 0; E.alpha = S.spd > 30 ? wrapPi(S.pitPro - S.pit) : 0;
    if (S.spd > 30 && q > 1) {
      const kS = q * CFG.cn * cnA * CFG.areaBelly * CFG.cpSlope;
      Mp = kS * (E.alpha - CFG.alpha0) - 2 * CFG.aeroZeta * Math.sqrt(Math.abs(kS) * I) * S.pitRate;
      if (land) Mp += -0.9 * q * CFG.cn * cnA * CFG.flapK;      // aft flaps folded, forward flaps out for the flip
    }
    const wMax = (land ? 42 : entry ? 12 : 7) * D2R, kW = land ? (S.flipDone ? 4 : 7) : entry ? 3 : 2, kL = 2, k = ctl.precision ? 0.3 : 1;
    if (land && !S.flipDone && (S.flipT > 7 || Math.abs(S.pit) < 8 * D2R && Math.abs(S.pitRate) < 5 * D2R)) S.flipDone = true;
    const flipping = land && !S.flipDone;
    let uG = 0, uF = 0, uR = 0, uGz = 0, uRz = 0, tgt = null, rateCmd = null;
    if (hand && !flipping && (land || S.att === 'MAN')) { uG = uR = clamp(land ? ctl.sy * k * 0.5 : ctl.sx * k, -1, 1); }
    else if (hand && entry) {
      uF = clamp(-CFG.areaBelly * CFG.cpSlope * (S.alphaSet - CFG.alpha0) / CFG.flapK, -1, 1); uR = q < 600 ? clamp(ctl.sy * k, -1, 1) : 0;
    } else {
      if (S.att === 'MAN') rateCmd = ctl.sx * wMax * k;
      else if (S.att === 'PRO') tgt = S.pitPro;
      else if (S.att === 'RETRO') tgt = S.pitPro + Math.PI;
      else if (S.att === 'AOA') tgt = S.spd > 30 ? S.pitPro - S.alphaSet : S.pit;
      else if (S.att === 'TILT') tgt = S.tiltX;
      else tgt = S.pit;
      const aMax = Math.max((tG + Math.abs(tF) * 0.6 + tR) / I, 2e-4);
      const aDes = axisCtl(tgt === null ? 0 : wrapPi(tgt - S.pit), S.pitRate, rateCmd, wMax, aMax, kW, land ? (S.flipDone ? kL : 3.2) : 1.6);
      let need = I * aDes - Mp;
      if (tG > 1) { uG = clamp(need / tG, -1, 1); need -= uG * tG; }
      if (Math.abs(tF) > 1) { uF = clamp(need / tF, -1, 1); need -= uF * tF; }
      if (tR > 1) { uR = clamp(need / tR, -1, 1); if (Math.abs(uR) < 0.03) uR = 0; }
    }
    const tau = uG * tG + uF * tF + uR * tR;
    S.pitRate += (tau + Mp) / I * dt; S.pit = wrapPi(S.pit + S.pitRate * dt);
    if (land) {
      if (hand && !flipping) uGz = uRz = clamp(ctl.sx * k * 0.5, -1, 1);
      else {
        const aMax = Math.max((tG + tR) / I, 2e-4); let need = I * axisCtl(S.tiltZ - S.yawT, S.yawRate, null, wMax, aMax, kW, S.flipDone ? kL : 3.2);
        if (tG > 1) { uGz = clamp(need / tG, -1, 1); need -= uGz * tG; }
        if (tR > 1) { uRz = clamp(need / tR, -1, 1); if (Math.abs(uRz) < 0.03) uRz = 0; }
      }
      S.yawRate += (uGz * tG + uRz * tR) / I * dt; S.yawT += S.yawRate * dt;
    } else { S.yawT += -S.yawT * Math.min(1, dt * 2); S.yawRate = 0; }
    const d = land ? -0.9 : uF;
    E.gim = uG * CFG.gimbalMax; E.gimZ = uGz * CFG.gimbalMax; E.dF = clamp(0.5 - d / 2, 0, 1); E.dA = clamp(0.5 + d / 2, 0, 1);
    E.rcsU = uR; E.rcsZ = uRz; E.tauG = uG * tG; E.tauF = uF * tF; E.tauR = uR * tR; E.tau = tau; E.I = I; E.Mp = Mp; E.tgt = tgt;
  }

  function autopilot(S, dt) {
    const c = S.cue;
    if (S.phase === 'ASCENT') {
      if (S.stage === 0) {
        S.att = 'CMD'; S.pitCmd = c.pit;
        S.thr = clamp(1 - (S.q - 31000) / 9000, 0.55, 1);
        if (engine(S, S.h).T === 0) stageSep(S);
      } else {
        S.att = 'CMD'; S.pitCmd = c.pit;
        const gl = clamp(3.5 * G0 * mass(S) / engine(S, S.h).T, 0.3, 1);
        if (S.sma >= RE + CFG.targetAlt - 300 && S.pe > CFG.orbitMinPe || S.ap > CFG.targetAlt + 60e3 && S.pe > CFG.orbitMinPe) S.thr = 0;
        else if (S.pe < CFG.orbitMinPe + 5e3 || S.sma < RE + CFG.targetAlt - 300) S.thr = S.thr > 0 || S.pe < CFG.orbitMinPe ? gl : 0;
      }
    } else if (S.phase === 'ORBIT') {
      if (S.apAvoid) {
        S.att = 'PRO'; S.thr = 0;                      // dodge with the side thrusters: +1 climbs over, -1 ducks under
        if (Math.abs(wrapPi(S.pit - S.pitPro)) < 5 * D2R) S.rcsY = S.apAvoid;
      } else if (S.apReturn) { S.att = 'PRO'; S.thr = 0; returnGuide(S); }
      else if (S.apDeorbit) {
        if (!S.apBurning) {
          S.att = 'RETRO'; S.thr = 0;
          if (S.std && (S.std.lead < 1.2 * D2R || S.std.lead > TAU - 6 * D2R) && Math.abs(wrapPi(S.pit - S.pitPro - Math.PI)) < 3 * D2R) S.apBurning = true;
        } else {
          S.att = 'RETRO'; S.thr = 1;
          if (S.pred && S.pred.err < 25e3 && S.pred.err > -2000e3) { S.thr = 0; S.apBurning = false; S.apDeorbit = false; S.att = 'AOA'; }
        }
      } else { S.thr = 0; if (S.att === 'MAN') S.att = 'PRO'; }
    } else if (S.phase === 'ENTRY') {
      S.att = 'AOA'; S.thr = 0; S.alphaSet = c.alpha; S.bank = c.bank;
      if (S.spd <= 700 && S.h < c.flipH) flip(S);
    } else if (S.phase === 'LAND') {
      landThrottle(S); landGuide(S); S.tiltX = c.tiltX; S.tiltZ = c.tiltZ;
    }
  }

  // --------------------------- player actions -------------------------
  function ev(S, name, data) { S.events.push({ name, t: S.t, data }); }
  function liftoff(S) { if (S.phase !== 'PRE') return; S.phase = 'ASCENT'; S.thr = 1; S.t = 0; ev(S, 'LIFTOFF'); }
  function stageSep(S) {
    if (S.stage !== 0 || S.phase !== 'ASCENT') return false;
    const r = Math.hypot(S.x, S.y), ux = S.x / r, uy = S.y / r, dx = uy, dy = -ux;
    const ax = Math.cos(S.pit) * ux + Math.sin(S.pit) * dx, ay = Math.cos(S.pit) * uy + Math.sin(S.pit) * dy;
    S.sep = { x: S.x, y: S.y, vx: S.vx, vy: S.vy, pit: S.pit, t: S.t };
    S.x += ax * CFG.stackOffset; S.y += ay * CFG.stackOffset; S.vx += ax * 3; S.vy += ay * 3;
    S.stage = 1; S.thr = 1; ev(S, 'SEP'); return true;
  }
  function flip(S) {
    if (S.phase !== 'ENTRY' || S.h > 6000) return false;
    S.phase = 'LAND'; S.flipT = 0; S.flipDone = false; S.yawRate = 0; S.att = 'TILT'; S.tiltX = 0; S.tiltZ = 0; S.bank = 0; S.thr = Math.max(S.thr, 0.55);
    ev(S, 'FLIP'); return true;
  }
  function deployCheck(S, win, tol) {
    // win: {phi, half} — returns null when OK or a reason string
    if (S.phase !== 'ORBIT') return 'phase';
    if (S.sats - S.satsDeployed <= 0) return 'empty';
    if (win && Math.abs(wrapPi(S.phi - win.phi)) > win.half) return 'window';
    if (Math.abs(wrapPi(S.pit - S.pitPro)) > 12 * D2R) return 'attitude';
    if (Math.abs(S.pitRate) > 1.2 * D2R) return 'rate';
    if (tol) { if (Math.abs(S.ap - CFG.targetAlt) > tol || Math.abs(S.pe - CFG.targetAlt) > tol) return 'orbit'; }
    else if (S.h < 160e3 || S.h > 320e3) return 'altitude';
    if (S.thr > 0 || S.rcsX || S.rcsY) return 'thrust';
    return null;
  }
  function deploy(S) { S.satsDeployed++; ev(S, 'DEPLOY', S.satsDeployed); }

  // ------------------------------- step -------------------------------
  const F = {};
  function sub(S, ctl, dt) {
    const r0 = derive(S);
    S.cue.pit = S.phase === 'ASCENT' ? (S.stage === 0 ? boosterPitch(S) : shipPitch(S)) : S.pitPro;
    if (S.stage === 1 && (S.phase === 'ENTRY' || S.phase === 'LAND')) landProfile(S);
    if (S.stage === 1 && S.phase === 'ENTRY') entryGuide(S, dt);
    if (S.stage === 1 && S.phase === 'LAND') landGuide(S);
    // ---- commands
    S.rcsX = 0; S.rcsY = 0;
    if (S.auto) { autopilot(S, dt); S.autoTime += dt; }
    else {
      S.thr = ctl.thr;
      if (S.phase === 'ORBIT') { const k = ctl.precision ? 0.25 : 1; S.rcsX = clamp(ctl.tx || 0, -1, 1) * k; S.rcsY = clamp(ctl.ty || 0, -1, 1) * k; }
      if (S.phase === 'ENTRY') {
        S.att = 'AOA'; S.thr = 0;
        const hyper = S.spd > 700, lo = hyper ? 42 : 62, hi = hyper ? 88 : 118;
        // manual level in near-vacuum: the stick fires the thrusters instead, and the flap trim waits for air
        if (S.assist || S.q >= 600) S.alphaSet = clamp(S.alphaSet - ctl.sy * (ctl.precision ? 5 : 14) * D2R * dt, lo * D2R, hi * D2R);
        S.bank = ctl.sx;
      } else if (S.phase === 'LAND') {
        // assist: the stick asks for a ground speed and the flight computer tilts the ship to get it;
        // let go and it brakes to a hover. Manual level bypasses this and drives the gimbal directly.
        const vm = ctl.precision ? 4 : 14;
        landTilt(S, ctl.sy * vm, ctl.sx * vm, TL); S.tiltX = TL.x; S.tiltZ = TL.z; S.att = 'TILT';
        if (S.assist && S.athr) landThrottle(S);
      } else if (Math.abs(ctl.sx) > 0.06 && S.att !== 'MAN') S.att = 'MAN';
      if (S.stage === 0 && S.phase === 'ASCENT' && engine(S, S.h).T === 0 && S.assist) { S.sepWait = (S.sepWait || 0) + dt; if (S.sepWait > 5) stageSep(S); }
    }
    if (S.phase === 'ENTRY') S.thr = 0;
    S.flightTime += dt;
    // ---- attitude: the climb keeps a simple rate-command model; the ship alone has real torque dynamics
    if (S.stage === 1 && S.phase !== 'ASCENT') attitudeDyn(S, ctl, dt);
    else {
      const maxRate = (S.stage === 0 ? 6 : 10) * D2R;
      let rateCmd = 0, tgt = null;
      if (S.att === 'MAN') rateCmd = ctl.sx * maxRate * (ctl.precision ? 0.3 : 1);
      else if (S.att === 'PRO') tgt = S.pitPro;
      else if (S.att === 'RETRO') tgt = S.pitPro + Math.PI;
      else if (S.att === 'CMD') tgt = S.pitCmd;
      else if (S.att === 'FD') tgt = S.cue.pit;
      if (tgt !== null) rateCmd = clamp(wrapPi(tgt - S.pit) * 2.2, -maxRate, maxRate);
      S.pitRate += (rateCmd - S.pitRate) * Math.min(1, dt / (S.stage === 0 ? 0.9 : 0.45));
      S.pit = wrapPi(S.pit + S.pitRate * dt);
      S.yawT += -S.yawT * Math.min(1, dt * 2);
    }
    if (S.flipT >= 0) S.flipT += dt;
    if (S.phase !== 'ENTRY') S.bank = 0;
    S.bankVis += (S.bank - S.bankVis) * Math.min(1, dt * 2.5);
    // ---- dynamics (kick-drift-kick on gravity)
    const m = mass(S);
    const st = { x: S.x, y: S.y, vx: S.vx, vy: S.vy, vz: S.vz, m };
    forces(S, st, S.pit, S.yawT, S.bank, S.thr, F);
    const r3 = r0 * r0 * r0, gx = -MU / r3 * S.x, gy = -MU / r3 * S.y;
    S.vx += (gx + F.ax) * dt * 0.5; S.vy += (gy + F.ay) * dt * 0.5;
    S.x += S.vx * dt; S.y += S.vy * dt;
    const r1 = Math.hypot(S.x, S.y), r13 = r1 * r1 * r1;
    S.vx += (-MU / r13 * S.x + F.ax) * dt * 0.5; S.vy += (-MU / r13 * S.y + F.ay) * dt * 0.5;
    S.vz += F.az * dt; S.z += S.vz * dt;
    S.ang += S.vh / r0 * dt;
    if (F.mdot > 0) { if (S.stage === 0) S.mB = Math.max(0, S.mB - F.mdot * dt); else S.mS = Math.max(0, S.mS - F.mdot * dt); }
    S.t += dt;
    // ---- diagnostics / damage
    S.q = F.q; S.cnA = F.cn * Math.abs(F.cn); S.engines = F.T > 0 ? engine(S, S.h).n : 0; S.thrust = F.T;
    S.gload = Math.hypot(F.ax, F.ay, F.az) / G0;
    S.twr = F.T / (m * G0);
    S.aoa = F.v > 20 ? Math.acos(clamp(F.ca, -1, 1)) : 0;
    S.bellyOK = F.cn > 0.5;
    if (S.q > S.qMax) S.qMax = S.q;
    if (!S.maxQDone && S.phase === 'ASCENT' && S.q < S.qMax * 0.93 && S.qMax > 8000) { S.maxQDone = true; ev(S, 'MAXQ', S.qMax); }
    if (S.phase === 'ASCENT') {
      const qa = S.q * Math.abs(Math.sin(S.aoa));
      if (qa > 5500) S.hull -= (qa / 5500 - 1) * 16 * dt + 2 * dt;
      if (S.q > 40000) S.hull -= ((S.q / 40000 - 1) * 60 + 3) * dt;
      S.loadQA = qa;
    }
    if (F.rho > 0 && F.v > 1200) {
      const Te = heatT(F.rho, F.v);
      S.temp += (Te - S.temp) * Math.min(1, dt / 5); S.heat = Te;
      if (S.phase !== 'ASCENT') {
        if (S.bellyOK && S.tps > 0) { if (S.temp > CFG.tileLimit) S.tps -= (S.temp - CFG.tileLimit) / 100 * 3.2 * dt; }
        else if (S.temp > CFG.steelLimit) S.hull -= (S.temp - CFG.steelLimit) / 100 * 5 * dt;
        if (S.tps < 0) S.tps = 0;
      }
    } else { S.temp += (290 - S.temp) * Math.min(1, dt / 25); S.heat = 0; }
    if (S.phase === 'ENTRY' && S.gload > 6) S.hull -= (S.gload - 6) * 10 * dt;
    // ---- phase transitions
    derive(S);
    if (S.phase === 'ASCENT' && S.stage === 1) {
      if (S.thr === 0 && S.pe > CFG.orbitMinPe && S.h > CFG.orbitMinPe) { S.phase = 'ORBIT'; S.att = S.assist || S.auto ? 'PRO' : 'MAN'; ev(S, 'ORBIT'); }
      else if (S.vr < 0 && S.h < 85e3 && S.t > 200) fail(S, 'suborbital');
      else if (S.mS <= 0 && S.pe < CFG.orbitMinPe && !S.dryWarned) { S.dryWarned = true; ev(S, 'DRY'); }
    } else if (S.phase === 'ORBIT') {
      if (S.h < 120e3 && S.vr < 0 && S.pe < 85e3) { S.phase = 'ENTRY'; S.att = 'AOA'; S.alphaSet = clamp(S.alphaSet, 42 * D2R, 88 * D2R); S.cue.alpha = S.alphaSet; S.thr = 0; S.apReturn = false; S.apAvoid = 0; ev(S, 'ENTRY'); }
    } else if (S.phase === 'ENTRY') {
      if (S.spd < 700 && !S.subsonicEv) { S.subsonicEv = true; ev(S, 'TERMINAL'); }
    }
    if (S.hull <= 0 && S.phase !== 'FAIL') { S.hull = 0; fail(S, S.phase === 'ASCENT' ? 'structure' : S.phase === 'ENTRY' ? 'burnup' : 'hull'); }
    // ---- ground / tower
    if (S.phase !== 'FAIL' && S.phase !== 'CAUGHT' && S.phase !== 'PRE') {
      const lowerH = S.h;
      if (S.phase === 'LAND') {
        const err = Math.hypot(S.x, S.z), vh = Math.hypot(S.vx, S.vz), tilt = Math.acos(clamp(Math.cos(S.pit) * Math.cos(S.yawT), -1, 1));
        if (S.z < -5.6 && Math.abs(S.x) < 11 && lowerH < 150 && lowerH > 0) fail(S, 'tower');
        else if (S.prevH > CFG.catchH && lowerH <= CFG.catchH && err < 15) {
          const res = { err, vy: S.vr, vh, tilt, rate: Math.abs(S.pitRate), fuel: S.mS, ok: false };
          res.ok = err <= CFG.catchTol && Math.abs(S.vr) <= CFG.catchVy && vh <= CFG.catchVh && tilt <= CFG.catchTilt;
          S.catchRes = res;
          if (res.ok) { S.phase = 'CAUGHT'; S.thr = 0; ev(S, 'CATCH', res); }
          else fail(S, 'catch');
        }
      }
      if (S.phase !== 'FAIL' && S.phase !== 'CAUGHT' && lowerH <= 0 && S.t > 3) {
        if (S.phase === 'LAND' && S.spd < 4 && Math.abs(S.pit) < 0.2) { S.softDown = true; fail(S, 'nocatch'); }
        else fail(S, 'crash');
      }
      S.prevH = lowerH;
    }
  }
  function fail(S, why) { if (S.phase === 'FAIL') return; S.failPhase = S.phase; S.phase = 'FAIL'; S.fail = why; S.thr = 0; ev(S, 'FAIL', why); }

  // advance by dt of simulated time, choosing a sub-step that suits the flight regime
  function step(S, ctl, dt) {
    if (S.phase === 'PRE' || S.phase === 'FAIL' || S.phase === 'CAUGHT') return;
    let left = dt, guard = 0;
    while (left > 1e-9 && guard++ < 4000) {
      let hmax = 0.5;
      if (S.phase === 'LAND' || S.h < 3000) hmax = 1 / 60;
      else if (S.thr > 0 || S.h < 125e3 || S.rcsX || S.rcsY) hmax = 0.05;
      else if (S.stage === 1 && (Math.abs(S.pitRate) > 1.5e-3 || S.eff.rcsU)) hmax = 0.1;
      const d = Math.min(left, hmax);
      sub(S, ctl, d); left -= d;
      if (S.phase === 'FAIL' || S.phase === 'CAUGHT') break;
    }
  }
  return { MU, RE, G0, CFG, R0, H0, sstep, newState, step, derive, mass, engine, predict, updatePrediction, orbitRadiusAt,
    liftoff, stageSep, flip, deploy, deployCheck, fail, clamp, wrapPi, wrap2, rho, D2R };
})();
if (typeof module !== 'undefined') module.exports = SIM;
