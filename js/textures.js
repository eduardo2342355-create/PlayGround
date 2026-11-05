import * as THREE from '../vendor/three.module.js';

/* ─────────────────────────────────────────────────────────────
   Procedural texture atelier. Everything in the apartment is
   painted at runtime so the build has no external art assets.
   ───────────────────────────────────────────────────────────── */

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function finish(canvas, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 8;
  return tex;
}

function grain(ctx, w, h, amount, rand, tint = [0, 0, 0]) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * amount;
    d[i] = Math.max(0, Math.min(255, d[i] + n + tint[0]));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n + tint[1]));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n + tint[2]));
  }
  ctx.putImageData(img, 0, 0);
}

function stains(ctx, w, h, rand, count = 5, alpha = 0.2, hue = '40,26,12') {
  for (let i = 0; i < count; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 20 + rand() * 110;
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0, `rgba(${hue},${alpha})`);
    g.addColorStop(0.55, `rgba(${hue},${alpha * 0.5})`);
    g.addColorStop(1, `rgba(${hue},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    // drips
    const drips = 1 + Math.floor(rand() * 3);
    for (let d = 0; d < drips; d++) {
      const dx = x + (rand() - 0.5) * r * 1.1;
      const len = 15 + rand() * 100;
      const lg = ctx.createLinearGradient(dx, y, dx, y + len);
      lg.addColorStop(0, `rgba(${hue},${alpha * 0.8})`);
      lg.addColorStop(1, `rgba(${hue},0)`);
      ctx.strokeStyle = lg;
      ctx.lineWidth = 1 + rand() * 2;
      ctx.beginPath();
      ctx.moveTo(dx, y);
      ctx.lineTo(dx + (rand() - 0.5) * 8, y + len);
      ctx.stroke();
    }
  }
}

function cracks(ctx, w, h, rand, count = 4, color = 'rgba(30,25,20,0.35)') {
  ctx.strokeStyle = color;
  for (let i = 0; i < count; i++) {
    let x = rand() * w;
    let y = rand() * h;
    ctx.lineWidth = 0.5 + rand();
    ctx.beginPath();
    ctx.moveTo(x, y);
    const segs = 4 + Math.floor(rand() * 7);
    for (let s = 0; s < segs; s++) {
      x += (rand() - 0.5) * 34;
      y += rand() * 26;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function fibers(ctx, w, h, rand, count, palette) {
  for (let i = 0; i < count; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const len = 2 + rand() * 9;
    const a = rand() * Math.PI;
    ctx.strokeStyle = palette[Math.floor(rand() * palette.length)];
    ctx.globalAlpha = 0.1 + rand() * 0.28;
    ctx.lineWidth = 0.5 + rand() * 0.7;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/* ───────────────────────── wallpaper ───────────────────────── */

export function wallpaperTexture(seed = 1, variant = 'olive') {
  const s = 512;
  const c = makeCanvas(s);
  const ctx = c.getContext('2d');
  const rand = mulberry32(seed);
  const pal = variant === 'rose'
    ? { base: '#5b4a45', dark: '#453833', light: '#6b5951', motif: '#3b2e2b', stain: '38,20,12' }
    : { base: '#4c4b3c', dark: '#3c3b30', light: '#5b5a48', motif: '#33342a', stain: '35,25,10' };
  ctx.fillStyle = pal.base;
  ctx.fillRect(0, 0, s, s);

  // vertical tone bands
  for (let x = 0; x < s; x += 32) {
    ctx.fillStyle = x % 64 === 0 ? pal.dark : pal.light;
    ctx.globalAlpha = 0.18;
    ctx.fillRect(x, 0, 16, s);
  }
  ctx.globalAlpha = 1;

  // damask motif
  const step = 128;
  for (let gy = -step; gy < s + step; gy += step) {
    for (let gx = -step; gx < s + step; gx += step) {
      const ox = gx + ((Math.floor(gy / step) % 2) * step) / 2;
      ctx.save();
      ctx.translate(ox, gy);
      ctx.strokeStyle = pal.motif;
      ctx.fillStyle = pal.motif;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 2.4;
      // central stem
      ctx.beginPath();
      ctx.moveTo(64, 10);
      ctx.bezierCurveTo(44, 38, 82, 58, 64, 92);
      ctx.bezierCurveTo(46, 112, 70, 118, 64, 122);
      ctx.stroke();
      // symmetric leaves
      for (const dir of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const y = 28 + i * 28;
          ctx.beginPath();
          ctx.moveTo(64, y);
          ctx.bezierCurveTo(64 + dir * 12, y - 14, 64 + dir * 38, y - 6, 64 + dir * 40, y + 6);
          ctx.bezierCurveTo(64 + dir * 34, y + 18, 64 + dir * 14, y + 12, 64, y + 2);
          ctx.closePath();
          ctx.fill();
        }
      }
      // crown
      ctx.beginPath();
      ctx.arc(64, 14, 8, 0, Math.PI * 2);
      ctx.fill();
      // small flanking diamonds
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(64 + dir * 18, 100);
        ctx.lineTo(64 + dir * 26, 108);
        ctx.lineTo(64 + dir * 18, 116);
        ctx.lineTo(64 + dir * 10, 108);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;

  stains(ctx, s, s, rand, 7, 0.26, pal.stain);
  cracks(ctx, s, s, rand, 5, 'rgba(25,20,15,0.25)');

  // peeling patches
  for (let i = 0; i < 3; i++) {
    const x = rand() * s;
    const y = rand() * s;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const n = 7;
    for (let j = 0; j < n; j++) {
      const a = (j / n) * Math.PI * 2;
      const r = 8 + rand() * 26;
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(90,82,66,0.5)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,18,14,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  grain(ctx, s, s, 20, rand);
  return finish(c, 2, 2);
}

/* ───────────────────────── floors ───────────────────────── */

export function woodFloorTexture(seed = 3) {
  const s = 512;
  const c = makeCanvas(s);
  const ctx = c.getContext('2d');
  const rand = mulberry32(seed);
  ctx.fillStyle = '#2c2016';
  ctx.fillRect(0, 0, s, s);

  const plankH = 52;
  for (let row = 0; row < s / plankH; row++) {
    const y = row * plankH;
    const offset = (row % 3) * 90 + rand() * 40;
    for (let x = -200; x < s + 200; x += 180) {
      const px = x + offset;
      const tone = 30 + rand() * 26;
      ctx.fillStyle = `rgb(${tone + 14},${tone + 2},${Math.max(8, tone - 10)})`;
      ctx.fillRect(px + 2, y + 2, 176, plankH - 4);
      // grain
      for (let g = 0; g < 7; g++) {
        ctx.strokeStyle = `rgba(15,9,5,${0.08 + rand() * 0.12})`;
        ctx.lineWidth = 0.5 + rand();
        ctx.beginPath();
        const gy = y + 6 + rand() * (plankH - 12);
        ctx.moveTo(px + 6, gy);
        ctx.bezierCurveTo(px + 60, gy + (rand() - 0.5) * 8, px + 120, gy + (rand() - 0.5) * 8, px + 170, gy + (rand() - 0.5) * 5);
        ctx.stroke();
      }
      // knots
      if (rand() > 0.72) {
        const kx = px + 20 + rand() * 140;
        const ky = y + 12 + rand() * (plankH - 24);
        ctx.fillStyle = 'rgba(20,12,6,0.5)';
        ctx.beginPath();
        ctx.ellipse(kx, ky, 2 + rand() * 3, 1 + rand() * 2, rand() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      // seam
      ctx.fillStyle = 'rgba(8,5,3,0.75)';
      ctx.fillRect(px, y, 2, plankH);
    }
    ctx.fillStyle = 'rgba(8,5,3,0.8)';
    ctx.fillRect(0, y, s, 2);
  }

  stains(ctx, s, s, rand, 6, 0.3, '18,10,4');
  grain(ctx, s, s, 16, rand);
  return finish(c, 4, 5);
}

export function carpetTexture(seed = 7) {
  const s = 512;
  const c = makeCanvas(s);
  const ctx = c.getContext('2d');
  const rand = mulberry32(seed);
  ctx.fillStyle = '#2a211d';
  ctx.fillRect(0, 0, s, s);
  fibers(ctx, s, s, rand, 9000, ['#3c2f29', '#241b18', '#4a3a31', '#332823', '#1d1614']);
  stains(ctx, s, s, rand, 9, 0.34, '12,7,4');
  grain(ctx, s, s, 14, rand);
  return finish(c, 5, 5);
}

export function tileTexture(seed = 11) {
  const s = 512;
  const c = makeCanvas(s);
  const ctx = c.getContext('2d');
  const rand = mulberry32(seed);
  ctx.fillStyle = '#4a4c44';
  ctx.fillRect(0, 0, s, s);
  const n = 4;
  const cell = s / n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const tone = 92 + rand() * 26;
      ctx.fillStyle = `rgb(${tone},${tone + 2},${tone - 6})`;
      ctx.fillRect(x * cell + 4, y * cell + 4, cell - 8, cell - 8);
      const g = ctx.createLinearGradient(x * cell, y * cell, (x + 1) * cell, (y + 1) * cell);
      g.addColorStop(0, 'rgba(255,255,255,0.05)');
      g.addColorStop(0.6, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.16)');
      ctx.fillStyle = g;
      ctx.fillRect(x * cell + 4, y * cell + 4, cell - 8, cell - 8);
    }
  }
  stains(ctx, s, s, rand, 8, 0.3, '30,26,12');
  cracks(ctx, s, s, rand, 6, 'rgba(25,22,18,0.4)');
  grain(ctx, s, s, 14, rand);
  return finish(c, 3, 3);
}

export function ceilingTexture(seed = 13) {
  const s = 512;
  const c = makeCanvas(s);
  const ctx = c.getContext('2d');
  const rand = mulberry32(seed);
  ctx.fillStyle = '#716c5d';
  ctx.fillRect(0, 0, s, s);
  stains(ctx, s, s, rand, 8, 0.3, '40,30,14');
  cracks(ctx, s, s, rand, 7, 'rgba(30,26,20,0.4)');
  grain(ctx, s, s, 18, rand);
  return finish(c, 3, 3);
}

/* ───────────────────────── doors & furniture ───────────────────────── */

export function doorTexture(seed = 17) {
  const s = 512;
  const c = makeCanvas(s);
  const ctx = c.getContext('2d');
  const rand = mulberry32(seed);
  ctx.fillStyle = '#33251b';
  ctx.fillRect(0, 0, s, s);
  // grain
  for (let i = 0; i < 140; i++) {
    const x = rand() * s;
    ctx.strokeStyle = `rgba(${10 + rand() * 30},${6 + rand() * 18},${3 + rand() * 10},${0.1 + rand() * 0.2})`;
    ctx.lineWidth = 0.5 + rand() * 1.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + (rand() - 0.5) * 12, s * 0.33, x + (rand() - 0.5) * 12, s * 0.66, x + (rand() - 0.5) * 8, s);
    ctx.stroke();
  }
  // panels
  for (const [x, y, w, h] of [[58, 48, 176, 180], [278, 48, 176, 180], [58, 284, 176, 180], [278, 284, 176, 180]]) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(120,92,60,0.28)';
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 8, y + 8, w - 16, h - 16);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 14, y + 14, w - 28, h - 28);
  }
  stains(ctx, s, s, rand, 4, 0.22, '20,12,5');
  grain(ctx, s, s, 14, rand);
  return finish(c, 1, 1);
}

export function fabricTexture(seed = 19) {
  const s = 256;
  const c = makeCanvas(s);
  const ctx = c.getContext('2d');
  const rand = mulberry32(seed);
  ctx.fillStyle = '#3c3b32';
  ctx.fillRect(0, 0, s, s);
  for (let y = 0; y < s; y += 3) {
    ctx.strokeStyle = `rgba(255,255,255,${0.015 + rand() * 0.03})`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(s, y + (rand() - 0.5) * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(0,0,0,${0.02 + rand() * 0.04})`;
    ctx.beginPath();
    ctx.moveTo(0, y + 1);
    ctx.lineTo(s, y + 1);
    ctx.stroke();
  }
  for (let x = 0; x < s; x += 3) {
    ctx.strokeStyle = `rgba(0,0,0,${0.02 + rand() * 0.03})`;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, s);
    ctx.stroke();
  }
  stains(ctx, s, s, rand, 3, 0.2, '18,12,6');
  return finish(c, 3, 3);
}

export function sheetTexture(seed = 23) {
  const s = 256;
  const c = makeCanvas(s);
  const ctx = c.getContext('2d');
  const rand = mulberry32(seed);
  ctx.fillStyle = '#9c9481';
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 30; i++) {
    ctx.strokeStyle = `rgba(${rand() > 0.5 ? '60,54,44' : '210,204,186'},${0.06 + rand() * 0.1})`;
    ctx.lineWidth = 1 + rand() * 3;
    ctx.beginPath();
    const x = rand() * s;
    const y = rand() * s;
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + 30, y + (rand() - 0.5) * 40, x + 70, y + (rand() - 0.5) * 40, x + 110, y + (rand() - 0.5) * 20);
    ctx.stroke();
  }
  stains(ctx, s, s, rand, 4, 0.26, '60,48,20');
  grain(ctx, s, s, 12, rand);
  return finish(c, 2, 2);
}

export function woodFurnitureTexture(seed = 29) {
  const s = 256;
  const c = makeCanvas(s);
  const ctx = c.getContext('2d');
  const rand = mulberry32(seed);
  ctx.fillStyle = '#3a291c';
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 90; i++) {
    const y = rand() * s;
    ctx.strokeStyle = `rgba(${15 + rand() * 25},${8 + rand() * 16},${3 + rand() * 8},${0.12 + rand() * 0.18})`;
    ctx.lineWidth = 0.5 + rand() * 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(s * 0.3, y + (rand() - 0.5) * 12, s * 0.6, y + (rand() - 0.5) * 12, s, y + (rand() - 0.5) * 6);
    ctx.stroke();
  }
  grain(ctx, s, s, 12, rand);
  return finish(c, 2, 2);
}

export function metalTexture(seed = 31) {
  const s = 256;
  const c = makeCanvas(s);
  const ctx = c.getContext('2d');
  const rand = mulberry32(seed);
  ctx.fillStyle = '#4a4a46';
  ctx.fillRect(0, 0, s, s);
  stains(ctx, s, s, rand, 7, 0.35, '70,40,12');
  grain(ctx, s, s, 26, rand);
  return finish(c, 2, 2);
}

/* ───────────────────────── pictures / screens ───────────────────────── */

export function photoTexture(seed = 37) {
  const s = 256;
  const c = makeCanvas(s);
  const ctx = c.getContext('2d');
  const rand = mulberry32(seed);
  // white polaroid border
  ctx.fillStyle = '#d8d1bd';
  ctx.fillRect(0, 0, s, s);
  const pad = 16;
  const g = ctx.createLinearGradient(0, pad, 0, s - 46);
  g.addColorStop(0, '#9b917c');
  g.addColorStop(0.5, '#6d6555');
  g.addColorStop(1, '#3a352b');
  ctx.fillStyle = g;
  ctx.fillRect(pad, pad, s - pad * 2, s - pad - 46);
  // doorway light
  ctx.fillStyle = 'rgba(230,220,190,0.22)';
  ctx.fillRect(s * 0.36, s * 0.18, s * 0.28, s * 0.6);
  // figures
  ctx.fillStyle = '#171410';
  // adult
  ctx.beginPath();
  ctx.ellipse(s * 0.52, s * 0.46, 11, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(s * 0.48, s * 0.51, 17, 50);
  ctx.fillRect(s * 0.47, s * 0.66, 7, 38);
  ctx.fillRect(s * 0.57, s * 0.66, 7, 38);
  // child
  ctx.beginPath();
  ctx.ellipse(s * 0.40, s * 0.55, 8, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(s * 0.37, s * 0.59, 12, 34);
  ctx.fillRect(s * 0.36, s * 0.71, 5, 24);
  ctx.fillRect(s * 0.44, s * 0.71, 5, 24);
  // child's hand reaching
  ctx.strokeStyle = '#171410';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(s * 0.46, s * 0.63);
  ctx.lineTo(s * 0.5, s * 0.6);
  ctx.stroke();
  // photo grain & scratches
  grain(ctx, s, s, 34, rand);
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = 'rgba(240,235,220,0.25)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(rand() * s, rand() * s);
    ctx.lineTo(rand() * s, rand() * s);
    ctx.stroke();
  }
  return finish(c, 1, 1);
}

export function portraitTexture(seed = 41) {
  const s = 256;
  const c = makeCanvas(s);
  const ctx = c.getContext('2d');
  const rand = mulberry32(seed);
  ctx.fillStyle = '#1b1712';
  ctx.fillRect(0, 0, s, s);
  // vague figure in the dark
  const g = ctx.createRadialGradient(s * 0.5, s * 0.38, 5, s * 0.5, s * 0.45, s * 0.4);
  g.addColorStop(0, 'rgba(180,170,145,0.55)');
  g.addColorStop(0.5, 'rgba(110,100,82,0.25)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  // face
  ctx.fillStyle = 'rgba(196,184,158,0.55)';
  ctx.beginPath();
  ctx.ellipse(s * 0.5, s * 0.4, 34, 46, -0.08, 0, Math.PI * 2);
  ctx.fill();
  // hair
  ctx.fillStyle = 'rgba(18,14,10,0.9)';
  ctx.beginPath();
  ctx.ellipse(s * 0.5, s * 0.28, 44, 26, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  // eyes (dark)
  ctx.fillStyle = 'rgba(15,12,9,0.9)';
  ctx.beginPath();
  ctx.ellipse(s * 0.45, s * 0.38, 5, 3, 0, 0, Math.PI * 2);
  ctx.ellipse(s * 0.55, s * 0.38, 5, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  // mouth smear
  ctx.strokeStyle = 'rgba(40,20,16,0.65)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(s * 0.46, s * 0.52);
  ctx.quadraticCurveTo(s * 0.5, s * 0.54, s * 0.55, s * 0.515);
  ctx.stroke();
  // body
  ctx.fillStyle = 'rgba(24,20,16,0.85)';
  ctx.beginPath();
  ctx.ellipse(s * 0.5, s * 0.95, 70, 70, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  grain(ctx, s, s, 22, rand);
  // varnish cracks
  cracks(ctx, s, s, rand, 5, 'rgba(20,16,12,0.3)');
  return finish(c, 1, 1);
}

export function tvStaticTexture(seed = 43) {
  const s = 256;
  const c = makeCanvas(s);
  const ctx = c.getContext('2d');
  const rand = mulberry32(seed);
  const img = ctx.createImageData(s, s);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = rand() * 255;
    img.data[i] = v * 0.75;
    img.data[i + 1] = v * 0.82;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  for (let y = 0; y < s; y += 4 + Math.floor(rand() * 8)) {
    ctx.fillStyle = `rgba(0,0,0,${0.08 + rand() * 0.16})`;
    ctx.fillRect(0, y, s, 1 + rand() * 2);
  }
  return finish(c, 1, 1);
}

export function rainTexture(seed = 47) {
  const s = 256;
  const c = makeCanvas(s);
  const ctx = c.getContext('2d');
  const rand = mulberry32(seed);
  ctx.clearRect(0, 0, s, s);
  for (let i = 0; i < 90; i++) {
    const x = rand() * s;
    const y = rand() * s;
    const len = 10 + rand() * 40;
    const g = ctx.createLinearGradient(x, y, x + 2, y + len);
    g.addColorStop(0, 'rgba(180,200,210,0)');
    g.addColorStop(0.4, `rgba(190,210,225,${0.12 + rand() * 0.2})`);
    g.addColorStop(1, 'rgba(180,200,210,0)');
    ctx.strokeStyle = g;
    ctx.lineWidth = 0.6 + rand() * 0.9;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 2, y + len);
    ctx.stroke();
  }
  // droplets
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = `rgba(200,220,230,${0.05 + rand() * 0.15})`;
    ctx.beginPath();
    ctx.arc(rand() * s, rand() * s, 0.8 + rand() * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  return finish(c, 2, 2);
}

export function paperTexture(seed = 53) {
  const s = 256;
  const c = makeCanvas(s);
  const ctx = c.getContext('2d');
  const rand = mulberry32(seed);
  ctx.fillStyle = '#cfc4a9';
  ctx.fillRect(0, 0, s, s);
  stains(ctx, s, s, rand, 4, 0.18, '80,55,20');
  // illegible handwriting
  ctx.strokeStyle = 'rgba(45,38,28,0.55)';
  for (let line = 0; line < 8; line++) {
    const y = 50 + line * 20;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    let x = 34;
    ctx.moveTo(x, y);
    while (x < s - 34) {
      const w = 4 + rand() * 12;
      ctx.quadraticCurveTo(x + w * 0.5, y - 2 - rand() * 3, x + w, y);
      x += w + 1 + rand() * 3;
    }
    ctx.stroke();
  }
  grain(ctx, s, s, 10, rand);
  return finish(c, 1, 1);
}

export function glowTexture() {
  const s = 128;
  const c = makeCanvas(s);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,240,205,0.9)');
  g.addColorStop(0.25, 'rgba(240,210,160,0.35)');
  g.addColorStop(0.6, 'rgba(200,160,110,0.08)');
  g.addColorStop(1, 'rgba(200,160,110,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return finish(c, 1, 1);
}

export function stainDecalTexture(seed = 59) {
  const s = 256;
  const c = makeCanvas(s);
  const ctx = c.getContext('2d');
  const rand = mulberry32(seed);
  ctx.clearRect(0, 0, s, s);
  const cx = s / 2;
  const cy = s / 2;
  const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, s * 0.42);
  g.addColorStop(0, 'rgba(20,12,7,0.7)');
  g.addColorStop(0.45, 'rgba(28,17,9,0.42)');
  g.addColorStop(1, 'rgba(30,18,10,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.42, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 16; i++) {
    const a = rand() * Math.PI * 2;
    const r = 20 + rand() * 85;
    ctx.fillStyle = `rgba(22,13,7,${0.15 + rand() * 0.3})`;
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 3 + rand() * 14, 2 + rand() * 9, rand() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  return finish(c, 1, 1);
}


export function windowTexture(seed = 71) {
  const s = 256;
  const c = makeCanvas(s);
  const ctx = c.getContext('2d');
  const rand = mulberry32(seed);
  const g = ctx.createLinearGradient(0, 0, 0, s);
  g.addColorStop(0, '#1b2a36');
  g.addColorStop(0.45, '#16222b');
  g.addColorStop(1, '#080d11');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);

  // moon behind cloud
  const mg = ctx.createRadialGradient(s * 0.3, s * 0.24, 2, s * 0.3, s * 0.24, 38);
  mg.addColorStop(0, 'rgba(196,210,214,0.55)');
  mg.addColorStop(0.4, 'rgba(140,160,170,0.16)');
  mg.addColorStop(1, 'rgba(120,140,150,0)');
  ctx.fillStyle = mg;
  ctx.fillRect(0, 0, s, s);

  // clouds
  for (let i = 0; i < 9; i++) {
    const x = rand() * s;
    const y = rand() * s * 0.6;
    const r = 25 + rand() * 55;
    const cg = ctx.createRadialGradient(x, y, 2, x, y, r);
    cg.addColorStop(0, `rgba(60,78,90,${0.16 + rand() * 0.2})`);
    cg.addColorStop(1, 'rgba(40,55,66,0)');
    ctx.fillStyle = cg;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // distant buildings
  ctx.fillStyle = '#070b0e';
  let bx = 0;
  while (bx < s) {
    const bw = 10 + rand() * 28;
    const bh = 20 + rand() * 55;
    ctx.fillRect(bx, s - bh, bw, bh);
    for (let wy = s - bh + 6; wy < s - 4; wy += 7) {
      for (let wx = bx + 3; wx < bx + bw - 2; wx += 6) {
        if (rand() > 0.72) {
          ctx.fillStyle = `rgba(200,170,110,${0.2 + rand() * 0.5})`;
          ctx.fillRect(wx, wy, 2, 2);
        }
      }
    }
    ctx.fillStyle = '#070b0e';
    bx += bw + 1 + rand() * 3;
  }

  // rain
  for (let i = 0; i < 160; i++) {
    const x = rand() * s;
    const y = rand() * s;
    const len = 6 + rand() * 26;
    ctx.strokeStyle = `rgba(180,205,220,${0.08 + rand() * 0.18})`;
    ctx.lineWidth = 0.5 + rand() * 0.7;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 1.5, y + len);
    ctx.stroke();
  }

  // condensation
  for (let i = 0; i < 24; i++) {
    const x = rand() * s;
    const y = rand() * s;
    const r = 0.8 + rand() * 2.4;
    const dg = ctx.createRadialGradient(x, y, 0, x, y, r);
    dg.addColorStop(0, 'rgba(200,220,230,0.22)');
    dg.addColorStop(1, 'rgba(200,220,230,0)');
    ctx.fillStyle = dg;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  grain(ctx, s, s, 8, rand);
  return finish(c, 1, 1);
}
