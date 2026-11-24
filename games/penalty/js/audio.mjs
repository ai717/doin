// Penalty Shootout audio: six physically modelled stadium voices, all synthesized.
// No external samples. Every AudioParam is scheduled via methods, never assigned.

const MASTER_LEVEL = 0.82;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let muted = false;

  function ensure() {
    if (muted) return null;
    if (ctx) return ctx;
    const Ctor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.setValueAtTime(muted ? 0 : MASTER_LEVEL, ctx.currentTime);
      master.connect(ctx.destination);
      const length = Math.floor(ctx.sampleRate * 1.6);
      noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      const rand = mulberry32(0x50454e41);
      for (let i = 0; i < length; i += 1) data[i] = rand() * 2 - 1;
      return ctx;
    } catch (error) {
      ctx = null;
      master = null;
      return null;
    }
  }

  function now() {
    return ctx ? ctx.currentTime : 0;
  }

  function envGain(attack, decay, peak, t) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(master);
    return g;
  }

  function noiseBurst({ type = "bandpass", freq = 1200, q = 2, attack = 0.004, decay = 0.15, peak = 0.2, sweepTo = 0, delay = 0 }) {
    if (!ctx) return;
    const t = now() + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);
    filter.Q.setValueAtTime(q, t);
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(Math.max(60, sweepTo), t + attack + decay);
    const g = envGain(attack, decay, peak, t);
    src.connect(filter);
    filter.connect(g);
    src.start(t);
    src.stop(t + attack + decay + 0.03);
  }

  function toneSweep({ from = 140, to = 55, decay = 0.14, peak = 0.3, type = "sine", delay = 0 }) {
    if (!ctx) return;
    const t = now() + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, to), t + decay);
    const g = envGain(0.002, decay, peak, t);
    osc.connect(g);
    osc.start(t);
    osc.stop(t + decay + 0.03);
  }

  // 1. Short turf footsteps before the strike.
  function steps() {
    if (!ensure()) return;
    try {
      for (let i = 0; i < 3; i += 1) {
        noiseBurst({ freq: 420 - i * 40, q: 1.6, attack: 0.003, decay: 0.055, peak: 0.13, delay: i * 0.115 });
      }
    } catch (error) { /* silent degradation */ }
  }

  // 2. Leather thump: low-frequency impact plus a brief leather snap.
  function kick(power = "drive") {
    if (!ensure()) return;
    try {
      const heavy = power === "blast";
      const soft = power === "tap";
      toneSweep({ from: heavy ? 170 : soft ? 110 : 140, to: heavy ? 45 : 60, decay: heavy ? 0.19 : 0.13, peak: heavy ? 0.42 : soft ? 0.24 : 0.34 });
      noiseBurst({ freq: heavy ? 760 : 980, q: 2.2, attack: 0.002, decay: heavy ? 0.12 : 0.08, peak: heavy ? 0.3 : 0.2, sweepTo: 320 });
    } catch (error) { /* silent degradation */ }
  }

  // 3. Net ripple: rope friction with a long, loosening tail.
  function net() {
    if (!ensure()) return;
    try {
      noiseBurst({ freq: 2100, q: 1.4, attack: 0.008, decay: 0.42, peak: 0.19, sweepTo: 760 });
      for (let i = 0; i < 4; i += 1) {
        noiseBurst({ freq: 2600 + i * 260, q: 5, attack: 0.002, decay: 0.09, peak: 0.045, delay: 0.07 + i * 0.065 });
      }
    } catch (error) { /* silent degradation */ }
  }

  // 4. Glove parry: a crisp slap plus the ball spinning away.
  function save() {
    if (!ensure()) return;
    try {
      noiseBurst({ type: "highpass", freq: 2100, q: 0.8, attack: 0.002, decay: 0.075, peak: 0.34 });
      toneSweep({ from: 260, to: 90, decay: 0.12, peak: 0.16, type: "triangle" });
      noiseBurst({ freq: 900, q: 6, attack: 0.02, decay: 0.28, peak: 0.1, sweepTo: 3400, delay: 0.05 });
    } catch (error) { /* silent degradation */ }
  }

  // 5. Wide ball: high-Q whistle sweeping past the frame into the stands.
  function wide() {
    if (!ensure()) return;
    try {
      noiseBurst({ freq: 1200, q: 9, attack: 0.05, decay: 0.5, peak: 0.19, sweepTo: 4600 });
      noiseBurst({ freq: 3400, q: 4, attack: 0.12, decay: 0.35, peak: 0.08, sweepTo: 1800, delay: 0.1 });
    } catch (error) { /* silent degradation */ }
  }

  // 6. Crowd: layered band-passed noise, swelling for a cheer, sinking for a sigh.
  function crowd(cheering = true) {
    if (!ensure()) return;
    try {
      const bands = [380, 760, 1300, 2100];
      bands.forEach((freq, index) => {
        const t = now();
        const src = ctx.createBufferSource();
        src.buffer = noiseBuffer;
        src.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(freq, t);
        filter.Q.setValueAtTime(0.9, t);
        const g = ctx.createGain();
        const peak = 0.1 - index * 0.014;
        const attack = cheering ? 0.16 + index * 0.05 : 0.03;
        const decay = cheering ? 1.15 : 0.8;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(peak, t + attack);
        if (!cheering) filter.frequency.exponentialRampToValueAtTime(Math.max(120, freq * 0.45), t + decay);
        g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
        src.connect(filter);
        filter.connect(g);
        g.connect(master);
        src.start(t);
        src.stop(t + attack + decay + 0.04);
      });
    } catch (error) { /* silent degradation */ }
  }

  function setMuted(value) {
    muted = Boolean(value);
    if (!ctx || !master) return muted;
    try {
      master.gain.setTargetAtTime(muted ? 0 : MASTER_LEVEL, now(), 0.02);
      if (muted && ctx.state === "running") ctx.suspend().catch(() => {});
      if (!muted && ctx.state === "suspended") ctx.resume().catch(() => {});
    } catch (error) { /* silent degradation */ }
    return muted;
  }

  function suspend() {
    if (!ctx || ctx.state !== "running") return;
    try { ctx.suspend().catch(() => {}); } catch (error) { /* ignore */ }
  }

  function resume() {
    if (!ctx || muted || ctx.state !== "suspended") return;
    try { ctx.resume().catch(() => {}); } catch (error) { /* ignore */ }
  }

  return {
    unlock: ensure,
    steps,
    kick,
    net,
    save,
    wide,
    crowd,
    setMuted,
    suspend,
    resume,
    get muted() { return muted; },
  };
}
