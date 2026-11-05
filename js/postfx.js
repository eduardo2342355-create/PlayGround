import * as THREE from '../vendor/three.module.js';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tDiffuse;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uSanity;
  uniform float uEntity;
  uniform float uFlash;
  uniform float uDamage;
  uniform float uFade;
  uniform float uGlitch;


  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  void main() {
    vec2 uv = vUv;
    vec2 c = uv - 0.5;
    float r2 = dot(c, c);

    // slow breathing warp when composure is low
    float dread = 1.0 - uSanity;
    uv.x += sin(uv.y * 9.0 + uTime * 1.7) * 0.0018 * dread;
    uv.y += sin(uv.x * 7.0 + uTime * 1.3) * 0.0012 * dread;

    // very subtle lens curvature
    uv = 0.5 + c * (1.0 + r2 * 0.045);

    // VHS-style tear bands when the figure is close
    float bandSeed = floor(uv.y * 46.0 + uTime * 4.0);
    float band = step(0.94, hash(vec2(bandSeed, floor(uTime * 7.0))));
    uv.x += (hash(vec2(bandSeed, 3.1)) - 0.5) * 0.012 * band * (0.25 + uGlitch);

    // chromatic aberration grows with dread and proximity
    vec2 ab = c * (0.0012 + dread * 0.0055 + uEntity * 0.009) * (0.35 + r2 * 2.2);
    vec3 col;
    col.r = texture2D(tDiffuse, uv + ab).r;
    col.g = texture2D(tDiffuse, uv).g;
    col.b = texture2D(tDiffuse, uv - ab).b;

    // cheap bright-pass bloom (four taps)
    vec3 bloom = vec3(0.0);
    vec2 px = 1.5 / uResolution;
    bloom += max(texture2D(tDiffuse, uv + vec2(px.x, 0.0)).rgb - 0.58, 0.0);
    bloom += max(texture2D(tDiffuse, uv - vec2(px.x, 0.0)).rgb - 0.58, 0.0);
    bloom += max(texture2D(tDiffuse, uv + vec2(0.0, px.y)).rgb - 0.58, 0.0);
    bloom += max(texture2D(tDiffuse, uv - vec2(0.0, px.y)).rgb - 0.58, 0.0);
    bloom += max(texture2D(tDiffuse, uv + vec2(px.x, px.y) * 2.5).rgb - 0.62, 0.0);
    bloom += max(texture2D(tDiffuse, uv - vec2(px.x, px.y) * 2.5).rgb - 0.62, 0.0);
    col += bloom * 0.17;

    // grade: sickly shadows, warm highlights, pulled saturation
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(lum), col, 0.78 - dread * 0.18);
    col *= vec3(0.95, 1.0, 1.035);
    col = pow(col, vec3(0.96, 1.0, 1.04));
    col += vec3(0.006, 0.009, 0.008) * (1.0 - smoothstep(0.0, 0.35, lum));

    // vignette
    float vig = 1.0 - smoothstep(0.28, 0.88, length(c * vec2(1.0, 0.92)) * 1.35);
    vig *= 0.92 + 0.08 * sin(uTime * 0.6);
    col *= mix(0.45, 1.0, vig);

    // film grain
    float grain = hash(uv * uResolution.xy + fract(uTime) * 971.0) - 0.5;
    col += grain * (0.022 + dread * 0.036);

    // faint scanline texture
    col *= 1.0 - 0.028 * (0.5 + 0.5 * sin(uv.y * uResolution.y * 3.14159));

    // entity static
    float st = hash(uv * uResolution.xy * 0.35 + uTime * 90.0);
    col += (st - 0.5) * uEntity * 0.14;
    col = mix(col, col * vec3(1.1, 0.92, 0.9), uEntity * 0.3);

    // damage pulse at edges
    float edge = smoothstep(0.18, 0.72, length(c));
    col = mix(col, vec3(0.34, 0.015, 0.01), uDamage * edge * 0.8);

    // lightning / jumpscare flash
    col = mix(col, vec3(0.93, 0.94, 0.92), uFlash);

    // final fade
    col *= 1.0 - uFade;

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export class PostProcessor {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.time = 0;

    const size = new THREE.Vector2();
    renderer.getSize(size);
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.width = Math.max(1, Math.floor(size.x * dpr));
    this.height = Math.max(1, Math.floor(size.y * dpr));

    this.target = new THREE.WebGLRenderTarget(this.width, this.height, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
    });
    this.target.texture.colorSpace = THREE.NoColorSpace;

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.target.texture },
        uResolution: { value: new THREE.Vector2(this.width, this.height) },
        uTime: { value: 0 },
        uSanity: { value: 1 },
        uEntity: { value: 0 },
        uFlash: { value: 0 },
        uDamage: { value: 0 },
        uFade: { value: 0 },
        uGlitch: { value: 0 },
      },
      vertexShader,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });

    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.quad.frustumCulled = false;
    this.postScene = new THREE.Scene();
    this.postScene.add(this.quad);
    this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  setSize(width, height) {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.width = Math.max(1, Math.floor(width * dpr));
    this.height = Math.max(1, Math.floor(height * dpr));
    this.target.setSize(this.width, this.height);
    this.material.uniforms.uResolution.value.set(this.width, this.height);
  }

  render(dt, params = {}) {
    this.time += dt;
    const u = this.material.uniforms;
    u.uTime.value = this.time;
    if (params.sanity !== undefined) u.uSanity.value = params.sanity;
    if (params.entity !== undefined) u.uEntity.value = params.entity;
    if (params.flash !== undefined) u.uFlash.value = params.flash;
    if (params.damage !== undefined) u.uDamage.value = params.damage;
    if (params.fade !== undefined) u.uFade.value = params.fade;
    if (params.glitch !== undefined) u.uGlitch.value = params.glitch;

    this.renderer.setRenderTarget(this.target);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCamera);
  }
}
