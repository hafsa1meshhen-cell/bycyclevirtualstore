/**
 * Procedural audio – no audio files needed.
 * - Ambient generative "lounge" music (warm detuned pads, sub bass, soft bells, reverb)
 * - UI sounds: click, hover tick, whoosh, success chime
 */
const MUTE_KEY = 'velovr.muted';

// A minor-ish dreamy progression (MIDI notes)
const CHORDS = [
  [57, 64, 67, 71, 74], // Am9
  [53, 60, 64, 67, 72], // Fmaj7
  [48, 55, 64, 67, 71], // Cmaj7
  [55, 62, 66, 69, 74], // G6/9-ish
];
const BELL_SCALE = [69, 72, 74, 76, 79, 81, 84, 86];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = (() => {
      try {
        return localStorage.getItem(MUTE_KEY) === '1';
      } catch {
        return false;
      }
    })();
    this.listeners = new Set();
    this._chordIndex = 0;
    this._timers = [];
  }

  /** Must be called from a user gesture. Safe to call repeatedly. */
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());

    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(ctx.destination);

    // Music bus with reverb
    this.music = ctx.createGain();
    this.music.gain.value = 0.55;
    const reverb = ctx.createConvolver();
    reverb.buffer = this._impulse(3.2);
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    this.music.connect(this.master);
    this.music.connect(reverb);
    reverb.connect(wet);
    wet.connect(this.master);

    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.6;
    this.sfx.connect(this.master);

    this._noise = this._noiseBuffer(1.5);
    this._startMusic();
  }

  setMuted(muted) {
    this.muted = muted;
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.15);
    this.listeners.forEach((fn) => fn(muted));
  }
  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }
  onChange(fn) {
    this.listeners.add(fn);
  }

  // ---------------------------------------------------------------- music
  _startMusic() {
    const playChord = () => {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + 0.05;
      const chord = CHORDS[this._chordIndex++ % CHORDS.length];
      chord.forEach((n, i) => this._pad(mtof(n - 12 * (i === 0 ? 1 : 0)), t, 9.5, i === 0 ? 0.05 : 0.028));
      this._sub(mtof(chord[0] - 24), t, 9);
    };
    playChord();
    this._timers.push(setInterval(playChord, 8000));

    const bell = () => {
      if (this.ctx && Math.random() < 0.75) {
        const n = BELL_SCALE[(Math.random() * BELL_SCALE.length) | 0];
        this._bell(mtof(n), this.ctx.currentTime + 0.02, 0.035);
      }
      this._timers.push(setTimeout(bell, 1400 + Math.random() * 2600));
    };
    this._timers.push(setTimeout(bell, 2500));
  }

  _pad(freq, t, dur, vol) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(700, t);
    f.frequency.linearRampToValueAtTime(1400, t + dur * 0.5);
    f.frequency.linearRampToValueAtTime(600, t + dur);
    f.Q.value = 0.6;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 2.8);
    g.gain.setValueAtTime(vol, t + dur - 3.2);
    g.gain.linearRampToValueAtTime(0, t + dur);
    f.connect(g);
    g.connect(this.music);
    for (const detune of [-7, 6]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      o.detune.value = detune;
      o.connect(f);
      o.start(t);
      o.stop(t + dur + 0.1);
    }
  }

  _sub(freq, t, dur) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09, t + 2);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g);
    g.connect(this.music);
    o.start(t);
    o.stop(t + dur + 0.1);
  }

  _bell(freq, t, vol, bus = this.music) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    g.connect(bus);
    [1, 2.01, 3.98].forEach((mult, i) => {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq * mult;
      og.gain.value = [1, 0.35, 0.12][i];
      o.connect(og);
      og.connect(g);
      o.start(t);
      o.stop(t + 2.5);
    });
  }

  // ---------------------------------------------------------------- sfx
  click() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(1500, t);
    o.frequency.exponentialRampToValueAtTime(700, t + 0.06);
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g);
    g.connect(this.sfx);
    o.start(t);
    o.stop(t + 0.1);
  }

  hover() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 2200;
    g.gain.setValueAtTime(0.04, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g);
    g.connect(this.sfx);
    o.start(t);
    o.stop(t + 0.06);
  }

  whoosh(duration = 0.7) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this._noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(2600, t + duration * 0.45);
    f.frequency.exponentialRampToValueAtTime(400, t + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + duration * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfx);
    src.start(t);
    src.stop(t + duration + 0.05);
  }

  success() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [76, 81, 88].forEach((n, i) => this._bell(mtof(n), t + i * 0.09, 0.09, this.sfx));
  }

  // ---------------------------------------------------------------- helpers
  _noiseBuffer(seconds) {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  _impulse(seconds) {
    const ctx = this.ctx;
    const len = ctx.sampleRate * seconds;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    return buf;
  }
}

export const audio = new AudioEngine();
