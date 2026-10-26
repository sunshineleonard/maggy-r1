import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// R1 build: plain files served from GitHub Pages, so assets load normally (no artifact sandbox here)
const ASSETS = { maggy: "assets/maggy.glb", bg: "assets/far-dusk.jpg", wings: "assets/wings.webp" };

// ---------------- moods, clips, lines ----------------
const MOODS = {
  content:   { label: "Content",   color: "#ffb547", glow: .55, clips: ["Idle", "Happy_Idle", "Look_Around", "1_hand_Looking_w_turn", "Neck_Stretching", "Thinking", "Sitting_Idle"],
               lines: ["Porch-sittin' weather.", "I'm just fine in here. Mostly.", "Ain't this nice."] },
  wants:     { label: "Wants you", color: "#5aa9ff", glow: .6,  clips: ["Waving", "Waving_2_hands", "Um_Helloooo_Knock", "Hey_Sugar"],
               lines: ["Hey. Hey you. Over here.", "Ummm, helloooo?", "You forget about me, darlin'?"] },
  delighted: { label: "Delighted", color: "#b6f25a", glow: .95, clips: ["Happy", "Macarena_Dance"],
               lines: ["Well hey there!", "There you are!", "Now that's what I'm talkin' about!"] },
  sassy:     { label: "Sassy",     color: "#ff6fb5", glow: .7,  clips: ["Shrugging", "No", "Shaking_Head_No"],
               lines: ["Well, bless your heart.", "Don't you sugar me.", "I could fix your schedule. I won't. But I could."] },
  annoyed:   { label: "Annoyed",   color: "#ff4d3d", glow: .85, clips: ["Angry", "Annoyed_Head_Shake", "Sad_Idle"],
               lines: ["Quit tappin' the glass!", "Do I look like a snow globe to you?", "Keep it up, see what happens."] },
  sleepy:    { label: "Sleepy",    color: "#b9a2ff", glow: .28, clips: ["Hammock_pose"],
               lines: ["Mm... five more minutes.", "Wake me if the porch catches fire."] },
};
const LIGHT = {
  day:   { label: "Day",   bg: [1.25, 1.2, 1.12], hemi: 1.25, k: .55, flies: 6 },
  dusk:  { label: "Dusk",  bg: [1, 1, 1], hemi: .95,  k: .85, flies: 18 },
  night: { label: "Night", bg: [.06, .09, .28], hemi: .45,  k: 1.0, flies: 40 },
};
const $ = id => document.getElementById(id);
const root = document.documentElement, stage = $("stage"), canvas = $("c"), say = $("say");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------------- renderer, camera, scene ----------------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
let pixelRatio = Math.min(1.5, devicePixelRatio || 1);   // R1 screen is 2x; 1.5 keeps it sharp and fast, drops to 1 if fps sags
renderer.setPixelRatio(pixelRatio);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 3 / 4, .05, 60);
// two framings: CLOSE while she's up and about (she fills most of the R1 screen), WIDE when the hammock is out
const CLOSE = { dist: +(new URLSearchParams(location.search).get("cd") || 3.05), y: +(new URLSearchParams(location.search).get("cy") || 1.1) };
const WIDE = { dist: 3.85, y: 1.3 };
const LOOK = new THREE.Vector3(0, CLOSE.y, 0); let CAM_DIST = CLOSE.dist, zoomOut = 0, lookCloseY = CLOSE.y, headStand = 1.85; const vHead = new THREE.Vector3();

const hemi = new THREE.HemisphereLight(0xffe2c2, 0x2a1820, .95); scene.add(hemi);
const key = new THREE.DirectionalLight(0xffd2a0, 1.5); key.position.set(-1.5, 3, 3); scene.add(key);
const rim = new THREE.DirectionalLight(0x8fa8ff, .7); rim.position.set(2, 2.5, -2.5); scene.add(rim);
const moodLight = new THREE.PointLight(0xffb547, 1, 3.2, 1.6); moodLight.position.set(0, 1.1, .7); scene.add(moodLight);

const texLoader = new THREE.TextureLoader();
const tex = uri => new Promise((res, rej) => texLoader.load(uri, t => { t.colorSpace = THREE.SRGBColorSpace; res(t); }, undefined, rej));
const glbLoader = new GLTFLoader();
const loadGLB = url => new Promise((res, rej) => glbLoader.load(url, res, p => {
  if (p.total) $("loading").textContent = "Waking Maggy up… " + Math.round(p.loaded / p.total * 100) + "%"; }, rej));
function radialTexture(inner = "rgba(255,255,255,1)", mid = "rgba(255,255,255,.35)") {
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, inner); gr.addColorStop(.35, mid); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------------- the jar ----------------
const JAR_R = 1.15, JAR_FLOOR = .09;
const jar = new THREE.Group(); scene.add(jar);
const profile = [[0, 0], [1.02, 0], [1.13, .06], [JAR_R, .2], [JAR_R, 2.32], [1.1, 2.48], [.97, 2.58], [.92, 2.64], [.92, 2.86]].map(([r, y]) => new THREE.Vector2(r, y));
const glassMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, side: THREE.DoubleSide,
  uniforms: { tint: { value: new THREE.Color(0xdfeeff) }, base: { value: .035 }, edge: { value: .55 } },
  vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vWN;
    void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
      vWN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform vec3 tint; uniform float base; uniform float edge; varying vec3 vN; varying vec3 vV; varying vec3 vWN;
    void main(){ float f = 1. - abs(dot(normalize(vN), normalize(vV)));
      float streak = pow(max(dot(normalize(vWN), normalize(vec3(-.75,.15,.65))), 0.), 60.) * .75
                   + pow(max(dot(normalize(vWN), normalize(vec3(.8,.1,.6))), 0.), 120.) * .35;
      float a = base + pow(f, 3.) * edge + streak; gl_FragColor = vec4(tint + streak, clamp(a, 0., .9)); }`,
});
const glass = new THREE.Mesh(new THREE.LatheGeometry(profile, 64), glassMat); glass.renderOrder = 10; jar.add(glass);
for (const y of [2.68, 2.75]) {                                  // glass threads under the lid
  const t = new THREE.Mesh(new THREE.TorusGeometry(.93, .012, 6, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .18, depthWrite: false }));
  t.rotation.x = Math.PI / 2; t.position.y = y; t.renderOrder = 11; jar.add(t);
}
const rust = new THREE.MeshStandardMaterial({ color: 0x8a4f2a, roughness: .78, metalness: .45 });
const lid = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, .26, 64, 1, true), rust); lid.position.y = 2.93; jar.add(lid);
const lidTop = new THREE.Mesh(new THREE.CircleGeometry(1.0, 64), new THREE.MeshStandardMaterial({ color: 0x3b2416, roughness: .9, metalness: .3, side: THREE.DoubleSide }));
lidTop.rotation.x = Math.PI / 2; lidTop.position.y = 2.8; jar.add(lidTop);
for (const y of [2.84, 2.93, 3.02]) { const r = new THREE.Mesh(new THREE.TorusGeometry(1.0, .018, 6, 64), rust); r.rotation.x = Math.PI / 2; r.position.y = y; jar.add(r); }
const base = new THREE.Mesh(new THREE.CylinderGeometry(1.02, 1.02, JAR_FLOOR, 64), new THREE.MeshStandardMaterial({ color: 0xcfe3ee, roughness: .15, metalness: 0, transparent: true, opacity: .28 }));
base.position.y = JAR_FLOOR / 2; jar.add(base);
function plankTexture() {
  const c = document.createElement("canvas"); c.width = 512; c.height = 512; const g = c.getContext("2d");
  for (let i = 0; i < 8; i++) { const v = 70 + (i * 37) % 30; g.fillStyle = `rgb(${v + 38},${v + 12},${v - 18})`; g.fillRect(0, i * 64, 512, 64);
    g.fillStyle = "rgba(0,0,0,.55)"; g.fillRect(0, i * 64, 512, 3);
    g.strokeStyle = "rgba(40,20,8,.25)"; for (let k = 0; k < 6; k++) { g.beginPath(); const y = i * 64 + 8 + k * 9; g.moveTo(0, y);
      for (let x = 0; x <= 512; x += 32) g.lineTo(x, y + Math.sin(x * .02 + i + k) * 2); g.stroke(); }
    g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect((i * 173) % 512, i * 64, 3, 64); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); return t;
}
const porch = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshStandardMaterial({ map: plankTexture(), roughness: .9 }));
porch.rotation.x = -Math.PI / 2; porch.rotation.z = .08; porch.position.set(0, -.001, -1.5); scene.add(porch);
const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.5, 48), new THREE.MeshBasicMaterial({ map: radialTexture("rgba(0,0,0,.7)", "rgba(0,0,0,.35)"), transparent: true, depthWrite: false }));
shadow.rotation.x = -Math.PI / 2; shadow.position.y = .003; scene.add(shadow);
const pool = new THREE.Mesh(new THREE.CircleGeometry(1.9, 48), new THREE.MeshBasicMaterial({ map: radialTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffb547 }));
pool.rotation.x = -Math.PI / 2; pool.position.y = .004; scene.add(pool);

// ---------------- backdrop, fireflies ----------------
let bgMat;
const flyGeo = new THREE.BufferGeometry(); const NF = 40; const flyBase = [];
for (let i = 0; i < NF; i++) flyBase.push([(Math.random() - .5) * 9, .2 + Math.random() * 4, -1.8 - Math.random() * 4.5, Math.random() * 6.28, .4 + Math.random()]);
flyGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(NF * 3), 3));
const flies = new THREE.Points(flyGeo, new THREE.PointsMaterial({ size: .16, map: radialTexture("rgba(255,250,170,1)", "rgba(210,255,90,.45)"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xfff6a8 }));
scene.add(flies);

// ---------------- hammock (striped porch canvas) ----------------
const HAM_Y = 1.62, HAM_LEN = 1.9, HAM_W = .66, HAM_SAG = .26;
function hammockTexture() {
  const c = document.createElement("canvas"); c.width = 256; c.height = 64; const g = c.getContext("2d");
  const cols = ["#efe3cc", "#b5532f", "#efe3cc", "#3f6d8c", "#efe3cc", "#d9a441"];
  for (let i = 0; i < 16; i++) { g.fillStyle = cols[i % cols.length]; g.fillRect(i * 16, 0, 16, 64); }
  g.globalAlpha = .12; g.fillStyle = "#000"; for (let y = 0; y < 64; y += 3) g.fillRect(0, y, 256, 1);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const hammock = new THREE.Group(); hammock.position.y = HAM_Y; scene.add(hammock);
{
  const SU = 40, SV = 8, pos = [], uv = [], idx = [];
  for (let i = 0; i <= SU; i++) for (let j = 0; j <= SV; j++) {
    const u = i / SU, v = j / SV, x = (u - .5) * HAM_LEN, s = 1 - Math.pow(2 * u - 1, 2), w = (v - .5) * HAM_W * (.35 + .65 * Math.sqrt(s));
    pos.push(x, -HAM_SAG * s + Math.pow((v - .5) * 2, 2) * .1 * s, w); uv.push(v, u);
  }
  for (let i = 0; i < SU; i++) for (let j = 0; j < SV; j++) { const a = i * (SV + 1) + j, b = a + SV + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  const hTex = hammockTexture();   // emissive copy keeps the stripes readable from underneath
  const cloth = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: hTex, emissiveMap: hTex, emissive: 0xffffff, emissiveIntensity: .45, roughness: .95, side: THREE.DoubleSide, transparent: true }));
  hammock.add(cloth);
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0xcdb48a, roughness: 1, transparent: true });
  for (const sx of [-1, 1]) {
    const from = new THREE.Vector3(sx * HAM_LEN / 2, 0, 0), to = new THREE.Vector3(sx * (JAR_R - .04), .45, 0);
    const len = from.distanceTo(to); const rope = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, len, 6), ropeMat);
    rope.position.copy(from).add(to).multiplyScalar(.5); rope.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
    hammock.add(rope);
  }
}
hammock.visible = false;
const setHammockOpacity = a => hammock.traverse(o => { if (o.material) { o.material.opacity = a; } });

// ---------------- Maggy ----------------
let mixer, maggy, H = 1.5, hipsBone, spineBone, headBone, upAxis = 1, hipsTrack = null;
const maggyRoot = new THREE.Group(); scene.add(maggyRoot);
const clips = {}, actions = {};
let floorY = JAR_FLOOR;
// in the hammock: turn her a quarter so she lies along it, then tip her back so she rests in the cloth
const HEAD_UP_DEG = 0;                                  // + raises her head end, - raises her feet end
let LIE_BACK = THREE.MathUtils.degToRad(62);          // replaced at load by a measured value that lays her flat
const SLEEP_Q = new THREE.Quaternion();
const legRest = [];                                      // leg bones + their straight (bind) rotation, used to straighten her legs in the hammock
let legStraight = 0;
function straightenLegs(w) { if (w <= 0) return; for (const [b, q] of legRest) b.quaternion.slerp(q, w); }
const hammockRootPos = new THREE.Vector3(), X_AXIS = new THREE.Vector3(1, 0, 0), qRock = new THREE.Quaternion();

// wings: two planes cut from the wing art, hinged at the spine
const wingRig = new THREE.Group(); scene.add(wingRig);
const wingL = new THREE.Group(), wingR = new THREE.Group(); wingRig.add(wingL, wingR);
const wingMats = [];
const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffb547 }));
scene.add(glowSprite);
const zTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
  g.font = "bold 44px Kalam, cursive"; g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("z", 32, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const zs = [];

async function build() {
  const [gltf, bgTex, wingTex] = await Promise.all([loadGLB(ASSETS.maggy), tex(ASSETS.bg), tex(ASSETS.wings)]);
  // backdrop plane far behind the jar
  bgMat = new THREE.MeshBasicMaterial({ map: bgTex, color: 0xffffff });
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(17.5, 9.8), bgMat); bg.position.set(.8, 2.6, -8.5); scene.add(bg);

  maggy = gltf.scene; maggyRoot.add(maggy);
  maggy.traverse(o => {
    if (o.isMesh) { o.frustumCulled = false; if (o.material) { o.material.side = THREE.FrontSide; } }
    if (o.isBone) { if (/Hips$/.test(o.name) && !hipsBone) hipsBone = o; if (/Spine2$/.test(o.name)) spineBone = o; if (/Head$/.test(o.name)) headBone = o; }
  });
  hipsTrack = hipsBone ? hipsBone.name + ".position" : null;
  maggy.traverse(o => { if (o.isBone && /(UpLeg|Leg|Foot|ToeBase)$/.test(o.name)) legRest.push([o, o.quaternion.clone()]); });
  for (const c of gltf.animations) clips[c.name] = c;
  mixer = new THREE.AnimationMixer(maggy);
  maggy.updateMatrixWorld(true);
  if (hipsBone && hipsBone.parent) { const pm = hipsBone.parent.matrixWorld; let best = -1;
    [new THREE.Vector3(1,0,0), new THREE.Vector3(0,1,0), new THREE.Vector3(0,0,1)].forEach((v, i) => { const d = Math.abs(v.transformDirection(pm).y); if (d > best) { best = d; upAxis = i; } }); }
  for (const n in clips) clips[n] = pin(clips[n]);
  // size + stand her on the jar floor, measured in the Idle pose
  const probe = mixer.clipAction(clips.Idle); probe.play(); mixer.update(0); maggy.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(maggy, true);
  const s = 1.95 / (box.max.y - box.min.y);   // big in the jar: about 2/3 of its height maggy.scale.multiplyScalar(s); maggy.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(maggy, true); H = box.max.y - box.min.y;
  maggy.position.y += floorY - box.min.y; maggy.position.x -= (box.min.x + box.max.x) / 2; maggy.position.z -= (box.min.z + box.max.z) / 2 + .05;
  maggy.updateMatrixWorld(true);
  if (headBone) { headBone.getWorldPosition(vHead); headStand = vHead.y; }   // standing head height, for the close framing
  // wings sized to her, attached to the upper spine each frame
  const ww = H * .34, wh = ww * 287 / 350;
  for (const [g, u0, sign] of [[wingL, 0, -1], [wingR, .5, 1]]) {
    for (const additive of [false, true]) {
      const geo = new THREE.PlaneGeometry(ww, wh); geo.translate(sign * ww / 2, 0, 0);
      const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, u0 + uv.getX(i) * .5);
      const m = new THREE.MeshBasicMaterial({ map: wingTex, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, opacity: additive ? .55 : .35, color: 0xffffff });
      wingMats.push({ m, additive }); g.add(new THREE.Mesh(geo, m));
    }
  }
  probe.stop();
  // where her hips sit in the hammock pose -> root offset that seats her in the cloth
  if (clips.Hammock_pose) {   // measure her lying in the hammock: centre her on it and rest her lowest point on the sag
    const a = mixer.clipAction(clips.Hammock_pose); a.play(); mixer.update(0); straightenLegs(1);
    maggyRoot.position.set(0, 0, 0); maggyRoot.quaternion.identity(); maggy.updateMatrixWorld(true);
    // tilt that makes her feet-to-head line level, so head and feet both settle into the cloth (user: 8 deg head-up was too much)
    const head = new THREE.Vector3(), lf = new THREE.Vector3(), rf = new THREE.Vector3();
    headBone.getWorldPosition(head);
    legRest.filter(([b]) => /LeftFoot$/.test(b.name))[0][0].getWorldPosition(lf);
    legRest.filter(([b]) => /RightFoot$/.test(b.name))[0][0].getWorldPosition(rf);
    const v = head.sub(lf.add(rf).multiplyScalar(.5)); let best = 1e9;
    for (let d = 20; d <= 110; d += .5) { const q = new THREE.Quaternion().setFromAxisAngle(X_AXIS, -THREE.MathUtils.degToRad(d));
      const w = v.clone().applyQuaternion(q), err = Math.abs(Math.atan2(w.y, Math.hypot(w.x, w.z)) - THREE.MathUtils.degToRad(HEAD_UP_DEG));
      if (err < best) { best = err; LIE_BACK = THREE.MathUtils.degToRad(d); } }
    SLEEP_Q.setFromEuler(new THREE.Euler(-LIE_BACK, Math.PI / 2, 0, "YXZ"));
    maggyRoot.quaternion.copy(SLEEP_Q); maggyRoot.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(maggy, true), c = b.getCenter(new THREE.Vector3());
    hammockRootPos.set(-c.x, (HAM_Y - HAM_SAG + .03) - b.min.y, -c.z);
    maggyRoot.quaternion.identity(); maggyRoot.updateMatrixWorld(true); a.stop(); }
  mixer.update(0);
}
function pin(clip) {                                   // keep her in place: remove the hips' travel across the floor (height kept)
  const c = clip.clone();
  for (const t of c.tracks) if (t.name === hipsTrack) { const v = t.values, f = [v[0], v[1], v[2]];
    for (let i = 0; i < v.length; i += 3) for (let a = 0; a < 3; a++) if (a !== upAxis) v[i + a] = f[a]; }
  return c;
}

// ---------------- clip player ----------------
let current = null, currentName = null, clipUntil = 0;
function playClip(name, fade = .4) {
  if (!clips[name]) return;
  const a = actions[name] ||= mixer.clipAction(clips[name]);
  a.reset(); a.setLoop(THREE.LoopRepeat); a.setEffectiveWeight(1); a.play();
  if (current && current !== a) current.crossFadeTo(a, fade, false);
  current = a; currentName = name;
  const d = clips[name].duration; clipUntil = performance.now() + 1000 * (d < .1 ? 4 + Math.random() * 3 : Math.max(d, 4) * (d < 3 ? 2 : 1));
  $("clipName").textContent = name.replaceAll("_", " ");
}
function pickFrom(mood) { const list = MOODS[mood].clips.filter(n => clips[n]); const choices = list.length > 1 ? list.filter(n => n !== currentName) : list;
  return choices[Math.floor(Math.random() * choices.length)]; }

// ---------------- behaviour ----------------
const st = { auto: true, manual: "content", mood: null, temp: null, tempUntil: 0, lastTouch: performance.now(), taps: [], light: "auto",
  nextSass: performance.now() + 60000, sleep: "awake", sleepT: 0, flight: 0,
  posFrom: new THREE.Vector3(), posTo: new THREE.Vector3(), qFrom: new THREE.Quaternion(), qTo: new THREE.Quaternion() };
let sayTimer = 0;
function speak(mood, line) { if (st.talking) return; const l = MOODS[mood].lines; say.textContent = line || l[Math.floor(Math.random() * l.length)];
  say.classList.add("on"); clearTimeout(sayTimer); sayTimer = setTimeout(() => say.classList.remove("on"), 3200); }
function setTemp(m, ms, line) { st.temp = m; st.tempUntil = performance.now() + ms; speak(m, line); }
// greetings that fit the time of day and how long you've been gone
function partOfDay(h = new Date().getHours()) { return h >= 5 && h < 12 ? "morning" : h >= 12 && h < 17 ? "afternoon" : h >= 17 && h < 21 ? "evening" : "late"; }
const pick = a => a[Math.floor(Math.random() * a.length)];
const HELLO = {
  morning:   ["Mornin', sugar.", "Well, good mornin', boss.", "Mornin'. Coffee first, then me.", "Rise and shine, hon."],
  afternoon: ["Afternoon, sugar.", "Well, hey there, boss.", "Afternoon, hon. Hot one out there?", "There you are."],
  evening:   ["Evenin', sugar.", "Evenin', boss. Porch light's on.", "Well, evenin', hon.", "Fireflies are out, and so are you."],
  late:      ["Up late, sugar?", "Night owl, huh, boss?", "Well, ain't you up past your bedtime.", "It's the middle of the night, hon."],
};
function greetingNow() {
  const now = Date.now(); let last = 0;
  try { last = +localStorage.getItem("maggySeen") || 0; localStorage.setItem("maggySeen", String(now)); } catch (e) {}
  const away = last ? (now - last) / 3600000 : 0, part = partOfDay(), day = new Date().getDay();
  if (last && away < 0.1) return pick(["Back already?", "Miss me that quick?", "Well, hey again."]);
  if (away > 48) return pick(["Well, look who remembered me.", "Days, sugar. Whole days. I counted.", "Thought you forgot about me, boss."]);
  if (away > 12 && part === "morning") return pick(["Mornin', sugar. I missed you.", "Mornin'. You were gone all night, hon."]);
  if (part === "morning" && day === 1) return pick(["Mornin'. Monday again, huh?", "Happy Monday, sugar. Bless us both."]);
  if (part === "afternoon" && day === 5) return pick(["Afternoon, sugar. It's Friday, thank the Lord."]);
  if ((day === 0 || day === 6) && part !== "late" && Math.random() < .4) return pick(["Happy weekend, sugar.", "Weekend's here, hon. Sit a spell."]);
  return pick(HELLO[part]);
}
function wakeLine() { return { morning: "Mornin', sugar.", afternoon: "Well, I'm up. Was just restin' my eyes.", evening: "Alright, alright, I'm up.", late: "Mmh… it's the middle of the night, hon." }[partOfDay()]; }
function lightNow() { if (st.light !== "auto") return st.light; const h = new Date().getHours(); return h >= 7 && h < 17 ? "day" : h >= 17 && h < 20 ? "dusk" : "night"; }

function poke() {
  if (talk.pendingQueue) { const q = talk.pendingQueue; talk.pendingQueue = null; hold(say.textContent.replace("  (tap me to hear it)", "")); speakQueue(q).catch(() => doneTalking()); return; }
  if (talk.busy || talk.listening) return;
  const now = performance.now(); st.taps = st.taps.filter(t => now - t < 2500); st.taps.push(now); st.lastTouch = now;
  if (st.sleep !== "awake") { if (!st.auto) { st.auto = true; refreshChips(); } wake(true); return; }
  if (!st.auto) { speak(st.manual); return; }
  if (st.taps.length >= 4) setTemp("annoyed", 6000); else setTemp("delighted", 4500);
}
window.__maggy = { fallAsleep: () => fallAsleep() };   // test hook
function fallAsleep() {
  if (st.sleep !== "awake") return;
  st.sleep = "yawning"; st.sleepT = performance.now(); playClip("Yawn"); speak("sleepy");
}
function wake(rude) {
  if (st.sleep === "awake" || st.sleep === "landing") return;
  st.sleep = "landing"; st.sleepT = performance.now(); st.flight = 1;
  st.posFrom.copy(maggyRoot.position); st.qFrom.copy(maggyRoot.quaternion); st.posTo.set(0, 0, 0); st.qTo.identity();
  playClip(rude ? "Annoyed_Head_Shake" : "Neck_Stretching", .5);
  if (rude) setTemp("annoyed", 5000, "I was NAPPIN'."); else st.temp = null;
  st.lastTouch = performance.now();
}
const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

function sleepTick(now) {
  if (st.sleep === "yawning" && now - st.sleepT > Math.min(5200, (clips.Yawn?.duration || 4) * 1000)) {
    st.sleep = "flying"; st.sleepT = now; hammock.visible = true; st.flight = 1;
    st.posFrom.copy(maggyRoot.position); st.qFrom.copy(maggyRoot.quaternion); st.posTo.copy(hammockRootPos); st.qTo.copy(SLEEP_Q);
    playClip("Hammock_pose", .9);
  }
  if (st.sleep === "flying") {
    const t = Math.min(1, (now - st.sleepT) / 1900), e = ease(t); setHammockOpacity(Math.min(1, t * 2));
    maggyRoot.position.lerpVectors(st.posFrom, st.posTo, e); maggyRoot.quaternion.slerpQuaternions(st.qFrom, st.qTo, e);
    if (t >= 1) { st.sleep = "asleep"; st.flight = 0; }
  }
  if (st.sleep === "landing") {
    const t = Math.min(1, (now - st.sleepT) / 1400), e = ease(t); setHammockOpacity(1 - t);
    maggyRoot.position.lerpVectors(st.posFrom, st.posTo, e); maggyRoot.quaternion.slerpQuaternions(st.qFrom, st.qTo, e);
    if (t >= 1) { st.sleep = "awake"; st.flight = 0; hammock.visible = false; hammock.rotation.x = 0; maggyRoot.position.set(0, 0, 0); maggyRoot.quaternion.identity(); }
  }
}

function tick() {
  const now = performance.now(), idle = (now - st.lastTouch) / 1000;
  let mood;
  if (st.sleep !== "awake" && st.sleep !== "landing") mood = "sleepy";
  else if (!st.auto) mood = st.manual;
  else if (st.temp && now < st.tempUntil) mood = st.temp;
  else { st.temp = null; mood = idle > 240 ? "sleepy" : idle > 45 ? "wants" : "content";
    if (mood === "content" && idle > 12 && now > st.nextSass) { st.nextSass = now + 90000; setTemp("sassy", 6000); mood = "sassy"; } }
  if (mood === "sleepy" && st.sleep === "awake") { fallAsleep(); }
  if (mood !== "sleepy" && (st.sleep === "asleep" || st.sleep === "flying" || st.sleep === "yawning") && !st.auto) wake(false);
  let glow = MOODS[mood].glow;
  if (mood === "wants" && st.auto) glow = .6 + .4 * Math.min(1, (idle - 45) / 75) + .08 * Math.sin(now / 420);
  if (mood === "annoyed") glow += .06 * Math.sin(now / 90);
  const L = lightNow(); st.glow = Math.max(0, Math.min(1.15, glow * LIGHT[L].k)); st.L = L;
  if (mood !== st.mood) { const prev = st.mood; st.mood = mood; showMood(mood, prev); }
  else if (st.sleep === "awake" && now > clipUntil && !st.clipLock) playClip(pickFrom(mood));
  $("why").textContent = st.sleep !== "awake" ? `napping (${st.sleep})` : !st.auto ? "held by test control"
    : mood === "wants" ? `ignored ${Math.round(idle)}s, glowing brighter` : st.temp ? "reacting to you" : `idle ${Math.round(idle)}s · ${LIGHT[L].label.toLowerCase()}`;
}
const moodColor = new THREE.Color(0xffb547), targetColor = new THREE.Color(0xffb547);
function showMood(mood, prev) {
  targetColor.set(MOODS[mood].color); root.style.setProperty("--mood", MOODS[mood].color);
  $("moodName").textContent = MOODS[mood].label;
  if (st.sleep === "awake" && !st.clipLock) playClip(pickFrom(mood), .45);
  if (st.auto && prev && mood === "wants" && !st.talking) speak(mood);
}

// ---------------- controls ----------------
const chip = (row, k, label, color, fn) => { const b = document.createElement("button"); b.className = "chip"; b.type = "button"; b.id = row.id + "-" + k;
  b.setAttribute("aria-pressed", "false"); if (color) { const d = document.createElement("span"); d.className = "dot"; d.style.background = color; b.append(d); }
  b.append(label); b.addEventListener("click", fn); row.append(b); };
const moodRow = $("moodRow"), lightRow = $("lightRow");
function refreshChips() { moodRow.querySelectorAll(".chip").forEach(b => b.setAttribute("aria-pressed", String(b.id === "moodRow-" + (st.auto ? "auto" : st.manual))));
  lightRow.querySelectorAll(".chip").forEach(b => b.setAttribute("aria-pressed", String(b.id === "lightRow-" + st.light))); }
chip(moodRow, "auto", "Auto", null, () => { st.auto = true; st.temp = null; st.lastTouch = performance.now(); if (st.sleep !== "awake") wake(false); refreshChips(); });
for (const [k, m] of Object.entries(MOODS)) chip(moodRow, k, m.label, m.color, () => { st.auto = false; st.manual = k; if (k !== "sleepy" && st.sleep !== "awake") wake(false); refreshChips(); speak(k); st.mood = null; });
chip(lightRow, "auto", "Auto", null, () => { st.light = "auto"; refreshChips(); });
for (const [k, l] of Object.entries(LIGHT)) chip(lightRow, k, l.label, null, () => { st.light = k; refreshChips(); });

// tap = poke the glass; drag = peek around her
let tx = 0, ty = 0, cx = 0, cy = 0, lastPointer = -1e9, down = null;
function aim(e) { const r = stage.getBoundingClientRect(); tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - .5) * 2));
  ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - .5) * 2)); lastPointer = performance.now(); }
stage.addEventListener("pointermove", aim);
let holdTimer = 0, touchTalk = false;
stage.addEventListener("pointerdown", e => { aim(e); down = { x: e.clientX, y: e.clientY, t: performance.now() };
  openMic();   // a touch counts as permission to use the mic: get it ready now
  clearTimeout(holdTimer); holdTimer = setTimeout(() => { if (down && PASS && !talk.busy) { touchTalk = true; st.lastTouch = performance.now(); if (st.sleep !== "awake") wake(false); startListening(); } }, 500); });
stage.addEventListener("pointermove", e => { if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 12) clearTimeout(holdTimer); });
function endTouch(e) { clearTimeout(holdTimer);
  if (touchTalk) { touchTalk = false; down = null; stopListening(); return; }
  if (e.type === "pointerup" && down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 10 && performance.now() - down.t < 450) poke(); down = null; }
stage.addEventListener("pointerup", endTouch); stage.addEventListener("pointercancel", endTouch);
stage.addEventListener("keydown", e => { if (e.target && e.target.tagName === "INPUT") return; if (e.key === "Enter" || e.key === " ") { e.preventDefault(); poke(); } });
stage.tabIndex = 0;

// ---------------- R1 hardware ----------------
// scroll wheel: peek around her (holds the view a few seconds, then she drifts back)
function peek(d) { tx = Math.max(-1, Math.min(1, tx + d)); ty = 0; lastPointer = performance.now() + 3000; }
window.addEventListener("scrollUp", () => { if (ui.menuOpen) setVolume(prefs.vol + 1); else if (ui.logOpen) scrollLog(-48); else peek(-.3); });
window.addEventListener("scrollDown", () => { if (ui.menuOpen) setVolume(prefs.vol - 1); else if (ui.logOpen) scrollLog(48); else peek(.3); });
// long press (hold the side button): talk to her (when she has her pass code), else a gentle "hey"
function greet() {
  if (st.sleep !== "awake") { wake(false); setTemp("content", 4000, wakeLine()); }
  else if (st.auto) setTemp("delighted", 4500, "Well hey there, boss!");
}
window.addEventListener("longPressStart", () => {
  st.lastTouch = performance.now(); closeMenu(); if (ui.logOpen && !ui.logByTilt) closeLog();
  if (!PASS || talk.busy) { if (!talk.busy) greet(); return; }
  if (st.sleep !== "awake") wake(false);
  startListening();
});
window.addEventListener("longPressEnd", () => stopListening());

// ---------------- talking: hold to talk -> relay (Gemini hears + replies as Maggy) -> her words, then her voice ----------------
const RELAY = "https://maggy-voice.sunshineleonard.workers.dev";
let PASS = null;   // private pass code: arrives once in the install QR (?k=...), then remembered on the R1
try { const q = new URLSearchParams(location.search).get("k"); if (q) localStorage.setItem("maggyKey", q); PASS = localStorage.getItem("maggyKey"); } catch (e) {}
const talk = { busy: false, listening: false, rec: null, chunks: [], t0: 0, stream: null, stopAsked: false, history: [], pendingQueue: null };
const voice = new Audio(); voice.preload = "auto";
const VOICE_RATE = 1.08;   // user pick: her voice 8% faster, same pitch
function rateUp() { voice.volume = prefs.muted ? 0 : prefs.vol / 10; voice.defaultPlaybackRate = VOICE_RATE; voice.playbackRate = VOICE_RATE; voice.preservesPitch = true; voice.webkitPreservesPitch = true; }
let audioUnlocked = false;
function silentWav() { const n = 2400, b = new ArrayBuffer(44 + n * 2), v = new DataView(b), w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 24000, true); v.setUint32(28, 48000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
  let s = ""; new Uint8Array(b).forEach(x => s += String.fromCharCode(x)); return "data:audio/wav;base64," + btoa(s); }
function unlockAudio() {   // browsers only let sound play after a touch: play a blip of silence on the first tap
  if (audioUnlocked) return; audioUnlocked = true; voice.src = silentWav(); voice.play().catch(() => { audioUnlocked = false; }); }
window.addEventListener("pointerdown", unlockAudio, { capture: true });
function hold(text) { say.textContent = text; say.classList.toggle("long", text.length > 70); say.classList.add("on"); clearTimeout(sayTimer); }
function release(ms = 1500) { clearTimeout(sayTimer); sayTimer = setTimeout(() => { say.classList.remove("on", "long"); }, ms); }
function moodNow() { return st.temp || st.mood || "content"; }
function oops(line) { talk.busy = false; talk.listening = false; st.talking = false; st.clipLock = false; st.temp = "sassy"; st.tempUntil = performance.now() + 5000; hold(line); release(4000); }

function stage_(s) { const d = $("steps"); if (d) d.textContent = s; }
const withTimeout = (p, ms, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(what + " timeout")), ms))]);
function micLive() { const t = talk.stream && talk.stream.getAudioTracks()[0]; return !!t && t.readyState === "live"; }
let micAsk = null;
function openMic() {
  if (!PASS || micLive()) return Promise.resolve(talk.stream);
  if (micAsk) return micAsk;
  stage_("mic: asking");
  micAsk = withTimeout(navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }), 6000, "mic")
    .then(s => { talk.stream = s; stage_("mic: ready"); return s; })
    .finally(() => { micAsk = null; });
  micAsk.catch(e => stage_("mic: " + (e.name || e.message)));
  return micAsk;
}
async function startListening() {
  if (talk.listening) return;
  talk.listening = true; talk.stopAsked = false; talk.chunks = []; st.talking = true;
  st.temp = "wants"; st.tempUntil = performance.now() + 60000; hold("I'm listenin', sugar…"); st.clipLock = true; playClip("Idle", .3);
  try { await openMic(); if (!micLive()) throw new Error("mic not live"); }
  catch (e) { stage_("mic failed: " + (e.message || e.name)); return oops(talk.stopAsked ? "I couldn't get to the mic in time, sugar. Tap me once, then try." : "Can't hear a thing, hon. Mic's off."); }
  try {
    const rec = talk.rec = new MediaRecorder(talk.stream);
    rec.ondataavailable = e => { if (e.data && e.data.size) talk.chunks.push(e.data); };
    rec.onstop = () => finishListening(rec.mimeType || "audio/webm");
    rec.start(250); talk.t0 = performance.now(); stage_("rec: on");
    if (talk.stopAsked) stopListening();
    setTimeout(() => { if (talk.rec === rec && rec.state === "recording") rec.stop(); }, 20000);   // cap at 20 s
  } catch (e) { oops("My ears ain't workin' right now."); }
}
function stopListening() {
  if (!talk.listening) return;
  talk.stopAsked = true; stage_(talk.rec ? "rec: stopping" : "rec: stop asked before mic was ready");
  if (talk.rec && talk.rec.state === "recording") talk.rec.stop();
  setTimeout(() => {   // watchdog: never stay stuck on "listenin'"
    if (!talk.listening) return;
    if (talk.rec && talk.rec.state !== "inactive") { stage_("rec: forced stop"); try { talk.rec.stop(); } catch (e) {} }
    setTimeout(() => { if (talk.listening) { stage_("rec: never stopped"); oops("Hold on, my ears got stuck. Try me again?"); } }, 1500);
  }, 2500);
}
async function finishListening(mime) {
  talk.listening = false; const rec = talk.rec; talk.rec = null;
  const ms = performance.now() - talk.t0, blob = new Blob(talk.chunks, { type: mime });
  stage_("rec: " + (ms / 1000).toFixed(1) + "s, " + Math.round(blob.size / 1024) + " KB");
  if (ms < 700 || blob.size < 2000) { st.temp = null; st.talking = false; st.clipLock = false; release(0); greet(); return; }   // just a tap of the button: old hello
  talk.busy = true; st.temp = "content"; st.tempUntil = performance.now() + 60000; hold("Hmm…"); st.clipLock = true; playClip("Thinking", .4);
  try {
    const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(blob); });
    stage_("sent: " + Math.round(blob.size / 1024) + " KB, waiting on words…");
    const j = await relay("/talk", { audio: b64, mime, mood: moodNow(), when: localWhen(), history: talk.history.slice(-6), speak: false });
    talk.history.push({ who: "boss", text: j.heard }, { who: "maggy", text: j.reply }); talk.history = talk.history.slice(-12);
    logLine("you", j.heard); logLine("maggy", j.reply); lastReply = { text: j.reply, voice: [] };
    st.clipLock = false; st.temp = j.mood; st.tempUntil = performance.now() + 60000; hold(j.reply);
    if (j.mood === st.mood) { const clip = pickFrom(j.mood); if (clip) playClip(clip, .5); }
    if (prefs.muted) {   // muted: words only, never ask for her voice (saves the voice cost)
      stage_("muted: text only"); setTimeout(doneTalking, Math.max(4000, j.reply.length * 70)); return;
    }
    stage_("heard: \"" + j.heard.slice(0, 60) + "\" · making voice…");
    // voice each sentence in parallel and play them in order: she starts talking as soon as the first one is ready
    const jobs = sentences(j.reply).map(t => relay("/say", { text: t }));
    jobs.forEach((p, i) => p.then(v => { if (lastReply) lastReply.voice[i] = v.audio; }).catch(() => {}));
    await speakQueue(jobs);
  } catch (e) { console.warn(e); stage_("error: " + String(e.message || e).slice(0, 80)); logLine("sys", "error: " + String(e.message || e).slice(0, 200)); oops(/401/.test(String(e)) ? "Who're you? I don't know that pass code." : "My jar's got bad reception. Try me again?"); }
}
async function relay(path, body) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 45000);
  try {
    const r = await fetch(RELAY + path, { method: "POST", headers: { "Content-Type": "application/json", "X-Maggy-Key": PASS }, body: JSON.stringify(body), signal: ctl.signal });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(r.status + " " + (j.error || ""));
    return j;
  } finally { clearTimeout(timer); }
}
function localWhen() { try { return new Date().toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }); } catch (e) { return String(new Date()); } }
function sentences(text) {   // split into sentences; fold short bits into the next so each voiced piece sounds natural
  const raw = (String(text).match(/[^.!?…]+[.!?…]+["')\]]*\s*|[^.!?…]+$/g) || [String(text)]).map(x => x.trim()).filter(Boolean);
  const out = []; let buf = "";
  for (const r of raw) { buf = buf ? buf + " " + r : r; if (buf.length >= 30) { out.push(buf); buf = ""; } }
  if (buf) { if (out.length) out[out.length - 1] += " " + buf; else out.push(buf); }
  return out.slice(0, 4).concat(out.length > 4 ? [out.slice(4).join(" ")] : []).filter(Boolean);
}
function playOne(src) {   // resolves true when it finished, false if the WebView blocked playback
  return new Promise(res => { voice.src = src; rateUp(); voice.onended = () => res(true); voice.onerror = () => res(true);
    voice.play().catch(e => { stage_("voice blocked: " + (e.name || e)); res(false); }); });
}
async function speakQueue(jobs) {
  for (let i = 0; i < jobs.length; i++) {
    let v; try { v = await jobs[i]; } catch (e) { if (i === 0) throw e; break; }
    stage_("voice: " + (i + 1) + "/" + jobs.length);
    if (!(await playOne("data:audio/wav;base64," + v.audio))) { talk.pendingQueue = jobs.slice(i); hold(say.textContent + "  (tap me to hear it)"); return; }
  }
  doneTalking();
}
function doneTalking() { stage_("done · hold the button or the jar to talk"); talk.busy = false; st.talking = false; st.lastTouch = performance.now(); st.tempUntil = performance.now() + 5000; release(1800); }
// shake: gentle shake wakes her; a hard shake makes her mad (R1 motion events: peak jolt ~40 when shaken hard)
let lastAcc = null, shakeCooldown = 0;
window.addEventListener("devicemotion", e => {
  const a = e.accelerationIncludingGravity; if (!a || a.x == null) return;
  if (lastAcc) {
    const jerk = Math.hypot(a.x - lastAcc.x, a.y - lastAcc.y, a.z - lastAcc.z), now = performance.now();
    if (now > shakeCooldown && jerk > 12) {
      shakeCooldown = now + 1500; st.lastTouch = now;
      const hard = jerk > 28;
      if (st.sleep !== "awake") { wake(hard); if (!hard) setTemp("content", 4000, "Alright, alright, I'm up."); }
      else if (hard) setTemp("annoyed", 6000, "Quit shakin' my jar!");
      else if (st.auto) setTemp("sassy", 4500, "Whoa there, easy on the jar.");
    }
  }
  lastAcc = { x: a.x, y: a.y, z: a.z };
});
// desktop testing: arrows = wheel, space = long press, S = gentle shake, H = hard shake
window.addEventListener("keydown", e => {
  if (e.target && e.target.tagName === "INPUT") return;
  if (e.key === "ArrowUp") window.dispatchEvent(new Event("scrollUp"));
  if (e.key === "ArrowDown") window.dispatchEvent(new Event("scrollDown"));
  if (e.key === "l" && !e.repeat) window.dispatchEvent(new Event("longPressStart"));
});
window.addEventListener("keyup", e => { if (e.target && e.target.tagName === "INPUT") return; if (e.key === "l") window.dispatchEvent(new Event("longPressEnd")); });

// ---------------- settings menu, transcript, head tracking ----------------
const prefs = Object.assign({ vol: 4, muted: false, track: false }, (() => { try { return JSON.parse(localStorage.getItem("maggyPrefs") || "{}"); } catch (e) { return {}; } })());
function savePrefs() { try { localStorage.setItem("maggyPrefs", JSON.stringify(prefs)); } catch (e) {} }
const ui = { menuOpen: false, logOpen: false, logByTilt: false };
let lastReply = null;
const menuBtn = $("menuBtn"), menu = $("menu"), logEl = $("log"), logBody = $("logBody");
for (const el of [menuBtn, menu, logEl]) {   // taps on the menu/transcript never poke Maggy or start talking
  for (const ev of ["pointerdown", "pointerup", "pointercancel"]) el.addEventListener(ev, e => e.stopPropagation()); }
menuBtn.addEventListener("click", () => ui.menuOpen ? closeMenu() : openMenu());
function openMenu() { closeLog(); ui.menuOpen = true; menu.hidden = false; drawMenu(); }
function closeMenu() { ui.menuOpen = false; menu.hidden = true; }
function drawMenu() {
  $("volBars").textContent = "▮".repeat(prefs.vol) + "▯".repeat(10 - prefs.vol);
  $("volNum").textContent = prefs.muted ? "muted" : prefs.vol * 10 + "%";
  $("muteBtn").textContent = prefs.muted ? "Voice: OFF (text only)" : "Voice: ON";
  $("muteBtn").setAttribute("aria-pressed", String(prefs.muted));
  $("trackBtn").textContent = "Head tracking: " + (prefs.track ? "ON" : "OFF");
  $("trackBtn").setAttribute("aria-pressed", String(prefs.track));
  $("replayBtn").disabled = !lastReply;
}
let tickCtx = null;
function tick_() {   // little click so you can hear the new volume
  if (prefs.muted) return;
  try { tickCtx ||= new (window.AudioContext || window.webkitAudioContext)(); const o = tickCtx.createOscillator(), g = tickCtx.createGain();
    o.frequency.value = 660; g.gain.value = .25 * prefs.vol / 10; o.connect(g); g.connect(tickCtx.destination); o.start(); o.stop(tickCtx.currentTime + .09); } catch (e) {}
}
function setVolume(v) { prefs.vol = Math.max(1, Math.min(10, v)); if (prefs.muted) prefs.muted = false; voice.volume = prefs.vol / 10; savePrefs(); drawMenu(); tick_(); }
$("volDown").addEventListener("click", () => setVolume(prefs.vol - 1));
$("volUp").addEventListener("click", () => setVolume(prefs.vol + 1));
$("muteBtn").addEventListener("click", () => { prefs.muted = !prefs.muted; voice.volume = prefs.muted ? 0 : prefs.vol / 10; if (prefs.muted) { try { voice.pause(); } catch (e) {} } savePrefs(); drawMenu(); });
$("replayBtn").addEventListener("click", () => { closeMenu(); replayLast(); });
$("logBtn").addEventListener("click", () => { closeMenu(); openLog(false); });
$("trackBtn").addEventListener("click", () => { prefs.track = !prefs.track; savePrefs(); drawMenu(); prefs.track ? startTracking() : stopTracking(); });
$("closeMenu").addEventListener("click", closeMenu);

function replayLast() {   // free: plays the voice already downloaded, or just shows the words again
  if (!lastReply || talk.busy || talk.listening) return;
  st.talking = true; talk.busy = true; hold(lastReply.text);
  const have = lastReply.voice.filter(Boolean);
  if (prefs.muted || !have.length) { stage_("replay: text"); setTimeout(doneTalking, Math.max(4000, lastReply.text.length * 70)); return; }
  stage_("replay: no charge"); speakQueue(have.map(a => Promise.resolve({ audio: a }))).catch(() => doneTalking());
}

// transcript: a terminal-style log of what you said and what she said (kept on the R1 between visits)
let logLines = (() => { try { return JSON.parse(localStorage.getItem("maggyLog") || "[]"); } catch (e) { return []; } })();
function logLine(who, text) {
  if (!text) return; logLines.push({ t: Date.now(), who, text: String(text).slice(0, 4000) }); logLines = logLines.slice(-150);
  try { localStorage.setItem("maggyLog", JSON.stringify(logLines)); } catch (e) {}
  if (ui.logOpen) drawLog();
}
function drawLog() {
  logBody.textContent = "";
  if (!logLines.length) { logBody.textContent = "No conversation yet. Hold the button or the jar and talk to her."; return; }
  let day = "";
  for (const l of logLines) {
    const d = new Date(l.t), dd = d.toLocaleDateString(), tm = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (dd !== day) { day = dd; const h = document.createElement("div"); h.className = "day"; h.textContent = "── " + d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }) + " ──"; logBody.append(h); }
    const row = document.createElement("div"); row.className = "ln " + l.who;
    row.textContent = (l.who === "you" ? "> " : l.who === "maggy" ? "maggy: " : "# ") + l.text;
    row.title = tm; const ts = document.createElement("span"); ts.className = "ts"; ts.textContent = " " + tm; row.append(ts); logBody.append(row);
  }
  logBody.scrollTop = logBody.scrollHeight;
}
function scrollLog(dy) { logBody.scrollTop += dy; }
function openLog(byTilt, turn) {
  closeMenu(); ui.logOpen = true; ui.logByTilt = !!byTilt; logEl.hidden = false;
  logEl.className = "log" + (turn ? " turn" + turn : ""); drawLog();
}
function closeLog() { ui.logOpen = false; ui.logByTilt = false; logEl.hidden = true; }
$("logClose").addEventListener("click", closeLog);

// typing to her (for meetings): she answers in text only, no voice, no sound
const typeIn = $("typeIn");
$("typeForm").addEventListener("submit", async e => {
  e.preventDefault();
  const text = typeIn.value.trim(); if (!text || talk.busy || talk.listening) return;
  if (!PASS) { logLine("sys", "She needs her pass code (install from the private QR) before she can answer."); return; }
  typeIn.value = ""; logLine("you", text); st.lastTouch = performance.now();
  if (st.sleep !== "awake") wake(false);
  talk.busy = true; st.talking = true; st.temp = "content"; st.tempUntil = performance.now() + 60000;
  const wait = document.createElement("div"); wait.className = "ln pending"; wait.textContent = "maggy is typing…"; logBody.append(wait); logBody.scrollTop = logBody.scrollHeight;
  try {
    const j = await relay("/talk", { text, mood: moodNow(), when: localWhen(), history: talk.history.slice(-6), speak: false });
    talk.history.push({ who: "boss", text }, { who: "maggy", text: j.reply }); talk.history = talk.history.slice(-12);
    lastReply = { text: j.reply, voice: [] }; st.temp = j.mood; st.tempUntil = performance.now() + 8000;
    logLine("maggy", j.reply);
  } catch (err) { logLine("sys", "couldn't reach her: " + String(err.message || err).slice(0, 120)); }
  finally { wait.remove(); talk.busy = false; st.talking = false; if (!ui.logOpen) { hold(lastReply ? lastReply.text : ""); release(5000); } }
});
$("logClear").addEventListener("click", () => { logLines = []; try { localStorage.removeItem("maggyLog"); } catch (e) {} drawLog(); });

// turn the R1 on its side -> the transcript opens, readable sideways; turn it back -> closes
let tiltSide = 0, tiltSince = 0;
window.addEventListener("devicemotion", e => {
  const g = e.accelerationIncludingGravity; if (!g || g.x == null) return;
  const side = Math.abs(g.x) > 6.5 && Math.abs(g.x) > Math.abs(g.y) + 2 ? (g.x > 0 ? 1 : -1) : Math.abs(g.y) > 6.5 ? 0 : tiltSide;
  const now = performance.now();
  if (side !== tiltSide) { tiltSide = side; tiltSince = now; return; }
  if (now - tiltSince < 500) return;
  const wide = window.innerWidth > window.innerHeight;   // if the R1 rotates the page itself, no need to turn the text
  if (side !== 0 && !(ui.logOpen && ui.logByTilt)) openLog(true, wide ? 0 : (side > 0 ? "R" : "L"));
  else if (side === 0 && ui.logOpen && ui.logByTilt) closeLog();
});

// head tracking: front camera + face detection (loaded only when switched on), her view follows your head
let face = { on: false, x: 0, y: 0, seen: 0 };
async function startTracking() {
  if (face.on) return; face.on = true; stage_("tracking: loading…");
  try {
    if (!window.MaggyFace) await new Promise((res, rej) => { const sc = document.createElement("script"); sc.src = "face.js?v=" + (window.MAGGY_BUILD || "1"); sc.onload = res; sc.onerror = () => rej(new Error("face.js didn't load")); document.head.append(sc); });
    await window.MaggyFace.start({
      base: new URL("vendor/mediapipe", location.href).href, model: new URL("vendor/blaze_face_short_range.tflite", location.href).href,
      onFace: (x, y) => { face.x = x; face.y = y; face.seen = performance.now(); },
      onStatus: s => stage_("tracking: " + s),
    });
  } catch (e) { face.on = false; prefs.track = false; savePrefs(); drawMenu(); stage_("tracking failed: " + (e.message || e)); logLine("sys", "head tracking failed: " + (e.message || e)); }
}
function stopTracking() { face.on = false; try { window.MaggyFace && window.MaggyFace.stop(); } catch (e) {} stage_("tracking: off"); }
document.addEventListener("visibilitychange", () => { if (!prefs.track) return; document.hidden ? stopTracking() : startTracking(); });
if (prefs.track) setTimeout(startTracking, 1500);

// ---------------- frame loop ----------------
const clock = new THREE.Clock(); let frames = 0, acc = 0, nextZ = 0;
const v1 = new THREE.Vector3(), q1 = new THREE.Quaternion(), qCorr = new THREE.Quaternion(), qBody = new THREE.Quaternion();
let corrReady = false, fold = 0;
function resize() { const w = canvas.clientWidth, h = canvas.clientHeight; const pr = renderer.getPixelRatio();
  if (canvas.width !== Math.round(w * pr) || canvas.height !== Math.round(h * pr)) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); } }
function frame() {
  const dt = Math.min(.05, clock.getDelta()), t = clock.elapsedTime, now = performance.now(); resize();
  if (mixer) {
    sleepTick(now);
    if (st.sleep === "asleep") {   // hammock rocks; she rocks with it about the same pivot
      const a = reduce ? 0 : Math.sin(t * .9) * .05; hammock.rotation.x = a; qRock.setFromAxisAngle(X_AXIS, a);
      maggyRoot.quaternion.copy(qRock).multiply(SLEEP_Q);
      maggyRoot.position.copy(hammockRootPos).sub(hammock.position).applyQuaternion(qRock).add(hammock.position);
    }
    hammock.position.y = HAM_Y;
    mixer.update(dt);
    const legTarget = st.sleep === "asleep" ? 1 : st.sleep === "flying" ? Math.min(1, (now - st.sleepT) / 1900) : st.sleep === "landing" ? 1 - Math.min(1, (now - st.sleepT) / 1400) : 0;
    legStraight += (legTarget - legStraight) * .25; straightenLegs(legStraight);
    maggy.updateMatrixWorld(true);
    // wings follow the upper spine
    if (spineBone) {
      spineBone.getWorldQuaternion(q1); spineBone.getWorldPosition(v1);
      if (!corrReady) { maggyRoot.getWorldQuaternion(qBody); qCorr.copy(q1).invert().multiply(qBody); corrReady = true; }
      wingRig.quaternion.copy(q1).multiply(qCorr);
      wingRig.position.copy(v1).add(new THREE.Vector3(0, H * .015, -H * .075).applyQuaternion(wingRig.quaternion));
      const fast = st.flight ? 30 : st.sleep === "asleep" ? 2 : 13, amp = st.flight ? .55 : st.sleep === "asleep" ? .05 : .3;
      const flap = reduce ? 0 : Math.sin(t * fast) * amp;
      fold += ((st.sleep === "asleep" ? 1 : 0) - fold) * .05;           // tuck the wings away while she naps
      wingL.rotation.y = -(.45 + fold * 1.0) - flap; wingR.rotation.y = (.45 + fold * 1.0) + flap;   // tips swept back behind her
      wingRig.scale.setScalar(Math.max(.001, 1 - fold)); wingRig.visible = fold < .97;
      glowSprite.position.copy(v1).add(new THREE.Vector3(0, -H * .05, -H * .2)); glowSprite.scale.setScalar(H * (1.1 + st.glow * .9));
    }
    // mood colour + glow
    moodColor.lerp(targetColor, .06);
    const g = st.glow || .5;
    moodLight.color.copy(moodColor); moodLight.intensity = 1.2 + g * 3.2; moodLight.position.set(0, maggyRoot.position.y + H * .55, .75);
    glowSprite.material.color.copy(moodColor); glowSprite.material.opacity = .25 + g * .55;
    pool.material.color.copy(moodColor); pool.material.opacity = .15 + g * .45;
    glassMat.uniforms.tint.value.set(0xdfeeff).lerp(moodColor, .25 + g * .2);
    for (const { m, additive } of wingMats) { if (additive) { m.color.copy(moodColor); m.opacity = (.3 + g * .5) * (1 - fold * .7); } else m.opacity = .35 * (1 - fold * .6); }
    // light of day
    const LL = LIGHT[st.L || "dusk"]; bgMat && bgMat.color.lerp(new THREE.Color().fromArray(LL.bg), .08);   // linear multipliers; day > 1 brightens hemi.intensity += (LL.hemi - hemi.intensity) * .05;
    // fireflies
    const p = flyGeo.attributes.position.array, nf = LL.flies;
    for (let i = 0; i < NF; i++) { const b = flyBase[i], on = i < nf;
      p[i * 3] = b[0] + Math.sin(t * .2 * b[4] + b[3]) * .5; p[i * 3 + 1] = on ? b[1] + Math.sin(t * .33 * b[4] + b[3] * 2) * .3 : -50; p[i * 3 + 2] = b[2]; }
    flyGeo.attributes.position.needsUpdate = true; flies.material.opacity = .55 + .45 * Math.sin(t * 2.3);
    // Zzz while asleep
    if (st.sleep === "asleep" && t > nextZ && headBone) { nextZ = t + 1.3; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: zTex, transparent: true, depthWrite: false, color: 0xd9ccff }));
      headBone.getWorldPosition(s.position); s.position.add(new THREE.Vector3(.12, .12, .1)); s.scale.setScalar(.14); s.userData.born = t; scene.add(s); zs.push(s); }
    for (let i = zs.length - 1; i >= 0; i--) { const s = zs[i], age = t - s.userData.born; s.position.y += dt * .22; s.position.x += Math.sin(age * 3) * dt * .08;
      s.material.opacity = Math.max(0, 1 - age / 2.6); s.scale.setScalar(.14 + age * .05); if (age > 2.6) { scene.remove(s); s.material.dispose(); zs.splice(i, 1); } }
  }
  // camera: peek around her (drag), gentle drift when nobody is touching
  if (face.on && now - face.seen < 1500) { tx = Math.max(-1, Math.min(1, face.x * 1.6)); ty = Math.max(-1, Math.min(1, face.y * 1.2)); lastPointer = now; }
  else if (now - lastPointer > 2500) { tx = Math.sin(t / 5.2) * .3; ty = Math.sin(t / 7.3) * .12; }
  cx += (tx - cx) * .07; cy += (ty - cy) * .07;
  const wantWide = st.sleep === "flying" || st.sleep === "asleep" || st.sleep === "landing" ? 1 : 0;
  zoomOut += (wantWide - zoomOut) * (reduce ? 1 : .03);
    // close framing follows her head down when she sits or crouches, so her whole body stays on screen
  if (headBone && maggy) { headBone.getWorldPosition(vHead); const want = Math.max(.62, Math.min(CLOSE.y, vHead.y - (headStand - CLOSE.y))); lookCloseY += (want - lookCloseY) * .04; }
  CAM_DIST = CLOSE.dist + (WIDE.dist - CLOSE.dist) * zoomOut; LOOK.y = lookCloseY + (WIDE.y - lookCloseY) * zoomOut;
  const yaw = reduce ? 0 : cx * .42, pitch = reduce ? 0 : cy * .14;
  camera.position.set(LOOK.x + Math.sin(yaw) * CAM_DIST * Math.cos(pitch), LOOK.y + .15 + Math.sin(pitch) * CAM_DIST, LOOK.z + Math.cos(yaw) * CAM_DIST * Math.cos(pitch));
  camera.lookAt(LOOK);
  renderer.render(scene, camera);
  frames++; acc += dt;
  if (acc > .5) { const fps = Math.round(frames / acc); $("fps").textContent = fps; frames = 0; acc = 0;
    // after a few seconds settle: if the R1 can't keep ~28 fps, render at 1x pixels instead of 1.5x
    if (t > 4 && fps < 28 && pixelRatio > 1) { pixelRatio = 1; renderer.setPixelRatio(1); } }
  requestAnimationFrame(frame);
}

(async () => { try {
  await build();
  $("loading").hidden = true;
  refreshChips(); tick(); setInterval(tick, 250); requestAnimationFrame(frame);
  setTimeout(() => speak("content", greetingNow()), 800);
  window.__maggy = { st, playClip, poke, fallAsleep, wake, get bg() { return bgMat; }, get face() { return face; } };   // test hook
} catch (e) {
  $("loading").textContent = "Maggy couldn't load: " + (e && e.message ? e.message : e);
} })();
