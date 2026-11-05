import * as THREE from '../vendor/three.module.js';
import {
  wallpaperTexture, woodFloorTexture, carpetTexture, tileTexture, ceilingTexture,
  doorTexture, fabricTexture, sheetTexture, woodFurnitureTexture, metalTexture,
  photoTexture, portraitTexture, tvStaticTexture, rainTexture, paperTexture,
  glowTexture, stainDecalTexture, windowTexture,
} from './textures.js';

export const H = 2.85;
const WT = 0.16;
const EYE = 1.64;

function rectCollider(colliders, x, z, hw, hd) {
  colliders.push({ minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd });
}

function box(parent, w, h, d, x, y, z, mat, cast = true, receive = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  parent.add(mesh);
  return mesh;
}

function plane(parent, w, h, x, y, z, mat, rx = 0, ry = 0, rz = 0, receive = true) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.receiveShadow = receive;
  parent.add(mesh);
  return mesh;
}

function texClone(tex, rx, ry) {
  const t = tex.clone();
  t.needsUpdate = true;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function standard(tex, rx, ry, opts = {}) {
  const map = texClone(tex, rx, ry);
  const mat = new THREE.MeshStandardMaterial({
    map,
    roughness: opts.roughness ?? 0.86,
    metalness: opts.metalness ?? 0.02,
    color: opts.color ?? 0xffffff,
    bumpMap: opts.bump === false ? null : map,
    bumpScale: opts.bumpScale ?? 0.018,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    side: opts.side ?? THREE.FrontSide,
  });
  return mat;
}

function basic(tex, rx, ry, opts = {}) {
  const map = texClone(tex, rx, ry);
  return new THREE.MeshBasicMaterial({
    map,
    color: opts.color ?? 0xffffff,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
    depthWrite: opts.depthWrite ?? true,
    blending: opts.blending ?? THREE.NormalBlending,
  });
}

export function buildWorld(scene, renderer) {
  const colliders = [];
  const interactables = [];
  const shards = [];
  const batteries = [];
  const notes = [];
  const flickerLights = [];
  const lightSources = [];
  const rainPlanes = [];
  const tvScreens = [];
  const mirrorMaterials = [];
  const animated = [];

  scene.fog = new THREE.FogExp2(0x050607, 0.052);
  scene.background = new THREE.Color(0x030303);

  /* ── textures & materials ─────────────────────────────────── */
  const T = {
    wall: wallpaperTexture(101, 'olive'),
    wallRose: wallpaperTexture(202, 'rose'),
    floor: woodFloorTexture(303),
    carpet: carpetTexture(404),
    tile: tileTexture(505),
    ceiling: ceilingTexture(606),
    door: doorTexture(707),
    fabric: fabricTexture(808),
    sheet: sheetTexture(909),
    wood: woodFurnitureTexture(111),
    metal: metalTexture(222),
    photo: photoTexture(333),
    portrait: portraitTexture(444),
    tv: tvStaticTexture(555),
    rain: rainTexture(666),
    paper: paperTexture(777),
    glow: glowTexture(),
    stain: stainDecalTexture(888),
    window: windowTexture(999),
  };

  const M = {
    wallHall: standard(T.wall, 2.4, 1.4, { roughness: 0.95, bumpScale: 0.024 }),
    wallLiving: standard(T.wall, 2.4, 1.4, { roughness: 0.95, bumpScale: 0.024, color: 0xd6d0c0 }),
    wallBed: standard(T.wallRose, 2.4, 1.4, { roughness: 0.95, bumpScale: 0.024, color: 0xcfc4bb }),
    wallBath: standard(T.tile, 2.2, 1.4, { roughness: 0.66, bumpScale: 0.008, color: 0xb5b6ab }),
    wallStudy: standard(T.wall, 2.4, 1.4, { roughness: 0.95, bumpScale: 0.024, color: 0xbdb9a8 }),
    floorHall: standard(T.floor, 3.2, 7.2, { roughness: 0.72, bumpScale: 0.03 }),
    floorLiving: standard(T.carpet, 3.2, 3.2, { roughness: 1, bumpScale: 0.05, color: 0xb9a89a }),
    floorBed: standard(T.carpet, 3, 3, { roughness: 1, bumpScale: 0.05, color: 0xa89a8e }),
    floorBath: standard(T.tile, 2.2, 2.4, { roughness: 0.56, bumpScale: 0.006, color: 0xb0b1a6 }),
    floorStudy: standard(T.floor, 3, 2.4, { roughness: 0.74, bumpScale: 0.03, color: 0xb0a58f }),
    ceiling: standard(T.ceiling, 3, 3, { roughness: 1, bumpScale: 0.03, color: 0x9a9484 }),
    door: standard(T.door, 1, 1, { roughness: 0.7, bumpScale: 0.02 }),
    fabric: standard(T.fabric, 2, 2, { roughness: 1, bumpScale: 0.03, color: 0x8d9182 }),
    sheet: standard(T.sheet, 2, 2, { roughness: 1, bumpScale: 0.02, color: 0xb8b2a2 }),
    wood: standard(T.wood, 2, 2, { roughness: 0.7, bumpScale: 0.02, color: 0x9a7f63 }),
    woodDark: standard(T.wood, 2, 2, { roughness: 0.75, bumpScale: 0.02, color: 0x6c5743 }),
    metal: standard(T.metal, 2, 2, { roughness: 0.42, metalness: 0.7, color: 0x9aa0a0 }),
    brass: new THREE.MeshStandardMaterial({ color: 0x8a6a35, roughness: 0.34, metalness: 0.9 }),
    black: new THREE.MeshStandardMaterial({ color: 0x0b0c0c, roughness: 0.92 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1b1a17, roughness: 0.9 }),
    white: new THREE.MeshStandardMaterial({ color: 0xb9b3a2, roughness: 0.7 }),
    ceramic: new THREE.MeshStandardMaterial({ color: 0xb6b2a6, roughness: 0.3, metalness: 0.05 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x1b2830, roughness: 0.12, metalness: 0.4, transparent: true, opacity: 0.75 }),
    tv: new THREE.MeshBasicMaterial({ map: T.tv, toneMapped: false }),
    paper: standard(T.paper, 1, 1, { roughness: 0.9, bumpScale: 0.004, emissive: 0x2a2418, emissiveIntensity: 0.25 }),
    water: new THREE.MeshStandardMaterial({ color: 0x0b1213, roughness: 0.08, metalness: 0.85 }),
  };

  /* ── helpers ──────────────────────────────────────────────── */
  function wall(x1, z1, x2, z2, mat, h = H, opts = {}) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    const cx = (x1 + x2) / 2;
    const cz = (z1 + z2) / 2;
    const geo = new THREE.BoxGeometry(len, h, WT);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx, h / 2, cz);
    mesh.rotation.y = -Math.atan2(dz, dx);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    const pad = WT / 2;
    colliders.push({
      minX: Math.min(x1, x2) - pad,
      maxX: Math.max(x1, x2) + pad,
      minZ: Math.min(z1, z2) - pad,
      maxZ: Math.max(z1, z2) + pad,
      wall: true,
    });
    if (opts.baseboard) {
      for (const side of [-1, 1]) {
        const bx = new THREE.Mesh(new THREE.BoxGeometry(len, 0.13, 0.045), M.woodDark);
        bx.position.set(cx, 0.065, cz);
        bx.rotation.y = mesh.rotation.y;
        bx.translateZ(side * (WT / 2 + 0.023));
        scene.add(bx);
        const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.055, 0.035), M.woodDark);
        rail.position.set(cx, 1.02, cz);
        rail.rotation.y = mesh.rotation.y;
        rail.translateZ(side * (WT / 2 + 0.018));
        scene.add(rail);
      }
    }
    return mesh;
  }

  function floor(x1, z1, x2, z2, mat) {
    const w = x2 - x1;
    const d = z2 - z1;
    const m = plane(scene, w, d, (x1 + x2) / 2, 0.005, (z1 + z2) / 2, mat, -Math.PI / 2, 0, 0);
    m.receiveShadow = true;
    return m;
  }

  function ceiling(x1, z1, x2, z2) {
    const w = x2 - x1;
    const d = z2 - z1;
    return plane(scene, w, d, (x1 + x2) / 2, H, (z1 + z2) / 2, M.ceiling, Math.PI / 2, 0, 0);
  }

  function doorFrame(x, z, width, alongZ = true, h = 2.22) {
    const t = 0.09;
    const d = 0.26;
    if (alongZ) {
      box(scene, d, h, t, x, h / 2, z - width / 2, M.woodDark, false);
      box(scene, d, h, t, x, h / 2, z + width / 2, M.woodDark, false);
      box(scene, d, t, width + t, x, h, z, M.woodDark, false);
    } else {
      box(scene, t, h, d, x - width / 2, h / 2, z, M.woodDark, false);
      box(scene, t, h, d, x + width / 2, h / 2, z, M.woodDark, false);
      box(scene, width + t, t, d, x, h, z, M.woodDark, false);
    }
  }

  function stainDecal(x, y, z, ry, scale = 1, opacity = 0.55) {
    const m = new THREE.MeshBasicMaterial({
      map: T.stain, transparent: true, opacity, depthWrite: false,
      color: 0x1a120a, side: THREE.DoubleSide,
    });
    const p = plane(scene, scale, scale, x, y, z, m, 0, ry, 0, false);
    p.renderOrder = 1;
    return p;
  }

  function addGlowSprite(parent, color, scale, opacity = 0.7) {
    const mat = new THREE.SpriteMaterial({
      map: T.glow, color, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const s = new THREE.Sprite(mat);
    s.scale.set(scale, scale, 1);
    parent.add(s);
    return s;
  }

  /* ── architecture ─────────────────────────────────────────── */

  // floors
  floor(-1.2, -10, 1.2, 10, M.floorHall);
  floor(-6, -6, -1.2, 0, M.floorLiving);
  floor(1.2, -2, 6, 4, M.floorBed);
  floor(-4.8, 2, -1.2, 6, M.floorBath);
  floor(1.2, 6, 5.4, 10, M.floorStudy);

  // ceilings
  ceiling(-1.2, -10, 1.2, 10);
  ceiling(-6, -6, -1.2, 0);
  ceiling(1.2, -2, 6, 4);
  ceiling(-4.8, 2, -1.2, 6);
  ceiling(1.2, 6, 5.4, 10);

  // hallway walls, with openings for the four rooms
  wall(-1.2, -10, -1.2, -4.2, M.wallHall, H, { baseboard: true });
  wall(-1.2, -2.8, -1.2, 3.4, M.wallHall, H, { baseboard: true });
  wall(-1.2, 4.8, -1.2, 10, M.wallHall, H, { baseboard: true });
  wall(1.2, -10, 1.2, 0.2, M.wallHall, H, { baseboard: true });
  wall(1.2, 1.6, 1.2, 7.4, M.wallHall, H, { baseboard: true });
  wall(1.2, 8.8, 1.2, 10, M.wallHall, H, { baseboard: true });

  // hallway end + front wall
  wall(-1.2, 10, 1.2, 10, M.wallHall, H, { baseboard: true });
  wall(-1.2, -10, -0.72, -10, M.wallHall, H, { baseboard: true });
  wall(0.72, -10, 1.2, -10, M.wallHall, H, { baseboard: true });

  // living room
  wall(-6, -6, -6, 0, M.wallLiving, H, { baseboard: true });
  wall(-6, -6, -1.2, -6, M.wallLiving, H, { baseboard: true });
  wall(-6, 0, -1.2, 0, M.wallLiving, H, { baseboard: true });

  // bedroom
  wall(1.2, -2, 6, -2, M.wallBed, H, { baseboard: true });
  wall(6, -2, 6, 4, M.wallBed, H, { baseboard: true });
  wall(1.2, 4, 6, 4, M.wallBed, H, { baseboard: true });

  // bathroom
  wall(-4.8, 2, -4.8, 6, M.wallBath, H, { baseboard: true });
  wall(-4.8, 2, -1.2, 2, M.wallBath, H, { baseboard: true });
  wall(-4.8, 6, -1.2, 6, M.wallBath, H, { baseboard: true });

  // study
  wall(1.2, 6, 5.4, 6, M.wallStudy, H, { baseboard: true });
  wall(5.4, 6, 5.4, 10, M.wallStudy, H, { baseboard: true });
  wall(1.2, 10, 5.4, 10, M.wallStudy, H, { baseboard: true });

  // door frames
  doorFrame(-1.2, -3.5, 1.4, true);
  doorFrame(1.2, 0.9, 1.4, true);
  doorFrame(-1.2, 4.1, 1.4, true);
  doorFrame(1.2, 8.1, 1.4, true);
  doorFrame(0, -10, 1.44, false);

  // bathroom tiled wainscot
  const wainMat = standard(T.tile, 3, 1.2, { roughness: 0.5, bumpScale: 0.006, color: 0xc3c4ba });
  plane(scene, 3.6, 1.35, -1.285, 0.675, 4, wainMat, 0, Math.PI / 2, 0);
  plane(scene, 3.6, 1.35, -4.785, 0.675, 4, wainMat, 0, -Math.PI / 2, 0);
  plane(scene, 3.6, 1.35, -3.0, 0.675, 2.015, wainMat, 0, 0, 0);
  plane(scene, 3.6, 1.35, -3.0, 0.675, 5.985, wainMat, 0, Math.PI, 0);

  // hallway runner
  const runnerMat = standard(T.carpet, 1.2, 8, { roughness: 1, color: 0x8a6b62 });
  plane(scene, 1.5, 14.5, 0, 0.012, 0, runnerMat, -Math.PI / 2, 0, 0);

  // wall stains
  stainDecal(-1.105, 1.9, -6.7, Math.PI / 2, 1.6, 0.5);
  stainDecal(1.105, 2.2, 5.4, -Math.PI / 2, 1.4, 0.45);
  stainDecal(-3.3, 2.3, -0.075, Math.PI, 1.7, 0.4);
  stainDecal(3.7, 2.1, 3.925, Math.PI, 1.5, 0.38);
  stainDecal(-3.9, 1.6, 5.92, Math.PI, 1.2, 0.4);

  /* ── front door ───────────────────────────────────────────── */
  const doorGroup = new THREE.Group();
  const doorMesh = box(doorGroup, 1.38, 2.18, 0.075, 0.69, 1.09, 0, M.door);
  doorMesh.castShadow = true;
  // chain
  box(doorGroup, 0.42, 0.035, 0.03, 0.97, 1.28, -0.06, M.brass, false);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), M.brass);
  knob.position.set(1.21, 1.03, -0.08);
  doorGroup.add(knob);
  const knob2 = knob.clone();
  knob2.position.z = 0.08;
  doorGroup.add(knob2);
  // light bleeding under the door
  const doorGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.3, 0.035),
    new THREE.MeshBasicMaterial({ color: 0xd6b98a, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending })
  );
  doorGlow.rotation.x = -Math.PI / 2;
  doorGlow.position.set(0, 0.02, -9.87);
  scene.add(doorGlow);
  doorGroup.position.set(-0.69, 0, -9.94);
  scene.add(doorGroup);

  const doorLight = new THREE.PointLight(0xd9b077, 2.2, 4.2, 2);
  doorLight.position.set(0, 0.25, -9.5);
  scene.add(doorLight);
  lightSources.push({ pos: new THREE.Vector3(0, 1.0, -9.5), radius: 2.4, base: 2.2, light: doorLight });

  const doorInteract = new THREE.Object3D();
  doorInteract.position.set(0, 1.1, -9.75);
  doorInteract.userData = { type: 'door', label: 'TRY THE DOOR' };
  scene.add(doorInteract);
  interactables.push(doorInteract);

  /* ── lighting fixtures ────────────────────────────────────── */

  function ceilingBulb(x, z, color, intensity, distance, opts = {}) {
    const g = new THREE.Group();
    g.position.set(x, H, z);
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, opts.drop ?? 0.35, 6), M.black);
    wire.position.y = -(opts.drop ?? 0.35) / 2;
    g.add(wire);
    const shade = new THREE.Mesh(
      new THREE.ConeGeometry(0.19, 0.17, 16, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x2a2721, roughness: 0.6, metalness: 0.3, side: THREE.DoubleSide })
    );
    shade.position.y = -(opts.drop ?? 0.35) - 0.02;
    g.add(shade);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 12, 8),
      new THREE.MeshBasicMaterial({ color, toneMapped: false })
    );
    bulb.position.y = -(opts.drop ?? 0.35) - 0.1;
    g.add(bulb);
    scene.add(g);

    const light = new THREE.PointLight(color, intensity, distance, 2);
    light.position.set(x, H - (opts.drop ?? 0.35) - 0.12, z);
    scene.add(light);
    if (opts.shadow) {
      light.castShadow = true;
      light.shadow.mapSize.set(512, 512);
      light.shadow.bias = -0.002;
      light.shadow.camera.near = 0.1;
      light.shadow.camera.far = 10;
    }
    lightSources.push({ pos: light.position.clone(), radius: distance * 0.55, base: intensity, light, bulb, flicker: opts.flicker });
    if (opts.flicker) flickerLights.push({ light, bulb, base: intensity, phase: Math.random() * 10, style: opts.flicker, baseColor: new THREE.Color(color) });
    return light;
  }

  // hallway bulbs
  ceilingBulb(0, -6.2, 0xffd7a0, 9.0, 8, { drop: 0.32, flicker: 'soft' });
  ceilingBulb(0, -0.6, 0xffd7a0, 7.0, 7.5, { drop: 0.3, flicker: 'soft' });
  ceilingBulb(0, 5.4, 0xffcf95, 8.5, 8, { drop: 0.32, flicker: 'soft' });

  // living room floor lamp
  const lampG = new THREE.Group();
  lampG.position.set(-5.45, 0, -1.1);
  box(lampG, 0.36, 0.04, 0.36, 0, 0.02, 0, M.metal, false);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.5, 8), M.metal);
  pole.position.y = 0.76;
  lampG.add(pole);
  const shadeMat = new THREE.MeshStandardMaterial({ color: 0x9a7d5c, roughness: 0.9, side: THREE.DoubleSide, emissive: 0x2b1d0e, emissiveIntensity: 0.4 });
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 0.34, 20, 1, true), shadeMat);
  shade.position.y = 1.52;
  lampG.add(shade);
  scene.add(lampG);
  const lampLight = new THREE.PointLight(0xffb66b, 15.0, 9, 2);
  lampLight.position.set(-5.45, 1.48, -1.1);
  scene.add(lampLight);
  lightSources.push({ pos: lampLight.position.clone(), radius: 3.8, base: 15.0, light: lampLight });
  flickerLights.push({ light: lampLight, base: 15.0, phase: 2, style: 'soft', bulb: null });

  // bedroom lamp
  const bedLampG = new THREE.Group();
  bedLampG.position.set(5.55, 0, 0.95);
  const bedLampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.05, 12), M.brass);
  bedLampBase.position.y = 0.62;
  bedLampG.add(bedLampBase);
  const bedPole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 8), M.brass);
  bedPole.position.y = 0.8;
  bedLampG.add(bedPole);
  const bedShade = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 0.22, 16, 1, true), shadeMat);
  bedShade.position.y = 0.99;
  bedLampG.add(bedShade);
  scene.add(bedLampG);
  const bedLight = new THREE.PointLight(0xffb070, 10.0, 7.5, 2);
  bedLight.position.set(5.55, 1.0, 0.95);
  scene.add(bedLight);
  lightSources.push({ pos: bedLight.position.clone(), radius: 3.2, base: 10.0, light: bedLight });

  // bathroom fluorescent
  const bathFixture = new THREE.Group();
  bathFixture.position.set(-3.0, H - 0.04, 4.0);
  box(bathFixture, 1.1, 0.05, 0.22, 0, 0, 0, M.metal, false);
  const tube = box(bathFixture, 1.0, 0.035, 0.055, 0, -0.045, 0, new THREE.MeshBasicMaterial({ color: 0xd8e6df, toneMapped: false }), false);
  scene.add(bathFixture);
  const bathLight = new THREE.PointLight(0xcfe4dd, 8.5, 8, 2);
  bathLight.position.set(-3.0, H - 0.18, 4.0);
  scene.add(bathLight);
  lightSources.push({ pos: bathLight.position.clone(), radius: 3.1, base: 8.5, light: bathLight });
  flickerLights.push({ light: bathLight, bulb: tube, base: 8.5, phase: 5, style: 'fluorescent' });

  // study bulb
  ceilingBulb(3.2, 8.0, 0xffc98a, 13.0, 8.5, { drop: 0.5, flicker: 'soft' });

  /* ── living room furniture ────────────────────────────────── */

  // rug
  const rugMat = standard(T.carpet, 2.2, 1.8, { roughness: 1, color: 0x7c5e52 });
  plane(scene, 3.4, 2.5, -3.6, 0.015, -3.0, rugMat, -Math.PI / 2, 0, 0);

  // sofa against z = 0, facing -z
  const sofa = new THREE.Group();
  sofa.position.set(-3.65, 0, -0.95);
  sofa.rotation.y = Math.PI;
  box(sofa, 2.3, 0.34, 0.95, 0, 0.2, 0, M.fabric);
  box(sofa, 2.3, 0.78, 0.2, 0, 0.66, -0.38, M.fabric);
  box(sofa, 0.22, 0.52, 0.95, -1.05, 0.44, 0, M.fabric);
  box(sofa, 0.22, 0.52, 0.95, 1.05, 0.44, 0, M.fabric);
  box(sofa, 1.0, 0.16, 0.72, -0.5, 0.44, 0.05, M.fabric);
  box(sofa, 1.0, 0.16, 0.72, 0.5, 0.44, 0.05, M.fabric);
  box(sofa, 0.34, 0.34, 0.16, -0.72, 0.65, -0.28, M.fabric);
  box(sofa, 0.34, 0.34, 0.16, 0.72, 0.65, -0.28, M.fabric);
  scene.add(sofa);
  rectCollider(colliders, -3.65, -0.95, 1.2, 0.55);

  // coffee table
  const table = new THREE.Group();
  table.position.set(-3.6, 0, -3.15);
  box(table, 1.25, 0.07, 0.72, 0, 0.42, 0, M.wood);
  for (const [x, z] of [[-0.52, -0.28], [0.52, -0.28], [-0.52, 0.28], [0.52, 0.28]]) {
    box(table, 0.06, 0.4, 0.06, x, 0.21, z, M.woodDark, false);
  }
  // mug
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.09, 12), M.ceramic);
  mug.position.set(-0.32, 0.5, 0.1);
  table.add(mug);
  // papers
  const p1 = plane(table, 0.3, 0.4, 0.2, 0.462, -0.05, M.paper, -Math.PI / 2, 0, 0.3);
  p1.castShadow = false;
  scene.add(table);
  rectCollider(colliders, -3.6, -3.15, 0.65, 0.4);

  // TV stand + TV
  const tvG = new THREE.Group();
  tvG.position.set(-3.6, 0, -5.55);
  box(tvG, 1.9, 0.48, 0.52, 0, 0.24, 0, M.woodDark);
  box(tvG, 1.84, 0.04, 0.5, 0, 0.49, 0, M.wood);
  const tvBody = box(tvG, 1.1, 0.72, 0.16, 0, 0.9, 0, M.dark);
  const screenMat = new THREE.MeshBasicMaterial({ map: T.tv.clone(), toneMapped: false });
  screenMat.map.wrapS = screenMat.map.wrapT = THREE.RepeatWrapping;
  screenMat.map.repeat.set(1, 1);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.58), screenMat);
  screen.position.set(0, 0.92, 0.085);
  tvG.add(screen);
  tvScreens.push(screenMat);
  // antenna
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.5, 4), M.metal);
  ant.position.set(0, 1.45, 0);
  ant.rotation.z = 0.35;
  tvG.add(ant);
  scene.add(tvG);
  rectCollider(colliders, -3.6, -5.55, 0.95, 0.3);

  const tvLight = new THREE.PointLight(0x5d7f9d, 4.2, 5.5, 2);
  tvLight.position.set(-3.6, 1.0, -5.1);
  scene.add(tvLight);
  lightSources.push({ pos: tvLight.position.clone(), radius: 2.2, base: 4.2, light: tvLight, tv: true });

  // window on living room west wall
  const windowGroup = new THREE.Group();
  windowGroup.position.set(-5.92, 1.6, -3.0);
  windowGroup.rotation.y = Math.PI / 2;
  box(windowGroup, 1.5, 1.3, 0.08, 0, 0, 0, M.woodDark, false);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.1), new THREE.MeshBasicMaterial({ map: T.window, color: 0x8b9aa2 }));
  glass.position.z = 0.05;
  windowGroup.add(glass);
  const rainMat = new THREE.MeshBasicMaterial({ map: T.rain.clone(), transparent: true, opacity: 0.8, color: 0xaac4d8, depthWrite: false, blending: THREE.AdditiveBlending });
  rainMat.map.wrapS = rainMat.map.wrapT = THREE.RepeatWrapping;
  const rainPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.1), rainMat);
  rainPlane.position.z = 0.07;
  windowGroup.add(rainPlane);
  rainPlanes.push(rainMat);
  // muntins
  box(windowGroup, 0.035, 1.1, 0.04, 0, 0, 0.09, M.woodDark, false);
  box(windowGroup, 1.3, 0.035, 0.04, 0, 0, 0.09, M.woodDark, false);
  scene.add(windowGroup);
  const winLight = new THREE.PointLight(0x6f8ea8, 4.0, 6, 2);
  winLight.position.set(-5.4, 1.7, -3.0);
  scene.add(winLight);
  lightSources.push({ pos: winLight.position.clone(), radius: 2.2, base: 4.0, light: winLight, window: true });

  // curtains
  const curtainMat = new THREE.MeshStandardMaterial({ color: 0x3b352d, roughness: 1, side: THREE.DoubleSide });
  for (const dz of [-1.02, 1.02]) {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.9, 6, 6), curtainMat);
    c.position.set(-5.86, 1.35, -3.0 + dz);
    c.rotation.y = Math.PI / 2;
    c.castShadow = false;
    scene.add(c);
  }

  // armchair
  const chairG = new THREE.Group();
  chairG.position.set(-5.2, 0, -4.6);
  chairG.rotation.y = -0.5;
  box(chairG, 0.85, 0.32, 0.8, 0, 0.25, 0, M.fabric);
  box(chairG, 0.85, 0.75, 0.18, 0, 0.62, -0.33, M.fabric);
  box(chairG, 0.16, 0.45, 0.8, -0.36, 0.42, 0, M.fabric);
  box(chairG, 0.16, 0.45, 0.8, 0.36, 0.42, 0, M.fabric);
  scene.add(chairG);
  rectCollider(colliders, -5.2, -4.6, 0.55, 0.55);

  // painting above sofa
  const frame = new THREE.Group();
  frame.position.set(-3.65, 1.85, -0.05);
  box(frame, 1.02, 0.82, 0.05, 0, 0, 0, M.woodDark, false);
  const painting = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.7), standard(T.portrait, 1, 1, { roughness: 0.6, emissive: 0x1a1510, emissiveIntensity: 0.3 }));
  painting.position.z = 0.032;
  frame.add(painting);
  scene.add(frame);

  // cushions and a folded throw on the sofa
  const cushionMat = new THREE.MeshStandardMaterial({ color: 0x6b3f36, roughness: 1 });
  for (const [cx, cz, rz] of [[-0.62, 0.08, 0.08], [0.62, 0.08, -0.07]]) {
    const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 0.14), cushionMat);
    cushion.position.set(cx, 0.66, cz);
    cushion.rotation.z = rz;
    cushion.castShadow = true;
    sofa.add(cushion);
  }
  const throwBlanket = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.08, 0.62), new THREE.MeshStandardMaterial({ color: 0x4b2c28, roughness: 1 }));
  throwBlanket.position.set(-0.4, 0.54, 0.08);
  throwBlanket.rotation.y = 0.12;
  sofa.add(throwBlanket);

  // candle on a small side table
  const candleTable = new THREE.Group();
  candleTable.position.set(-2.0, 0, -2.3);
  box(candleTable, 0.4, 0.05, 0.4, 0, 0.48, 0, M.wood);
  box(candleTable, 0.04, 0.48, 0.04, -0.16, 0.24, -0.16, M.woodDark, false);
  box(candleTable, 0.04, 0.48, 0.04, 0.16, 0.24, -0.16, M.woodDark, false);
  box(candleTable, 0.04, 0.48, 0.04, -0.16, 0.24, 0.16, M.woodDark, false);
  box(candleTable, 0.04, 0.48, 0.04, 0.16, 0.24, 0.16, M.woodDark, false);
  const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.042, 0.16, 9), M.ceramic);
  wax.position.y = 0.59;
  candleTable.add(wax);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.06, 6), new THREE.MeshBasicMaterial({ color: 0xffc06a, toneMapped: false }));
  flame.position.y = 0.7;
  candleTable.add(flame);
  scene.add(candleTable);
  rectCollider(colliders, -2.0, -2.3, 0.23, 0.23);
  const candleLight = new THREE.PointLight(0xffa860, 1.4, 3.0, 2);
  candleLight.position.set(-2.0, 0.78, -2.3);
  scene.add(candleLight);
  lightSources.push({ pos: candleLight.position.clone(), radius: 1.7, base: 1.4, light: candleLight });
  flickerLights.push({ light: candleLight, base: 1.4, phase: 1.3, style: 'soft', bulb: flame });

  /* ── bedroom furniture ────────────────────────────────────── */

  // bed
  const bed = new THREE.Group();
  bed.position.set(4.9, 0, 2.4);
  box(bed, 2.2, 0.28, 1.75, 0, 0.2, 0, M.woodDark);
  box(bed, 2.05, 0.24, 1.6, 0, 0.46, 0, M.sheet);
  box(bed, 0.18, 1.0, 1.8, 1.03, 0.5, 0, M.woodDark);
  // pillows
  for (const z of [-0.4, 0.4]) {
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.16, 0.6), M.sheet);
    pillow.position.set(0.62, 0.66, z);
    pillow.rotation.z = -0.08;
    pillow.castShadow = true;
    bed.add(pillow);
  }
  // blanket
  const blanket = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.09, 1.64), standard(T.fabric, 2, 2, { roughness: 1, color: 0x4f5549 }));
  blanket.position.set(-0.28, 0.61, 0);
  blanket.castShadow = true;
  bed.add(blanket);
  scene.add(bed);
  rectCollider(colliders, 4.9, 2.4, 1.12, 0.9);

  // nightstand
  const ns = new THREE.Group();
  ns.position.set(5.5, 0, 0.95);
  box(ns, 0.55, 0.62, 0.5, 0, 0.31, 0, M.wood);
  box(ns, 0.45, 0.16, 0.03, 0, 0.42, 0.26, M.woodDark, false);
  box(ns, 0.45, 0.16, 0.03, 0, 0.2, 0.26, M.woodDark, false);
  scene.add(ns);
  rectCollider(colliders, 5.5, 0.95, 0.3, 0.27);

  // wardrobe
  const wd = new THREE.Group();
  wd.position.set(3.1, 0, -1.65);
  box(wd, 1.6, 2.15, 0.58, 0, 1.075, 0, M.wood);
  box(wd, 0.74, 1.9, 0.03, -0.4, 1.1, 0.3, M.woodDark, false);
  box(wd, 0.74, 1.9, 0.03, 0.4, 1.1, 0.3, M.woodDark, false);
  const h1 = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), M.brass);
  h1.position.set(-0.07, 1.08, 0.33);
  wd.add(h1);
  const h2 = h1.clone();
  h2.position.x = 0.07;
  wd.add(h2);
  scene.add(wd);
  rectCollider(colliders, 3.1, -1.65, 0.82, 0.32);

  // bedroom mirror on z=4 wall
  const bedMirrorMat = new THREE.MeshStandardMaterial({ color: 0x8d979b, roughness: 0.06, metalness: 1.0, emissive: 0x0a0d0e, emissiveIntensity: 0.55 });
  mirrorMaterials.push(bedMirrorMat);
  box(scene, 0.9, 1.2, 0.06, 2.35, 1.6, 3.94, M.woodDark, false);
  const bedMirror = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 1.06), bedMirrorMat);
  bedMirror.position.set(2.35, 1.6, 3.9);
  bedMirror.rotation.y = Math.PI;
  scene.add(bedMirror);

  // bedroom window
  const bwin = new THREE.Group();
  bwin.position.set(5.92, 1.55, 2.5);
  bwin.rotation.y = -Math.PI / 2;
  box(bwin, 1.2, 1.15, 0.08, 0, 0, 0, M.woodDark, false);
  const bglass = new THREE.Mesh(new THREE.PlaneGeometry(1.02, 0.98), new THREE.MeshBasicMaterial({ map: T.window, color: 0x7f8f99 }));
  bglass.position.z = 0.05;
  bwin.add(bglass);
  const brainMat = new THREE.MeshBasicMaterial({ map: T.rain.clone(), transparent: true, opacity: 0.75, color: 0xaac4d8, depthWrite: false, blending: THREE.AdditiveBlending });
  brainMat.map.wrapS = brainMat.map.wrapT = THREE.RepeatWrapping;
  const brain = new THREE.Mesh(new THREE.PlaneGeometry(1.02, 0.98), brainMat);
  brain.position.z = 0.07;
  bwin.add(brain);
  rainPlanes.push(brainMat);
  scene.add(bwin);
  const bwinLight = new THREE.PointLight(0x6d8ba3, 3.6, 5.5, 2);
  bwinLight.position.set(5.4, 1.7, 2.5);
  scene.add(bwinLight);
  lightSources.push({ pos: bwinLight.position.clone(), radius: 2.0, base: 3.6, light: bwinLight, window: true });


  // bedroom rug and a book on the nightstand
  const bedRugMat = standard(T.carpet, 2.2, 1.7, { roughness: 1, color: 0x7a554d });
  plane(scene, 2.5, 1.8, 4.35, 0.014, 2.0, bedRugMat, -Math.PI / 2, 0, 0);
  const nsBook = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.3), new THREE.MeshStandardMaterial({ color: 0x4b2f2a, roughness: 0.9 }));
  nsBook.position.set(5.42, 0.66, 0.78);
  nsBook.rotation.y = 0.2;
  scene.add(nsBook);
  // framed photograph above the bed
  const bedPhoto = new THREE.Group();
  bedPhoto.position.set(4.9, 1.95, 3.93);
  bedPhoto.rotation.y = Math.PI;
  box(bedPhoto, 0.75, 0.55, 0.04, 0, 0, 0, M.woodDark, false);
  const bp = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.44), standard(T.photo, 1, 1, { roughness: 0.8, emissive: 0x120e09, emissiveIntensity: 0.2 }));
  bp.position.z = 0.025;
  bedPhoto.add(bp);
  scene.add(bedPhoto);

  /* ── bathroom furniture ───────────────────────────────────── */

  const tub = new THREE.Group();
  tub.position.set(-3.0, 0, 5.25);
  box(tub, 2.0, 0.55, 0.95, 0, 0.275, 0, M.ceramic);
  const inner = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.3, 0.7), M.black);
  inner.position.set(0, 0.5, 0);
  tub.add(inner);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.68), M.water);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.55;
  tub.add(water);
  const tap = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.28, 8), M.brass);
  tap.position.set(0.88, 0.68, 0);
  tap.rotation.z = Math.PI / 2;
  tub.add(tap);
  scene.add(tub);
  rectCollider(colliders, -3.0, 5.25, 1.05, 0.52);

  const sink = new THREE.Group();
  sink.position.set(-4.35, 0, 3.0);
  const basin = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.72), M.ceramic);
  basin.position.y = 0.86;
  sink.add(basin);
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, 0.8, 10), M.ceramic);
  pedestal.position.y = 0.4;
  sink.add(pedestal);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.22, 8), M.brass);
  spout.position.set(0.16, 1.0, 0);
  spout.rotation.z = Math.PI / 2;
  sink.add(spout);
  scene.add(sink);
  rectCollider(colliders, -4.35, 3.0, 0.34, 0.4);

  // sink mirror
  const sinkMirrorMat = new THREE.MeshStandardMaterial({ color: 0x8d999d, roughness: 0.05, metalness: 1.0, emissive: 0x0a0d0e, emissiveIntensity: 0.55 });
  mirrorMaterials.push(sinkMirrorMat);
  box(scene, 0.9, 1.05, 0.05, -4.75, 1.62, 3.0, M.woodDark, false);
  const sinkMirror = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.95), sinkMirrorMat);
  sinkMirror.position.set(-4.71, 1.62, 3.0);
  sinkMirror.rotation.y = Math.PI / 2;
  scene.add(sinkMirror);

  // toilet
  const toilet = new THREE.Group();
  toilet.position.set(-2.0, 0, 2.55);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.42, 14), M.ceramic);
  bowl.position.y = 0.24;
  toilet.add(bowl);
  const tank = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.22), M.ceramic);
  tank.position.set(0, 0.55, -0.3);
  toilet.add(tank);
  const seat = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.035, 8, 18), M.ceramic);
  seat.rotation.x = Math.PI / 2;
  seat.position.y = 0.46;
  toilet.add(seat);
  scene.add(toilet);
  rectCollider(colliders, -2.0, 2.55, 0.3, 0.38);


  // bath mat, towel and shelf bottles
  const matMat = standard(T.fabric, 1.4, 0.9, { roughness: 1, color: 0x6b6f60 });
  plane(scene, 1.3, 0.75, -3.0, 0.016, 4.35, matMat, -Math.PI / 2, 0, 0);
  const towelMat = new THREE.MeshStandardMaterial({ color: 0x6f7566, roughness: 1, side: THREE.DoubleSide });
  const towel = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.78), towelMat);
  towel.position.set(-3.7, 1.3, 5.965);
  towel.rotation.y = Math.PI;
  scene.add(towel);
  const towelBar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.62, 8), M.brass);
  towelBar.rotation.z = Math.PI / 2;
  towelBar.position.set(-3.7, 1.72, 5.95);
  scene.add(towelBar);
  // small shelf with bottles
  box(scene, 0.62, 0.04, 0.18, -4.62, 1.35, 2.5, M.woodDark, false);
  for (const [bx, bz, bh, col] of [[-4.75, 2.46, 0.18, 0x5c6d5a], [-4.62, 2.52, 0.14, 0x6d5a45], [-4.5, 2.44, 0.2, 0x4a5560]]) {
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, bh, 8), new THREE.MeshStandardMaterial({ color: col, roughness: 0.5 }));
    bottle.position.set(bx, 1.38 + bh / 2, bz);
    scene.add(bottle);
  }
  const tp = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.09, 10), M.ceramic);
  tp.position.set(-2.35, 0.55, 2.25);
  tp.rotation.z = Math.PI / 2;
  scene.add(tp);

  // warm vanity light beside the mirror
  const vanityLight = new THREE.PointLight(0xffc98a, 2.2, 2.8, 2);
  vanityLight.position.set(-4.3, 1.8, 3.0);
  scene.add(vanityLight);
  lightSources.push({ pos: vanityLight.position.clone(), radius: 1.6, base: 2.2, light: vanityLight });

  /* ── study furniture ──────────────────────────────────────── */

  const desk = new THREE.Group();
  desk.position.set(4.95, 0, 8.0);
  box(desk, 0.82, 0.07, 2.1, 0, 0.77, 0, M.wood);
  box(desk, 0.75, 0.55, 0.5, 0, 0.45, -0.65, M.woodDark);
  box(desk, 0.75, 0.55, 0.5, 0, 0.45, 0.65, M.woodDark);
  box(desk, 0.06, 0.75, 0.06, -0.34, 0.38, -0.95, M.woodDark, false);
  box(desk, 0.06, 0.75, 0.06, -0.34, 0.38, 0.95, M.woodDark, false);
  scene.add(desk);
  rectCollider(colliders, 4.95, 8.0, 0.46, 1.1);

  // typewriter
  const typewriter = new THREE.Group();
  typewriter.position.set(4.9, 0.8, 7.55);
  box(typewriter, 0.42, 0.1, 0.34, 0, 0.05, 0, M.dark);
  box(typewriter, 0.3, 0.12, 0.2, 0, 0.15, -0.03, M.black);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 8; c++) {
      const k = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 6), M.ceramic);
      k.position.set(-0.11 + c * 0.031, 0.105, 0.09 + r * 0.035);
      typewriter.add(k);
    }
  }
  scene.add(typewriter);

  // chair
  const deskChair = new THREE.Group();
  deskChair.position.set(4.15, 0, 8.95);
  deskChair.rotation.y = Math.PI / 2;
  box(deskChair, 0.5, 0.07, 0.5, 0, 0.48, 0, M.woodDark);
  box(deskChair, 0.5, 0.7, 0.07, 0, 0.83, -0.22, M.woodDark);
  for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) {
    box(deskChair, 0.05, 0.48, 0.05, x, 0.24, z, M.woodDark, false);
  }
  scene.add(deskChair);
  rectCollider(colliders, 4.15, 8.95, 0.32, 0.32);

  // bookshelf
  const shelf = new THREE.Group();
  shelf.position.set(2.7, 0, 9.68);
  box(shelf, 1.7, 2.25, 0.38, 0, 1.125, 0, M.woodDark);
  for (let i = 0; i < 5; i++) {
    box(shelf, 1.6, 0.04, 0.34, 0, 0.32 + i * 0.43, 0, M.wood, false);
  }
  // books
  const bookColors = [0x5a3028, 0x2f3b32, 0x3b3348, 0x6b5a36, 0x2e2a25, 0x4a3a2a, 0x343f45];
  for (let s = 0; s < 4; s++) {
    let x = -0.74;
    while (x < 0.72) {
      const bw = 0.035 + Math.random() * 0.045;
      const bh = 0.22 + Math.random() * 0.14;
      const b = new THREE.Mesh(
        new THREE.BoxGeometry(bw, bh, 0.24),
        new THREE.MeshStandardMaterial({ color: bookColors[Math.floor(Math.random() * bookColors.length)], roughness: 0.9 })
      );
      b.position.set(x + bw / 2, 0.34 + s * 0.43 + bh / 2, 0.02);
      b.rotation.z = (Math.random() - 0.5) * 0.06;
      shelf.add(b);
      x += bw + 0.004;
    }
  }
  scene.add(shelf);
  rectCollider(colliders, 2.7, 9.68, 0.86, 0.24);

  // stack of papers on desk
  for (let i = 0; i < 4; i++) {
    const pp = plane(desk, 0.3, 0.4, 4.9 + (Math.random() - 0.5) * 0.12, 0.815 + i * 0.006, 8.65 + (Math.random() - 0.5) * 0.1, M.paper, -Math.PI / 2, 0, Math.random() * 0.6);
    pp.castShadow = false;
  }


  // green banker's lamp on the desk
  const deskLamp = new THREE.Group();
  deskLamp.position.set(4.88, 0.81, 8.55);
  const dlBase = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.04, 10), M.brass);
  dlBase.position.y = 0.02;
  deskLamp.add(dlBase);
  const dlPole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.26, 8), M.brass);
  dlPole.position.y = 0.17;
  deskLamp.add(dlPole);
  const dlShade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.19, 0.13, 14, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x2f4a3a, roughness: 0.55, side: THREE.DoubleSide, emissive: 0x16281c, emissiveIntensity: 0.6 })
  );
  dlShade.position.y = 0.33;
  deskLamp.add(dlShade);
  const dlBulb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false }));
  dlBulb.position.y = 0.29;
  deskLamp.add(dlBulb);
  scene.add(deskLamp);
  const deskLight = new THREE.PointLight(0xffc27a, 5.5, 3.6, 2);
  deskLight.position.set(4.82, 1.12, 8.55);
  scene.add(deskLight);
  lightSources.push({ pos: deskLight.position.clone(), radius: 2.0, base: 5.5, light: deskLight });
  flickerLights.push({ light: deskLight, base: 5.5, phase: 3.7, style: 'soft', bulb: dlBulb });

  // study rug
  const studyRugMat = standard(T.carpet, 2.2, 1.8, { roughness: 1, color: 0x5a4a42 });
  plane(scene, 2.4, 1.8, 3.0, 0.014, 8.0, studyRugMat, -Math.PI / 2, 0, 0);

  // study window
  const swin = new THREE.Group();
  swin.position.set(5.32, 1.55, 7.2);
  swin.rotation.y = -Math.PI / 2;
  box(swin, 1.0, 1.0, 0.06, 0, 0, 0, M.woodDark, false);
  const sglass = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.86), new THREE.MeshBasicMaterial({ map: T.window, color: 0x7f8f99 }));
  sglass.position.z = 0.04;
  swin.add(sglass);
  scene.add(swin);

  /* ── hallway dressing ─────────────────────────────────────── */

  // console table at end
  const consoleG = new THREE.Group();
  consoleG.position.set(0, 0, 9.55);
  box(consoleG, 1.1, 0.06, 0.32, 0, 0.82, 0, M.wood);
  for (const [x, z] of [[-0.48, -0.1], [0.48, -0.1], [-0.48, 0.1], [0.48, 0.1]]) {
    box(consoleG, 0.05, 0.8, 0.05, x, 0.4, z, M.woodDark, false);
  }
  scene.add(consoleG);
  rectCollider(colliders, 0, 9.55, 0.56, 0.18);

  // hallway mirror
  const hallMirrorMat = new THREE.MeshStandardMaterial({ color: 0x8a9599, roughness: 0.05, metalness: 1.0, emissive: 0x0a0d0e, emissiveIntensity: 0.5 });
  mirrorMaterials.push(hallMirrorMat);
  box(scene, 1.25, 1.65, 0.06, 0, 1.65, 9.94, M.woodDark, false);
  const hallMirror = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.5), hallMirrorMat);
  hallMirror.position.set(0, 1.65, 9.9);
  hallMirror.rotation.y = Math.PI;
  scene.add(hallMirror);

  // coat rack near front door
  const rack = new THREE.Group();
  rack.position.set(-0.95, 0, -8.8);
  const rackPole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.85, 8), M.woodDark);
  rackPole.position.y = 0.93;
  rack.add(rackPole);
  for (let i = 0; i < 3; i++) {
    const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.28, 6), M.woodDark);
    peg.position.set(Math.cos(i * 2.1) * 0.12, 1.68, Math.sin(i * 2.1) * 0.12);
    peg.rotation.z = Math.cos(i * 2.1) * 0.5;
    peg.rotation.x = Math.sin(i * 2.1) * 0.5;
    rack.add(peg);
  }
  // coat
  const coat = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.95, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0x24251f, roughness: 1, side: THREE.DoubleSide }));
  coat.position.set(0.05, 1.15, 0.02);
  rack.add(coat);
  scene.add(rack);
  rectCollider(colliders, -0.95, -8.8, 0.3, 0.3);

  // hallway frames
  function wallPhoto(x, y, z, ry, tex) {
    const f = new THREE.Group();
    f.position.set(x, y, z);
    f.rotation.y = ry;
    box(f, 0.55, 0.7, 0.04, 0, 0, 0, M.woodDark, false);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.58), standard(tex, 1, 1, { roughness: 0.8, emissive: 0x120e09, emissiveIntensity: 0.2 }));
    p.position.z = 0.025;
    f.add(p);
    scene.add(f);
  }
  wallPhoto(-1.105, 1.7, -7.4, Math.PI / 2, T.photo);
  wallPhoto(-1.105, 1.72, -0.7, Math.PI / 2, T.photo);
  wallPhoto(1.105, 1.68, 5.9, -Math.PI / 2, T.photo);
  wallPhoto(1.105, 1.7, -4.8, -Math.PI / 2, T.photo);
  wallPhoto(-2.7, 1.75, 5.925, Math.PI, T.portrait);

  // small hallway side table with dead plant
  const sideTable = new THREE.Group();
  sideTable.position.set(0.85, 0, 5.8);
  box(sideTable, 0.55, 0.05, 0.4, 0, 0.72, 0, M.wood);
  box(sideTable, 0.05, 0.72, 0.05, -0.23, 0.36, -0.15, M.woodDark, false);
  box(sideTable, 0.05, 0.72, 0.05, 0.23, 0.36, -0.15, M.woodDark, false);
  box(sideTable, 0.05, 0.72, 0.05, -0.23, 0.36, 0.15, M.woodDark, false);
  box(sideTable, 0.05, 0.72, 0.05, 0.23, 0.36, 0.15, M.woodDark, false);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.13, 10), M.ceramic);
  pot.position.set(0, 0.81, 0);
  sideTable.add(pot);
  for (let i = 0; i < 5; i++) {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.2 + Math.random() * 0.15, 4), new THREE.MeshStandardMaterial({ color: 0x3a3a24, roughness: 1 }));
    stem.position.set((Math.random() - 0.5) * 0.1, 0.95 + Math.random() * 0.08, (Math.random() - 0.5) * 0.1);
    stem.rotation.z = (Math.random() - 0.5) * 0.7;
    sideTable.add(stem);
  }
  scene.add(sideTable);
  rectCollider(colliders, 0.85, 5.8, 0.3, 0.22);

  /* ── interactables: memories, batteries, notes ────────────── */

  function makeShard(index, x, y, z, glowColor = 0xffcf95) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const photo = new THREE.Mesh(
      new THREE.PlaneGeometry(0.23, 0.28),
      new THREE.MeshStandardMaterial({
        map: T.photo, emissiveMap: T.photo, emissive: 0xffd9a8, emissiveIntensity: 0.55,
        roughness: 0.55, side: THREE.DoubleSide, toneMapped: false,
      })
    );
    photo.rotation.x = -0.2;
    photo.rotation.z = 0.06;
    g.add(photo);
    addGlowSprite(g, glowColor, 0.8, 0.35);
    const l = new THREE.PointLight(glowColor, 0.55, 2.0, 2);
    g.add(l);
    g.userData = { type: 'memory', index, label: 'TAKE MEMORY', active: true, light: l, baseY: y, phase: Math.random() * 6 };
    scene.add(g);
    interactables.push(g);
    shards.push(g);
    return g;
  }

  makeShard(0, -3.6, 0.72, -3.15);
  makeShard(1, 4.25, 0.82, 2.15);
  makeShard(2, -4.35, 1.18, 3.0);
  makeShard(3, 4.85, 1.0, 7.5);
  makeShard(4, 0, 1.12, 9.55);

  function makeBattery(x, y, z) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 10), M.dark);
    body.rotation.z = Math.PI / 2;
    g.add(body);
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.037, 0.037, 0.05, 10),
      new THREE.MeshBasicMaterial({ color: 0x9fc47a, toneMapped: false })
    );
    band.rotation.z = Math.PI / 2;
    g.add(band);
    addGlowSprite(g, 0xa8d488, 0.45, 0.35);
    g.userData = { type: 'battery', label: 'TAKE BATTERY', active: true, baseY: y, phase: Math.random() * 6 };
    scene.add(g);
    interactables.push(g);
    batteries.push(g);
    return g;
  }

  makeBattery(-5.4, 0.72, -1.55);
  makeBattery(-2.2, 0.95, 2.4);
  makeBattery(2.7, 1.05, 9.55);
  makeBattery(0.85, 0.85, 5.8);

  function makeNote(x, y, z, ry, text, sign) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = ry;
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.4), M.paper);
    paper.rotation.x = -Math.PI / 2 + 0.03;
    g.add(paper);
    g.userData = { type: 'note', label: 'READ NOTE', active: true, text, sign };
    scene.add(g);
    interactables.push(g);
    notes.push(g);
    return g;
  }

  makeNote(-3.2, 0.79, 7.0, 0, 'She keeps leaving the taps running.\n\nI turn them off before bed. By morning they are on again. The water is warm, as if someone has just washed their hands.\n\nI live alone. I have always lived alone.', '— a torn page, in your handwriting');
  makeNote(-4.35, 0.98, 2.6, 0, 'The landlord says apartment 4B has been empty for eleven years.\n\nI paid the deposit. I have the keys. I sleep here every night.\n\nWhen I asked him about the girl in the hallway, he hung up.', '— folded twice, addressed to no one');
  makeNote(-3.6, 0.48, -5.4, 0, 'It only moves when you look away.\n\nKeep the beam on it. Do not blink. Do not let the battery die.\n\nAnd whatever it says in her voice, it is not her.', '— scrawled on the back of a photograph');

  /* ── ambient dust ─────────────────────────────────────────── */
  const dustCount = 650;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(dustCount * 3);
  const dustSeed = [];
  for (let i = 0; i < dustCount; i++) {
    const x = -5.8 + Math.random() * 11.6;
    const z = -9.8 + Math.random() * 19.6;
    const y = 0.2 + Math.random() * 2.5;
    dustPos[i * 3] = x;
    dustPos[i * 3 + 1] = y;
    dustPos[i * 3 + 2] = z;
    dustSeed.push({ x, y, z, p: Math.random() * 10, s: 0.3 + Math.random() * 0.7 });
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({
    map: T.glow, color: 0xbfb8a0, size: 0.022, transparent: true, opacity: 0.32,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  scene.add(dust);

  /* ── ambient / lightning light ────────────────────────────── */
  const hemi = new THREE.HemisphereLight(0x35404a, 0x0a0806, 0.5);
  scene.add(hemi);
  const lightningLight = new THREE.DirectionalLight(0xb9cfe0, 0);
  lightningLight.position.set(-4, 4, -3);
  scene.add(lightningLight);

  /* ── environment maps for mirrors ─────────────────────────── */
  function bakeMirrors() {
    const rt = new THREE.WebGLCubeRenderTarget(128, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    const cam = new THREE.CubeCamera(0.1, 30, rt);
    // hallway
    hallMirror.visible = false;
    cam.position.set(0, 1.6, 9.2);
    scene.add(cam);
    cam.update(renderer, scene);
    hallMirrorMat.envMap = rt.texture;
    hallMirrorMat.needsUpdate = true;
    scene.remove(cam);

    const rt2 = new THREE.WebGLCubeRenderTarget(128, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    const cam2 = new THREE.CubeCamera(0.1, 30, rt2);
    sinkMirror.visible = false;
    cam2.position.set(-4.2, 1.6, 3.0);
    scene.add(cam2);
    cam2.update(renderer, scene);
    sinkMirrorMat.envMap = rt2.texture;
    sinkMirrorMat.needsUpdate = true;
    scene.remove(cam2);

    hallMirror.visible = true;
    sinkMirror.visible = true;
  }
  bakeMirrors();

  /* ── world state / update ─────────────────────────────────── */
  let blackout = 0;
  let lightning = 0;
  let time = 0;

  function update(dt) {
    time += dt;

    // flicker practicals
    for (const f of flickerLights) {
      let mult = 1;
      if (f.style === 'fluorescent') {
        const n = Math.sin(time * 17 + f.phase) * Math.sin(time * 3.1 + f.phase * 2);
        mult = n > 0.25 ? 0.18 : 0.95 + Math.sin(time * 31) * 0.05;
        if (Math.random() < 0.004) mult = 0.05;
      } else {
        mult = 0.92 + Math.sin(time * 7.3 + f.phase) * 0.05 + Math.sin(time * 19 + f.phase * 3) * 0.025;
        if (Math.random() < 0.0015) mult = 0.35;
      }
      const bo = blackout > 0 ? Math.max(0.02, 1 - blackout * (0.7 + Math.sin(time * 40) * 0.3)) : 1;
      f.light.intensity = f.base * mult * bo;
      if (f.bulb && f.bulb.material) f.bulb.material.opacity = mult * bo;
    }

    // non-flicker practicals respect blackout
    if (blackout > 0) {
      const bo = Math.max(0.02, 1 - blackout);
      for (const s of lightSources) {
        if (!s.flicker && !s.light.userData?.flicker) {
          if (s.tv) s.light.intensity = s.base * (0.4 + Math.random() * 0.8) * bo;
          else if (s.window) s.light.intensity = s.base * bo;
        }
      }
    } else {
      for (const s of lightSources) {
        if (s.tv) s.light.intensity = s.base * (0.55 + Math.random() * 0.55);
        else if (s.window) s.light.intensity = s.base;
      }
    }
    if (blackout > 0) blackout = Math.max(0, blackout - dt * 0.55);

    // lightning
    if (lightning > 0) {
      lightning = Math.max(0, lightning - dt * 3.2);
      const flick = lightning > 0.55 ? 1 : lightning > 0.3 ? 0.25 : 0.7;
      lightningLight.intensity = lightning * 5 * flick;
      for (const s of lightSources) if (s.window) s.light.intensity = s.base + lightning * 8 * flick;
    } else {
      lightningLight.intensity = 0;
    }

    // tv static
    for (const m of tvScreens) {
      m.map.offset.x = Math.random() * 0.4;
      m.map.offset.y = Math.random() * 0.4;
    }

    // rain
    for (const m of rainPlanes) {
      m.map.offset.y -= dt * 0.65;
      m.map.offset.x += dt * 0.015;
    }

    // shard / battery float
    for (const s of shards) {
      if (!s.userData.active) continue;
      s.position.y = s.userData.baseY + Math.sin(time * 1.6 + s.userData.phase) * 0.035;
      s.rotation.y = Math.sin(time * 0.7 + s.userData.phase) * 0.4;
    }
    for (const b of batteries) {
      if (!b.userData.active) continue;
      b.position.y = b.userData.baseY + Math.sin(time * 1.3 + b.userData.phase) * 0.02;
      b.rotation.y += dt * 0.4;
    }

    // dust
    const pos = dustGeo.attributes.position.array;
    for (let i = 0; i < dustCount; i++) {
      const d = dustSeed[i];
      pos[i * 3] = d.x + Math.sin(time * 0.12 + d.p) * 0.25;
      pos[i * 3 + 1] = d.y + Math.sin(time * 0.17 + d.p * 1.7) * 0.12;
      pos[i * 3 + 2] = d.z + Math.cos(time * 0.1 + d.p * 0.8) * 0.2;
    }
    dustGeo.attributes.position.needsUpdate = true;
    dustMat.opacity = 0.22 + 0.1 * Math.sin(time * 0.4);
  }

  function pulseBlackout(amount = 1) {
    blackout = Math.max(blackout, amount);
  }

  function triggerLightning() {
    lightning = 1;
  }

  function isLit(pos) {
    if (blackout > 0.25) return false;
    for (const s of lightSources) {
      if (s.window && lightning <= 0) continue;
      if (s.light.intensity < 0.5) continue;
      const dx = pos.x - s.pos.x;
      const dz = pos.z - s.pos.z;
      if (dx * dx + dz * dz < s.radius * s.radius) return true;
    }
    return false;
  }

  function roomAt(x, z) {
    if (x > -1.2 && x < 1.2) return 'HALLWAY';
    if (x <= -1.2) {
      if (z < 0) return 'LIVING ROOM';
      if (z >= 2) return 'BATHROOM';
      return 'HALLWAY';
    }
    if (z < 4) return 'BEDROOM';
    if (z >= 6) return 'STUDY';
    return 'HALLWAY';
  }

  return {
    colliders,
    interactables,
    shards,
    batteries,
    notes,
    doorGroup,
    doorInteract,
    doorMesh,
    doorLight,
    flickerLights,
    lightSources,
    update,
    pulseBlackout,
    triggerLightning,
    isLit,
    roomAt,
    EYE,
    get blackout() { return blackout; },
    get lightning() { return lightning; },
  };
}
