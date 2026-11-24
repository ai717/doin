// Procedural WebAudio. Noise-buffer + bandpass scraping bed (the core ASMR trigger),
// short pitched chip plinks with rising streak, FM chime for core reveal,
// marimba close for completion. Zero external audio files.
// All methods are safe no-ops when WebAudio is unavailable (Node tests, restricted browsers).

import { MATERIALS } from "./soaps.mjs";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let suspended = false;
  let bed = null; // { source, filter, gain }
  let noiseBuffer = null;
  let lastPlink = -Infinity;
  let streak = 0;
  let lastChipTime = -Infinity;

  function ensure() {
    if (ctx) return ctx;
    const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.setValueAtTime(muted ? 0 : 0.9, ctx.currentTime);
      master.connect(ctx.destination);
      noiseBuffer = makeNoise(ctx, 2);
      return ctx;
    } catch (error) {
      ctx = null;
      master = null;
      return null;
    }
  }

  function makeNoise(context, seconds) {
    const frames = Math.max(1, Math.floor(context.sampleRate * seconds));
    const buffer = context.createBuffer(1, frames, context.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 0x1234567;
    for (let i = 0; i < frames; i += 1) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      data[i] = (seed / 2147483648 - 1) * 0.7;
    }
    return buffer;
  }

  function now() {
    return ctx ? ctx.currentTime : 0;
  }

  function resumeIfNeeded() {
    if (ctx && ctx.state === "suspended" && !suspended && !muted) {
      try { ctx.resume(); } catch (error) { /* ignore */ }
    }
  }

  function unlock() {
    if (!ensure()) return false;
    resumeIfNeeded();
    return true;
  }

  function setMuted(value) {
    muted = Boolean(value);
    if (!ctx || !master) return muted;
    try {
      master.gain.setTargetAtTime(muted ? 0 : 0.9, now(), 0.02);
      if (muted) stopScrape();
      else resumeIfNeeded();
    } catch (error) { /* ignore */ }
    return muted;
  }

  function isMuted() {
    return muted;
  }

  function ensureBed() {
    if (!ensure()) return null;
    if (bed) return bed;
    try {
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer;
      source.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(1850, now());
      filter.Q.setValueAtTime(3, now());
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now());
      source.connect(filter).connect(gain).connect(master);
      source.start(0);
      bed = { source, filter, gain };
      return bed;
    } catch (error) {
      return null;
    }
  }

  function startScrape(materialId = "mat_hard", speed = 300) {
    const node = ensureBed();
    if (!node || muted || suspended) return false;
    try {
      resumeIfNeeded();
      const tone = MATERIALS[materialId] ?? MATERIALS.mat_hard;
      const t = now();
      node.materialId = tone.id;
      node.filter.frequency.setTargetAtTime(tone.freq, t, 0.03);
      node.filter.Q.setTargetAtTime(tone.q, t, 0.05);
      node.gain.gain.setTargetAtTime(0.16, t, 0.03);
      updateScrape(speed, 1);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Speed and thinness continuously modulate the scraping bed: faster -> brighter/denser,
  // thinner curl -> higher center frequency, thicker -> lower and broader.
  function updateScrape(speed = 300, thinness = 1) {
    if (!bed || muted || suspended) return false;
    try {
      const tone = MATERIALS[bed.materialId] ?? MATERIALS.mat_hard;
      const s = clamp(speed, 0, 2600) / 2600;
      const thin = clamp(thinness, 0.3, 2);
      const t = now();
      bed.filter.frequency.setTargetAtTime(tone.freq * (0.72 + s * 0.85) * (1 + (2 - thin) * 0.16), t, 0.035);
      bed.filter.Q.setTargetAtTime(tone.q * (0.8 + s * 0.5), t, 0.05);
      bed.gain.gain.setTargetAtTime(0.09 + s * 0.13, t, 0.035);
      return true;
    } catch (error) {
      return false;
    }
  }

  function stopScrape() {
    if (!bed) return false;
    try {
      bed.gain.gain.setTargetAtTime(0, now(), 0.04);
      streak = 0;
      return true;
    } catch (error) {
      return false;
    }
  }

  function plink(freq, gainValue, duration, type = "triangle") {
    if (!ensure() || muted || suspended) return false;
    try {
      const t = now();
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(gainValue, t + 0.004);
      env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      osc.connect(env).connect(master);
      osc.start(t);
      osc.stop(t + duration + 0.02);
      return true;
    } catch (error) {
      return false;
    }
  }

  function noiseBurst(freq, q, gainValue, duration) {
    if (!ensure() || muted || suspended) return false;
    try {
      const t = now();
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(freq, t);
      filter.Q.setValueAtTime(q, t);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(gainValue, t + 0.006);
      env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      source.connect(filter).connect(env).connect(master);
      source.start(t, Math.random() * 1.2);
      source.stop(t + duration + 0.02);
      return true;
    } catch (error) {
      return false;
    }
  }

  // One short brittle snap per detached curl/crumb, throttled and pitch-rising in a streak.
  function chip(style = "curl", streakBoost = 0) {
    if (!ensure() || muted || suspended) return false;
    const t = now();
    if (t - lastChipTime > 0.22) streak = 0;
    lastChipTime = t;
    if (t - lastPlink < 0.018) return false;
    lastPlink = t;
    streak = Math.min(28, streak + 1 + Math.max(0, Math.floor(streakBoost)));
    const step = Math.pow(2, streak / 24);
    if (style === "flake") return noiseBurst(1250 * step, 2.2, 0.13, 0.055);
    if (style === "ribbon") return noiseBurst(2100 * step, 4.5, 0.09, 0.035);
    return noiseBurst(1750 * step, 3.4, 0.11, 0.045) && plink(520 * step, 0.06, 0.07, "triangle");
  }

  function bladeIn() {
    return noiseBurst(820, 1.6, 0.16, 0.07) && plink(180, 0.08, 0.1, "sine");
  }

  // FM chime: carrier + modulator, no samples.
  function coreReveal() {
    if (!ensure() || muted || suspended) return false;
    try {
      const t = now();
      const carrier = ctx.createOscillator();
      carrier.type = "sine";
      carrier.frequency.setValueAtTime(880, t);
      const mod = ctx.createOscillator();
      mod.type = "sine";
      mod.frequency.setValueAtTime(880 * 1.41, t);
      const modGain = ctx.createGain();
      modGain.gain.setValueAtTime(540, t);
      modGain.gain.exponentialRampToValueAtTime(1, t + 0.5);
      mod.connect(modGain).connect(carrier.frequency);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
      carrier.connect(env).connect(master);
      mod.start(t);
      carrier.start(t);
      mod.stop(t + 0.9);
      carrier.stop(t + 0.9);
      return true;
    } catch (error) {
      return false;
    }
  }

  function complete() {
    stopScrape();
    if (!ensure() || muted || suspended) return false;
    noiseBurst(2400, 1.2, 0.16, 0.55);
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => {
      const t = index * 0.105;
      try {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now() + t);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, now() + t);
        env.gain.exponentialRampToValueAtTime(0.14, now() + t + 0.008);
        env.gain.exponentialRampToValueAtTime(0.0001, now() + t + 0.42);
        osc.connect(env).connect(master);
        osc.start(now() + t);
        osc.stop(now() + t + 0.45);
      } catch (error) { /* ignore */ }
    });
    return true;
  }

  function pause() {
    suspended = true;
    stopScrape();
    if (ctx && ctx.state === "running") {
      try { ctx.suspend(); } catch (error) { /* ignore */ }
    }
    return suspended;
  }

  function resume() {
    suspended = false;
    if (ctx && ctx.state === "suspended" && !muted) {
      try { ctx.resume(); } catch (error) { /* ignore */ }
    }
    return suspended;
  }

  function dispose() {
    try { if (bed) bed.source.stop(); } catch (error) { /* ignore */ }
    bed = null;
    try { if (ctx) ctx.close(); } catch (error) { /* ignore */ }
    ctx = null;
    master = null;
  }

  return {
    unlock,
    setMuted,
    isMuted,
    startScrape,
    updateScrape,
    stopScrape,
    chip,
    bladeIn,
    coreReveal,
    complete,
    pause,
    resume,
    dispose,
    get context() { return ctx; },
    get bedNode() { return bed; },
  };
}
