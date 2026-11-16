// Headless "human" flying in ASSIST mode: exercises the non-autopilot control paths.
const SIM = require('../src/sim.js');
const { RE, D2R, CFG, clamp, wrapPi } = SIM;
const S = SIM.newState({ sats: 3 });
const LEVEL = process.env.LEVEL || 'assist';
S.auto = false; S.assist = LEVEL !== 'manual';
const ctl = { sx: 0, sy: 0, thr: 1, precision: false };
SIM.liftoff(S); S.att = 'FD';
let lastPred = -100, deployed = 0, burn = 0, log = [];
const say = m => console.log(`T+${S.t.toFixed(0).padStart(6)} ${m}  h=${(S.h / 1000).toFixed(1)} v=${S.spd.toFixed(0)} pe=${(S.pe / 1000).toFixed(0)} mS=${(S.mS / 1000).toFixed(0)} hull=${S.hull.toFixed(0)} tps=${S.tps.toFixed(0)}`);
for (let i = 0; i < 6e6; i++) {
  const coast = S.phase === 'ORBIT' && S.thr === 0 && burn !== 1 && !(S.std && (S.std.lead < 0.06 || S.std.lead > 6.2));
  SIM.step(S, ctl, coast ? 0.5 : 1 / 30);
  if (S.t - lastPred > (S.phase === 'ENTRY' || burn === 1 ? 0.25 : 1)) { SIM.updatePrediction(S); lastPred = S.t; }
  while (S.events.length) { const e = S.events.shift(); say('EV ' + e.name + ' ' + (typeof e.data === 'object' ? JSON.stringify(e.data) : e.data || '')); if (e.name === 'ENTRY') S.z = +(process.env.ZOFF || 2500); }
  ctl.sx = 0; ctl.sy = 0;
  if (S.phase === 'ASCENT' && S.stage === 0) {
    ctl.thr = S.q > 33e3 ? 0.7 : 1;
    if (SIM.engine(S, S.h).T === 0) SIM.stageSep(S);
  } else if (S.phase === 'ASCENT') {
    S.att = 'FD';
    if (S.pe > CFG.orbitMinPe && S.sma >= RE + CFG.targetAlt - 500) ctl.thr = 0; else ctl.thr = 1;
  } else if (S.phase === 'ORBIT') {
    if (deployed < 3) { if (S.assist) S.att = 'PRO'; else { S.att = 'MAN'; ctl.sx = clamp(wrapPi(S.pitPro - S.pit) * 4 - S.pitRate * 9, -1, 1); } ctl.thr = 0; if (S.ang > 1.6 + deployed * 1.2 && !SIM.deployCheck(S, null)) { SIM.deploy(S); deployed++; } }
    else if (burn === 0) { if (S.assist) S.att = 'RETRO'; else { S.att = 'MAN'; ctl.sx = clamp(wrapPi(S.pitPro + Math.PI - S.pit) * 4 - S.pitRate * 9, -1, 1); } ctl.thr = 0; if (S.ang > 6.4 && S.std && (S.std.lead < 1.2 * D2R || S.std.lead > 6.2)) { burn = 1; say('BURN START lead=' + (S.std.lead / D2R).toFixed(2)); } }
    else if (burn === 1) { if (!S.assist) ctl.sx = clamp(wrapPi(S.pitPro + Math.PI - S.pit) * 4 - S.pitRate * 9, -1, 1); ctl.thr = 1; if (S.pred && S.pred.err < 30e3 && S.pred.err > -2000e3) { ctl.thr = 0; burn = 2; say('BURN END err=' + (S.pred.err / 1000).toFixed(0) + 'km'); } }
    else { ctl.thr = 0; if (!S.assist) ctl.sx = clamp(wrapPi(S.pitPro - S.alphaSet - S.pit) * 4 - S.pitRate * 9, -1, 1); }
  } else if (S.phase === 'ENTRY') {
    const e = S.pred ? S.pred.err : 0;
    if (!S.assist && S.q < 600) { ctl.sy = clamp(wrapPi(S.pitPro - S.alphaSet - S.pit) * 4 - S.pitRate * 9, -1, 1); }
    else if (S.spd > 700) { ctl.sy = clamp(-e / 40e3, -1, 1); const tgo = S.pred ? Math.max(S.pred.tgo, 20) : 200; ctl.sx = clamp((-S.z / (tgo * 0.45) - S.vz) * 0.03, -1, 1); }
    else {
      // a player nudging: want alphaSet = 90° + e/30
      const want = 90 * D2R + clamp(e / 30, -24, 24) * D2R; ctl.sy = clamp(-(want - S.alphaSet) / (4 * D2R), -1, 1);
      const tf = Math.max((S.h - S.cue.flipH) / Math.max(-S.vr, 20), 1); ctl.sx = clamp((clamp(-S.z / Math.max(tf * 0.5, 3), -45, 45) - S.vz) * 0.12, -1, 1);
      if (S.h < S.cue.flipH + 30) { SIM.flip(S); ctl.thr = 0.6; S.athr = S.assist; }
    }
  } else if (S.phase === 'LAND') {
    const aT = S.cue.aT || 20;
    if (S.assist) { ctl.sy = clamp(-S.x * 0.2 / 14, -1, 1); ctl.sx = clamp(-S.z * 0.2 / 14, -1, 1); }
    else {
      ctl.thr = !S.flipDone ? 0.6 : clamp((9.81 + (S.h - CFG.catchH > 3 ? S.cue.ad : 0) + 1.6 * (S.cue.vdes - S.vr)) / aT, 0.1, 1);
      ctl.sy = S.flipDone ? clamp((S.cue.tiltX - S.pit) * 6 - S.pitRate * 10, -1, 1) : 0; ctl.sx = S.flipDone ? clamp((S.cue.tiltZ - S.yawT) * 6 - S.yawRate * 10, -1, 1) : 0;
    }
  }
  if (S.phase === 'FAIL' || S.phase === 'CAUGHT') break;
  if (S.t > 30000 || S.x !== S.x) { console.log('timeout/nan'); break; }
}
console.log('END', S.phase, S.fail, 'qMax', (S.qMax / 1000).toFixed(1), 'hull', S.hull.toFixed(0), 'tps', S.tps.toFixed(0), 'fuel', (S.mS / 1000).toFixed(1), JSON.stringify(S.catchRes));
