const SIM = require('../src/sim.js');
const { RE, D2R } = SIM;
const S = SIM.newState({ sats: 3 });
S.auto = true;
const ctl = { sx: 0, sy: 0, thr: 0, precision: false };
SIM.liftoff(S);
let lastPrint = -100, lastPred = -100, lastPhase = '', deployed = 0, armed = false;
const verbose = process.argv.includes('-v');
const zoff = Number(process.env.ZOFF || 3000);
for (let i = 0; i < 4e6; i++) {
  const coast = S.phase === 'ORBIT' && S.thr === 0 && !S.apBurning && !(S.std && (S.std.lead < 0.05 || S.std.lead > 6.2) && S.apDeorbit);
  const dt = coast ? 0.5 : 1 / 30;
  SIM.step(S, ctl, dt);
  if (S.t - lastPred > (S.phase === 'ENTRY' || S.apBurning ? 0.3 : 1)) { SIM.updatePrediction(S); lastPred = S.t; }
  while (S.events.length) { const e = S.events.shift(); console.log(`T+${S.t.toFixed(1).padStart(7)} EV ${e.name} h=${(S.h / 1000).toFixed(1)}km v=${S.spd.toFixed(0)} vr=${S.vr.toFixed(0)} pit=${(S.pit / D2R).toFixed(1)} mS=${(S.mS / 1000).toFixed(0)}t ap=${(S.ap / 1000).toFixed(0)} pe=${(S.pe / 1000).toFixed(0)} x=${S.x.toFixed(0)} z=${S.z.toFixed(0)}`);
    if (e.name === 'ENTRY') { S.z = zoff; }
  }
  if (S.phase === 'ORBIT' && deployed < 3 && S.ang > (1.6 + deployed * 1.2)) { if (!SIM.deployCheck(S, null)) { SIM.deploy(S); deployed++; } }
  if (S.phase === 'ORBIT' && deployed === 3 && !armed && S.ang > 6.4) { S.apDeorbit = true; armed = true; console.log('deorbit armed, std lead', S.std && (S.std.lead / D2R).toFixed(1), 'std ang', S.std && (S.std.ang / D2R).toFixed(1)); }
  const iv = S.phase === 'ASCENT' ? 60 : S.phase === 'ORBIT' ? 3000 : S.phase === 'ENTRY' ? 100 : 4;
  if (verbose && S.t - lastPrint >= iv && (S.phase==='LAND')) {
    lastPrint = S.t;
    console.log(`T+${S.t.toFixed(0)} ${S.phase} h=${(S.h / 1000).toFixed(2).padStart(7)} v=${S.spd.toFixed(0).padStart(5)} vr=${S.vr.toFixed(0).padStart(5)} pit=${(S.pit / D2R).toFixed(0).padStart(4)} aoa=${(S.aoa / D2R).toFixed(0).padStart(3)} q=${(S.q / 1000).toFixed(1).padStart(5)} g=${S.gload.toFixed(1)} thr=${S.thr.toFixed(2)} T=${(S.temp - 273).toFixed(0)}C tps=${S.tps.toFixed(0)} hull=${S.hull.toFixed(0)} mS=${(S.mS / 1000).toFixed(0)} x=${S.x.toFixed(0)} z=${S.z.toFixed(0)} err=${S.pred ? (S.pred.err / 1000).toFixed(1) : '-'} a=${(S.alphaSet / D2R).toFixed(0)}`);
  }
  if (S.phase === 'FAIL' || S.phase === 'CAUGHT') break;
  if (S.t > 30000 || S.x!==S.x) { console.log('timeout/nan'); break; }
}
console.log('END', S.phase, S.fail, 'T+' + S.t.toFixed(0), 'qMax', (S.qMax / 1000).toFixed(1), 'kPa', 'hull', S.hull.toFixed(0), 'tps', S.tps.toFixed(0), 'fuel', (S.mS / 1000).toFixed(1), 't', JSON.stringify(S.catchRes));
