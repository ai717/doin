// WebAudio 程序化合成音效（零外部音频文件）。
// 隐私模式或不支持时静默降级。

export function createAudio(options = {}) {
  const muted = options.muted ?? false;
  let ctx = null;
  let master = null;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = typeof window !== "undefined" && window.AudioContext
        ? window.AudioContext
        : (typeof globalThis !== "undefined" ? globalThis.AudioContext : null);
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.6;
      master.connect(ctx.destination);
      return ctx;
    } catch (e) {
      ctx = null;
      return null;
    }
  }

  function beep(freq, durationMs, opts = {}) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    try {
      const t0 = c.currentTime;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = opts.type ?? "sine";
      osc.frequency.setValueAtTime(freq, t0);
      if (opts.freqEnd != null) {
        osc.frequency.linearRampToValueAtTime(opts.freqEnd, t0 + durationMs / 1000);
      }
      const vol = opts.volume ?? 0.4;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(vol, t0 + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationMs / 1000);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t0);
      osc.stop(t0 + durationMs / 1000 + 0.02);
    } catch (e) {
      // 静默降级
    }
  }

  function chord(freqs, durationMs, opts = {}) {
    if (muted) return;
    for (const f of freqs) beep(f, durationMs, opts);
  }

  function sequence(freqs, gapMs, durationMs, opts = {}) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    freqs.forEach((f, i) => {
      try {
        const t0 = c.currentTime + (i * (gapMs + durationMs)) / 1000;
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = opts.type ?? "sine";
        osc.frequency.setValueAtTime(f, t0);
        const vol = opts.volume ?? 0.4;
        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(vol, t0 + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationMs / 1000);
        osc.connect(gain);
        gain.connect(master);
        osc.start(t0);
        osc.stop(t0 + durationMs / 1000 + 0.02);
      } catch (e) {
        // ignore
      }
    });
  }

  // 事件封装
  return {
    unlock() {
      const c = ensure();
      if (c && c.state === "suspended") {
        c.resume().catch(() => {});
      }
    },
    setMuted(v) {
      // 不能直接改 muted 闭包，所以重新创建
    },
    placeBlack() { beep(180, 30, { type: "triangle", volume: 0.5 }); },
    placeWhite() { beep(240, 25, { type: "triangle", volume: 0.45 }); },
    threatThree() { beep(880, 60, { type: "sine", volume: 0.3 }); },
    threatFour() { sequence([660, 990], 30, 80, { type: "sine", volume: 0.35 }); },
    threatOpenFour() { beep(1320, 100, { type: "sine", volume: 0.4 }); },
    winBlack() { sequence([261.6, 329.6, 392, 523.2, 659.2], 80, 80, { type: "sine", volume: 0.45 }); },
    winWhite() { sequence([523.2, 659.2, 783.9, 1046.5, 1318.5], 80, 80, { type: "sine", volume: 0.45 }); },
    forbidden() { beep(110, 200, { type: "sawtooth", volume: 0.35, freqEnd: 80 }); },
    aiThinking() {
      // 极轻底噪（不实现，避免持续占用）
    },
    puzzleSolved() {
      sequence([392, 523.2, 659.2], 50, 80, { type: "sine", volume: 0.4 });
      setTimeout(() => beep(1320, 100, { type: "sine", volume: 0.3 }), 320);
    },
    wrongMove() { sequence([550, 330], 0, 30, { type: "square", volume: 0.3 }); },
    starLight() { beep(1760, 80, { type: "sine", volume: 0.35 }); },
    click() { beep(440, 20, { type: "square", volume: 0.2 }); },
  };
}
