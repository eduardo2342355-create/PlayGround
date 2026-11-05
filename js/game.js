import * as THREE from '../vendor/three.module.js';
import { buildWorld } from './world.js';
import { PostProcessor } from './postfx.js';
import { AudioEngine } from './audio.js';

/* ─────────────────────────────────────────────────────────────
   THE HOLLOW HOUR
   A short first-person psychological horror.
   ───────────────────────────────────────────────────────────── */

const $ = (id) => document.getElementById(id);

const ui = {
  canvas: $('scene'),
  loading: $('loading'),
  loadBar: $('load-bar'),
  loadStatus: $('load-status'),
  menu: $('menu'),
  hud: $('hud'),
  objective: $('objective-text'),
  memoryCount: $('memory-count'),
  sanityBar: $('sanity-bar'),
  sanityVal: $('sanity-val'),
  batteryBar: $('battery-bar'),
  batteryVal: $('battery-val'),
  flashState: $('flash-state'),
  flashWarning: $('flash-warning'),
  subtitle: $('subtitle'),
  prompt: $('prompt'),
  promptText: $('prompt-text'),
  crosshair: $('crosshair'),
  location: $('location'),
  note: $('note'),
  noteText: $('note-text'),
  noteSign: $('note-sign'),
  pause: $('pause'),
  death: $('death'),
  ending: $('ending'),
  introCard: $('intro-card'),
  fade: $('fade'),
  help: $('help'),
  menuSound: $('menu-sound'),
  optSens: $('opt-sens'),
  optSensVal: $('opt-sens-val'),
  optVol: $('opt-vol'),
  optVolVal: $('opt-vol-val'),
};

/* ── renderer / scene ───────────────────────────────────────── */
const renderer = new THREE.WebGLRenderer({
  canvas: ui.canvas,
  antialias: false,
  powerPreference: 'high-performance',
  stencil: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 45);
camera.rotation.order = 'YXZ';
scene.add(camera);

/* ── flashlight ─────────────────────────────────────────────── */
const flashlight = new THREE.SpotLight(0xffe6c2, 90, 22, 0.46, 0.68, 1.35);
flashlight.position.set(0.16, -0.1, 0.02);
flashlight.target.position.set(0, -0.05, -1);
flashlight.castShadow = false;
flashlight.shadow.mapSize.set(1024, 1024);
flashlight.shadow.bias = -0.0009;
flashlight.shadow.camera.near = 0.1;
flashlight.shadow.camera.far = 18;
camera.add(flashlight);
camera.add(flashlight.target);

const flashFill = new THREE.PointLight(0xffe2bc, 0.9, 3.2, 2);
flashFill.position.set(0, 0, -0.2);
camera.add(flashFill);

/* ── audio ──────────────────────────────────────────────────── */
const audio = new AudioEngine();

/* ── game state ─────────────────────────────────────────────── */
const state = {
  mode: 'loading',
  memories: 0,
  sanity: 100,
  battery: 100,
  flashlightOn: true,
  doorUnlocked: false,
  room: 'HALLWAY',
  time: 0,
  subtitleTimer: 0,
  flash: 0,
  damage: 0,
  shake: 0,
  nextLightning: 20 + Math.random() * 20,
  nextEntity: 48 + Math.random() * 24,
  forceSpawn: 0,
  endingTimer: 0,
  helpReturn: null,
};

const player = {
  pos: new THREE.Vector3(0, 0, -8.55),
  vel: new THREE.Vector3(),
  yaw: Math.PI,
  pitch: 0,
  radius: 0.29,
  sensitivity: 1,
  walkPhase: 0,
  stepDist: 0,
  bob: 0,
  dragging: false,
};

const keys = Object.create(null);
const clock = { last: performance.now() };

let world = null;
let post = null;
let entity = null;
let menuTime = 0;
let pointerLocked = false;

const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();

const MEMORY_TEXT = [
  'You were seven. The television stayed on all night so the house would not feel empty.',
  'She used to say the dark was not empty. It was just full of things we could not see.',
  'The water ran for three days after she left. You told the police you did not hear it.',
  'You wrote the letter. You remember writing it. You do not remember sending it.',
  'There was never a sister. There was only the part of you that needed one.',
];

const ROOM_DOORS = {
  'LIVING ROOM': { x: -1.8, z: -3.5 },
  BEDROOM: { x: 1.8, z: 0.9 },
  BATHROOM: { x: -1.8, z: 4.1 },
  STUDY: { x: 1.8, z: 8.1 },
};

/* ── boot ───────────────────────────────────────────────────── */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

async function boot() {
  setLoad(8, 'Waking the building…');
  await wait(140);

  setLoad(24, 'Painting the walls…');
  await nextFrame();

  world = buildWorld(scene, renderer);
  setLoad(62, 'Remembering the rooms…');
  await nextFrame();

  entity = makeEntity();
  setLoad(78, 'Checking the locks…');
  await nextFrame();

  post = new PostProcessor(renderer, scene, camera);
  camera.position.set(0, 1.55, 7.4);
  camera.rotation.set(-0.015, 0.02, 0);
  setLoad(90, 'Turning out the lights…');
  await nextFrame();

  // warm the shaders once so the first play frame does not hitch
  renderer.compile(scene, camera);
  setLoad(100, 'Ready.');
  await wait(420);

  ui.loading.classList.remove('visible');
  ui.menu.classList.add('visible');
  state.mode = 'menu';
  updateMenuCamera(0, true);
  requestAnimationFrame(loop);
}

function setLoad(pct, text) {
  ui.loadBar.style.width = pct + '%';
  if (text) ui.loadStatus.textContent = text;
}

/* ── entity ─────────────────────────────────────────────────── */
function makeEntity() {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0x070707, roughness: 0.94, metalness: 0.0 });
  const coatMat = new THREE.MeshStandardMaterial({ color: 0x090909, roughness: 1, side: THREE.DoubleSide });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xcfc2a8, toneMapped: false });

  // long, wrong proportions
  const coat = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.75, 9, 1, true), coatMat);
  coat.position.y = 0.88;
  group.add(coat);

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 1.15, 8), skin);
  torso.position.y = 1.55;
  group.add(torso);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.2, 6), skin);
  neck.position.y = 2.18;
  group.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), skin);
  head.scale.set(0.9, 1.28, 1.0);
  head.position.y = 2.34;
  group.add(head);

  // arms
  const armGeo = new THREE.CylinderGeometry(0.038, 0.052, 1.05, 6);
  const armL = new THREE.Mesh(armGeo, skin);
  armL.position.set(-0.29, 1.55, 0);
  armL.rotation.z = 0.12;
  group.add(armL);
  const armR = new THREE.Mesh(armGeo, skin);
  armR.position.set(0.29, 1.55, 0);
  armR.rotation.z = -0.12;
  group.add(armR);

  const handGeo = new THREE.SphereGeometry(0.055, 6, 5);
  const handL = new THREE.Mesh(handGeo, skin);
  handL.position.set(-0.35, 1.0, 0);
  group.add(handL);
  const handR = new THREE.Mesh(handGeo, skin);
  handR.position.set(0.35, 1.0, 0);
  group.add(handR);

  // eyes: two very faint points, only readable up close
  const eyeGeo = new THREE.SphereGeometry(0.012, 5, 4);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.052, 2.36, 0.145);
  group.add(eyeL);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(0.052, 2.36, 0.145);
  group.add(eyeR);

  group.visible = false;
  group.position.set(0, 0, 8.6);
  scene.add(group);

  return {
    group,
    parts: { torso, head, armL, armR, handL, handR },
    active: false,
    attack: 0,
    retreat: 0,
    cooldown: 0,
    life: 0,
    distance: 999,
    visible: false,
    lit: false,
    anim: Math.random() * 10,
  };
}

function spawnEntity() {
  if (state.mode !== 'playing' || entity.active || entity.cooldown > 0) return;
  const px = player.pos.x;
  const pz = player.pos.z;
  let sz;
  if (Math.abs(px) < 1.2) {
    sz = pz > 0 ? -8.7 : 8.7;
  } else {
    sz = pz > 0 ? Math.max(-8.7, pz - 7) : Math.min(8.7, pz + 7);
  }
  entity.group.position.set(0, 0, sz);
  entity.group.scale.set(1, 1, 1);
  entity.group.visible = true;
  entity.active = true;
  entity.visible = true;
  entity.attack = 0;
  entity.retreat = 0;
  entity.life = 0;
  entity.anim = Math.random() * 10;
  world.pulseBlackout(0.7);
  audio.stinger();
}

function dissolveEntity(repelled = false) {
  if (!entity.active) return;
  entity.active = false;
  entity.attack = 0;
  entity.retreat = 0;
  entity.life = 0;
  entity.cooldown = repelled ? 4.5 : 7;
  entity.group.visible = false;
  if (repelled) {
    audio.whisper();
    state.sanity = Math.min(100, state.sanity + 2);
  }
}

function entityLOS(from, to) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const dist = Math.hypot(dx, dz);
  const steps = Math.max(2, Math.ceil(dist / 0.22));
  for (let i = 1; i < steps - 1; i++) {
    const t = i / steps;
    const x = from.x + dx * t;
    const z = from.z + dz * t;
    for (const c of world.colliders) {
      if (c.wall && x > c.minX + 0.02 && x < c.maxX - 0.02 && z > c.minZ + 0.02 && z < c.maxZ - 0.02) {
        return true;
      }
    }
  }
  return false;
}

function entityTarget() {
  if (Math.abs(player.pos.x) < 1.2) return player.pos;
  const door = ROOM_DOORS[state.room];
  if (!door) return player.pos;
  const dx = entity.group.position.x - door.x;
  const dz = entity.group.position.z - door.z;
  if (Math.hypot(dx, dz) < 1.25) return player.pos;
  return { x: door.x, z: door.z };
}

function updateEntity(dt) {
  if (entity.cooldown > 0) entity.cooldown -= dt;
  if (!entity.active) {
    entity.distance = 999;
    entity.visible = false;
    return;
  }

  const ex = entity.group.position.x;
  const ez = entity.group.position.z;
  const dx = player.pos.x - ex;
  const dz = player.pos.z - ez;
  const dist = Math.hypot(dx, dz);
  entity.distance = dist;

  const camDir = camera.getWorldDirection(tmpV);
  const toEnt = tmpV2.set(ex, 1.35, ez).sub(camera.position);
  const flatDist = Math.max(0.001, Math.hypot(toEnt.x, toEnt.z));
  const dot = (toEnt.x * camDir.x + toEnt.z * camDir.z) / flatDist;
  const los = !entityLOS(camera.position, { x: ex, z: ez });

  entity.lit = state.flashlightOn && state.battery > 0 && dist < 15 && dot > 0.86 && los;
  entity.visible = dist < 18 && dot > 0.42 && los;

  // face the player
  entity.group.rotation.y = Math.atan2(dx, dz);
  entity.anim += dt;
  const sway = Math.sin(entity.anim * 2.1) * 0.055;
  entity.parts.torso.rotation.z = sway;
  entity.parts.head.rotation.z = -sway * 0.7;
  entity.parts.head.rotation.x = Math.sin(entity.anim * 0.7) * 0.06;
  entity.parts.armL.rotation.z = 0.12 + Math.sin(entity.anim * 1.4) * 0.05;
  entity.parts.armR.rotation.z = -0.12 - Math.sin(entity.anim * 1.4 + 1) * 0.05;
  entity.group.position.y = Math.sin(entity.anim * 1.7) * 0.012;

  if (entity.attack > 0) {
    entity.attack -= dt;
    entity.group.visible = true;
    if (entity.attack <= 0) {
      dissolveEntity(false);
    }
    return;
  }

  if (entity.lit) {
    entity.retreat += dt;
    state.sanity -= dt * 1.1;
    // forced back into the dark
    const len = Math.max(0.001, Math.hypot(dx, dz));
    entity.group.position.x -= (dx / len) * dt * 0.55;
    entity.group.position.z -= (dz / len) * dt * 0.55;
    const s = Math.max(0.72, 1 - entity.retreat * 0.12);
    entity.group.scale.set(s, s, s);
    if (entity.retreat > 1.9) dissolveEntity(true);
  } else if (entity.visible) {
    // It cannot move while watched. But being seen without the beam costs you.
    state.sanity -= dt * 5.2;
    entity.group.position.x += Math.sin(entity.anim * 3.1) * dt * 0.008;
  } else {
    const target = entityTarget();
    const tdx = target.x - entity.group.position.x;
    const tdz = target.z - entity.group.position.z;
    const tlen = Math.hypot(tdx, tdz);
    if (tlen > 0.02) {
      const speed = 0.62 + (1 - state.sanity / 100) * 0.55;
      entity.group.position.x += (tdx / tlen) * speed * dt;
      entity.group.position.z += (tdz / tlen) * speed * dt;
    }
  }

  entity.life += dt;
  if (dist < 1.35) beginAttack();
  else if (entity.life > 50) dissolveEntity(false);
}

function beginAttack() {
  if (entity.attack > 0) return;
  entity.attack = 0.62;
  entity.retreat = 0;
  state.sanity -= 26;
  state.damage = 1;
  state.flash = 0.75;
  state.shake = 1.5;
  audio.jumpscare();
  world.pulseBlackout(0.9);

  const fwd = camera.getWorldDirection(tmpV).clone();
  entity.group.position.set(player.pos.x + fwd.x * 0.95, 0, player.pos.z + fwd.z * 0.95);
  entity.group.scale.set(1.15, 1.15, 1.15);
  entity.group.rotation.y = Math.atan2(-fwd.x, -fwd.z);
  entity.group.visible = true;
}

/* ── input ──────────────────────────────────────────────────── */
function requestLock() {
  if (!ui.canvas.requestPointerLock) return;
  try {
    const p = ui.canvas.requestPointerLock({ unadjustedMovement: true });
    if (p && p.catch) p.catch(() => {
      try { ui.canvas.requestPointerLock(); } catch {}
    });
  } catch {
    try { ui.canvas.requestPointerLock(); } catch {}
  }
}

document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === ui.canvas;
  if (!pointerLocked && state.mode === 'playing') {
    pauseGame();
  }
});

document.addEventListener('mousemove', (e) => {
  if (state.mode !== 'playing') return;
  if (!pointerLocked && !player.dragging) return;
  const dx = pointerLocked ? e.movementX : e.movementX || 0;
  const dy = pointerLocked ? e.movementY : e.movementY || 0;
  player.yaw -= dx * 0.0022 * player.sensitivity;
  player.pitch -= dy * 0.0022 * player.sensitivity;
  player.pitch = Math.max(-1.28, Math.min(1.28, player.pitch));
});

ui.canvas.addEventListener('mousedown', (e) => {
  if (state.mode !== 'playing') return;
  if (e.button === 0) player.dragging = true;
});
window.addEventListener('mouseup', () => { player.dragging = false; });

window.addEventListener('keydown', (e) => {
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight'].includes(e.code)) e.preventDefault();
  keys[e.code] = true;

  if (state.mode === 'playing') {
    if (e.code === 'KeyF') toggleFlashlight();
    if (e.code === 'KeyE') interact();
    if (e.code === 'Escape') pauseGame();
    if (e.code === 'KeyM') toggleSound();
  } else if (state.mode === 'note') {
    if (e.code === 'KeyE' || e.code === 'Escape') closeNote();
  } else if (state.mode === 'paused') {
    if (e.code === 'Escape') resumeGame();
  }
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; player.dragging = false; });

/* ── movement ───────────────────────────────────────────────── */
function blocked(x, z) {
  const r = player.radius;
  for (const c of world.colliders) {
    const nx = Math.max(c.minX, Math.min(x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - nx;
    const dz = z - nz;
    if (dx * dx + dz * dz < r * r) return true;
  }
  return false;
}

function tryMove(dx, dz) {
  const dist = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(dist / 0.07));
  const sx = dx / steps;
  const sz = dz / steps;
  for (let i = 0; i < steps; i++) {
    if (!blocked(player.pos.x + sx, player.pos.z)) player.pos.x += sx;
    if (!blocked(player.pos.x, player.pos.z + sz)) player.pos.z += sz;
  }
}

function updatePlayer(dt) {
  const playing = state.mode === 'playing';
  let strafe = 0;
  let forwardInput = 0;
  if (playing) {
    if (keys.KeyW) forwardInput += 1;
    if (keys.KeyS) forwardInput -= 1;
    if (keys.KeyD) strafe += 1;
    if (keys.KeyA) strafe -= 1;
  }
  const run = playing && (keys.ShiftLeft || keys.ShiftRight);
  const speed = run ? 3.3 : 1.85;

  const sy = Math.sin(player.yaw);
  const cy = Math.cos(player.yaw);
  const fwdX = -sy;
  const fwdZ = -cy;
  const rightX = cy;
  const rightZ = -sy;

  let tx = (fwdX * forwardInput + rightX * strafe);
  let tz = (fwdZ * forwardInput + rightZ * strafe);
  const mag = Math.hypot(tx, tz);
  if (mag > 1) { tx /= mag; tz /= mag; }

  const accel = playing ? 10 : 4;
  player.vel.x += (tx * speed - player.vel.x) * Math.min(1, dt * accel);
  player.vel.z += (tz * speed - player.vel.z) * Math.min(1, dt * accel);
  if (!playing) {
    player.vel.x *= Math.max(0, 1 - dt * 6);
    player.vel.z *= Math.max(0, 1 - dt * 6);
  }

  if (Math.abs(player.vel.x) + Math.abs(player.vel.z) > 0.01) {
    tryMove(player.vel.x * dt, player.vel.z * dt);
  }

  const spd = Math.hypot(player.vel.x, player.vel.z);
  if (spd > 0.2) {
    player.walkPhase += dt * (run ? 10.5 : 7.2);
    player.stepDist += spd * dt;
    const stride = run ? 1.65 : 1.1;
    if (player.stepDist > stride) {
      player.stepDist = 0;
      if (playing) audio.footstep(run);
    }
  }

  const bobAmt = Math.min(1, spd / 3.2);
  player.bob = Math.sin(player.walkPhase * 2) * 0.026 * bobAmt;

  const lowSan = 1 - state.sanity / 100;
  const breath = Math.sin(state.time * 1.55) * 0.0045;
  const swayX = Math.sin(state.time * 0.43) * 0.012 * lowSan;
  const swayY = Math.sin(state.time * 0.57 + 1.2) * 0.008 * lowSan;

  state.shake = Math.max(0, state.shake - dt * 2.6);
  const sh = state.shake * state.shake;
  const shakeX = (Math.random() - 0.5) * 0.08 * sh;
  const shakeY = (Math.random() - 0.5) * 0.06 * sh;
  const shakeR = (Math.random() - 0.5) * 0.08 * sh;

  camera.position.set(
    player.pos.x + swayX + shakeX,
    world.EYE + player.bob + breath + swayY + shakeY,
    player.pos.z
  );
  camera.rotation.set(
    player.pitch + shakeR * 0.6,
    player.yaw + shakeR,
    -strafe * 0.012 + Math.sin(state.time * 0.6) * 0.012 * lowSan + shakeR * 0.4
  );
}

function updateMenuCamera(dt, snap = false) {
  menuTime += dt;
  const t = menuTime;
  const z = 7.45 + Math.sin(t * 0.11) * 0.35;
  const x = Math.sin(t * 0.08) * 0.16;
  if (snap) {
    camera.position.set(x, 1.54, z);
    camera.rotation.set(-0.012, 0.035 + Math.sin(t * 0.09) * 0.02, 0);
  } else {
    camera.position.x += (x - camera.position.x) * Math.min(1, dt * 0.8);
    camera.position.y += (1.54 - camera.position.y) * Math.min(1, dt * 0.8);
    camera.position.z += (z - camera.position.z) * Math.min(1, dt * 0.8);
    camera.rotation.x += (-0.012 - camera.rotation.x) * Math.min(1, dt * 0.8);
    camera.rotation.y += (0.035 + Math.sin(t * 0.09) * 0.02 - camera.rotation.y) * Math.min(1, dt * 0.8);
    camera.rotation.z += (0 - camera.rotation.z) * Math.min(1, dt * 0.8);
  }
  flashlight.visible = false;
  flashFill.intensity = 0;
}

/* ── game flow ──────────────────────────────────────────────── */
function startGame() {
  if (state.mode !== 'menu') return;
  audio.init();
  audio.click();
  document.body.classList.add('playing');
  resetRun();
  state.mode = 'intro';
  ui.menu.classList.remove('visible');
  ui.hud.classList.remove('hidden');
  ui.introCard.classList.remove('hidden');
  ui.introCard.style.opacity = '1';
  const p1 = ui.introCard.querySelector('.intro-1');
  const p2 = ui.introCard.querySelector('.intro-2');
  p1.classList.remove('show');
  p2.classList.remove('show');
  requestLock();

  setTimeout(() => p1.classList.add('show'), 500);
  setTimeout(() => p2.classList.add('show'), 2900);
  setTimeout(() => { ui.introCard.style.opacity = '0'; }, 5400);
  setTimeout(() => {
    ui.introCard.classList.add('hidden');
    if (state.mode === 'intro') {
      state.mode = 'playing';
      showSubtitle('Find the five memories.', 4.6);
      setObjective('Find the five memories');
    }
  }, 7200);
}

function resetRun() {
  state.memories = 0;
  state.sanity = 100;
  state.battery = 100;
  state.flashlightOn = true;
  state.doorUnlocked = false;
  state.subtitleTimer = 0;
  state.flash = 0;
  state.damage = 0;
  state.shake = 0;
  state.nextLightning = 18 + Math.random() * 18;
  state.nextEntity = 55 + Math.random() * 25;
  state.forceSpawn = 0;
  state.endingTimer = 0;
  player.pos.set(0, 0, -8.55);
  player.vel.set(0, 0, 0);
  player.yaw = Math.PI;
  player.pitch = 0;
  player.walkPhase = 0;
  player.stepDist = 0;

  for (const s of world.shards) {
    s.visible = true;
    s.userData.active = true;
    s.userData.light.intensity = 0.9;
    s.position.y = s.userData.baseY;
  }
  for (const b of world.batteries) {
    b.visible = true;
    b.userData.active = true;
    b.position.y = b.userData.baseY;
  }
  for (const n of world.notes) n.userData.active = true;

  if (entity) {
    entity.active = false;
    entity.attack = 0;
    entity.cooldown = 0;
    entity.group.visible = false;
    entity.group.scale.set(1, 1, 1);
  }

  world.doorGroup.rotation.y = 0;
  world.doorGroup.rotation.z = 0;
  world.doorMesh.visible = true;
  world.doorLight.intensity = 1.1;

  ui.death.classList.remove('visible');
  ui.ending.classList.remove('visible');
  ui.pause.classList.remove('visible');
  ui.note.classList.remove('visible');
  ui.help.classList.remove('visible');
  ui.hud.classList.remove('hidden');
  ui.fade.classList.remove('on');
  ui.fade.classList.remove('flash');
  ui.subtitle.classList.remove('show');
  ui.prompt.classList.add('hidden');
  ui.crosshair.classList.remove('active');
  ui.memoryCount.innerHTML = '0 <i>/ 5</i>';
  ui.sanityBar.style.width = '100%';
  ui.sanityVal.textContent = '100';
  ui.batteryBar.style.width = '100%';
  ui.batteryVal.textContent = '100';
  ui.flashState.textContent = 'ON';
  ui.flashState.classList.remove('off');
  ui.flashWarning.classList.remove('show');
  ui.location.classList.remove('show');
  ui.objective.textContent = 'Find the five memories';
  state.room = 'HALLWAY';
  updateHUD();
}

function pauseGame() {
  if (state.mode !== 'playing') return;
  state.mode = 'paused';
  ui.pause.classList.add('visible');
  document.body.classList.add('paused');
  if (document.pointerLockElement) document.exitPointerLock();
  audio.click();
}

function resumeGame() {
  if (state.mode !== 'paused') return;
  state.mode = 'playing';
  ui.pause.classList.remove('visible');
  document.body.classList.remove('paused');
  requestLock();
  audio.click();
}

function toMenu() {
  state.mode = 'menu';
  if (document.pointerLockElement) document.exitPointerLock();
  document.body.classList.remove('playing');
  document.body.classList.remove('paused');
  for (const k in keys) keys[k] = false;
  player.dragging = false;
  ui.hud.classList.add('hidden');
  ui.pause.classList.remove('visible');
  ui.death.classList.remove('visible');
  ui.ending.classList.remove('visible');
  ui.note.classList.remove('visible');
  ui.help.classList.remove('visible');
  ui.introCard.classList.add('hidden');
  ui.fade.classList.remove('on');
  ui.subtitle.classList.remove('show');
  resetRun();
  ui.hud.classList.add('hidden');
  ui.menu.classList.add('visible');
  audio.setEntity(false, 999);
  audio.click();
  updateMenuCamera(0, true);
}

function die() {
  if (state.mode === 'dead') return;
  state.mode = 'dead';
  audio.jumpscare();
  if (document.pointerLockElement) document.exitPointerLock();
  ui.fade.classList.add('on');
  setTimeout(() => {
    ui.hud.classList.add('hidden');
    ui.death.classList.add('visible');
    document.body.classList.add('paused');
    ui.fade.classList.remove('on');
  }, 900);
}

function retry() {
  ui.death.classList.remove('visible');
  ui.ending.classList.remove('visible');
  resetRun();
  state.mode = 'playing';
  document.body.classList.add('playing');
  document.body.classList.remove('paused');
  requestLock();
  audio.click();
  showSubtitle('Find the five memories.', 3.4);
}

function finishGame() {
  if (state.mode !== 'playing') return;
  state.mode = 'endingSeq';
  state.endingTimer = 2.6;
  state.doorUnlocked = true;
  ui.prompt.classList.add('hidden');
  audio.doorOpen();
  world.doorGroup.rotation.y = 0;
  world.doorGroup.rotation.z = 0;
  world.pulseBlackout(0.35);
  if (document.pointerLockElement) document.exitPointerLock();
}

function showEnding() {
  state.mode = 'ending';
  ui.hud.classList.add('hidden');
  ui.fade.classList.add('on');
  setTimeout(() => {
    ui.ending.classList.add('visible');
    document.body.classList.remove('playing');
    document.body.classList.add('paused');
    ui.fade.classList.remove('on');
  }, 900);
}

/* ── interactions ───────────────────────────────────────────── */
function lineBlockedTo(p) {
  const from = camera.position;
  const dx = p.x - from.x;
  const dz = p.z - from.z;
  const dist = Math.hypot(dx, dz);
  const steps = Math.max(2, Math.ceil(dist / 0.2));
  for (let i = 2; i < steps - 1; i++) {
    const t = i / steps;
    const x = from.x + dx * t;
    const z = from.z + dz * t;
    for (const c of world.colliders) {
      if (c.wall && x > c.minX + 0.03 && x < c.maxX - 0.03 && z > c.minZ + 0.03 && z < c.maxZ - 0.03) {
        return true;
      }
    }
  }
  return false;
}

function findInteractable() {
  if (state.mode !== 'playing') return null;
  let best = null;
  let bestScore = -Infinity;
  for (const it of world.interactables) {
    if (it.userData.active === false) continue;
    it.getWorldPosition(tmpV2);
    const dx = tmpV2.x - camera.position.x;
    const dy = tmpV2.y - camera.position.y;
    const dz = tmpV2.z - camera.position.z;
    const d = Math.hypot(dx, dy, dz);
    if (d > 2.7) continue;
    // require the object to be close to the crosshair in screen space
    tmpV2.project(camera);
    if (tmpV2.z < -1 || tmpV2.z > 1) continue;
    const off = Math.max(Math.abs(tmpV2.x), Math.abs(tmpV2.y));
    if (off > 0.26) continue;
    if (lineBlockedTo(it.getWorldPosition(tmpV2))) continue;
    const score = (0.26 - off) * 3 - d * 0.2;
    if (score > bestScore) {
      bestScore = score;
      best = it;
    }
  }
  return best;
}

let currentInteractable = null;

function updateInteractionUI() {
  if (state.mode !== 'playing') {
    currentInteractable = null;
    ui.prompt.classList.add('hidden');
    ui.crosshair.classList.remove('active');
    return;
  }
  const it = findInteractable();
  currentInteractable = it;
  if (!it) {
    ui.prompt.classList.add('hidden');
    ui.crosshair.classList.remove('active');
    return;
  }
  let label = it.userData.label;
  if (it.userData.type === 'door') {
    label = state.doorUnlocked ? 'OPEN THE DOOR' : 'TRY THE DOOR';
  }
  ui.promptText.textContent = label;
  ui.prompt.classList.remove('hidden');
  ui.crosshair.classList.add('active');
}

function interact() {
  const it = currentInteractable || findInteractable();
  if (!it) return;
  const type = it.userData.type;
  if (type === 'memory') collectMemory(it);
  else if (type === 'battery') collectBattery(it);
  else if (type === 'note') openNote(it);
  else if (type === 'door') tryDoor();
}

function collectMemory(shard) {
  if (!shard.userData.active) return;
  shard.userData.active = false;
  shard.visible = false;
  shard.userData.light.intensity = 0;
  const idx = shard.userData.index;
  state.memories++;
  state.sanity = Math.max(1, state.sanity - 7);
  state.flash = 0.28;
  state.shake = 0.45;
  world.pulseBlackout(1);
  audio.pickup();
  audio.stinger();
  showSubtitle(MEMORY_TEXT[idx] || '', 6.4);
  ui.memoryCount.innerHTML = `${state.memories} <i>/ 5</i>`;
  state.forceSpawn = 1.6;
  updateHUD();

  if (state.memories >= 5) {
    state.doorUnlocked = true;
    setObjective('The door is open. Leave.');
    setTimeout(() => showSubtitle('The chain falls away. The door is open.', 5.5), 2500);
    audio.doorOpen();
  } else {
    setObjective(`Find the five memories — ${state.memories} of 5`);
  }
}

function collectBattery(b) {
  if (!b.userData.active) return;
  b.userData.active = false;
  b.visible = false;
  state.battery = Math.min(100, state.battery + 46);
  if (!state.flashlightOn) state.flashlightOn = true;
  audio.battery();
  showSubtitle('A fresh battery. The beam steadies.', 2.8);
  updateHUD();
}

function openNote(note) {
  state.mode = 'note';
  ui.noteText.textContent = note.userData.text;
  ui.noteSign.textContent = note.userData.sign || '';
  ui.note.classList.add('visible');
  document.body.classList.add('paused');
  if (document.pointerLockElement) document.exitPointerLock();
  audio.click();
}

function closeNote() {
  if (state.mode !== 'note') return;
  state.mode = 'playing';
  ui.note.classList.remove('visible');
  document.body.classList.remove('paused');
  requestLock();
  audio.click();
}

function tryDoor() {
  if (state.doorUnlocked) {
    finishGame();
  } else {
    const left = 5 - state.memories;
    showSubtitle(
      left === 5
        ? 'The chain holds. Five memories are still missing.'
        : `The chain holds. ${left} ${left === 1 ? 'memory is' : 'memories are'} still missing.`,
      3.4
    );
    audio.click();
    world.doorGroup.rotation.z = Math.sin(state.time * 30) * 0.004;
  }
}

/* ── flashlight ─────────────────────────────────────────────── */
function toggleFlashlight() {
  if (state.battery <= 0) {
    showSubtitle('The battery is dead.', 2.4);
    audio.click();
    return;
  }
  state.flashlightOn = !state.flashlightOn;
  audio.click();
  updateHUD();
}

function updateFlashlight(dt) {
  const active = state.mode !== 'menu' && state.mode !== 'dead' && state.mode !== 'ending';
  const on = active && state.flashlightOn && state.battery > 0;
  flashlight.visible = on;
  flashFill.intensity = on ? 0.9 : 0;
  if (!on) {
    flashlight.intensity = 0;
    return;
  }
  if (state.mode === 'playing') {
    state.battery = Math.max(0, state.battery - dt * 0.5);
    if (state.battery <= 0) {
      state.flashlightOn = false;
      showSubtitle('The light dies.', 2.6);
      audio.click();
      updateHUD();
    }
  }
  const weak = state.battery < 18 ? 0.55 + Math.random() * 0.45 : 1;
  flashlight.intensity = 90 * weak * (0.93 + Math.random() * 0.07);
}

/* ── HUD / subtitles ────────────────────────────────────────── */
function setObjective(text) {
  ui.objective.textContent = text;
}

function showSubtitle(text, duration = 5) {
  if (!text) return;
  ui.subtitle.textContent = text;
  ui.subtitle.classList.add('show');
  state.subtitleTimer = duration;
}

function updateHUD() {
  const s = Math.max(0, Math.min(100, state.sanity));
  const b = Math.max(0, Math.min(100, state.battery));
  ui.sanityBar.style.width = s + '%';
  ui.sanityVal.textContent = Math.round(s);
  ui.sanityBar.classList.toggle('low', s < 35);
  ui.batteryBar.style.width = b + '%';
  ui.batteryVal.textContent = Math.round(b);
  ui.batteryBar.classList.toggle('low', b < 20);
  const on = state.flashlightOn && b > 0;
  ui.flashState.textContent = b <= 0 ? 'DEAD' : on ? 'ON' : 'OFF';
  ui.flashState.classList.toggle('off', !on);
  ui.flashWarning.classList.toggle('show', on && b < 18);
  ui.memoryCount.innerHTML = `${state.memories} <i>/ 5</i>`;
}

function updateLocation() {
  const room = world.roomAt(player.pos.x, player.pos.z);
  if (room !== state.room) {
    state.room = room;
    ui.location.textContent = room;
    ui.location.classList.add('show');
    clearTimeout(updateLocation._timer);
    updateLocation._timer = setTimeout(() => ui.location.classList.remove('show'), 2200);
  }
}

/* ── settings / menus ───────────────────────────────────────── */
function loadSettings() {
  try {
    const raw = localStorage.getItem('hollow-hour-settings');
    if (!raw) return;
    const s = JSON.parse(raw);
    if (typeof s.sensitivity === 'number') player.sensitivity = s.sensitivity;
    if (typeof s.volume === 'number') audio.volume = s.volume;
    if (typeof s.muted === 'boolean') audio.muted = s.muted;
  } catch {}
  ui.optSens.value = player.sensitivity;
  ui.optSensVal.textContent = player.sensitivity.toFixed(1);
  ui.optVol.value = audio.volume;
  ui.optVolVal.textContent = Math.round(audio.volume * 100);
  ui.menuSound.textContent = audio.muted ? 'SOUND: OFF' : 'SOUND: ON';
}

function saveSettings() {
  try {
    localStorage.setItem('hollow-hour-settings', JSON.stringify({
      sensitivity: player.sensitivity,
      volume: audio.volume,
      muted: audio.muted,
    }));
  } catch {}
}

function toggleSound() {
  audio.init();
  audio.setMuted(!audio.muted);
  ui.menuSound.textContent = audio.muted ? 'SOUND: OFF' : 'SOUND: ON';
  saveSettings();
  if (!audio.muted) audio.click();
}

ui.optSens.addEventListener('input', () => {
  player.sensitivity = parseFloat(ui.optSens.value);
  ui.optSensVal.textContent = player.sensitivity.toFixed(1);
  saveSettings();
});
ui.optVol.addEventListener('input', () => {
  audio.init();
  audio.setVolume(parseFloat(ui.optVol.value));
  ui.optVolVal.textContent = Math.round(audio.volume * 100);
  ui.menuSound.textContent = audio.muted ? 'SOUND: OFF' : 'SOUND: ON';
  saveSettings();
});
ui.menuSound.addEventListener('click', toggleSound);

$('btn-start').addEventListener('click', startGame);
$('btn-help').addEventListener('click', () => {
  state.helpReturn = state.mode;
  if (state.mode === 'paused') ui.pause.classList.remove('visible');
  ui.help.classList.add('visible');
  audio.click();
});
$('btn-help-close').addEventListener('click', () => {
  ui.help.classList.remove('visible');
  if (state.helpReturn === 'paused' && state.mode === 'paused') ui.pause.classList.add('visible');
  state.helpReturn = null;
  audio.click();
});
$('btn-pause-help').addEventListener('click', () => {
  state.helpReturn = 'paused';
  ui.pause.classList.remove('visible');
  ui.help.classList.add('visible');
  audio.click();
});
$('btn-resume').addEventListener('click', resumeGame);
$('btn-quit').addEventListener('click', toMenu);
$('btn-retry').addEventListener('click', retry);
$('btn-death-title').addEventListener('click', toMenu);
$('btn-ending-title').addEventListener('click', toMenu);
ui.note.addEventListener('click', (e) => {
  if (e.target === ui.note || e.target.closest('.note-paper')) closeNote();
});

/* ── resize ─────────────────────────────────────────────────── */
window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (post) post.setSize(w, h);
});

/* ── main loop ──────────────────────────────────────────────── */
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, Math.max(0.001, (now - clock.last) / 1000));
  clock.last = now;
  state.time += dt;

  if (state.mode === 'menu') {
    updateMenuCamera(dt);
    world.update(dt);
    audio.update(dt);
    const entI = 0;
    post.render(dt, {
      sanity: 1, entity: entI, flash: 0, damage: 0, fade: 0, glitch: 0,
    });
    return;
  }

  if (state.mode === 'playing' || state.mode === 'intro' || state.mode === 'endingSeq') {
    updatePlayer(dt);

    if (state.mode === 'playing') {
      updateFlashlight(dt);
      updateEntity(dt);

      // sanity: lit rooms mend you, darkness eats at you
      const lit = world.isLit(player.pos);
      if (!entity.visible) {
        if (lit) state.sanity += dt * 1.35;
        else state.sanity -= dt * (state.flashlightOn ? 0.38 : 1.45);
      }
      state.sanity = Math.max(0, Math.min(100, state.sanity));

      // random appearance
      state.nextEntity -= dt;
      if (state.forceSpawn > 0) {
        state.forceSpawn -= dt;
        if (state.forceSpawn <= 0) spawnEntity();
      } else if (state.nextEntity <= 0) {
        if (state.memories > 0) spawnEntity();
        state.nextEntity = 42 + Math.random() * 32;
      }

      // lightning
      state.nextLightning -= dt;
      if (state.nextLightning <= 0) {
        world.triggerLightning();
        audio.thunder();
        state.flash = Math.max(state.flash, 0.18);
        state.nextLightning = 22 + Math.random() * 26;
      }

      updateLocation();
      updateInteractionUI();
      updateHUD();

      if (state.subtitleTimer > 0) {
        state.subtitleTimer -= dt;
        if (state.subtitleTimer <= 0) ui.subtitle.classList.remove('show');
      }

      if (state.sanity <= 0) die();
    } else if (state.mode === 'endingSeq') {
      updateFlashlight(dt);
      state.endingTimer -= dt;
      world.doorGroup.rotation.y = Math.max(-1.15, world.doorGroup.rotation.y - dt * 0.85);
      if (state.endingTimer <= 0) showEnding();
    } else {
      updateFlashlight(dt);
    }

    world.update(dt);
    audio.update(dt);

    // audio beds
    audio.setSanity(state.sanity / 100);
    audio.setEntity(entity.active, entity.distance);

    state.flash = Math.max(0, state.flash - dt * 2.6);
    state.damage = Math.max(0, state.damage - dt * 1.4);

    const entI = entity.active && entity.visible
      ? Math.min(1, Math.max(0, 1 - entity.distance / 11)) * (entity.attack > 0 ? 1 : 0.8)
      : 0;
    const glitch = Math.min(1, entI * 1.2 + (1 - state.sanity / 100) * 0.4);
    post.render(dt, {
      sanity: state.sanity / 100,
      entity: entI,
      flash: state.flash,
      damage: state.damage,
      fade: 0,
      glitch,
    });
    return;
  }

  // paused / note / dead / ending: keep the world breathing, but frozen player
  world.update(dt);
  audio.update(dt);
  if (state.mode === 'paused' || state.mode === 'note') {
    audio.setEntity(false, 999);
  }
  const entI = state.mode === 'note' && entity.active && entity.visible
    ? Math.min(1, Math.max(0, 1 - entity.distance / 11)) * 0.35
    : 0;
  post.render(dt, {
    sanity: state.sanity / 100,
    entity: entI,
    flash: state.flash,
    damage: state.damage,
    fade: 0,
    glitch: (1 - state.sanity / 100) * 0.35,
  });
}

/* ── go ─────────────────────────────────────────────────────── */
loadSettings();
boot().catch((err) => {
  console.error(err);
  ui.loadStatus.textContent = 'The apartment would not open. ' + err.message;
});

/* Debug/verification hooks. Harmless in normal play; used by the visual checks. */
window.__hollow = {
  player,
  state,
  get world() { return world; },
  flashlight,
  get entity() { return entity; },
  teleport(x, z, yaw = Math.PI, pitch = 0) {
    player.pos.set(x, 0, z);
    player.vel.set(0, 0, 0);
    player.yaw = yaw;
    player.pitch = pitch;
  },
  look(yaw, pitch = 0) {
    player.yaw = yaw;
    player.pitch = pitch;
  },
  sanity(v) { state.sanity = v; },
  battery(v) { state.battery = v; },
  memories(n) {
    state.memories = n;
    state.doorUnlocked = n >= 5;
    updateHUD();
  },
  probe(nx = 0, ny = 0) {
    const rc = new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2(nx, ny), camera);
    return rc.intersectObjects(scene.children, true).slice(0, 6).map((h) => ({
      dist: Number(h.distance.toFixed(2)),
      type: h.object.type,
      pos: h.object.position.toArray().map((v) => Number(v.toFixed(2))),
      geo: h.object.geometry?.parameters || null,
    }));
  },
  spawnEntity,
  finishGame,
  die,
};
