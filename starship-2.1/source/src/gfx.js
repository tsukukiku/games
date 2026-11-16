// ===================================================================
// GFX — three.js scene. Two passes: a far scene in km (Earth, sky) and a
// near scene in metres with the vehicle at the origin. Both use a
// local-level frame: +X downrange, +Y up, +Z cross-range.
// ===================================================================
const GFX = (function () {
  'use strict';
  const T = THREE, RE = 6371000, D2R = Math.PI / 180;
  const V = (x, y, z) => new T.Vector3(x, y, z);
  const ZAX = V(0, 0, 1), YAX = V(0, 1, 0);
  const sunI = V(0.2, 0.42, 0.885).normalize(), sunW = V(0, 1, 0);
  let renderer, far, near, camF, camN, W = 2, H = 2, maxAniso = 1;
  let inertial, earth, atmo, stars, sunSprite, earthMat, atmoMat;
  let padG, towerArms = [], qdArm, vehicle, shipG, boosterG, boosterFree, flaps = [], shipMat, boosterMat, envGround, envSpace;
  let sunLight, hemi, amb, engLight;
  let plB, plBc, plS, plSc, wake, shell, shellMat, plFree;
  let pPad, pShip, pFire, satPool = [], ufoPool = [], laser, debrisPts, flash, junkIM, rockIM, chunkSeed = [];
  const qPhi = new T.Quaternion(), qE = new T.Quaternion(), qS = new T.Quaternion(), tmpM = new T.Matrix4(), tv = V(0, 0, 0), tv2 = V(0, 0, 0), tq = new T.Quaternion();
  const clearC = new T.Color();
  const cam = { view: 'EXT', offX: 0, az: 0.35, el: 0.12, dist: 240, mapAz: Math.PI, mapEl: 0.14, mapDist: 25000, shake: 0, fov: 50 };
  const st = { time: 0, cloud: 0, sunVis: 1, skyK: 1, phi: 0, r: RE, heat: 0 };

  function tex(canvas, srgb, repeat) {
    const t = new T.CanvasTexture(canvas);
    if (srgb) t.encoding = T.sRGBEncoding;
    t.anisotropy = maxAniso;
    if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; }
    return t;
  }
  const HEAD = 'varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying vec3 vNv; varying vec3 vVv; varying vec3 vP;\n';
  const VERT = HEAD + 'void main(){ vUv=uv; vP=position; vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; vec4 mv=viewMatrix*w; vVv=-mv.xyz; vNv=normalize(normalMatrix*normal); gl_Position=projectionMatrix*mv; }';
  const TAIL = '\n#include <tonemapping_fragment>\n#include <encodings_fragment>\n}';

  // ------------------------------------------------------------------
  async function init(canvas, small, onProgress) {
    renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.autoClear = false;
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2));
    maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    far = new T.Scene(); near = new T.Scene();
    camF = new T.PerspectiveCamera(50, 1, 0.4, 2e6); camN = new T.PerspectiveCamera(50, 1, 0.5, 6e5);
    near.fog = new T.FogExp2(0x9fc3e6, 0.00002);
    // lights (near scene)
    sunLight = new T.DirectionalLight(0xfff4e4, 2.4); near.add(sunLight);
    hemi = new T.HemisphereLight(0x9fc4ff, 0x4a4438, 0.7); near.add(hemi);
    amb = new T.AmbientLight(0x30384a, 0.5); near.add(amb);
    engLight = new T.PointLight(0xffb070, 0, 1400, 1.6); near.add(engLight);
    buildEnv();
    onProgress(0.03);
    const et = await TEX.earth(LAND_MASK, small, onProgress);
    buildFar(et); onProgress(0.96); await new Promise(r => setTimeout(r, 0));
    buildVehicle(); buildPad(); buildFx();
    onProgress(1);
    resize();
  }
  function resize() {
    const c = renderer.domElement, w = c.clientWidth || window.innerWidth, h = c.clientHeight || window.innerHeight;
    W = w; H = h; renderer.setSize(w, h, false);
    camF.aspect = camN.aspect = w / h;
  }

  function buildEnv() {
    const pm = new T.PMREMGenerator(renderer);
    const mk = (top, mid, bot) => {
      const sc = new T.Scene();
      const m = new T.ShaderMaterial({ side: T.BackSide, uniforms: { a: { value: new T.Color(top) }, b: { value: new T.Color(mid) }, c: { value: new T.Color(bot) } },
        vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: 'varying vec3 vP; uniform vec3 a; uniform vec3 b; uniform vec3 c; void main(){ float y=normalize(vP).y; vec3 col=y>0.0?mix(b,a,pow(y,0.45)):mix(b,c,pow(-y,0.35)); gl_FragColor=vec4(col,1.0);\n#include <encodings_fragment>\n}' });
      sc.add(new T.Mesh(new T.SphereGeometry(10, 32, 16), m));
      const rt = pm.fromScene(sc, 0, 0.1, 100); return rt.texture;
    };
    envGround = mk(0x3f74c8, 0xdfe9f5, 0x6a6558);
    envSpace = mk(0x01020a, 0xbfd8ff, 0x3a66b0);
    pm.dispose();
  }

  // ----------------------------- far scene -----------------------------
  function buildFar(et) {
    inertial = new T.Group(); far.add(inertial);
    const day = tex(et.day, false), cloud = tex(et.cloud, false);
    day.wrapS = cloud.wrapS = T.RepeatWrapping;
    earthMat = new T.ShaderMaterial({
      uniforms: { tDay: { value: day }, tCloud: { value: cloud }, sunDir: { value: sunW }, cloudShift: { value: 0 }, amb: { value: 0 } },
      vertexShader: VERT,
      fragmentShader: HEAD + `uniform sampler2D tDay; uniform sampler2D tCloud; uniform vec3 sunDir; uniform float cloudShift; uniform float amb;
      void main(){
        vec3 N=normalize(vN); vec3 Vd=normalize(cameraPosition-vW);
        float ndl=dot(N,sunDir); float lit=max(ndl,0.0); float day=smoothstep(-0.15,0.2,ndl);
        vec4 d=texture2D(tDay,vUv); vec3 base=pow(d.rgb,vec3(2.2));
        vec2 cu=vec2(vUv.x+cloudShift,vUv.y);
        vec4 ct=texture2D(tCloud,cu); float c=ct.r; float cs=texture2D(tCloud,cu+vec2(0.0025,0.0012)).r;
        vec3 col=base*(1.0-0.45*cs)*lit*1.25;
        float oc=texture2D(tCloud,vUv).b; vec3 Hh=normalize(sunDir+Vd); float sp=pow(max(dot(N,Hh),0.0),90.0)*oc*1.6+pow(max(dot(N,Hh),0.0),12.0)*oc*0.12;
        col+=vec3(1.0,0.93,0.8)*sp*(1.0-c)*day;
        col=mix(col,vec3(1.0,1.0,1.02)*(lit*1.2+0.02),c*0.94);
        float fr=pow(1.0-max(dot(N,Vd),0.0),2.6);
        col=mix(col,vec3(0.25,0.5,1.0)*day*1.1,fr*0.7);
        float tw=smoothstep(-0.12,0.06,ndl)*(1.0-smoothstep(0.06,0.3,ndl));
        col+=vec3(0.9,0.36,0.1)*tw*0.16*(0.3+c);
        col+=vec3(1.0,0.72,0.38)*ct.g*(1.0-day)*(1.0-c)*0.75;
        col+=vec3(0.004,0.007,0.016)*(1.0-day);
        vec3 mp=base*1.15*(1.0-0.25*c)+vec3(0.55)*c*0.6; mp=mix(mp,vec3(0.3,0.55,1.0),fr*0.6); col=mix(col,mp*(0.72+0.28*day),amb);
        gl_FragColor=vec4(col,1.0);` + TAIL
    });
    earth = new T.Mesh(new T.SphereGeometry(RE / 1000, 256, 128), earthMat);
    // orient so the launch site (Starbase, 25.997°N 97.157°W) is at +Y with east along +X
    const la = 25.997 * D2R, lo = -97.157 * D2R;
    const up = V(Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo)), east = V(-Math.sin(lo), 0, -Math.cos(lo)), south = V(0, 0, 0).crossVectors(east, up);
    earth.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(east, up, south).transpose());
    inertial.add(earth);
    atmoMat = new T.ShaderMaterial({
      side: T.BackSide, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      uniforms: { sunDir: { value: sunW }, k: { value: 1 } }, vertexShader: VERT,
      fragmentShader: HEAD + `uniform vec3 sunDir; uniform float k;
      void main(){ vec3 N=normalize(vN); vec3 Vd=normalize(cameraPosition-vW);
        float c=abs(dot(N,Vd)); float g=pow(smoothstep(0.0,0.2,c),1.6)*pow(1.0-c,2.0)*1.5;
        float day=smoothstep(-0.35,0.25,dot(N,sunDir));
        float tw=smoothstep(-0.35,-0.05,dot(N,sunDir))*(1.0-smoothstep(-0.05,0.3,dot(N,sunDir)));
        vec3 col=mix(vec3(0.12,0.4,1.0),vec3(1.0,0.5,0.2),tw*0.55)*g*day*1.35*k;
        gl_FragColor=vec4(col,g*day*k);` + TAIL
    });
    atmo = new T.Mesh(new T.SphereGeometry(RE / 1000 + 105, 128, 64), atmoMat); inertial.add(atmo);
    // stars
    const n = 2600, pos = new Float32Array(n * 3), colr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = TEX.rnd() * 2 - 1, a = TEX.rnd() * 6.2832, s = Math.sqrt(1 - u * u), b = Math.pow(TEX.rnd(), 2.4) * 0.9 + 0.1, tint = TEX.rnd();
      pos[i * 3] = s * Math.cos(a); pos[i * 3 + 1] = u; pos[i * 3 + 2] = s * Math.sin(a);
      colr[i * 3] = b * (0.8 + 0.2 * tint); colr[i * 3 + 1] = b * 0.88; colr[i * 3 + 2] = b * (1 - 0.2 * tint);
    }
    const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(pos, 3)); sg.setAttribute('color', new T.BufferAttribute(colr, 3));
    stars = new T.Points(sg, new T.PointsMaterial({ size: 1.7, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, fog: false }));
    stars.scale.setScalar(9e5); stars.frustumCulled = false; far.add(stars);
    const st2 = TEX.glow(256, [[0, 'rgba(255,255,255,1)'], [0.06, 'rgba(255,250,235,1)'], [0.14, 'rgba(255,225,170,.5)'], [0.4, 'rgba(255,190,120,.12)'], [1, 'rgba(255,180,100,0)']]);
    sunSprite = new T.Sprite(new T.SpriteMaterial({ map: tex(st2, true), blending: T.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    sunSprite.scale.setScalar(2.2e5); far.add(sunSprite);
  }

  // ------------------------------ vehicle ------------------------------
  function noseR(y) { if (y <= 37) return 4.5; const t = Math.min(1, (y - 37) / 13.3); return 4.5 * Math.pow(Math.max(0, 1 - Math.pow(t, 1.8)), 0.75); }
  function buildVehicle() {
    vehicle = new T.Group(); near.add(vehicle);
    shipG = new T.Group(); boosterG = new T.Group(); vehicle.add(shipG); vehicle.add(boosterG);
    const ht = TEX.hull('ship');
    const orm = tex(ht.orm, false);
    shipMat = new T.MeshStandardMaterial({ map: tex(ht.color, true), roughnessMap: orm, metalnessMap: orm, roughness: 1, metalness: 1, envMap: envGround, envMapIntensity: 1.15, emissive: 0xff5a1c, emissiveMap: tex(ht.emis, false), emissiveIntensity: 0 });
    const pts = []; for (let i = 0; i <= 56; i++) { const y = i / 56 * 50.3; pts.push(new T.Vector2(Math.max(noseR(y), 0.001), y)); }
    const body = new T.Mesh(new T.LatheGeometry(pts, 56), shipMat); shipG.add(body);
    const dark = new T.MeshStandardMaterial({ color: 0x24262b, roughness: 0.55, metalness: 0.9, envMap: envGround, side: T.DoubleSide });
    const glowM = new T.MeshBasicMaterial({ color: 0xffa050, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false });
    const dome = new T.Mesh(new T.CircleGeometry(4.4, 40), dark); dome.rotation.x = Math.PI / 2; dome.position.y = 3.0; shipG.add(dome);
    shipG.userData.glows = [];
    const noz = (r0, r1, h, x, z) => { const m = new T.Mesh(new T.CylinderGeometry(r0, r1, h, 20, 1, true), dark); m.position.set(x, 3.0 - h / 2, z); shipG.add(m);
      const gl = new T.Mesh(new T.CircleGeometry(r1 * 0.92, 20), glowM); gl.rotation.x = Math.PI / 2; gl.position.set(x, 3.05 - h, z); shipG.add(gl); };
    for (let i = 0; i < 3; i++) { const a = i * 2.094 + 0.5; noz(0.3, 0.65, 1.7, Math.cos(a) * 0.9, Math.sin(a) * 0.9); }
    for (let i = 0; i < 3; i++) { const a = i * 2.094 + 1.55; noz(0.42, 1.2, 2.7, Math.cos(a) * 2.9, Math.sin(a) * 2.9); }
    shipG.userData.glowM = glowM;
    // flaps: windward face tiled, leeward face steel
    const hexT = tex(TEX.hexTile(), true, true); hexT.repeat.set(0.14, 0.14);
    const tileM = new T.MeshStandardMaterial({ map: hexT, roughness: 0.88, metalness: 0, emissive: 0xff5a1c, emissiveIntensity: 0 });
    const steelM = new T.MeshStandardMaterial({ color: 0xb4bac3, roughness: 0.36, metalness: 1, envMap: envGround, envMapIntensity: 1.1 });
    shipG.userData.tileM = tileM; shipG.userData.steelM = steelM;
    const mkFlap = (shapePts, sideSign, rootZ, y0) => {
      const sh = new T.Shape(); shapePts.forEach((p, i) => i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1]));
      const geo = new T.ShapeGeometry(sh);
      const hinge = new T.Group(); hinge.position.set(-0.5, y0, sideSign * rootZ);
      const piv = new T.Group(); piv.rotation.y = -sideSign * Math.PI / 2; hinge.add(piv);
      const tm = tileM.clone(); tm.side = sideSign > 0 ? T.BackSide : T.FrontSide;
      const sm = steelM.clone(); sm.side = sideSign > 0 ? T.FrontSide : T.BackSide;
      piv.add(new T.Mesh(geo, tm)); piv.add(new T.Mesh(geo, sm));
      shipG.add(hinge); flaps.push({ hinge, sign: sideSign, tm });
      return hinge;
    };
    const fore = [[-1.6, 0], [4.4, 0.7], [4.7, 3.0], [1.6, 8.6], [-2.6, 8.6]], aft = [[-1, 0], [5.0, 0], [5.0, 8.2], [0.6, 15.2], [-1, 15.2]];
    mkFlap(fore, 1, 4.1, 36.8); mkFlap(fore, -1, 4.1, 36.8); mkFlap(aft, 1, 4.2, 0.9); mkFlap(aft, -1, 4.2, 0.9);
    // ---- booster (origin at its base; ship sits at y=72.8 while stacked)
    const bt = TEX.hull('booster'), borm = tex(bt.orm, false);
    boosterMat = new T.MeshStandardMaterial({ map: tex(bt.color, true), roughnessMap: borm, metalnessMap: borm, roughness: 1, metalness: 1, envMap: envGround, envMapIntensity: 1.1 });
    const mkBooster = () => {
      const gB = new T.Group();
      const b = new T.Mesh(new T.CylinderGeometry(4.5, 4.5, 72.8, 56, 1, true), boosterMat); b.position.y = 36.4; gB.add(b);
      const cap = new T.Mesh(new T.CircleGeometry(4.45, 40), dark); cap.rotation.x = Math.PI / 2; cap.position.y = 0.4; gB.add(cap);
      const top = new T.Mesh(new T.CircleGeometry(4.45, 40), dark); top.rotation.x = -Math.PI / 2; top.position.y = 71.2; gB.add(top);
      const ng = new T.CylinderGeometry(0.34, 0.6, 1.5, 12, 1, true), im = new T.InstancedMesh(ng, dark, 33); let k = 0; const d = new T.Object3D();
      const ring = (n, r, o) => { for (let i = 0; i < n; i++) { const a = i / n * 6.2832 + o; d.position.set(Math.cos(a) * r, -0.3, Math.sin(a) * r); d.updateMatrix(); im.setMatrixAt(k++, d.matrix); } };
      ring(3, 0.78, 0); ring(10, 2.15, 0.2); ring(20, 3.78, 0); gB.add(im);
      const gm = new T.MeshStandardMaterial({ map: tex(TEX.grid(), true), alphaTest: 0.5, side: T.DoubleSide, roughness: 0.6, metalness: 0.7, color: 0x9aa0a8 });
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; const f = new T.Mesh(new T.PlaneGeometry(3.6, 3.3), gm); f.rotation.x = -Math.PI / 2; const p = new T.Group(); p.add(f); f.position.set(0, 0, 0); p.position.set(Math.cos(a) * 6.2, 65.5, Math.sin(a) * 6.2); p.rotation.y = -a + Math.PI / 2; gB.add(p);
        const ch = new T.Mesh(new T.BoxGeometry(0.5, 20, 1.0), steelM); ch.position.set(Math.cos(a) * 4.7, 12, Math.sin(a) * 4.7); ch.rotation.y = -a + Math.PI / 2; gB.add(ch); }
      const gl = new T.Mesh(new T.CircleGeometry(4.3, 32), glowM.clone()); gl.rotation.x = Math.PI / 2; gl.position.y = -1.0; gB.add(gl); gB.userData.glow = gl.material;
      return gB;
    };
    const b1 = mkBooster(); boosterG.add(b1); boosterG.userData.glow = b1.userData.glow;
    boosterFree = mkBooster(); boosterFree.visible = false; near.add(boosterFree);
  }

  // -------------------------------- pad --------------------------------
  function buildPad() {
    padG = new T.Group(); near.add(padG);
    const lay = (canvas, size, y, ro, curved) => {
      let geo;
      if (curved) { geo = new T.PlaneGeometry(size, size, 48, 48); const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const d2 = p.getX(i) * p.getX(i) + p.getY(i) * p.getY(i); p.setZ(i, -d2 / (2 * RE)); } }
      else geo = new T.PlaneGeometry(size, size);
      const m = new T.Mesh(geo, new T.MeshLambertMaterial({ map: tex(canvas, true), transparent: true, depthWrite: false, color: 0xcfcfcf }));
      m.rotation.x = -Math.PI / 2; m.position.y = y; m.renderOrder = ro; padG.add(m); return m;
    };
    padG.userData.layers = [lay(TEX.ground(300000, 1024, 2), 300000, 0, -30, true), lay(TEX.ground(40000, 1024, 1), 40000, 0.1, -29, false), lay(TEX.ground(2400, 1024, 1), 2400, 0.2, -28, false)];
    const steel = new T.MeshStandardMaterial({ color: 0x565c66, roughness: 0.6, metalness: 0.7, envMap: envGround });
    const trT = tex(TEX.truss(), true, true);
    const trM = (rx, ry) => { const t = trT.clone(); t.needsUpdate = true; t.repeat.set(rx, ry); return new T.MeshStandardMaterial({ map: t, alphaTest: 0.5, side: T.DoubleSide, roughness: 0.7, metalness: 0.6, color: 0xb8bcc4 }); };
    // tower: north of the mount (−Z), 146 m
    const tw = new T.Mesh(new T.BoxGeometry(10, 146, 10), trM(1, 14)); tw.position.set(0, 73, -16); padG.add(tw);
    const core = new T.Mesh(new T.BoxGeometry(4.6, 144, 4.6), new T.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.8, metalness: 0.4 })); core.position.set(0, 72, -16); padG.add(core);
    const capT = new T.Mesh(new T.BoxGeometry(12, 3, 12), steel); capT.position.set(0, 147, -16); padG.add(capT);
    const mast = new T.Mesh(new T.CylinderGeometry(0.15, 0.3, 16, 6), steel); mast.position.set(0, 156, -16); padG.add(mast);
    // chopstick arms on a carriage at 127 m
    const car = new T.Mesh(new T.BoxGeometry(15, 7, 3), steel); car.position.set(0, 125, -10.4); padG.add(car);
    for (const s of [-1, 1]) {
      const piv = new T.Group(); piv.position.set(s * 5.4, 126.4, -9.6);
      const arm = new T.Mesh(new T.BoxGeometry(1.8, 3.4, 30), trM(8, 1)); arm.position.set(0, -1.2, 15); piv.add(arm);
      const rail = new T.Mesh(new T.BoxGeometry(2.0, 0.5, 30), steel); rail.position.set(0, 0.7, 15); piv.add(rail);
      padG.add(piv); towerArms.push({ piv, s });
    }
    qdArm = new T.Group(); qdArm.position.set(3.5, 96, -11);
    const qd = new T.Mesh(new T.BoxGeometry(2.4, 2.6, 9), steel); qd.position.set(0, 0, 4); qdArm.add(qd); padG.add(qdArm);
    // launch mount
    const conc = new T.MeshStandardMaterial({ color: 0x8b8d8f, roughness: 0.95, metalness: 0 });
    const ringM = new T.Mesh(new T.CylinderGeometry(9.2, 9.2, 4.2, 40, 1, true), steel); ringM.position.y = 15.9; padG.add(ringM);
    const ringI = new T.Mesh(new T.CylinderGeometry(5.6, 5.6, 4.2, 40, 1, true), new T.MeshStandardMaterial({ color: 0x1c1d20, roughness: 0.9, side: T.BackSide })); ringI.position.y = 15.9; padG.add(ringI);
    const ringT = new T.Mesh(new T.RingGeometry(5.6, 9.2, 40), steel); ringT.rotation.x = -Math.PI / 2; ringT.position.y = 18; padG.add(ringT);
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.2832 + 0.52; const leg = new T.Mesh(new T.BoxGeometry(2.4, 14, 2.4), conc); leg.position.set(Math.cos(a) * 7.6, 7, Math.sin(a) * 7.6); leg.rotation.y = -a; padG.add(leg); }
    const defl = new T.Mesh(new T.CylinderGeometry(3, 11, 2.4, 24), new T.MeshStandardMaterial({ color: 0x35363a, roughness: 0.9 })); defl.position.y = 1.2; padG.add(defl);
    // tank farm + buildings
    const white = new T.MeshStandardMaterial({ color: 0xb9bdc2, roughness: 0.6, metalness: 0.1, envMap: envGround, envMapIntensity: 0.25 });
    const tg = new T.CylinderGeometry(5.6, 5.6, 30, 24), tgc = new T.SphereGeometry(5.6, 24, 8, 0, 6.2832, 0, 1.5708);
    for (let i = 0; i < 9; i++) { const x = -150 - (i % 5) * 16 - (i > 4 ? 8 : 0), z = i > 4 ? 112 : 96; const t1 = new T.Mesh(tg, white); t1.position.set(x, 15, z); padG.add(t1); const c1 = new T.Mesh(tgc, white); c1.position.set(x, 30, z); c1.scale.y = 0.35; padG.add(c1); }
    const hg = new T.CylinderGeometry(2.6, 2.6, 26, 16);
    for (let i = 0; i < 5; i++) { const t1 = new T.Mesh(hg, white); t1.rotation.z = Math.PI / 2; t1.position.set(-205, 3.2, 60 - i * 8); padG.add(t1); }
    const bg = new T.BoxGeometry(1, 1, 1), bm = new T.MeshStandardMaterial({ color: 0x6f7378, roughness: 0.9 });
    [[-120, 5, -70, 28, 10, 16], [-200, 4, -40, 18, 8, 30], [-60, 3, 120, 14, 6, 10], [60, 2.5, 100, 10, 5, 8], [-250, 7, 110, 22, 14, 22]].forEach(b => { const m = new T.Mesh(bg, bm); m.position.set(b[0], b[1], b[2]); m.scale.set(b[3], b[4], b[5]); padG.add(m); });
  }

  // --------------------------------- fx ---------------------------------
  function plumeMesh(r0, r1) {
    const geo = new T.CylinderGeometry(r0, r1, 1, 28, 14, true); geo.translate(0, -0.5, 0);
    const m = new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
      uniforms: { uT: { value: 0 }, uPow: { value: 0 }, uVac: { value: 0 }, cA: { value: new T.Color(1, 0.95, 0.85) }, cB: { value: new T.Color(1, 0.5, 0.15) }, uGain: { value: 1 } },
      vertexShader: VERT,
      fragmentShader: HEAD + `uniform float uT; uniform float uPow; uniform float uVac; uniform float uGain; uniform vec3 cA; uniform vec3 cB;
      void main(){ float s=1.0-vUv.y; vec3 Nn=normalize(vNv); vec3 Vn=normalize(vVv);
        float e=pow(abs(dot(Nn,Vn)),1.3+1.5*uVac);
        float core=exp(-s*(3.4-1.4*uPow));
        float dia=1.0+0.45*sin(s*44.0-uT*9.0)*exp(-s*5.0)*(1.0-uVac);
        float fl=0.86+0.14*sin(uT*71.0+s*23.0)*sin(uT*37.0+vUv.x*31.0);
        float a=core*e*dia*fl*uPow*(1.0-smoothstep(0.7,1.0,s))*uGain;
        vec3 col=mix(cA,cB,smoothstep(0.0,0.42,s));
        gl_FragColor=vec4(col*a*1.6,a);` + TAIL
    });
    const mesh = new T.Mesh(geo, m); mesh.frustumCulled = false; mesh.visible = false; return mesh;
  }
  function Particles(n, additive, parent) {
    const geo = new T.BufferGeometry(), pos = new Float32Array(n * 3), col = new Float32Array(n * 4), size = new Float32Array(n);
    geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('aCol', new T.BufferAttribute(col, 4)); geo.setAttribute('aSize', new T.BufferAttribute(size, 1));
    const mat = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: additive ? T.AdditiveBlending : T.NormalBlending, uniforms: { uScale: { value: 500 } },
      vertexShader: 'attribute float aSize; attribute vec4 aCol; varying vec4 vCol; uniform float uScale; void main(){ vCol=aCol; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=min(aSize*uScale/max(-mv.z,0.5),700.0); gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'varying vec4 vCol; void main(){ float d=length(gl_PointCoord-0.5)*2.0; float a=smoothstep(1.0,0.15,d); gl_FragColor=vec4(vCol.rgb,vCol.a*a);' + TAIL });
    const pts = new T.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = additive ? 12 : 10; parent.add(pts);
    const vel = new Float32Array(n * 3), life = new Float32Array(n), max = new Float32Array(n), s0 = new Float32Array(n), s1 = new Float32Array(n), c0 = new Float32Array(n * 4), drag = new Float32Array(n);
    let head = 0;
    return {
      pts, mat,
      emit(x, y, z, vx, vy, vz, lf, a, b, r, g, bl, al, dr) { const i = head; head = (head + 1) % n; pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz; life[i] = lf; max[i] = lf; s0[i] = a; s1[i] = b; c0[i * 4] = r; c0[i * 4 + 1] = g; c0[i * 4 + 2] = bl; c0[i * 4 + 3] = al; drag[i] = dr || 0; },
      update(dt, floorY) {
        for (let i = 0; i < n; i++) {
          if (life[i] <= 0) { size[i] = 0; continue; }
          life[i] -= dt; const t = 1 - life[i] / max[i], k = Math.exp(-drag[i] * dt);
          vel[i * 3] *= k; vel[i * 3 + 1] *= k; vel[i * 3 + 2] *= k;
          pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
          if (floorY !== undefined && pos[i * 3 + 1] < floorY) { pos[i * 3 + 1] = floorY; vel[i * 3 + 1] = Math.abs(vel[i * 3 + 1]) * 0.25; }
          size[i] = s0[i] + (s1[i] - s0[i]) * t;
          col[i * 4] = c0[i * 4]; col[i * 4 + 1] = c0[i * 4 + 1]; col[i * 4 + 2] = c0[i * 4 + 2]; col[i * 4 + 3] = c0[i * 4 + 3] * (1 - t) * Math.min(1, t * 8);
        }
        geo.attributes.position.needsUpdate = true; geo.attributes.aCol.needsUpdate = true; geo.attributes.aSize.needsUpdate = true;
      },
      clear() { life.fill(0); }
    };
  }
  function buildFx() {
    plB = plumeMesh(3.6, 13); plBc = plumeMesh(2.6, 5); boosterG.add(plB); boosterG.add(plBc);
    plS = plumeMesh(2.6, 9); plSc = plumeMesh(1.2, 2.6); shipG.add(plS); shipG.add(plSc);
    plFree = plumeMesh(2.4, 7); boosterFree.add(plFree);
    wake = plumeMesh(7, 26); near.add(wake); wake.material.uniforms.cA.value.set(1, 0.62, 0.42); wake.material.uniforms.cB.value.set(1, 0.3, 0.45);
    shellMat = new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
      uniforms: { uT: { value: 0 }, uHeat: { value: 0 }, uFlow: { value: V(1, 0, 0) } }, vertexShader: VERT,
      fragmentShader: HEAD + `uniform float uT; uniform float uHeat; uniform vec3 uFlow;
      void main(){ vec3 n=normalize(vP/vec3(8.5,30.0,11.5)); float f=max(dot(n,uFlow),0.0);
        float rim=pow(1.0-abs(dot(normalize(vNv),normalize(vVv))),1.6);
        float st=0.75+0.25*sin(dot(vP,uFlow)*0.9-uT*40.0+sin(vP.y*0.7+uT*9.0)*2.0);
        float a=uHeat*(0.42*pow(f,1.6)+0.9*rim*(0.04+f*f))*st;
        vec3 col=mix(vec3(1.0,0.3,0.05),vec3(1.0,0.42,0.62),clamp(uHeat*1.2-0.2,0.0,1.0)); col=mix(col,vec3(1.0,0.85,0.8),pow(f,3.0)*uHeat*0.6);
        gl_FragColor=vec4(col*a*1.25,a);` + TAIL
    });
    shell = new T.Mesh(new T.SphereGeometry(1, 32, 24), shellMat); shell.scale.set(8.5, 30, 11.5); shell.position.set(1.5, 24, 0); shell.visible = false; shipG.add(shell);
    pPad = Particles(700, false, padG); pShip = Particles(260, false, near); pFire = Particles(420, true, near);
    // satellites
    const busM = new T.MeshStandardMaterial({ color: 0xd9dde2, roughness: 0.5, metalness: 0.6, envMap: envSpace }), panM = new T.MeshStandardMaterial({ color: 0x2a4fb8, roughness: 0.35, metalness: 0.4, emissive: 0x1c3c9a, emissiveIntensity: 1.0, envMap: envSpace });
    const foilM = new T.MeshStandardMaterial({ color: 0xd8a640, roughness: 0.42, metalness: 0.9, envMap: envSpace, envMapIntensity: 1.2 });
    for (let i = 0; i < 3; i++) {
      const g = new T.Group(); const bus = new T.Mesh(new T.BoxGeometry(2.6, 3.2, 2.6), foilM); g.add(bus);
      const top = new T.Mesh(new T.BoxGeometry(2.7, 0.5, 2.7), busM); top.position.y = 1.7; g.add(top);
      const dish = new T.Mesh(new T.SphereGeometry(1.5, 20, 8, 0, 6.2832, 0, 1.05), busM); dish.rotation.x = Math.PI; dish.position.y = 3.5; g.add(dish);
      const wings = [];
      for (const sgn of [-1, 1]) { const w = new T.Group(); w.position.set(0, 0, sgn * 1.3); const pn = new T.Mesh(new T.BoxGeometry(0.08, 2.8, 9), panM); pn.position.z = sgn * 4.7; w.add(pn); const boom = new T.Mesh(new T.BoxGeometry(0.16, 0.16, 9.4), busM); boom.position.z = sgn * 4.7; w.add(boom); g.add(w); wings.push(w); }
      g.userData.wings = wings; g.scale.setScalar(2.2); g.visible = false; near.add(g); satPool.push(g);
    }
    // UFOs
    const up = [[0.01, -1.3], [2.2, -1.35], [5.2, -0.6], [7, 0], [5.2, 0.55], [2.7, 0.95], [2.3, 1.7], [1.3, 2.4], [0.01, 2.6]].map(p => new T.Vector2(p[0], p[1]));
    const ug = new T.LatheGeometry(up, 28), rg = new T.TorusGeometry(5.3, 0.22, 8, 36);
    for (let i = 0; i < 4; i++) { const g = new T.Group(); const m = new T.Mesh(ug, new T.MeshStandardMaterial({ color: 0x5c6470, roughness: 0.3, metalness: 1, envMap: envSpace, envMapIntensity: 1.3 })); g.add(m);
      const rm = new T.MeshBasicMaterial({ color: 0x66ffd0 }); const r = new T.Mesh(rg, rm); r.rotation.x = Math.PI / 2; r.position.y = -0.45; g.add(r); g.userData.ring = rm; g.visible = false; near.add(g); ufoPool.push(g); }
    laser = new T.Mesh(new T.CylinderGeometry(0.16, 0.16, 1, 6, 1, true), new T.MeshBasicMaterial({ color: 0x8dffe0, transparent: true, blending: T.AdditiveBlending, depthWrite: false })); laser.visible = false; laser.frustumCulled = false; near.add(laser);
    const dn = 500, dp = new Float32Array(dn * 3); for (let i = 0; i < dn * 3; i++) dp[i] = (TEX.rnd() - 0.5);
    const dg = new T.BufferGeometry(); dg.setAttribute('position', new T.BufferAttribute(dp, 3));
    debrisPts = new T.Points(dg, new T.PointsMaterial({ color: 0xd8dce4, size: 2.2, sizeAttenuation: false, transparent: true, fog: false })); debrisPts.visible = false; debrisPts.frustumCulled = false; near.add(debrisPts);
    // tumbling chunks for the two hazards: sheet-metal junk and rocks (drawn oversize so they read at a distance)
    const CN = 150;
    junkIM = new T.InstancedMesh(new T.BoxGeometry(1, 0.12, 0.7), new T.MeshStandardMaterial({ color: 0xc9ced6, roughness: 0.3, metalness: 1, envMap: envSpace, envMapIntensity: 1.4, emissive: 0x6c747e }), CN);
    rockIM = new T.InstancedMesh(new T.DodecahedronGeometry(0.6, 0), new T.MeshStandardMaterial({ color: 0x5e4f41, roughness: 1, metalness: 0, flatShading: true, emissive: 0x15110d }), CN);
    for (const m of [junkIM, rockIM]) { m.visible = false; m.frustumCulled = false; near.add(m); }
    for (let i = 0; i < CN; i++) chunkSeed.push([TEX.rnd() - 0.5, TEX.rnd() - 0.5, TEX.rnd() - 0.5, TEX.rnd() * 6.28, TEX.rnd() * 6.28, 0.4 + TEX.rnd() * 1.6, 14 + TEX.rnd() * TEX.rnd() * 70]);
  }
  function setPlume(m, on, len, rad, pow, vac, time, cA, cB, gain) {
    m.visible = on; if (!on) return; m.scale.set(rad, len, rad);
    const u = m.material.uniforms; u.uT.value = time; u.uPow.value = pow; u.uVac.value = vac; u.uGain.value = gain || 1;
    if (cA) { u.cA.value.setRGB(cA[0], cA[1], cA[2]); u.cB.value.setRGB(cB[0], cB[1], cB[2]); }
  }

  // ------------------------------- update -------------------------------
  // S: sim state. g: game extras {ignite, arms, booster, sats, ufos, laser, debris, exploded, mapAmb}
  function update(S, g, dt, wdt) {
    st.time += wdt;
    const E = S.eff || { dF: 0.5, dA: 0.5, gim: 0, gimZ: 0 };
    const r = Math.hypot(S.x, S.y), phi = Math.atan2(S.x, S.y), h = r - RE; st.phi = phi; st.r = r;
    qPhi.setFromAxisAngle(ZAX, phi);
    inertial.quaternion.copy(qPhi); inertial.position.set(0, -r / 1000, -S.z / 1000);
    // Earth's spin is shown by turning the sky (sun and stars) against the ground-fixed flight frame
    qE.setFromAxisAngle(ZAX, g.rotE || 0); qS.copy(qPhi).multiply(qE);
    sunW.copy(sunI).applyQuaternion(qS);
    st.cloud += dt * 4e-6; earthMat.uniforms.cloudShift.value = st.cloud;
    // sunlight: is the vehicle in Earth's shadow?
    const dSun = sunW.y, dip = Math.sqrt(Math.max(0, 1 - (RE / r) * (RE / r)));
    st.sunVis = TEX.sstep(-dip - 0.03, -dip + 0.05, dSun);
    const low = 1 - TEX.sstep(-dip + 0.02, -dip + 0.32, dSun);
    sunLight.position.copy(sunW).multiplyScalar(1000); sunLight.intensity = 2.5 * st.sunVis;
    sunLight.color.setRGB(1, 0.96 - 0.3 * low, 0.9 - 0.55 * low);
    const dayG = TEX.sstep(-0.1, 0.25, dSun);
    hemi.intensity = 0.18 + 0.6 * dayG; amb.intensity = 0.35 + 0.2 * dayG;
    st.skyK = Math.exp(-Math.max(h, 0) / 9500) * (0.08 + 0.92 * dayG);
    // pad + site
    padG.position.set(-S.x, RE - S.y, -S.z).applyQuaternion(qPhi); padG.quaternion.copy(qPhi);
    const padDist = padG.position.length(); padG.visible = padDist < 450e3;
    const fadeHi = 1 - TEX.sstep(50e3, 160e3, padDist);
    padG.userData.layers.forEach((m, i) => { m.material.opacity = i === 0 ? fadeHi : 1; });
    // vehicle attitude
    const cp = Math.cos(S.pit), sp = Math.sin(S.pit), cy = Math.cos(S.yawT), sy = Math.sin(S.yawT);
    const nose = V(sp * cy, cp * cy, sy), belly = V(cp, -sp, 0);
    const z3 = V(0, 0, 0).crossVectors(belly, nose);
    if (S.bankVis) { const a = S.bankVis * 0.45; const b2 = belly.clone().multiplyScalar(Math.cos(a)).addScaledVector(z3, Math.sin(a)); z3.crossVectors(b2, nose); belly.copy(b2); }
    tmpM.makeBasis(belly, nose, z3); vehicle.quaternion.setFromRotationMatrix(tmpM);
    vehicle.visible = !g.exploded;
    const stacked = S.stage === 0;
    boosterG.visible = stacked; shipG.position.y = stacked ? 72.8 : 0;
    const env = h > 45e3 ? envSpace : envGround;
    if (shipMat.envMap !== env) { shipMat.envMap = env; boosterMat.envMap = env; shipG.userData.steelM.envMap = env; flaps.forEach(f => { f.hinge.children[0].children[1].material.envMap = env; }); }
    // plumes
    const vac = TEX.sstep(8e3, 70e3, h), ign = g.ignite || 0;
    const bOn = stacked && (S.thrust > 0 || ign > 0) && !g.exploded, bp = S.phase === 'PRE' ? ign * 0.7 : Math.max(0.3, S.thr);
    setPlume(plB, bOn, TEX.mix(150, 420, vac) * (0.5 + 0.5 * bp), TEX.mix(1, 5.5, vac), bp, vac, st.time, [1, 0.93, 0.8], [TEX.mix(1, 0.55, vac), TEX.mix(0.5, 0.45, vac), TEX.mix(0.14, 0.9, vac)], 1);
    setPlume(plBc, bOn, TEX.mix(110, 200, vac) * bp, 1, bp, vac * 0.5, st.time + 3, [1, 1, 0.95], [1, 0.75, 0.4], 1.2);
    boosterG.userData.glow.opacity = bOn ? 0.9 : 0;
    const sOn = !stacked && S.thrust > 0 && !g.exploded;
    const mode = S.phase === 'ORBIT' ? 0 : S.phase === 'LAND' ? 1 : 2;
    const sp2 = Math.max(0.25, S.thr);
    if (mode === 2) { setPlume(plS, sOn, TEX.mix(80, 260, vac) * (0.5 + 0.5 * sp2), TEX.mix(1, 5, vac), sp2, vac, st.time, [1, 0.93, 0.82], [TEX.mix(1, 0.5, vac), TEX.mix(0.5, 0.45, vac), TEX.mix(0.15, 0.95, vac)], 1); setPlume(plSc, sOn, 70 * sp2, 1.6, sp2, vac * 0.5, st.time + 2, [1, 1, 0.95], [1, 0.7, 0.4], 1.2); }
    else if (mode === 0) { setPlume(plS, sOn, 60 * (0.5 + 0.5 * sp2), 1.6, sp2 * 0.7, 1, st.time, [0.85, 0.9, 1], [0.45, 0.5, 1], 0.8); setPlume(plSc, sOn, 16, 0.7, sp2, 0.6, st.time, [1, 1, 1], [0.7, 0.8, 1], 1); }
    else { setPlume(plS, sOn, 34 + 30 * sp2, 0.55, sp2, 0, st.time, [1, 0.95, 0.85], [1, 0.5, 0.15], 1.3); setPlume(plSc, sOn, 30 * sp2 + 8, 0.9, sp2, 0, st.time + 1, [1, 1, 0.95], [1, 0.8, 0.5], 1.4); }
    shipG.userData.glowM.opacity = sOn ? 0.9 : 0;
    plS.rotation.z = plSc.rotation.z = E.gim * 1.6; plS.rotation.x = plSc.rotation.x = -E.gimZ * 1.6;   // gimbal swing, exaggerated a little
    const thrN = (S.thrust || 0) / 75e6 + (S.phase === 'PRE' ? ign * 0.6 : 0);
    engLight.intensity = Math.min(9, thrN * 9 + (sOn && mode === 1 ? 3 : 0)); engLight.position.set(0, -12, 0).applyQuaternion(vehicle.quaternion);
    // re-entry heating
    const heat = S.phase === 'ENTRY' || S.phase === 'ORBIT' ? TEX.sstep(800, 1650, S.heat || 0) : 0; st.heat = heat;
    shell.visible = heat > 0.01 && !g.exploded; wake.visible = shell.visible;
    const glowK = TEX.sstep(900, 1750, S.temp);
    shipMat.emissiveIntensity = glowK * 1.3; flaps.forEach(f => { f.tm.emissiveIntensity = glowK * 1.6; });
    if (shell.visible) {
      const vv = Math.max(S.spd, 1), fl = V(S.vh / vv, S.vr / vv, S.vz / vv);
      tq.copy(vehicle.quaternion).invert(); shellMat.uniforms.uFlow.value.copy(fl).applyQuaternion(tq);
      shellMat.uniforms.uHeat.value = heat; shellMat.uniforms.uT.value = st.time;
      wake.position.copy(nose).multiplyScalar(22); wake.quaternion.setFromUnitVectors(YAX, fl);
      setPlume(wake, true, 260 + 240 * heat, 1 + heat * 0.6, heat * 0.85, 0.7, st.time);
    }
    // flaps (cosmetic): tucked on ascent, working during entry, aft folded for the flip
    const ent = S.phase === 'ENTRY', lnd = S.phase === 'LAND';
    const bk = (S.bankVis || 0) * 0.3;
    flaps.forEach((f, i) => { const isFore = i < 2; let d = ent || lnd ? 1.15 - 0.95 * (isFore ? E.dF : E.dA) + (ent ? f.sign * bk : 0) : 0.08; d = Math.max(0, Math.min(1.35, d)); f.cur = f.cur === undefined ? d : f.cur + (d - f.cur) * Math.min(1, wdt * 3); f.hinge.rotation.y = -f.sign * f.cur; });
    // tower arms + QD
    const a = g.arms || 0; towerArms.forEach(t => { t.piv.rotation.y = t.s * (1 - a) * 0.62; });
    qdArm.rotation.y = S.phase === 'PRE' && ign < 0.5 ? 0 : -1.25;
    // booster after separation, satellites, ufos, laser, debris
    boosterFree.visible = !!g.booster;
    if (g.booster) { const b = g.booster; boosterFree.position.set(b.x, b.y, b.z); boosterFree.quaternion.copy(b.q); setPlume(plFree, b.burn > 0, 90, 1, b.burn, 1, st.time, [1, 0.9, 0.8], [0.6, 0.5, 1], 1); }
    satPool.forEach((m, i) => { const s = g.sats && g.sats[i]; m.visible = !!s; if (s) { m.position.set(s.x, s.y, s.z); m.quaternion.copy(vehicle.quaternion); m.rotateZ(1.1); m.rotateY(s.spin || 0); const k = Math.max(0.04, s.pan || 0); m.userData.wings.forEach(w => { w.scale.z = k; }); } });
    ufoPool.forEach((m, i) => { const u = g.ufos && g.ufos[i]; m.visible = !!(u && u.alive); if (m.visible) { m.position.set(u.x, u.y, u.z); m.rotation.y = st.time * 1.5 + i; m.rotation.z = Math.sin(st.time * 0.8 + i) * 0.15; const c = u.charge > 0 ? 1 : 0, hit = u.hitT > 0 ? 1 : 0; m.userData.ring.color.setRGB(hit ? 1 : c ? 1 : 0.4, hit ? 1 : c ? 0.15 + 0.3 * Math.sin(st.time * 30) : 1, hit ? 1 : c ? 0.1 : 0.82); } });
    laser.visible = !!(g.laser && g.laser.t > 0);
    if (laser.visible) { const l = g.laser, a0 = V(l.ax, l.ay, l.az), b0 = V(l.bx, l.by, l.bz), d = b0.clone().sub(a0), len = d.length(); laser.position.copy(a0).addScaledVector(d, 0.5); laser.scale.set(1, len, 1); laser.quaternion.setFromUnitVectors(YAX, d.normalize()); laser.material.color.setHex(l.enemy ? 0xff5a4a : 0x8dffe0); laser.material.opacity = Math.min(1, l.t * 8); }
    const db = g.debris && g.debris.show ? g.debris : null;
    debrisPts.visible = !!db; junkIM.visible = !!db && db.kind !== 'rock'; rockIM.visible = !!db && db.kind === 'rock';
    if (db) {
      const sx = 2800, sy = db.thick, sz = 1000, im = db.kind === 'rock' ? rockIM : junkIM;
      debrisPts.position.set(db.dx, db.dy, 0); debrisPts.scale.set(sx, sy, sz);
      for (let i = 0; i < chunkSeed.length; i++) { const c = chunkSeed[i]; tv.set(db.dx + c[0] * sx, db.dy + c[1] * sy, c[2] * sz); tq.setFromAxisAngle(tv2.set(Math.cos(c[3]), Math.sin(c[3]) * Math.cos(c[4]), Math.sin(c[3]) * Math.sin(c[4])), st.time * c[5]); tmpM.compose(tv, tq, tv2.set(c[6] * 0.16, c[6] * 0.16, c[6] * 0.16)); im.setMatrixAt(i, tmpM); }
      im.instanceMatrix.needsUpdate = true;
    }
    // particles
    pPad.mat.uniforms.uScale.value = pShip.mat.uniforms.uScale.value = pFire.mat.uniforms.uScale.value = H * renderer.getPixelRatio() / (2 * Math.tan(camN.fov * D2R / 2));
    pPad.update(dt, 0.5); pShip.update(dt); pFire.update(dt);
  }

  // ------------------------------- camera -------------------------------
  function placeCamera(S, g, wdt) {
    const stacked = S.stage === 0, view = cam.view;
    let fov = 50;
    if (view === 'MAP') {
      const d = cam.mapDist, ce = Math.cos(cam.mapEl), p = tv.set(Math.sin(cam.mapAz) * ce * d, Math.sin(cam.mapEl) * d, Math.cos(cam.mapAz) * ce * d);
      p.applyQuaternion(qS).add(inertial.position);   // the map camera sits still among the stars; Earth turns below it
      camF.position.copy(p); camF.up.set(0, 1, 0).applyQuaternion(qS); camF.lookAt(inertial.position);
      camF.fov = 42; camF.near = 50; camF.far = 3e6; camF.updateProjectionMatrix(); camF.updateMatrixWorld();
      return;
    }
    const centerY = stacked ? 60 : 24;
    const center = V(0, centerY, 0).applyQuaternion(vehicle.quaternion);
    camN.up.set(0, 1, 0);
    if (view === 'EXT') {
      const ce = Math.cos(cam.el), d = cam.dist;
      camN.position.set(center.x + Math.sin(cam.az) * ce * d, center.y + Math.sin(cam.el) * d, center.z + Math.cos(cam.az) * ce * d);
      // keep the camera above ground near the pad
      const gy = padG.visible ? padG.position.y + 3 : -1e9; if (camN.position.y < gy && Math.abs(st.phi) < 0.1) camN.position.y = gy;
      camN.lookAt(center);
      if (cam.offX) camN.translateX(-cam.offX * d * Math.tan(cam.fov * D2R / 2) * camN.aspect);
    } else if (view === 'TOWER') {
      camN.position.copy(V(150, 16, 115).applyQuaternion(padG.quaternion).add(padG.position));
      camN.up.set(0, 1, 0).applyQuaternion(padG.quaternion);
      camN.lookAt(center); const d = camN.position.distanceTo(center); fov = Math.max(0.7, Math.min(55, 2 * Math.atan(95 / d) / D2R));
    } else {
      const base = stacked ? 72.8 : 0;
      let p, l, u;
      if (view === 'SAT') { const t = g.satCam || { x: -20, y: 0, z: 0 }; p = V(-7.6, 46.5, 5.2); l = V(t.x, t.y, t.z); u = V(-1, 0.2, 0); fov = 64; }
      else if (view === 'FLAP') { p = V(-5.4, base + 42.5, 3.6); l = V(-0.6, base + 2, 9.2); u = V(-0.9, 0.3, 0.3); fov = 68; }
      else if (view === 'ENG') { p = V(-8.6, base + 4.5, -4.2); l = V(1.5, base - 38, 2); u = V(-1, 0, 0); fov = 72; }
      else { p = V(-5.2, base + 41, 0); l = V(-1.5, base + 140, 0); u = V(-1, 0, 0); fov = 64; }
      camN.position.copy(p.applyQuaternion(vehicle.quaternion)); camN.up.copy(u.applyQuaternion(vehicle.quaternion)); camN.lookAt(l.applyQuaternion(vehicle.quaternion));
    }
    if (cam.shake > 0.001) { const s = cam.shake, sp = (view === 'EXT' || view === 'TOWER') ? s * Math.min(1.5, cam.dist / 200) : s * 0.03; camN.position.x += (Math.random() - 0.5) * sp; camN.position.y += (Math.random() - 0.5) * sp; camN.rotateZ((Math.random() - 0.5) * s * 0.004); camN.rotateX((Math.random() - 0.5) * s * 0.004); }
    cam.fov += (fov - cam.fov) * Math.min(1, wdt * 6);
    camN.fov = cam.fov; const dC = camN.position.length();
    camN.near = Math.max(0.3, Math.min(40, dC * 0.02)); camN.far = 6e5; camN.updateProjectionMatrix(); camN.updateMatrixWorld();
    camF.position.copy(camN.position).multiplyScalar(0.001); camF.quaternion.copy(camN.quaternion); camF.fov = cam.fov; camF.near = 0.4; camF.far = 3e6; camF.updateProjectionMatrix(); camF.updateMatrixWorld();
  }
  function render(S, g, wdt) {
    placeCamera(S, g, wdt);
    const map = cam.view === 'MAP';
    earthMat.uniforms.amb.value = map ? 0.92 : 0;
    const camAlt = map ? 1e9 : (S.h || 0);
    const k = map ? 0 : st.skyK;
    renderer.setClearColor(clearC.setRGB(0.27 * k, 0.5 * k, 0.86 * k), 1);
    near.fog.color.setRGB(0.62 * k + 0.02, 0.76 * k + 0.02, 0.9 * k + 0.03); near.fog.density = 0.000022 * Math.exp(-Math.max(camAlt, 0) / 6500);
    atmoMat.uniforms.k.value = map ? 1 : TEX.sstep(12e3, 90e3, camAlt) * 0.45 + 0.55;
    stars.position.copy(camF.position); stars.quaternion.copy(qS); stars.material.opacity = Math.max(0, 1 - k * 2.2);
    sunSprite.position.copy(camF.position).addScaledVector(sunW, 8e5); sunSprite.material.opacity = 1;
    renderer.clear();
    renderer.render(far, camF);
    if (!map) { renderer.clearDepth(); renderer.render(near, camN); }
  }

  // --------------------------- helpers for the HUD ---------------------------
  // inertial metres (earth-centred flight plane) → screen px; hidden when behind Earth
  function projectInertial(x, y, z, out) {
    tv.set(x / 1000, y / 1000, (z || 0) / 1000);
    const cI = tv2.copy(camF.position).sub(inertial.position).applyQuaternion(tq.copy(qPhi).invert());
    // ray camera→point against the sphere
    const dx = tv.x - cI.x, dy = tv.y - cI.y, dz = tv.z - cI.z, dl = Math.hypot(dx, dy, dz), ux = dx / dl, uy = dy / dl, uz = dz / dl;
    const b = cI.x * ux + cI.y * uy + cI.z * uz, c = cI.lengthSq() - 6371 * 6371, disc = b * b - c;
    let hid = false; if (disc > 0) { const t0 = -b - Math.sqrt(disc); if (t0 > 0 && t0 < dl - 1) hid = true; }
    tv.applyQuaternion(qPhi).add(inertial.position).project(camF);
    out.x = (tv.x * 0.5 + 0.5) * W; out.y = (-tv.y * 0.5 + 0.5) * H; out.vis = !hid && tv.z < 1 && tv.z > -1; return out;
  }
  function projectLocal(x, y, z, out) { tv.set(x, y, z).project(camN); out.x = (tv.x * 0.5 + 0.5) * W; out.y = (-tv.y * 0.5 + 0.5) * H; out.vis = tv.z < 1 && tv.z > -1; return out; }
  function padLocal(x, y, z, out) { tv.set(x, y, z).applyQuaternion(padG.quaternion).add(padG.position); out.x = tv.x; out.y = tv.y; out.z = tv.z; return out; }
  function shipPoint(x, y, z, out) { tv.set(x, y + (boosterG.visible ? 72.8 : 0), z).applyQuaternion(vehicle.quaternion); out.x = tv.x; out.y = tv.y; out.z = tv.z; return out; }
  function explode(x, y, z, big) {
    const n = big ? 160 : 40;
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, u = Math.random() * 2 - 1, s = Math.sqrt(1 - u * u), sp = (big ? 30 : 12) + Math.random() * (big ? 110 : 40);
      pFire.emit(x, y, z, Math.cos(a) * s * sp, u * sp + (big ? 20 : 0), Math.sin(a) * s * sp, 0.8 + Math.random() * (big ? 2.6 : 1), big ? 14 : 4, big ? 60 : 12, 1, 0.55 + Math.random() * 0.4, 0.2, 0.9, 1.2); }
    if (big) for (let i = 0; i < 60; i++) { const a = Math.random() * 6.283, sp = 10 + Math.random() * 50; pShip.emit(x, y, z, Math.cos(a) * sp, Math.random() * 40, Math.sin(a) * sp, 4 + Math.random() * 5, 20, 120, 0.16, 0.15, 0.15, 0.7, 0.6); }
  }
  return { init, resize, update, render, cam, st, projectInertial, projectLocal, padLocal, shipPoint, explode,
    get pPad() { return pPad; }, get pShip() { return pShip; }, get pFire() { return pFire; }, get size() { return { W, H }; }, get renderer() { return renderer; }, get vq() { return vehicle.quaternion; }, sunW };
})();
