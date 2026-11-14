// 光圈科技实验室音色：虫洞吸入、合金箱摩擦、门体硬化闷响、核心锁定与过载和弦。
// 全部由 WebAudio 程序化合成，静音或浏览器不支持时静默降级。

const CLEAR_NOTES = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99, 1046.5];

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
    const length = Math.max(1, Math.floor(ctx.sampleRate * 0.7));
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
      const duration = spec.duration ?? 0.14;
      const source = ctx.createBufferSource();
      source.buffer = noise(ctx).buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = spec.filterType ?? "bandpass";
      filter.frequency.setValueAtTime(spec.frequency ?? 1200, start);
      if (spec.sweepTo) filter.frequency.exponentialRampToValueAtTime(spec.sweepTo, start + duration);
      filter.Q.setValueAtTime(spec.q ?? 1.2, start);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(spec.gain ?? 0.14, start + (spec.attack ?? 0.005));
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
      const peak = spec.gain ?? 0.08;
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
      modGain.gain.exponentialRampToValueAtTime(Math.max(1, (spec.frequency ?? 440) * 0.05), start + duration);
      const peak = spec.gain ?? 0.07;
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
    // 虫洞穿梭：真空吸力上升后骤降
    portal() {
      burst({ frequency: 260, sweepTo: 3200, q: 1.8, duration: 0.32, gain: 0.14 });
      tone({ frequency: 740, slideTo: 180, type: "triangle", duration: 0.34, gain: 0.06, delay: 0.05 });
      fm({ frequency: 880, ratio: 1.41, index: 1.6, duration: 0.22, gain: 0.03, delay: 0.12 });
    },
    // 推箱：合金摩擦 + 低频阻尼
    push() {
      burst({ frequency: 680, sweepTo: 240, q: 1.4, duration: 0.16, gain: 0.08 });
      tone({ frequency: 120, slideTo: 82, type: "triangle", duration: 0.18, gain: 0.05 });
    },
    // 撞墙 / 出口阻抗
    bump() {
      burst({ frequency: 180, filterType: "lowpass", q: 0.8, duration: 0.12, gain: 0.12 });
      tone({ frequency: 90, slideTo: 58, type: "sine", duration: 0.16, gain: 0.09 });
    },
    // 核心归位：清脆锁定
    core() {
      fm({ frequency: 1046.5, ratio: 3.01, index: 1.1, duration: 0.4, gain: 0.07 });
      fm({ frequency: 1568, ratio: 2.01, index: 0.8, duration: 0.35, gain: 0.04, delay: 0.05 });
      burst({ frequency: 4200, q: 3, duration: 0.05, gain: 0.04 });
    },
    undo() {
      tone({ frequency: 520, slideTo: 260, type: "triangle", duration: 0.16, gain: 0.06 });
      burst({ frequency: 2200, sweepTo: 900, q: 2, duration: 0.1, gain: 0.03 });
    },
    reset() {
      burst({ frequency: 1600, sweepTo: 300, q: 0.8, duration: 0.3, gain: 0.09 });
      tone({ frequency: 220, slideTo: 110, type: "sine", duration: 0.3, gain: 0.06 });
    },
    clear() {
      CLEAR_NOTES.forEach((frequency, index) => {
        tone({ frequency, type: "triangle", duration: 0.35, gain: 0.065, delay: index * 0.08 });
        tone({ frequency: frequency * 0.5, type: "sine", duration: 0.4, gain: 0.02, delay: index * 0.08 });
      });
      tone({ frequency: 65.41, type: "sine", duration: 2, gain: 0.09, attack: 0.12 });
      burst({ frequency: 2800, sweepTo: 600, q: 0.7, duration: 0.8, gain: 0.04, delay: 0.05 });
    },
    click() {
      burst({ frequency: 3200, q: 2.4, duration: 0.035, gain: 0.04 });
    },
  };
}
