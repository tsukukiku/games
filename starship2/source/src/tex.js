// ===================================================================
// TEX — procedural textures (noise, Earth, hull, ground). No image files.
// ===================================================================
const TEX = (function () {
  'use strict';
  // ---- seeded value noise
  const P = new Uint8Array(512);
  (function () { let s = 1337; const a = []; for (let i = 0; i < 256; i++) a[i] = i;
    for (let i = 255; i > 0; i--) { s = (s * 1664525 + 1013904223) >>> 0; const j = s % (i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; }
    for (let i = 0; i < 512; i++) P[i] = a[i & 255]; })();
  function n3(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    let xf = x - xi, yf = y - yi, zf = z - zi;
    xf = xf * xf * (3 - 2 * xf); yf = yf * yf * (3 - 2 * yf); zf = zf * zf * (3 - 2 * zf);
    const X = xi & 255, Y = yi & 255, Z = zi & 255;
    const A = P[X] + Y, B = P[X + 1] + Y, AA = P[A] + Z, AB = P[A + 1] + Z, BA = P[B] + Z, BB = P[B + 1] + Z;
    const l = (a, b, t) => a + (b - a) * t;
    return l(l(l(P[AA], P[BA], xf), l(P[AB], P[BB], xf), yf), l(l(P[AA + 1], P[BA + 1], xf), l(P[AB + 1], P[BB + 1], xf), yf), zf) / 255;
  }
  function fbm(x, y, z, o) { let s = 0, a = 0.5, n = 0; for (let i = 0; i < o; i++) { s += a * n3(x, y, z); n += a; a *= 0.5; x = x * 2.03 + 11.1; y = y * 2.03 + 3.7; z = z * 2.03 + 7.3; } return s / n; }
  let seed = 9001;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const mix = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const tick = () => new Promise(r => setTimeout(r, 0));

  // ------------------------------- Earth -------------------------------
  async function earth(maskURL, small, onProgress) {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = maskURL; });
    const TW = small ? 1536 : 2048, TH = TW / 2;
    const c = cv(TW, TH), g = c.getContext('2d');
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, TW, TH);
    const src = g.getImageData(0, 0, TW, TH).data;
    const out = g.createImageData(TW, TH), o = out.data, ocean = new Uint8Array(TW * TH);
    const CW = 1024, CH = 512, cc = cv(CW, CH), cg = cc.getContext('2d'), cout = cg.createImageData(CW, CH), co = cout.data;
    for (let y = 0; y < TH; y++) {
      const lat = (0.5 - (y + 0.5) / TH) * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat), latd = lat * 57.2958, al = Math.abs(latd);
      for (let x = 0; x < TW; x++) {
        const lon = ((x + 0.5) / TW * 2 - 1) * Math.PI, lond = lon * 57.2958;
        const px = cl * Math.cos(lon), py = sl, pz = -cl * Math.sin(lon), i = (y * TW + x) * 4;
        const m = src[i] / 255;
        const nA = fbm(px * 5 + 3, py * 5, pz * 5, 3), nB = n3(px * 46, py * 46, pz * 46), nC = n3(px * 150, py * 150, pz * 150);
        const lv = m + (nB - 0.5) * 0.32 + (nC - 0.5) * 0.12;
        let r, gg, b, sp = 0;
        if (lv > 0.5) {
          let dry = al < 10 ? 0.08 : al < 18 ? mix(0.08, 0.7, (al - 10) / 8) : al < 32 ? 0.78 : al < 45 ? mix(0.78, 0.3, (al - 32) / 13) : 0.22;
          const bx = (a0, a1, o0, o1) => sstep(a0 - 4, a0 + 4, latd) * (1 - sstep(a1 - 4, a1 + 4, latd)) * sstep(o0 - 5, o0 + 5, lond) * (1 - sstep(o1 - 5, o1 + 5, lond));
          dry -= 0.5 * bx(5, 38, 70, 125); dry -= 0.5 * bx(24, 42, -100, -72); dry -= 0.38 * bx(6, 24, -106, -82);
          dry -= 0.5 * bx(-36, -12, -64, -38); dry -= 0.3 * bx(-30, -8, 26, 52); dry += 0.42 * bx(36, 50, 48, 110);
          dry = mix(dry, 0.86, bx(-38, -16, 114, 143)); dry = mix(dry, 0.6, bx(-56, -38, -76, -62)); dry -= 0.12 * bx(36, 60, -12, 40);
          dry = Math.min(1, Math.max(0, dry + (nA - 0.5) * 0.7));
          if (dry < 0.33) { const t = dry / 0.33; r = mix(26, 70, t); gg = mix(58, 92, t); b = mix(30, 44, t); }
          else if (dry < 0.66) { const t = (dry - 0.33) / 0.33; r = mix(70, 152, t); gg = mix(92, 136, t); b = mix(44, 84, t); }
          else { const t = (dry - 0.66) / 0.34; r = mix(152, 214, t); gg = mix(136, 184, t); b = mix(84, 130, t); }
          { const t = 0.7 * bx(28, 39, 78, 102); r = mix(r, 128, t); gg = mix(gg, 112, t); b = mix(b, 92, t); }
          const sh = 0.82 + nB * 0.36; r *= sh; gg *= sh; b *= sh;
          let ice = sstep(60, 80, al + (nA - 0.5) * 24);
          ice = Math.max(ice, bx(62, 86, -66, -16));
          if (latd < -60) ice = 1;
          if (ice > 0) { const tun = Math.min(1, ice * 2.2), sn = sstep(0.45, 0.8, ice);
            r = mix(r, 118, tun); gg = mix(gg, 118, tun); b = mix(b, 100, tun);
            r = mix(r, 238, sn); gg = mix(gg, 242, sn); b = mix(b, 247, sn); }
        } else {
          const sh = sstep(0.12, 0.5, lv), tr = 1 - Math.min(1, al / 40);
          r = mix(5, 16, sh) + tr * 3; gg = mix(22, 76, sh) + tr * 8; b = mix(54, 104, sh) + tr * 4; sp = 255;
          const si = sstep(66, 78, al + (nA - 0.5) * 26 + (nB - 0.5) * 6);
          if (si > 0) { r = mix(r, 225, si); gg = mix(gg, 232, si); b = mix(b, 240, si); sp = 255 * (1 - si); }
        }
        o[i] = r; o[i + 1] = gg; o[i + 2] = b; o[i + 3] = 255; ocean[i >> 2] = sp;
      }
      if ((y & 63) === 63) { if (onProgress) onProgress(0.05 + 0.6 * y / TH); await tick(); }
    }
    g.putImageData(out, 0, 0);
    // clouds (R) + city lights (G)
    for (let y = 0; y < CH; y++) {
      const lat = (0.5 - (y + 0.5) / CH) * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat), al = Math.abs(lat * 57.2958);
      const band = 0.86 + 0.2 * Math.cos(lat * 6) - (al > 15 && al < 32 ? 0.1 : 0);
      for (let x = 0; x < CW; x++) {
        const lon = ((x + 0.5) / CW * 2 - 1) * Math.PI, px = cl * Math.cos(lon), py = sl, pz = -cl * Math.sin(lon), i = (y * CW + x) * 4;
        const w = fbm(px * 2.2 + 9, py * 2.2, pz * 2.2, 3) - 0.5;
        const n = fbm(px * 4.2 + w * 2.6, py * 6.5 + w * 2.6, pz * 4.2 - w * 2.6, 5) * band;
        const cld = sstep(0.5, 0.74, n);
        const si = (Math.floor((y + 0.5) / CH * TH) * TW + Math.floor((x + 0.5) / CW * TW)) * 4;
        let li = 0;
        if (ocean[si >> 2] === 0 && al < 62) { const d = n3(px * 300, py * 300, pz * 300), reg = fbm(px * 9 + 40, py * 9, pz * 9, 2); if (d > 0.72 && reg > 0.5 && o[si + 1] > o[si + 2]) li = (d - 0.72) * 3.2 * (reg - 0.5) * 6; }
        co[i] = cld * 255; co[i + 1] = Math.min(255, li * 255); co[i + 2] = ocean[si >> 2]; co[i + 3] = 255;
      }
      if ((y & 63) === 63) { if (onProgress) onProgress(0.65 + 0.3 * y / CH); await tick(); }
    }
    cg.putImageData(cout, 0, 0);
    return { day: c, cloud: cc };
  }

  // ----------------------------- hull tiles -----------------------------
  function hexTile() {
    const S = 512, c = cv(S, S), g = c.getContext('2d');
    g.fillStyle = '#0d0d10'; g.fillRect(0, 0, S, S);
    const w = S / 16, vp = S / 9, hh = vp / 1.5, rr = hh / 2;
    for (let row = -1; row < 20; row++) for (let col = -1; col < 18; col++) {
      const cx = col * w + (row & 1 ? w / 2 : 0), cy = row * vp / 2 * 1.0;
      const rw = ((row % 18) + 18) % 18, cw = ((col % 16) + 16) % 16, h = P[(rw * 37 + cw * 11) & 255] / 255;
      const v = 15 + h * 9;
      g.beginPath();
      for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k + Math.PI / 6; const x = cx + Math.cos(a) * (w / 2 / 0.866) * 0.94, y = cy + Math.sin(a) * rr * 0.94; k ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.closePath();
      g.fillStyle = `rgb(${v},${v},${v + 3})`; g.fill();
      g.strokeStyle = 'rgba(58,60,68,.5)'; g.lineWidth = 1; g.stroke();
    }
    return c;
  }
  // main body: u around (tiles on u 0..0.5 = +X side), v bottom→top
  function hull(kind) {
    const W = 1024, H = 2048, c = cv(W, H), g = c.getContext('2d'), o = cv(W, H), og = o.getContext('2d'), e = cv(256, 512), eg = e.getContext('2d');
    const lenM = kind === 'ship' ? 50.3 : 71, ppm = H / lenM;
    // stainless steel
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#c9ced6'); gr.addColorStop(0.6, '#b9bec7'); gr.addColorStop(1, '#a9aeb6');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let y = H; y > 0; y -= 1.83 * ppm) {
      for (let s = 0; s < 8; s++) { const v = rnd(); g.fillStyle = v > 0.5 ? `rgba(255,255,255,${(v - 0.5) * 0.16})` : `rgba(40,45,60,${(0.5 - v) * 0.2})`; g.fillRect(s * W / 8 + rnd() * 30, y - 1.83 * ppm, W / 8, 1.83 * ppm); }
      g.fillStyle = 'rgba(60,66,78,.55)'; g.fillRect(0, y - 2, W, 2); g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(0, y, W, 1);
    }
    for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(${rnd() > 0.5 ? '255,255,255' : '50,55,70'},${rnd() * 0.05})`; g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2, 60 + rnd() * 500); }
    og.fillStyle = 'rgb(0,84,255)'; og.fillRect(0, 0, W, H);
    eg.fillStyle = '#000'; eg.fillRect(0, 0, 256, 512);
    if (kind === 'ship') {
      const pat = g.createPattern(hexTile(), 'repeat');
      const x0 = -0.014 * W, x1 = 0.514 * W;
      g.save(); g.beginPath(); g.rect(0, 0, x1, H); g.rect(W + x0, 0, -x0, H); g.clip();
      g.scale(0.5, 0.5); g.fillStyle = pat; g.fillRect(0, 0, W * 2, H * 2); g.restore();
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x1, 0, 3, H); g.fillRect(W + x0 - 3, 0, 3, H);
      og.fillStyle = 'rgb(0,225,0)'; og.fillRect(0, 0, x1, H); og.fillRect(W + x0, 0, -x0, H);
      eg.fillStyle = '#fff'; eg.fillRect(0, 0, 0.514 * 256, 512); eg.fillRect(256 * (1 - 0.014), 0, 256 * 0.014, 512);
      // payload slot + markings on the steel side (u≈0.75 → −X)
      g.fillStyle = '#15171b'; g.fillRect(0.75 * W - 62, H - 31.2 * ppm, 124, 0.9 * ppm);
      g.fillStyle = 'rgba(20,22,26,.85)'; g.font = '600 46px sans-serif'; g.textAlign = 'center';
      g.save(); g.translate(0.75 * W, H - 22 * ppm); g.fillText('MC-01', 0, 0); g.restore();
      // frost low on the tanks
      const fg = g.createLinearGradient(0, H - 26 * ppm, 0, H - 3 * ppm); fg.addColorStop(0, 'rgba(255,255,255,0)'); fg.addColorStop(0.3, 'rgba(255,255,255,.22)'); fg.addColorStop(1, 'rgba(255,255,255,.08)');
      g.fillStyle = fg; g.fillRect(x1 + 3, H - 26 * ppm, W + x0 - x1 - 6, 23 * ppm);
    } else {
      // booster: frost on both tanks, dark hot-stage vents at the top, soot at the base
      const band = (y0, y1, a) => { const fg = g.createLinearGradient(0, H - y1 * ppm, 0, H - y0 * ppm); fg.addColorStop(0, 'rgba(255,255,255,0)'); fg.addColorStop(0.12, `rgba(250,252,255,${a})`); fg.addColorStop(0.88, `rgba(250,252,255,${a})`); fg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = fg; g.fillRect(0, H - y1 * ppm, W, (y1 - y0) * ppm); };
      band(6, 36, 0.8); band(39, 66, 0.86);
      for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(170,176,186,${rnd() * 0.35})`; const y = H - (6 + rnd() * 60) * ppm; g.fillRect(rnd() * W, y, 2 + rnd() * 5, 20 + rnd() * 160); }
      g.fillStyle = '#23262b'; g.fillRect(0, 0, W, 1.9 * ppm);
      for (let i = 0; i < 48; i++) { g.fillStyle = '#07080a'; g.fillRect(i * W / 48 + 4, 0.35 * ppm, W / 48 - 9, 1.2 * ppm); }
      const sg = g.createLinearGradient(0, H - 5 * ppm, 0, H); sg.addColorStop(0, 'rgba(20,20,22,0)'); sg.addColorStop(1, 'rgba(20,20,22,.75)'); g.fillStyle = sg; g.fillRect(0, H - 5 * ppm, W, 5 * ppm);
      og.fillStyle = 'rgb(0,150,120)'; og.fillRect(0, H - 66 * ppm, W, 60 * ppm);
    }
    return { color: c, orm: o, emis: e };
  }
  function truss() {
    const S = 256, c = cv(S, S), g = c.getContext('2d');
    g.clearRect(0, 0, S, S); g.strokeStyle = '#3a3f47'; g.lineCap = 'square';
    g.lineWidth = 26; g.strokeRect(13, 13, S - 26, S - 26);
    g.lineWidth = 16; g.beginPath(); g.moveTo(20, 20); g.lineTo(S - 20, S - 20); g.moveTo(S - 20, 20); g.lineTo(20, S - 20); g.stroke();
    g.lineWidth = 10; g.strokeStyle = '#4b515b'; g.beginPath(); g.moveTo(0, S / 2); g.lineTo(S, S / 2); g.stroke();
    return c;
  }
  function grid() {
    const S = 128, c = cv(S, S), g = c.getContext('2d'); g.clearRect(0, 0, S, S); g.strokeStyle = '#2c3036'; g.lineWidth = 7;
    for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * S / 8, 0); g.lineTo(i * S / 8, S); g.moveTo(0, i * S / 8); g.lineTo(S, i * S / 8); g.stroke(); }
    return c;
  }

  // ------------------------------ ground ------------------------------
  // size: metres covered by the square; all three layers share one coastline function
  function coastX(z) { return 650 + (n3(z / 5200 + 5, 1.3, 0) - 0.5) * 2600 + (n3(z / 520 + 2, 7.7, 0) - 0.5) * 240 + (n3(z / 52000 + 3, 4.1, 0) - 0.5) * 22000 - z * 0.06; }
  function ground(size, res, fade) {
    const c = cv(res, res), g = c.getContext('2d'), im = g.createImageData(res, res), o = im.data, half = size / 2, mpp = size / res;
    for (let py = 0; py < res; py++) {
      const wz = (py + 0.5) / res * size - half;
      const cx = coastX(wz);
      for (let px = 0; px < res; px++) {
        const wx = (px + 0.5) / res * size - half, i = (py * res + px) * 4;
        const d = wx - cx; // >0 sea
        let r, gg, b;
        const n1 = fbm(wx / 900 + 20, wz / 900, 0.5, 4), n2 = n3(wx / 60, wz / 60, 2.2), n0 = fbm(wx / 14000 + 3, wz / 14000, 7, 3);
        const island = size > 60000 && d > 3500 && d < 6200 + n0 * 2600 && n3(wz / 30000, 0.3, 9) > 0.32;
        if (d > 0 && !island) {
          const t = sstep(0, 2600, d), t2 = sstep(2000, 40000, d);
          r = mix(mix(58, 14, t), 7, t2); gg = mix(mix(120, 62, t), 34, t2); b = mix(mix(128, 104, t), 74, t2);
          const wv = (n2 - 0.5) * 8; r += wv; gg += wv; b += wv;
        } else {
          const flat = sstep(0.5, 0.62, fbm(wx / 2600 + 8, wz / 2600, 3.3, 3) + (d > -2500 ? 0.09 : d > -11000 ? -0.01 : -0.3));
          const river = Math.abs(wz - (3600 + 1100 * Math.sin(wx / 2700) + 500 * Math.sin(wx / 900))) < Math.max(70, mpp * 0.7) && d < -100;
          const veg = sstep(0.4, 0.62, n1 + (n0 - 0.5) * 0.5);
          r = mix(168, 86, veg); gg = mix(150, 104, veg); b = mix(112, 62, veg);
          if (size > 60000) { const f = sstep(0.42, 0.6, n3(wx / 5200, wz / 5200, 5.5)) * sstep(-4000, -30000, d); r = mix(r, 124, f * 0.6); gg = mix(gg, 132, f * 0.6); b = mix(b, 78, f * 0.6); }
          const sh = 0.86 + n2 * 0.28; r *= sh; gg *= sh; b *= sh;
          if (flat > 0 && d < -260) { const wet = sstep(0.55, 0.9, flat); r = mix(mix(r, 150, flat), 58, wet); gg = mix(mix(gg, 142, flat), 92, wet); b = mix(mix(b, 124, flat), 104, wet); }
          if (river) { r = 50; gg = 84; b = 98; }
          if (d > -110 || island) { const t = island ? 0.8 : sstep(-110, -20, d); r = mix(r, 222, t); gg = mix(gg, 208, t); b = mix(b, 176, t); }
          if (size < 5000) { // launch complex
            const dc = Math.hypot(wx, wz);
            const apron = wx > -280 && wx < 95 && wz > -125 && wz < 150, road = (Math.abs(wz - 30) < 7 && wx < -280) || (Math.abs(wx + 150) < 6 && wz < -125) || (Math.abs(wz + 60) < 5 && wx > 95 && d < -40);
            if (apron || road) { const k = 150 + n2 * 26; r = k; gg = k; b = k - 5; }
            if (apron && (Math.abs(((wx + 1000) % 40) - 20) > 19.2 || Math.abs(((wz + 1000) % 40) - 20) > 19.2)) { r -= 22; gg -= 22; b -= 22; }
            if (dc < 62) { const k = mix(74, 172, sstep(16, 60, dc)) + n2 * 14; r = k; gg = k; b = k - 3; }
          }
        }
        let a = 1;
        if (fade) { const e = Math.max(Math.abs(wx), Math.abs(wz)) / half, rr = Math.hypot(wx, wz) / half; a = fade === 2 ? 1 - sstep(0.72, 0.98, rr) : 1 - sstep(0.86, 1, e); }
        o[i] = r; o[i + 1] = gg; o[i + 2] = b; o[i + 3] = a * 255;
      }
    }
    g.putImageData(im, 0, 0);
    return c;
  }
  function glow(size, stops) {
    const c = cv(size, size), g = c.getContext('2d'), gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const s of stops) gr.addColorStop(s[0], s[1]);
    g.fillStyle = gr; g.fillRect(0, 0, size, size); return c;
  }
  return { n3, fbm, earth, hull, hexTile, truss, grid, ground, glow, rnd, mix, sstep };
})();
