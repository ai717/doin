// Nine Rings audio: physically modelled bronze / wood voices, all synthesized.
// No external samples. Every AudioParam is scheduled via methods, never assigned.

const MASTER_LEVEL = 0.85;

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
    if (ctx) return ctx;
    const Ctor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.setValueAtTime(muted ? 0 : MASTER_LEVEL, ctx.currentTime);
      master.connect(ctx.destination);
      const length = Math.floor(ctx.sampleRate * 1.2);
      noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      const rand = mulberry32(0x52494e47);
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

  function noiseBurst({ type = "bandpass", freq = 1200, q = 3, attack = 0.005, decay = 0.12, peak = 0.2, sweep = 0 }) {
    if (!ctx) return;
    const t = now();
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);
    filter.Q.setValueAtTime(q, t);
    if (sweep) filter.frequency.exponentialRampToValueAtTime(Math.max(80, freq + sweep), t + attack + decay);
    const g = envGain(attack, decay, peak, t);
    src.connect(filter);
    filter.connect(g);
    src.start(t);
    src.stop(t + attack + decay + 0.02);
  }

  function metalHit({ freq, ratio, index, decay, peak, detune = 0, delay = 0 }) {
    if (!ctx) return;
    const t = now() + delay;
    const carrier = ctx.createOscillator();
    carrier.type = "sine";
    carrier.frequency.setValueAtTime(freq, t);
    if (detune) carrier.detune.setValueAtTime(detune, t);
    const mod = ctx.createOscillator();
    mod.type = "sine";
    mod.frequency.setValueAtTime(freq * ratio, t);
    const modGain = ctx.createGain();
    modGain.gain.setValueAtTime(freq * index, t);
    modGain.gain.exponentialRampToValueAtTime(1, t + decay);
    const g = envGain(0.002, decay, peak, t);
    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(g);
    mod.start(t);
    carrier.start(t);
    mod.stop(t + decay + 0.03);
    carrier.stop(t + decay + 0.03);
  }

  function play(fn) {
    if (muted) return;
    try {
      if (!ensure()) return;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      fn();
    } catch (error) {
      // Audio must never break the game.
    }
  }

  return {
    unlock() {
      play(() => {});
    },
    isMuted() {
      return muted;
    },
    setMuted(value) {
      muted = Boolean(value);
      if (ctx && master) {
        try {
          master.gain.setTargetAtTime(muted ? 0 : MASTER_LEVEL, now(), 0.02);
          if (!muted && ctx.state === "suspended") ctx.resume().catch(() => {});
        } catch (error) {
          // ignore
        }
      }
      return muted;
    },
    // Ring climbs onto the handle: wood scrape then a bright FM seat "ding".
    linkUp(step = 0) {
      play(() => {
        noiseBurst({ type: "bandpass", freq: 900 + (step % 5) * 90, q: 4, attack: 0.008, decay: 0.1, peak: 0.14, sweep: 500 });
        metalHit({ freq: 880 + (step % 4) * 110, ratio: 2.41, index: 1.8, decay: 0.34, peak: 0.2 });
      });
    },
    // Ring drops off: two detuned metallic partials, crisp "clang".
    linkDown(step = 0) {
      play(() => {
        metalHit({ freq: 660 + (step % 4) * 70, ratio: 1.73, index: 2.4, decay: 0.3, peak: 0.17, detune: -7 });
        metalHit({ freq: 990 + (step % 4) * 70, ratio: 3.11, index: 1.1, decay: 0.22, peak: 0.09, detune: 9, delay: 0.006 });
      });
    },
    // Illegal ring: muffled wooden knock (low-passed noise + low thud).
    reject() {
      play(() => {
        noiseBurst({ type: "lowpass", freq: 240, q: 1, attack: 0.002, decay: 0.09, peak: 0.22, sweep: -120 });
        metalHit({ freq: 150, ratio: 1.2, index: 0.4, decay: 0.1, peak: 0.08 });
      });
    },
    // Undo / reset: high-passed paper rustle.
    paper() {
      play(() => {
        noiseBurst({ type: "highpass", freq: 2600, q: 0.8, attack: 0.02, decay: 0.22, peak: 0.12, sweep: 1400 });
      });
    },
    // Victory: stacked bell chord (inharmonic FM) + long wooden handle withdrawal.
    win(rings = 9) {
      play(() => {
        const base = 523.25;
        const chord = [1, 1.5, 2, 3, 4];
        chord.forEach((mult, i) => {
          metalHit({ freq: base * mult, ratio: 1.41 + i * 0.13, index: 1.6, decay: 1.6 - i * 0.16, peak: 0.13 / (i + 1), delay: i * 0.07 });
        });
        noiseBurst({ type: "bandpass", freq: 700, q: 2, attack: 0.06, decay: 1.1, peak: 0.1, sweep: 900 });
        metalHit({ freq: 261.63 + rings * 4, ratio: 2.7, index: 1.2, decay: 1.9, peak: 0.08, delay: 0.2 });
      });
    },
  };
}
