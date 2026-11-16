// Quick landing iteration: fly auto once to just before the flip (cached), then trace the landing.
const fs = require('fs'); const SIM = require('../src/sim.js'); const { D2R, CFG } = SIM;
const cache = '/tmp/preflip.json';
let S;
if (!fs.existsSync(cache) || process.argv.includes('--fresh')) {
  S = SIM.newState({ sats: 0 }); S.auto = true; SIM.liftoff(S); const ctl = { sx: 0, sy: 0, thr: 1 }; let lp = -100, armed = false;
  for (let i = 0; i < 5e6; i++) {
    SIM.step(S, ctl, S.phase === 'ORBIT' && S.thr === 0 && !S.apBurning ? 0.5 : 1 / 30);
    if (S.t - lp > (S.phase === 'ENTRY' ? 0.25 : 1)) { SIM.updatePrediction(S); lp = S.t; }
    S.events.length = 0;
    if (S.phase === 'ORBIT' && !armed) { armed = true; S.apDeorbit = true; }
    if (S.phase === 'ENTRY' && !S.zset) { S.zset = 1; S.z = 2500; }
    if (S.phase === 'ENTRY' && S.h < 3500) break;
    if (S.phase === 'FAIL') { console.log('fail before flip', S.fail); break; }
  }
  S.pred = null; S.std = null; fs.writeFileSync(cache, JSON.stringify(S));
}
S = JSON.parse(fs.readFileSync(cache)); S.events = [];
const mode = process.env.MODE || 'auto';
S.auto = mode === 'auto'; S.assist = mode !== 'manual';
const ctl = { sx: 0, sy: 0, thr: 0 }; let lp = -100, n = 0;
const verbose = process.argv.includes('-v');
while (S.phase !== 'FAIL' && S.phase !== 'CAUGHT' && n++ < 60 * 400) {
  SIM.step(S, ctl, 1 / 60);
  if (S.t - lp > 0.25) { SIM.updatePrediction(S); lp = S.t; }
  if (mode !== 'auto') { // scripted human
    if (S.phase === 'ENTRY') { const e = S.pred ? S.pred.err : 0; const want = 90 * D2R + SIM.clamp(e / 30, -24, 24) * D2R; ctl.sy = SIM.clamp(-(want - S.alphaSet) / (4 * D2R), -1, 1); ctl.sx = S.cue.bank; if (S.h < S.cue.flipH + 10) { SIM.flip(S); S.athr = mode === 'assist'; ctl.thr = 0.55; } }
    else if (S.phase === 'LAND') {
      if (mode === 'assist') { ctl.sy = SIM.clamp(-S.x * 0.2 / 14, -1, 1); ctl.sx = SIM.clamp(-S.z * 0.2 / 14, -1, 1); }
      else { // manual: direct gimbal torque; PD on tilt toward guidance cue
        const kx = SIM.clamp((S.cue.tiltX - S.pit) * 6 - S.pitRate * 10, -1, 1), kz = SIM.clamp((S.cue.tiltZ - S.yawT) * 6 - S.yawRate * 10, -1, 1);
        ctl.sy = S.flipDone ? kx : 0; ctl.sx = S.flipDone ? kz : 0;
        const aT = S.cue.aT || 20; ctl.thr = S.flipT < 3 ? 0.55 : SIM.clamp((9.81 + (S.h - CFG.catchH > 3 ? S.cue.ad : 0) + 1.6 * (S.cue.vdes - S.vr)) / aT, 0.1, 1);
      }
    }
  }
  while (S.events.length) { const e = S.events.shift(); console.log('EV', e.name, typeof e.data === 'object' ? JSON.stringify(e.data) : e.data || '', 't', S.t.toFixed(1)); }
  if (verbose && S.phase === 'LAND' && n % 20 === 0) console.log(`ft=${S.flipT.toFixed(1)} h=${(S.h - CFG.catchH).toFixed(0)} vr=${S.vr.toFixed(1)} vdes=${S.cue.vdes.toFixed(1)} x=${S.x.toFixed(1)} vx=${S.vx.toFixed(1)} z=${S.z.toFixed(1)} vz=${S.vz.toFixed(1)} pit=${(S.pit / D2R).toFixed(1)} w=${(S.pitRate / D2R).toFixed(1)} tX=${(S.tiltX / D2R).toFixed(1)} gim=${(S.eff.gim / D2R).toFixed(1)} yaw=${(S.yawT / D2R).toFixed(1)} thr=${S.thr.toFixed(2)} T=${((S.thrust||0)/1e6).toFixed(2)}`);
}
console.log('END', mode, S.phase, S.fail, 'fuel', (S.mS / 1000).toFixed(1), JSON.stringify(S.catchRes));
