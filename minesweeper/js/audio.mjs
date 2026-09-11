// 零资源音效：全部用 WebAudio 实时合成，不加载任何音频文件。
// 浏览器要求音频上下文必须由用户手势解锁，所以每个发声入口都会尝试 resume。
// 环境不支持 AudioContext（或测试环境）时整体静默降级，绝不抛异常。
//
// 扫雷专用音景：
//   reveal  翻开（音调随一次展开格数升高，连片清场更有"爽感"）
//   flag    插旗（清脆高 tick）
//   unflag  取消旗（略低 tick）
//   chord   速开（双音上行扫）
//   win     通关（五声音阶琶音）
//   lose    踩雷（下行衰减爆炸感）
//   peek    免费透视（上滑扫描 blip）

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
    reveal(count = 1) {
      // 一次展开越多，音高越高 —— 给 flood / chord 的"大片清场"正反馈
      const c = Math.max(1, Math.min(8, Math.trunc(count) || 1));
      beep({ frequency: 360 + c * 28, type: "triangle", duration: 0.06, gain: 0.08 });
    },
    flag() {
      beep({ frequency: 720, type: "square", duration: 0.05, gain: 0.07 });
    },
    unflag() {
      beep({ frequency: 520, type: "square", duration: 0.05, gain: 0.06 });
    },
    chord() {
      beep({ frequency: 660, type: "triangle", duration: 0.1, gain: 0.09 });
      beep({ frequency: 990, type: "triangle", duration: 0.12, gain: 0.09, delay: 0.05 });
    },
    win() {
      PENTATONIC.slice(0, 4).forEach((frequency, index) => {
        beep({ frequency, type: "triangle", duration: 0.16, gain: 0.11, delay: index * 0.085 });
      });
    },
    lose() {
      beep({ frequency: 300, type: "sawtooth", duration: 0.22, gain: 0.1, slideTo: 90 });
      beep({ frequency: 150, type: "sine", duration: 0.3, gain: 0.09, delay: 0.12 });
    },
    peek() {
      beep({ frequency: 880, type: "sine", duration: 0.08, gain: 0.07, slideTo: 1320 });
    },
    click() {
      beep({ frequency: 600, type: "sine", duration: 0.04, gain: 0.05 });
    },
  };
}
