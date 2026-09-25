// audio：零资源 WebAudio 程序化合成音效。
// AudioContext 只能由用户手势解锁 → 每个发声入口先 unlock()。
// 环境不支持或静音时整体静默，绝不把异常抛进游戏循环。

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
    } catch (error) {
      ctx = null;
      return null;
    }
  }

  function live() {
    return muted ? null : unlock();
  }

  // 单音：频率从 from 指数滑到 to，增益从 peak 指数衰减到 0.01。
  function voice({ type = "sine", from, to = from, start = 0, duration = 0.2, peak = 0.18, detune = 0 }) {
    const ac = live();
    if (!ac) return;
    try {
      const at = ac.currentTime + start;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type;
      if (detune) osc.detune.setValueAtTime(detune, at);
      osc.frequency.setValueAtTime(from, at);
      if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + duration);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(peak, at + Math.min(0.02, duration * 0.2));
      gain.gain.exponentialRampToValueAtTime(0.01, at + duration);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(at);
      osc.stop(at + duration + 0.02);
    } catch (error) {
      // 发声失败不影响游戏
    }
  }

  function noise({ duration = 0.3, from = 700, to = 90, peak = 0.24, type = "lowpass" }) {
    const ac = live();
    if (!ac) return;
    try {
      const now = ac.currentTime;
      const size = Math.max(1, Math.floor(ac.sampleRate * duration));
      const buffer = ac.createBuffer(1, size, ac.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < size; i += 1) data[i] = Math.random() * 2 - 1;
      const source = ac.createBufferSource();
      source.buffer = buffer;
      const filter = ac.createBiquadFilter();
      filter.type = type;
      filter.frequency.setValueAtTime(from, now);
      filter.frequency.exponentialRampToValueAtTime(Math.max(20, to), now + duration);
      const gain = ac.createGain();
      gain.gain.setValueAtTime(peak, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(ac.destination);
      source.start(now);
    } catch (error) {
      // 忽略
    }
  }

  function chord(freqs, { type = "triangle", step = 0.07, duration = 0.26, peak = 0.16 } = {}) {
    freqs.forEach((freq, index) => voice({ type, from: freq, start: index * step, duration, peak }));
  }

  return {
    isMuted: () => muted,

    setMuted(value) {
      muted = Boolean(value);
      return muted;
    },

    unlock,

    // 吞食：短促上行“咕嘟”，连击越高音越高（最高 +9 半音）。
    eat(combo = 1) {
      const lift = Math.min(9, Math.max(0, combo - 1)) * 1.06;
      voice({ type: "triangle", from: 330 * Math.pow(2, lift / 12), to: 620 * Math.pow(2, lift / 12), duration: 0.09, peak: 0.16 });
    },

    // 体型升级：三度上扬 + 一圈水花
    grow() {
      chord([440, 554.37, 659.25], { step: 0.06, duration: 0.26, peak: 0.2 });
      noise({ duration: 0.24, from: 420, to: 1400, peak: 0.1, type: "highpass" });
    },

    frenzy(level = 1) {
      const base = level >= 2 ? 523.25 : 392;
      chord([base, base * 1.5, base * 2], { type: "sawtooth", step: 0.05, duration: 0.3, peak: 0.13 });
    },

    // 被吃：低频下坠 + 闷响
    bite() {
      voice({ type: "sawtooth", from: 260, to: 58, duration: 0.42, peak: 0.24 });
      noise({ duration: 0.32, from: 900, to: 70, peak: 0.26 });
    },

    // 咬中精英尾巴：清脆咬合
    snap() {
      voice({ type: "square", from: 780, to: 240, duration: 0.11, peak: 0.16 });
      voice({ type: "triangle", from: 1180, to: 620, start: 0.06, duration: 0.14, peak: 0.13 });
    },

    // 制服精英
    subdue() {
      chord([392, 493.88, 587.33, 784], { step: 0.08, duration: 0.34, peak: 0.18 });
    },

    power(kind = "pearl") {
      const map = { pearl: 880, lightning: 1320, frenzy: 660, shoal: 740, heart: 990 };
      const freq = map[kind] ?? 880;
      voice({ type: "sine", from: freq, to: freq * 1.6, duration: 0.16, peak: 0.17 });
      voice({ type: "sine", from: freq * 2, start: 0.09, duration: 0.16, peak: 0.11 });
    },

    hurt() {
      voice({ type: "square", from: 180, to: 60, duration: 0.22, peak: 0.22 });
    },

    zap() {
      voice({ type: "sawtooth", from: 1400, to: 240, duration: 0.16, peak: 0.14 });
    },

    boom() {
      noise({ duration: 0.42, from: 900, to: 55, peak: 0.3 });
    },

    net() {
      noise({ duration: 0.24, from: 2600, to: 900, peak: 0.12, type: "bandpass" });
    },

    tornado() {
      noise({ duration: 0.3, from: 300, to: 1200, peak: 0.1, type: "bandpass" });
    },

    hurry() {
      voice({ type: "square", from: 880, to: 880, duration: 0.1, peak: 0.14 });
      voice({ type: "square", from: 880, to: 880, start: 0.16, duration: 0.1, peak: 0.14 });
    },

    win() {
      chord([523.25, 659.25, 783.99, 1046.5], { step: 0.1, duration: 0.36, peak: 0.18 });
    },

    lose() {
      chord([392, 329.63, 261.63], { type: "sawtooth", step: 0.14, duration: 0.42, peak: 0.16 });
    },

    click() {
      voice({ type: "square", from: 1200, to: 700, duration: 0.05, peak: 0.11 });
    },

    dive() {
      voice({ type: "sine", from: 300, to: 90, duration: 0.6, peak: 0.14 });
      noise({ duration: 0.7, from: 500, to: 120, peak: 0.1 });
    },
  };
}
