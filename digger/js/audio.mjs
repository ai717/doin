// 博物馆发掘现场音色：泥沙噪声、气泵弹簧、气球升调、落石低频轰鸣与化石木琴。
// 全部由 WebAudio 程序化合成，静音或浏览器不支持时静默降级。

const PENTATONIC = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];

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
    const length = Math.max(1, Math.floor(ctx.sampleRate * 0.6));
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
      filter.frequency.setValueAtTime(spec.frequency ?? 1200, start);
      if (spec.sweepTo) filter.frequency.exponentialRampToValueAtTime(spec.sweepTo, start + duration);
      filter.Q.setValueAtTime(spec.q ?? 1.1, start);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(spec.gain ?? 0.14, start + (spec.attack ?? 0.005));
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      source.connect(filter).connect(gain).connect(ctx.destination);
      source.start(start);
      source.stop(start + duration + 0.04);
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
      modGain.gain.exponentialRampToValueAtTime(Math.max(1, (spec.frequency ?? 440) * 0.05), start + duration);
      const peak = spec.gain ?? 0.09;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + (spec.attack ?? 0.006));
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
    // 泥沙翻动：短促带通噪声
    dig() {
      burst({ frequency: 900, sweepTo: 2200, q: 0.8, duration: 0.09, gain: 0.055 });
    },
    // 气泵射击：弹簧伸展 + 气流
    pumpShoot() {
      burst({ frequency: 1800, sweepTo: 500, q: 1.6, duration: 0.16, gain: 0.08 });
      tone({ frequency: 300, slideTo: 150, type: "triangle", duration: 0.12, gain: 0.05 });
    },
    // 每次充气：升调气球啸叫
    pumpHit(inflation = 1) {
      const frequency = 260 + Math.max(0, inflation - 1) * 120;
      tone({ frequency, slideTo: frequency * 1.7, type: "sawtooth", duration: 0.18, gain: 0.06 });
      burst({ frequency: 2400, sweepTo: 1200, q: 2.2, duration: 0.08, gain: 0.03 });
    },
    burst() {
      burst({ frequency: 700, sweepTo: 120, filterType: "lowpass", q: 0.6, duration: 0.3, gain: 0.26 });
      tone({ frequency: 150, slideTo: 55, type: "sine", duration: 0.28, gain: 0.22, attack: 0.003 });
      fm({ frequency: 540, ratio: 1.41, index: 3.4, duration: 0.22, gain: 0.05 });
    },
    rockCreak() {
      burst({ frequency: 180, q: 4.5, duration: 0.9, gain: 0.05 });
      tone({ frequency: 90, slideTo: 62, type: "sawtooth", duration: 0.9, gain: 0.025 });
    },
    rockCrash() {
      burst({ frequency: 320, sweepTo: 60, filterType: "lowpass", q: 0.5, duration: 0.55, gain: 0.3 });
      tone({ frequency: 70, slideTo: 38, type: "sine", duration: 0.6, gain: 0.28, attack: 0.002 });
      burst({ frequency: 1600, sweepTo: 400, q: 0.7, duration: 0.35, gain: 0.08, delay: 0.02 });
    },
    crush() {
      burst({ frequency: 220, sweepTo: 70, filterType: "lowpass", q: 0.7, duration: 0.4, gain: 0.24 });
      fm({ frequency: 110, ratio: 3.01, index: 4, duration: 0.3, gain: 0.08 });
    },
    flame() {
      burst({ frequency: 300, sweepTo: 2600, q: 0.7, duration: 0.45, gain: 0.14 });
    },
    charge() {
      tone({ frequency: 180, slideTo: 640, type: "triangle", duration: 0.5, gain: 0.07 });
    },
    fossil() {
      const notes = [PENTATONIC[5], PENTATONIC[7], PENTATONIC[9]];
      notes.forEach((frequency, index) => {
        fm({ frequency, ratio: 4.01, index: 1.3, duration: 0.5, gain: 0.07, delay: index * 0.06 });
      });
    },
    ghost() {
      tone({ frequency: 520, slideTo: 220, type: "sine", duration: 0.5, gain: 0.05 });
      tone({ frequency: 780, slideTo: 330, type: "sine", duration: 0.45, gain: 0.025, delay: 0.04 });
    },
    death() {
      tone({ frequency: 330, slideTo: 110, type: "triangle", duration: 0.55, gain: 0.12 });
      burst({ frequency: 500, sweepTo: 120, q: 0.8, duration: 0.4, gain: 0.08 });
    },
    clear() {
      [PENTATONIC[0], PENTATONIC[2], PENTATONIC[4], PENTATONIC[5], PENTATONIC[7], PENTATONIC[9]].forEach((frequency, index) => {
        fm({ frequency, ratio: 2.01, index: 1.1, duration: 0.6, gain: 0.075, delay: index * 0.09 });
      });
      tone({ frequency: 65.41, type: "sine", duration: 2.4, gain: 0.1, attack: 0.15 });
    },
    lose() {
      tone({ frequency: 220, slideTo: 82, type: "triangle", duration: 0.8, gain: 0.1 });
      fm({ frequency: 110, ratio: 1.5, index: 2, duration: 0.9, gain: 0.05, delay: 0.1 });
    },
    click() {
      burst({ frequency: 2800, q: 2.2, duration: 0.035, gain: 0.05 });
    },
    pause() {
      tone({ frequency: 392, type: "sine", duration: 0.12, gain: 0.05 });
    },
  };
}
