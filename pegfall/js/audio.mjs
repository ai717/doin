// 维多利亚机台音色：噪声滤波的加农炮与金属钉、FM 编钟音阶、铜管《欢乐颂》狂喜乐章。

const SCALE = [
  261.63, 293.66, 329.63, 392.0, 440.0,
  523.25, 587.33, 659.25, 783.99, 880.0,
  1046.5, 1174.66, 1318.51, 1567.98, 1760.0, 2093.0,
];

// 欢乐颂主旋律（E E F G | G F E D | C C D E | E D D）
const ODE = [
  329.63, 329.63, 349.23, 392.0,
  392.0, 349.23, 329.63, 293.66,
  261.63, 261.63, 293.66, 329.63,
  329.63, 293.66, 293.66,
];

export function createAudio(options = {}) {
  let context = null;
  let failed = false;
  let muted = Boolean(options.muted);
  let noiseCache = null;

  function ensure() {
    if (context || failed) return context;
    try {
      const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Ctor) {
        failed = true;
        return null;
      }
      context = new Ctor();
    } catch (error) {
      failed = true;
      context = null;
    }
    return context;
  }

  function resume(ctx) {
    if (ctx && ctx.state === "suspended" && typeof ctx.resume === "function") ctx.resume();
  }

  function noise(ctx) {
    if (noiseCache && noiseCache.sampleRate === ctx.sampleRate) return noiseCache;
    const length = Math.max(1, Math.floor(ctx.sampleRate * 0.5));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    noiseCache = { buffer, sampleRate: ctx.sampleRate };
    return noiseCache;
  }

  function burst(spec) {
    if (muted) return;
    const ctx = ensure();
    if (!ctx) return;
    try {
      resume(ctx);
      const start = ctx.currentTime + (spec.delay ?? 0);
      const duration = spec.duration ?? 0.12;
      const source = ctx.createBufferSource();
      source.buffer = noise(ctx).buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = spec.filterType ?? "bandpass";
      filter.frequency.setValueAtTime(spec.frequency ?? 1800, start);
      if (spec.sweepTo) filter.frequency.exponentialRampToValueAtTime(spec.sweepTo, start + duration);
      filter.Q.setValueAtTime(spec.q ?? 1.2, start);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(spec.gain ?? 0.16, start + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      source.connect(filter).connect(gain).connect(ctx.destination);
      source.start(start);
      source.stop(start + duration + 0.03);
    } catch (error) {
      // 静默
    }
  }

  function tone(spec) {
    if (muted) return;
    const ctx = ensure();
    if (!ctx) return;
    try {
      resume(ctx);
      const start = ctx.currentTime + (spec.delay ?? 0);
      const duration = spec.duration ?? 0.2;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = spec.type ?? "sine";
      osc.frequency.setValueAtTime(spec.frequency ?? 440, start);
      if (spec.slideTo) osc.frequency.exponentialRampToValueAtTime(spec.slideTo, start + duration);
      const peak = spec.gain ?? 0.1;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + (spec.attack ?? 0.008));
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.03);
    } catch (error) {
      // 静默
    }
  }

  function fm(spec) {
    if (muted) return;
    const ctx = ensure();
    if (!ctx) return;
    try {
      resume(ctx);
      const start = ctx.currentTime + (spec.delay ?? 0);
      const duration = spec.duration ?? 0.3;
      const carrier = ctx.createOscillator();
      const modulator = ctx.createOscillator();
      const modGain = ctx.createGain();
      const gain = ctx.createGain();
      carrier.type = spec.type ?? "sine";
      carrier.frequency.setValueAtTime(spec.frequency ?? 440, start);
      modulator.frequency.setValueAtTime((spec.frequency ?? 440) * (spec.ratio ?? 2.01), start);
      modGain.gain.setValueAtTime((spec.frequency ?? 440) * (spec.index ?? 2), start);
      modGain.gain.exponentialRampToValueAtTime(Math.max(1, (spec.frequency ?? 440) * 0.06), start + duration);
      const peak = spec.gain ?? 0.1;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + (spec.attack ?? 0.005));
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      modulator.connect(modGain).connect(carrier.frequency);
      carrier.connect(gain).connect(ctx.destination);
      modulator.start(start);
      carrier.start(start);
      modulator.stop(start + duration + 0.03);
      carrier.stop(start + duration + 0.03);
    } catch (error) {
      // 静默
    }
  }

  return {
    isMuted: () => muted,
    setMuted(value) {
      muted = Boolean(value);
    },
    unlock() {
      resume(ensure());
    },
    cannon() {
      burst({ frequency: 420, sweepTo: 90, filterType: "lowpass", q: 0.7, duration: 0.3, gain: 0.28 });
      tone({ frequency: 120, slideTo: 52, type: "sine", duration: 0.32, gain: 0.24, attack: 0.003 });
    },
    // 音阶弹跳：combo 从 1 开始，每命中一钉上行一品
    peg(combo, pegType) {
      const index = Math.max(0, Math.min(SCALE.length - 1, (combo ?? 1) - 1));
      const frequency = SCALE[index];
      fm({ frequency, ratio: 3.01, index: 1.6, duration: 0.26, gain: 0.075 });
      if (pegType === "orange") fm({ frequency: frequency * 1.5, ratio: 2.01, index: 1.2, duration: 0.2, gain: 0.04, delay: 0.01 });
      if ((combo ?? 0) >= 10 && (combo ?? 0) % 5 === 0) {
        fm({ frequency: frequency * 2, ratio: 2.5, index: 0.8, duration: 0.5, gain: 0.03, delay: 0.03 });
      }
    },
    green() {
      burst({ frequency: 600, sweepTo: 3800, q: 1.4, duration: 0.4, gain: 0.08 });
      [523.25, 783.99, 1046.5, 1567.98].forEach((frequency, i) => {
        fm({ frequency, ratio: 2.4, index: 1.1, duration: 0.5, gain: 0.05, delay: i * 0.05 });
      });
    },
    bucket() {
      [1046.5, 1318.51, 1567.98].forEach((frequency, i) => {
        fm({ frequency, ratio: 2.01, index: 0.9, duration: 0.35, gain: 0.08, delay: i * 0.07 });
      });
    },
    pocket(value) {
      const base = value >= 10000 ? 523.25 : value >= 5000 ? 392 : 329.63;
      tone({ frequency: base, type: "triangle", duration: 0.3, gain: 0.07 });
      tone({ frequency: base * 1.5, type: "sine", duration: 0.4, gain: 0.05, delay: 0.06 });
    },
    dissolve(index) {
      const frequency = 700 + ((index ?? 0) % 8) * 70;
      tone({ frequency, slideTo: frequency * 1.4, type: "triangle", duration: 0.12, gain: 0.035 });
    },
    fever() {
      ODE.forEach((frequency, i) => {
        const delay = i * 0.24;
        tone({ frequency, type: "triangle", duration: 0.26, gain: 0.09, delay });
        tone({ frequency: frequency * 0.5, type: "sawtooth", duration: 0.28, gain: 0.03, delay });
        tone({ frequency: frequency * 2, type: "sine", duration: 0.22, gain: 0.025, delay: delay + 0.01 });
      });
      tone({ frequency: 65.41, type: "sine", duration: 4.2, gain: 0.12, attack: 0.2 });
      burst({ frequency: 2400, sweepTo: 800, q: 0.8, duration: 1.2, gain: 0.04, delay: 0.1 });
    },
    clear() {
      [523.25, 659.25, 783.99, 1046.5].forEach((frequency, i) => {
        fm({ frequency, ratio: 2.01, index: 1.2, duration: 0.55, gain: 0.08, delay: i * 0.09 });
      });
    },
    lose() {
      tone({ frequency: 220, slideTo: 98, type: "triangle", duration: 0.7, gain: 0.1 });
      tone({ frequency: 146.83, slideTo: 73.42, type: "sine", duration: 0.9, gain: 0.08, delay: 0.08 });
    },
    click() {
      burst({ frequency: 3200, q: 2.4, duration: 0.03, gain: 0.05 });
    },
    pause() {
      tone({ frequency: 392, type: "sine", duration: 0.12, gain: 0.06 });
    },
  };
}
