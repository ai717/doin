// audio：零资源 WebAudio 合成音效（含绞盘循环嗡鸣与倒计时心跳）。
// AudioContext 必须由用户手势解锁 → 每个发声入口先 unlock()。
// 环境不支持或静音时整体静默，绝不把异常抛给游戏循环。

export function createAudio(options = {}) {
  let ctx = null;
  let muted = Boolean(options.muted);
  let reelNode = null;

  function unlock() {
    try {
      if (!ctx) {
        const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!Ctor) return null;
        ctx = new Ctor();
      }
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    } catch (error) {
      ctx = null;
      return null;
    }
  }

  function live() {
    return muted ? null : unlock();
  }

  // 单音：频率从 from 指数滑到 to，增益从 peak 指数衰减到 0.01。
  function voice({ type = "sine", from, to = from, start = 0, duration = 0.2, peak = 0.2 }) {
    const ac = live();
    if (!ac) return;
    try {
      const at = ac.currentTime + start;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(from, at);
      if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, at + duration);
      gain.gain.setValueAtTime(peak, at);
      gain.gain.exponentialRampToValueAtTime(0.01, at + duration);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(at);
      osc.stop(at + duration);
    } catch (error) {
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
      if (muted) this.stopReel();
      return muted;
    },

    unlock,

    // 放爪：锯齿波从 440 滑到 120
    shoot() {
      voice({ type: "sawtooth", from: 440, to: 120, duration: 0.18, peak: 0.15 });
    },

    // 抓到金块/钻石：D5 → A5 双音
    gold() {
      chord([587.33, 880], { duration: 0.25, peak: 0.2 });
    },

    // 抓到废石：方波低频闷响
    rock() {
      voice({ type: "square", from: 110, to: 45, duration: 0.15, peak: 0.2 });
    },

    // 爆炸：白噪声过低通，频率从 800 塌到 60
    explosion() {
      const ac = live();
      if (!ac) return;
      try {
        const now = ac.currentTime;
        const size = Math.floor(ac.sampleRate * 0.35);
        const buffer = ac.createBuffer(1, size, ac.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < size; i += 1) data[i] = Math.random() * 2 - 1;
        const noise = ac.createBufferSource();
        noise.buffer = buffer;
        const filter = ac.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(800, now);
        filter.frequency.exponentialRampToValueAtTime(60, now + 0.35);
        const gain = ac.createGain();
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ac.destination);
        noise.start();
      } catch (error) {
        // 忽略
      }
    },

    // 购买/开箱：C5 → G5
    buy() {
      voice({ type: "sine", from: 523.25, duration: 0.08, peak: 0.2 });
      voice({ type: "sine", from: 783.99, start: 0.08, duration: 0.14, peak: 0.2 });
    },

    // 过关：A4-C#5-E5-A5 上行琶音
    win() {
      chord([440, 554.37, 659.25, 880], { step: 0.09, duration: 0.3, peak: 0.18 });
    },

    // 最后 10 秒心跳
    heartbeat() {
      voice({ type: "sine", from: 80, to: 30, duration: 0.12, peak: 0.3 });
    },

    // 绞盘循环：低频锯齿嗡鸣，回收期间常驻
    startReel() {
      if (reelNode || muted) return;
      const ac = unlock();
      if (!ac) return;
      try {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(70, ac.currentTime);
        gain.gain.setValueAtTime(0.03, ac.currentTime);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start();
        reelNode = { osc, gain };
      } catch (error) {
        reelNode = null;
      }
    },

    stopReel() {
      if (!reelNode) return;
      try {
        reelNode.osc.stop();
        reelNode.osc.disconnect();
      } catch (error) {
        // 忽略
      }
      reelNode = null;
    },
  };
}
