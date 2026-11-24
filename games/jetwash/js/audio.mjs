// Jet Wash audio: six physically modelled voices, all synthesized, zero samples.
// The water jet is a sustained filtered-noise bed modulated by pointer speed;
// foam, brush, squeegee, droplet chime and the finish flourish are one-shots.
// Every AudioParam is scheduled via methods, never assigned directly.

const MASTER_LEVEL = 0.78;

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
  let bed = null;

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
      const length = Math.floor(ctx.sampleRate * 1.5);
      noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      const rand = mulberry32(0x4a455457);
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

  function resumeIfNeeded() {
    if (ctx && ctx.state === "suspended" && typeof ctx.resume === "function") {
      try { ctx.resume(); } catch (error) { /* ignore */ }
    }
  }

  function envGain(attack, decay, peak, t) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(master);
    return g;
  }

  function noiseOne({ type = "bandpass", freq = 1200, q = 2, attack = 0.004, decay = 0.15, peak = 0.2, sweepTo = 0, delay = 0 }) {
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
    src.stop(t + attack + decay + 0.02);
  }

  function fmChime(freq, delay, peak) {
    if (!ctx) return;
    const t = now() + delay;
    const carrier = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();
    carrier.type = "sine";
    carrier.frequency.setValueAtTime(freq, t);
    mod.type = "sine";
    mod.frequency.setValueAtTime(freq * 2.01, t);
    modGain.gain.setValueAtTime(freq * 1.4, t);
    modGain.gain.exponentialRampToValueAtTime(1, t + 0.24);
    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    const g = envGain(0.003, 0.32, peak, t);
    carrier.connect(g);
    mod.start(t);
    carrier.start(t);
    mod.stop(t + 0.36);
    carrier.stop(t + 0.36);
  }

  function startBed() {
    if (!ensure() || bed) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1500, ctx.currentTime);
    filter.Q.setValueAtTime(0.8, ctx.currentTime);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(ctx.currentTime);
    bed = { src, filter, gain };
  }

  // speed is normalized pointer speed 0..1; active toggles the spray bed.
  function jet(active, speed = 0.5) {
    if (!ensure()) return;
    resumeIfNeeded();
    if (active) {
      startBed();
      if (!bed) return;
      const t = now();
      const s = Math.min(1, Math.max(0, speed));
      bed.filter.frequency.setTargetAtTime(1100 + s * 3200, t, 0.04);
      bed.filter.Q.setTargetAtTime(0.6 + s * 1.6, t, 0.05);
      bed.gain.gain.setTargetAtTime(0.10 + s * 0.12, t, 0.03);
    } else if (bed) {
      bed.gain.gain.setTargetAtTime(0, now(), 0.04);
    }
  }

  function stopAll() {
    if (bed) bed.gain.gain.setTargetAtTime(0, now(), 0.03);
  }

  function foam() {
    if (!ensure()) return;
    resumeIfNeeded();
    noiseOne({ type: "highpass", freq: 2400, q: 0.7, attack: 0.01, decay: 0.16, peak: 0.14, sweepTo: 5200 });
    for (let i = 0; i < 4; i += 1) fmChime(900 + i * 220, 0.05 + i * 0.035, 0.035);
  }

  function brush() {
    if (!ensure()) return;
    resumeIfNeeded();
    noiseOne({ type: "bandpass", freq: 780, q: 1.2, attack: 0.02, decay: 0.20, peak: 0.16, sweepTo: 1300 });
  }

  function squeegee() {
    if (!ensure()) return;
    resumeIfNeeded();
    noiseOne({ type: "bandpass", freq: 1900, q: 3.2, attack: 0.03, decay: 0.26, peak: 0.18, sweepTo: 620 });
  }

  function droplet() {
    if (!ensure()) return;
    resumeIfNeeded();
    fmChime(1320, 0, 0.10);
  }

  function finish() {
    if (!ensure()) return;
    resumeIfNeeded();
    noiseOne({ type: "highpass", freq: 900, q: 0.6, attack: 0.06, decay: 0.5, peak: 0.16, sweepTo: 4200 });
    // Gentle major-pentatonic rising marimba, not a stock arpeggio.
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => fmChime(f, 0.12 + i * 0.11, 0.085));
  }

  function setMuted(value) {
    muted = Boolean(value);
    if (!ctx || !master) return muted;
    master.gain.setTargetAtTime(muted ? 0 : MASTER_LEVEL, now(), 0.02);
    if (muted) stopAll();
    else resumeIfNeeded();
    return muted;
  }

  function suspend() {
    stopAll();
  }

  return { jet, foam, brush, squeegee, droplet, finish, setMuted, suspend, get muted() { return muted; }, get ready() { return Boolean(ctx); } };
}
