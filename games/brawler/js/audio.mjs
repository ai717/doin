// 操场音色：噪声滤波的拳风与落地沙沙、失谐低音的重拳闷响、
// FM 合成的捡道具叮声与小鼓点 Boss 登场。绝不使用单音蜂鸣器。

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
      source.playbackRate.setValueAtTime(spec.rate ?? 1, start);
      const filter = ctx.createBiquadFilter();
      filter.type = spec.filterType ?? "bandpass";
      filter.frequency.setValueAtTime(spec.frequency ?? 1600, start);
      if (spec.sweepTo) filter.frequency.exponentialRampToValueAtTime(spec.sweepTo, start + duration);
      filter.Q.setValueAtTime(spec.q ?? 1.1, start);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(spec.gain ?? 0.14, start + 0.004);
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
      osc.type = spec.type ?? "sine";
      osc.frequency.setValueAtTime(spec.frequency ?? 440, start);
      if (spec.slideTo) osc.frequency.exponentialRampToValueAtTime(spec.slideTo, start + duration * (spec.slideAt ?? 1));
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(spec.gain ?? 0.1, start + (spec.attack ?? 0.008));
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.04);
    } catch (error) {
      // 静默
    }
  }

  function detuned(spec) {
    if (muted) return;
    const ctx = ensure();
    if (!ctx) return;
    try {
      resume(ctx);
      const start = ctx.currentTime + (spec.delay ?? 0);
      const duration = spec.duration ?? 0.26;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(spec.gain ?? 0.12, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      gain.connect(ctx.destination);
      [-0.06, 0, 0.07].forEach((detune, index) => {
        const osc = ctx.createOscillator();
        osc.type = spec.type ?? "sawtooth";
        const frequency = (spec.frequency ?? 120) * (1 + detune);
        osc.frequency.setValueAtTime(frequency, start);
        if (spec.slideTo) osc.frequency.exponentialRampToValueAtTime(spec.slideTo * (1 + detune), start + duration);
        osc.detune.setValueAtTime(index * 7 - 7, start);
        osc.connect(gain);
        osc.start(start);
        osc.stop(start + duration + 0.03);
      });
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
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(spec.gain ?? 0.09, start + 0.006);
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
    // 轻拳：短促“啪”，带通噪声 + 一点点身体闷点
    light() {
      burst({ frequency: 1500, sweepTo: 900, q: 1.4, duration: 0.07, gain: 0.16 });
      tone({ frequency: 210, slideTo: 120, type: "triangle", duration: 0.07, gain: 0.07 });
    },
    // 重拳：失谐低音下潜 + 厚噪声撞击
    heavy() {
      detuned({ frequency: 132, slideTo: 46, duration: 0.28, gain: 0.16, type: "sawtooth" });
      burst({ frequency: 700, sweepTo: 130, filterType: "lowpass", q: 0.8, duration: 0.2, gain: 0.22 });
      tone({ frequency: 86, slideTo: 38, type: "sine", duration: 0.26, gain: 0.16 });
    },
    // 击飞：噪声扫频的呼啸风声
    launch() {
      burst({ frequency: 420, sweepTo: 2600, q: 0.7, duration: 0.36, gain: 0.13, filterType: "bandpass" });
      tone({ frequency: 320, slideTo: 880, type: "triangle", duration: 0.3, gain: 0.045 });
    },
    // 落地：沙坑里的沙沙闷响
    land() {
      burst({ frequency: 520, sweepTo: 160, filterType: "lowpass", q: 0.6, duration: 0.22, gain: 0.15 });
    },
    // 捡道具：FM 清脆“叮”
    pickup() {
      fm({ frequency: 1046.5, ratio: 2.01, index: 1.3, duration: 0.22, gain: 0.08 });
      fm({ frequency: 1567.98, ratio: 1.5, index: 0.8, duration: 0.26, gain: 0.04, delay: 0.05 });
    },
    // 回血：温润上行三音
    heal() {
      [523.25, 659.25, 783.99].forEach((frequency, index) => {
        fm({ frequency, ratio: 2.4, index: 0.9, duration: 0.32, gain: 0.065, delay: index * 0.06 });
      });
    },
    // 必杀：失谐爆发 + 低频冲击
    special() {
      detuned({ frequency: 220, slideTo: 60, duration: 0.5, gain: 0.15, type: "square" });
      burst({ frequency: 2600, sweepTo: 300, q: 0.8, duration: 0.45, gain: 0.2 });
      tone({ frequency: 70, slideTo: 34, type: "sine", duration: 0.5, gain: 0.2 });
    },
    // Boss 登场：三连小鼓点
    boss() {
      [0, 0.16, 0.34].forEach((delay, index) => {
        burst({ frequency: 260 - index * 40, filterType: "lowpass", q: 0.7, duration: 0.16, gain: 0.2, delay });
        tone({ frequency: 120 - index * 16, slideTo: 62, type: "sine", duration: 0.18, gain: 0.18, delay });
      });
      tone({ frequency: 392, type: "triangle", duration: 0.6, gain: 0.05, delay: 0.5 });
    },
    // 击飞计数 / 彩蛋：FM 铃音随连击上行
    ko(count = 1) {
      const base = 659.25 * Math.pow(2, Math.min(8, Math.max(0, count - 1)) / 12);
      fm({ frequency: base, ratio: 2.5, index: 1.1, duration: 0.3, gain: 0.08 });
      fm({ frequency: base * 1.5, ratio: 1.6, index: 0.7, duration: 0.34, gain: 0.04, delay: 0.04 });
    },
    star() {
      [659.25, 783.99, 1046.5, 1318.51].forEach((frequency, index) => {
        fm({ frequency, ratio: 2.01, index: 1.4, duration: 0.5, gain: 0.07, delay: index * 0.08 });
      });
    },
    clear() {
      [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
        fm({ frequency, ratio: 2.01, index: 1.2, duration: 0.55, gain: 0.08, delay: index * 0.09 });
      });
    },
    lose() {
      tone({ frequency: 220, slideTo: 92, type: "triangle", duration: 0.7, gain: 0.1 });
      tone({ frequency: 146.83, slideTo: 73.42, type: "sine", duration: 0.9, gain: 0.08, delay: 0.08 });
    },
    click() {
      burst({ frequency: 2800, q: 2.2, duration: 0.03, gain: 0.05 });
    },
    pause() {
      tone({ frequency: 392, type: "sine", duration: 0.12, gain: 0.06 });
      tone({ frequency: 261.63, type: "sine", duration: 0.16, gain: 0.05, delay: 0.06 });
    },
  };
}
