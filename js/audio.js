/* ─────────────────────────────────────────────────────────────
   All sound is synthesised in the browser. No audio files.
   ───────────────────────────────────────────────────────────── */

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.volume = 0.7;
    this.muted = false;
    this.noise = null;
    this.nextBeat = 0;
    this.nextMusic = 0;
    this.nextWhisper = 0;
    this.entityLevel = 0;
    this.sanity = 1;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(ctx.destination);

    // gentle bus compression so stingers don't clip
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 22;
    comp.ratio.value = 5;
    comp.attack.value = 0.004;
    comp.release.value = 0.28;
    comp.connect(this.master);
    this.bus = comp;

    this.noise = this.makeNoise(3);
    this.ready = true;
    this.buildAmbience();
  }

  makeNoise(seconds) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        last = 0.985 * last + 0.015 * white;
        data[i] = white * 0.55 + last * 1.4;
      }
    }
    return buffer;
  }

  noiseSource(loop = true) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = loop;
    return src;
  }

  buildAmbience() {
    const ctx = this.ctx;

    // ── low, breathing drone ──
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0.055;
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 210;
    droneFilter.Q.value = 1.2;
    this.droneGain.connect(droneFilter);
    droneFilter.connect(this.bus);

    const d1 = ctx.createOscillator();
    d1.type = 'sine';
    d1.frequency.value = 43.65;
    const d2 = ctx.createOscillator();
    d2.type = 'sawtooth';
    d2.frequency.value = 43.65 * 1.006;
    const d3 = ctx.createOscillator();
    d3.type = 'sine';
    d3.frequency.value = 87.3 * 0.997;
    const g2 = ctx.createGain();
    g2.gain.value = 0.22;
    const g3 = ctx.createGain();
    g3.gain.value = 0.16;
    d1.connect(this.droneGain);
    d2.connect(g2); g2.connect(this.droneGain);
    d3.connect(g3); g3.connect(this.droneGain);
    d1.start(); d2.start(); d3.start();
    this.droneOscs = [d1, d2, d3];

    // slow amplitude LFO
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.045;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.024;
    lfo.connect(lfoGain);
    lfoGain.connect(this.droneGain.gain);
    lfo.start();

    // ── rain against the windows ──
    const rain = this.noiseSource();
    const rainFilter = ctx.createBiquadFilter();
    rainFilter.type = 'bandpass';
    rainFilter.frequency.value = 1500;
    rainFilter.Q.value = 0.45;
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0.026;
    rain.connect(rainFilter);
    rainFilter.connect(this.rainGain);
    this.rainGain.connect(this.bus);
    rain.start();

    // rain body
    const rain2 = this.noiseSource();
    const rf2 = ctx.createBiquadFilter();
    rf2.type = 'lowpass';
    rf2.frequency.value = 420;
    const rg2 = ctx.createGain();
    rg2.gain.value = 0.03;
    rain2.connect(rf2); rf2.connect(rg2); rg2.connect(this.bus);
    rain2.start();

    // ── room tone / air ──
    const air = this.noiseSource();
    const airF = ctx.createBiquadFilter();
    airF.type = 'lowpass';
    airF.frequency.value = 170;
    const airG = ctx.createGain();
    airG.gain.value = 0.03;
    air.connect(airF); airF.connect(airG); airG.connect(this.bus);
    air.start();

    // ── entity presence bed (silent until needed) ──
    const pres = this.noiseSource();
    const presF = ctx.createBiquadFilter();
    presF.type = 'highpass';
    presF.frequency.value = 900;
    const presG = ctx.createGain();
    presG.gain.value = 0.0;
    pres.connect(presF); presF.connect(presG); presG.connect(this.bus);
    pres.start();
    this.presenceGain = presG;

    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = 31;
    const subG = ctx.createGain();
    subG.gain.value = 0.0;
    sub.connect(subG); subG.connect(this.bus);
    sub.start();
    this.subGain = subG;

    // ── whisper bed, tied to sanity ──
    const wh = this.noiseSource();
    const whF = ctx.createBiquadFilter();
    whF.type = 'bandpass';
    whF.frequency.value = 2100;
    whF.Q.value = 1.8;
    const whG = ctx.createGain();
    whG.gain.value = 0;
    const whPan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    wh.connect(whF);
    if (whPan) { whF.connect(whPan); whPan.connect(whG); } else whF.connect(whG);
    whG.connect(this.bus);
    wh.start();
    this.whisperGain = whG;
    this.whisperPan = whPan;

    const whLfo = ctx.createOscillator();
    whLfo.frequency.value = 0.19;
    const whLfoG = ctx.createGain();
    whLfoG.gain.value = 900;
    whLfo.connect(whLfoG); whLfoG.connect(whF.frequency);
    whLfo.start();

    this.nextBeat = ctx.currentTime + 2;
    this.nextMusic = ctx.currentTime + 10;
    this.nextWhisper = ctx.currentTime + 6;
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : v, this.ctx.currentTime, 0.08);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : this.volume, this.ctx.currentTime, 0.08);
  }

  setSanity(s) {
    this.sanity = s;
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const target = (1 - s) * 0.018;
    this.whisperGain.gain.setTargetAtTime(target, t, 1.5);
    if (this.whisperPan) {
      this.whisperPan.pan.setTargetAtTime(Math.sin(t * 0.13) * 0.7, t, 2);
    }
    if (this.droneGain) this.droneGain.gain.setTargetAtTime(0.055 + (1 - s) * 0.035, t, 2);
  }

  setEntity(active, distance) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const near = active ? Math.max(0, 1 - distance / 14) : 0;
    this.entityLevel = near;
    this.presenceGain.gain.setTargetAtTime(near * 0.035, t, 0.25);
    this.subGain.gain.setTargetAtTime(near * 0.07, t, 0.4);
  }

  footstep(run = false) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = this.noiseSource(false);
    src.playbackRate.value = 0.7 + Math.random() * 0.5;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = run ? 480 : 330;
    f.Q.value = 1.4;
    const g = ctx.createGain();
    const vol = run ? 0.09 : 0.06;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (run ? 0.16 : 0.22));
    src.connect(f); f.connect(g); g.connect(this.bus);
    src.start(t); src.stop(t + 0.3);

    // heel scuff
    const s2 = this.noiseSource(false);
    s2.playbackRate.value = 1.4;
    const f2 = ctx.createBiquadFilter();
    f2.type = 'bandpass';
    f2.frequency.value = 1600;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.0001, t + 0.02);
    g2.gain.exponentialRampToValueAtTime(0.018, t + 0.03);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    s2.connect(f2); f2.connect(g2); g2.connect(this.bus);
    s2.start(t + 0.02); s2.stop(t + 0.2);
  }

  tone(freq, dur, type = 'sine', vol = 0.06, when = 0, dest = null, detune = 0) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.bus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  pickup() {
    if (!this.ready) return;
    this.tone(523.25, 1.2, 'sine', 0.045, 0);
    this.tone(783.99, 1.6, 'sine', 0.03, 0.08);
    this.tone(1046.5, 1.9, 'sine', 0.016, 0.16);
    this.tone(261.63, 2.4, 'sine', 0.03, 0);
    // reversed-ish breath
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = this.noiseSource(false);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(700, t);
    f.frequency.exponentialRampToValueAtTime(3200, t + 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.03, t + 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    src.connect(f); f.connect(g); g.connect(this.bus);
    src.start(t); src.stop(t + 1);
  }

  battery() {
    if (!this.ready) return;
    this.tone(392, 0.18, 'square', 0.025, 0);
    this.tone(587.33, 0.28, 'triangle', 0.03, 0.09);
  }

  click() {
    if (!this.ready) return;
    this.tone(1600, 0.05, 'square', 0.012, 0);
    this.tone(900, 0.07, 'sine', 0.01, 0.01);
  }

  stinger() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    // dissonant string cluster
    for (const [f, d] of [[146.8, 0], [155.6, 6], [220, -4], [233, 9]]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = d;
      const fl = ctx.createBiquadFilter();
      fl.type = 'lowpass';
      fl.frequency.setValueAtTime(900, t);
      fl.frequency.exponentialRampToValueAtTime(180, t + 2.4);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.035, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
      o.connect(fl); fl.connect(g); g.connect(this.bus);
      o.start(t); o.stop(t + 2.8);
    }
    // noise hit
    const src = this.noiseSource(false);
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    src.connect(f); f.connect(g); g.connect(this.bus);
    src.start(t); src.stop(t + 0.6);
  }

  jumpscare() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    this.stinger();
    const src = this.noiseSource(false);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(3000, t);
    f.frequency.exponentialRampToValueAtTime(180, t + 1.1);
    f.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    src.connect(f); f.connect(g); g.connect(this.bus);
    src.start(t); src.stop(t + 1.4);
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(1200, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.9);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.09, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    o.connect(og); og.connect(this.bus);
    o.start(t); o.stop(t + 1.3);
  }

  thunder() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = this.noiseSource(false);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(320, t);
    f.frequency.exponentialRampToValueAtTime(60, t + 3.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.28, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.13, t + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 4.2);
    src.connect(f); f.connect(g); g.connect(this.bus);
    src.start(t); src.stop(t + 4.4);
    this.tone(38, 3.5, 'sine', 0.09, 0.1);
    this.tone(57, 2.2, 'sine', 0.04, 0.2);
  }

  heartbeat(volume = 0.06) {
    if (!this.ready) return;
    this.tone(48, 0.16, 'sine', volume, 0);
    this.tone(43, 0.2, 'sine', volume * 0.7, 0.17);
  }

  whisper() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = this.noiseSource(false);
    src.playbackRate.value = 0.6 + Math.random() * 0.5;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1200 + Math.random() * 1800;
    f.Q.value = 3.5;
    const g = ctx.createGain();
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) pan.pan.value = Math.random() * 1.6 - 0.8;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.035, t + 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9 + Math.random() * 0.5);
    src.connect(f);
    if (pan) { f.connect(pan); pan.connect(g); } else f.connect(g);
    g.connect(this.bus);
    src.start(t); src.stop(t + 1.6);
  }

  musicBox() {
    if (!this.ready) return;
    const motif = [220, 261.63, 329.63, 392.0, 329.63, 261.63, 246.94, 220, 196.0, 246.94, 293.66, 349.23];
    const count = 3 + Math.floor(Math.random() * 4);
    let when = 0;
    for (let i = 0; i < count; i++) {
      const f = motif[Math.floor(Math.random() * motif.length)];
      this.tone(f, 2.8, 'triangle', 0.013, when, null, (Math.random() - 0.5) * 18);
      this.tone(f * 2, 1.6, 'sine', 0.004, when + 0.01);
      when += 0.45 + Math.random() * 0.7;
    }
  }

  doorOpen() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = this.noiseSource(false);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(180, t);
    f.frequency.exponentialRampToValueAtTime(700, t + 1.2);
    f.Q.value = 5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    src.connect(f); f.connect(g); g.connect(this.bus);
    src.start(t); src.stop(t + 1.7);
    this.tone(58, 1.2, 'sine', 0.05, 0.1);
  }

  update(dt) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const sanity = this.sanity;
    const ent = this.entityLevel;

    // heartbeat speeds up with proximity / low sanity
    if (t > this.nextBeat) {
      const urgency = Math.max(ent, 1 - sanity);
      if (urgency > 0.18) {
        this.heartbeat(0.02 + urgency * 0.07);
        this.nextBeat = t + Math.max(0.42, 1.15 - urgency * 0.62);
      } else {
        this.nextBeat = t + 1.2;
      }
    }

    // whispers
    if (t > this.nextWhisper) {
      if (sanity < 0.72 || Math.random() < 0.1) this.whisper();
      this.nextWhisper = t + 3 + Math.random() * 8;
    }

    // music box
    if (t > this.nextMusic) {
      if (sanity > 0.25) this.musicBox();
      this.nextMusic = t + 22 + Math.random() * 30;
    }
  }
}
