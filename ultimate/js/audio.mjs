// 玄铁机台音色：噪声滤波模拟金属撞击、FM 合成钢印与编钟、破空声提示战场转移。
// 零外部音频文件；不支持 WebAudio 时整体静默降级，绝不打断对局。

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

  // 噪声 + 带通滤波：木头/金属/纸张的材质差异全靠中心频率与 Q 值。
  function burst(spec) {
    if (muted) return;
    const ctx = ensure();
    if (!ctx) return;
    try {
      resume(ctx);
      const start = ctx.currentTime + (spec.delay ?? 0);
      const source = ctx.createBufferSource();
      source.buffer = noise(ctx).buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = spec.filterType ?? "bandpass";
      filter.frequency.setValueAtTime(spec.frequency ?? 1800, start);
      if (spec.sweepTo) filter.frequency.exponentialRampToValueAtTime(spec.sweepTo, start + (spec.duration ?? 0.12));
      filter.Q.setValueAtTime(spec.q ?? 1.2, start);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(spec.gain ?? 0.18, start + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + (spec.duration ?? 0.12));
      source.connect(filter).connect(gain).connect(ctx.destination);
      source.start(start);
      source.stop(start + (spec.duration ?? 0.12) + 0.03);
    } catch (error) {
      // 音频失败不影响棋局
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

  // FM：载波 + 调制器，做钢印、木琴与编钟的金属泛音。
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
      modGain.gain.exponentialRampToValueAtTime(Math.max(1, (spec.frequency ?? 440) * 0.08), start + duration);
      const peak = spec.gain ?? 0.1;
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
      const ctx = ensure();
      resume(ctx);
    },
    // 落子：玉石轻叩 + 极短金属泛音，X 比 O 略高
    place(mark) {
      burst({ frequency: mark === 1 ? 2600 : 2100, q: 2.4, duration: 0.055, gain: 0.12 });
      fm({ frequency: mark === 1 ? 620 : 520, ratio: 2.7, index: 0.7, duration: 0.09, gain: 0.05 });
    },
    // 攻克大格：重锤压实 + 低频钢板共鸣
    capture() {
      burst({ frequency: 900, sweepTo: 180, filterType: "lowpass", q: 0.8, duration: 0.32, gain: 0.3 });
      tone({ frequency: 92, slideTo: 58, type: "sine", duration: 0.42, gain: 0.26, attack: 0.004 });
      fm({ frequency: 330, ratio: 1.41, index: 2.6, duration: 0.34, gain: 0.09, delay: 0.01 });
    },
    // 战场转移：气流掠过铁槽
    shift() {
      burst({ frequency: 700, sweepTo: 3200, q: 1.1, duration: 0.16, gain: 0.05 });
    },
    win() {
      [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
        fm({ frequency, ratio: 3.01, index: 1.1, duration: 0.5, gain: 0.09, delay: index * 0.11 });
      });
      tone({ frequency: 65, type: "sine", duration: 0.7, gain: 0.16 });
    },
    lose() {
      tone({ frequency: 220, slideTo: 110, type: "sawtooth", duration: 0.5, gain: 0.08 });
      tone({ frequency: 146.83, slideTo: 73.42, type: "sine", duration: 0.7, gain: 0.12, delay: 0.1 });
    },
    draw() {
      tone({ frequency: 392, type: "triangle", duration: 0.25, gain: 0.08 });
      tone({ frequency: 392, type: "triangle", duration: 0.3, gain: 0.08, delay: 0.2 });
    },
    undo() {
      burst({ frequency: 1400, sweepTo: 500, duration: 0.1, gain: 0.05 });
      tone({ frequency: 300, slideTo: 180, type: "triangle", duration: 0.12, gain: 0.05 });
    },
    click() {
      burst({ frequency: 3200, q: 2.6, duration: 0.035, gain: 0.06 });
    },
  };
}
