// 零资源音效：全部用 WebAudio 实时合成，不加载任何音频文件。
// 浏览器要求音频上下文必须由用户手势解锁，所以每个发声入口都会尝试 resume。
// 环境不支持 AudioContext（或测试环境）时整体静默降级，绝不抛异常。

const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880];

export function createAudio(options = {}) {
  let context = null;
  let muted = Boolean(options.muted);
  let failed = false;

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

  function beep(spec) {
    if (muted) return;
    const ctx = ensure();
    if (!ctx) return;
    try {
      if (ctx.state === "suspended" && typeof ctx.resume === "function") ctx.resume();
      const start = ctx.currentTime + (spec.delay ?? 0);
      const duration = spec.duration ?? 0.12;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = spec.type ?? "sine";
      osc.frequency.setValueAtTime(spec.frequency, start);
      if (spec.slideTo) osc.frequency.exponentialRampToValueAtTime(spec.slideTo, start + duration);

      const peak = spec.gain ?? 0.12;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.02);
    } catch (error) {
      // 音频永远不该打断游戏
    }
  }

  return {
    isMuted: () => muted,
    setMuted(value) {
      muted = Boolean(value);
    },
    unlock() {
      const ctx = ensure();
      if (ctx && ctx.state === "suspended" && typeof ctx.resume === "function") ctx.resume();
    },
    // 落子：短促的木质轻敲，X 与 O 略微错开音高
    place(mark) {
      beep({ frequency: mark === 1 ? 560 : 470, type: "triangle", duration: 0.07, gain: 0.1 });
    },
    win() {
      PENTATONIC.slice(0, 4).forEach((frequency, index) => {
        beep({ frequency, type: "triangle", duration: 0.16, gain: 0.11, delay: index * 0.085 });
      });
    },
    lose() {
      beep({ frequency: 392, type: "sine", duration: 0.18, gain: 0.1 });
      beep({ frequency: 294, type: "sine", duration: 0.26, gain: 0.1, delay: 0.14 });
    },
    draw() {
      beep({ frequency: 440, type: "sine", duration: 0.14, gain: 0.09 });
      beep({ frequency: 440, type: "sine", duration: 0.18, gain: 0.09, delay: 0.16 });
    },
    undo() {
      beep({ frequency: 380, type: "sine", duration: 0.1, gain: 0.08, slideTo: 300 });
    },
    click() {
      beep({ frequency: 880, type: "sine", duration: 0.04, gain: 0.06 });
    },
  };
}
