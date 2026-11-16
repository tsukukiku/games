const SIM = require('../src/sim.js'); const { RE, CFG, D2R } = SIM;
function toOrbit() { const S = SIM.newState({ sats: 3 }); S.auto = true; SIM.liftoff(S); const ctl = { sx: 0, sy: 0, thr: 1 }; while (S.phase !== 'ORBIT') SIM.step(S, ctl, 1 / 30); S.events.length = 0; return S; }
const S0 = JSON.stringify(toOrbit());
for (const [dvr, dvt] of [[20, 0], [-25, 0], [0, 12], [15, -8], [0, -9]]) {
  const S = JSON.parse(S0), ctl = { sx: 0, sy: 0, thr: 0 };
  // kick along radial / tangential
  const r = Math.hypot(S.x, S.y), ux = S.x / r, uy = S.y / r, dx = uy, dy = -ux;
  S.vx += ux * dvr + dx * dvt; S.vy += uy * dvr + dy * dvt; SIM.derive(S);
  const a0 = `${(S.ap / 1000).toFixed(1)}x${(S.pe / 1000).toFixed(1)}`;
  // let the error develop for 5 minutes, then return
  for (let i = 0; i < 600; i++) SIM.step(S, ctl, 0.5);
  const t0 = S.t; S.apReturn = true; let n = 0, maxdH = 0;
  while (S.apReturn && n++ < 200000) { SIM.step(S, ctl, 0.1); maxdH = Math.max(maxdH, Math.abs(S.dH)); }
  console.log(`kick vr ${dvr} vt ${dvt}: before ${a0} -> after ${(S.ap / 1000).toFixed(2)}x${(S.pe / 1000).toFixed(2)} in ${(S.t - t0).toFixed(0)} s  maxdH ${(maxdH / 1000).toFixed(1)} km  dH ${S.dH.toFixed(0)} vr ${S.vr.toFixed(2)} dVt ${S.dVt.toFixed(2)} attErr ${(SIM.wrapPi(S.pit - S.pitPro) / D2R).toFixed(2)}`);
}
// attitude: PRO -> RETRO turn time with thrusters
{ const S = JSON.parse(S0), ctl = { sx: 0, sy: 0, thr: 0 }; S.auto = false; S.assist = true; S.att = 'RETRO'; const t0 = S.t; let n = 0, maxw = 0;
  while (n++ < 5000) { SIM.step(S, ctl, 0.05); maxw = Math.max(maxw, Math.abs(S.pitRate)); if (Math.abs(SIM.wrapPi(S.pit - S.pitPro - Math.PI)) < 1 * D2R && Math.abs(S.pitRate) < 0.2 * D2R) break; }
  console.log('PRO->RETRO turn', (S.t - t0).toFixed(1), 's, peak rate', (maxw / D2R).toFixed(1), '°/s, I', (S.eff.I / 1e6).toFixed(1), 'e6');
  // coast stability at big steps
  S.att = 'PRO'; for (let i = 0; i < 400; i++) SIM.step(S, ctl, 1.07); console.log('after warp coast: attErr', (SIM.wrapPi(S.pit - S.pitPro) / D2R).toFixed(3), 'rate', (S.pitRate / D2R).toFixed(4)); }
