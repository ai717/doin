// audio：零资源 WebAudio 合成音效。
// AudioContext 由用户手势解锁。环境不支持或静音时静默降级。

export function createAudio(options = {}) {
  let ctx = null;
  let muted = Boolean(options.muted);

  function unlock() {
    try {
      if (!ctx) {
        const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!Ctor) return null;
        ctx = new Ctor();
      }
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    } catch {
      ctx = null;
      return null;
    }
  }

  function live() {
    return muted ? null : unlock();
  }

  function voice({ type = "sine", from, to = from, start = 0, duration = 0.2, peak = 0.2 }) {
    const ac = live();
    if (!ac) return;
    try {
      const at = ac.currentTime + start;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(from, at);
      if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(to, 0.01), at + duration);
      gain.gain.setValueAtTime(peak, at);
      gain.gain.exponentialRampToValueAtTime(0.01, at + duration);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(at);
      osc.stop(at + duration);
    } catch {
      // 发声失败不影响游戏
    }
  }

  function chord(freqs, { type = "triangle", step = 0.08, duration = 0.25, peak = 0.2 } = {}) {
    freqs.forEach((freq, index) => {
      voice({ type, from: freq, start: index * step, duration, peak });
    });
  }

  return {
    isMuted: () => muted,

    setMuted(value) {
      muted = Boolean(value);
      return muted;
    },

    unlock,

    // 画线：短促的轻嗒声
    draw() {
      voice({ type: "sine", from: 1200, duration: 0.05, peak: 0.08 });
    },

    // 播放：上升滑音
    play() {
      voice({ type: "sine", from: 440, to: 880, duration: 0.3, peak: 0.2 });
    },

    // 暂停
    pause() {
      voice({ type: "sine", from: 440, to: 220, duration: 0.2, peak: 0.15 });
    },

    // 撤销
    undo() {
      voice({ type: "sine", from: 800, to: 400, duration: 0.1, peak: 0.12 });
    },

    // 擦除
    erase() {
      voice({ type: "square", from: 300, to: 100, duration: 0.1, peak: 0.1 });
    },

    // 收集星标
    star() {
      chord([523.25, 659.25, 783.99], { step: 0.06, duration: 0.2, peak: 0.15 });
    },

    // 通关
    win() {
      chord([440, 554.37, 659.25, 880], { step: 0.09, duration: 0.3, peak: 0.18 });
    },

    // 摔落
    crash() {
      voice({ type: "sawtooth", from: 300, to: 50, duration: 0.35, peak: 0.2 });
    },

    // 碰撞轨道（回到轨道上）
    land() {
      voice({ type: "triangle", from: 300, to: 400, duration: 0.12, peak: 0.12 });
    },

    // 切换线型
    switchTool() {
      voice({ type: "sine", from: 600, duration: 0.06, peak: 0.1 });
    },
  };
}