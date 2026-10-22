// audio：WebAudio 程序化合成音效（零外部音频文件）。
// 首次手势 unlock 恢复 AudioContext；静音 / 不支持时静默降级，绝不抛错。
// 果园主题：掉落闷响、合并啵声（随级数升高）、连锁上行、摘瓜丰收号角。

export function createAudio({ muted = false } = {}) {
  let ctx = null;
  let master = null;
  let mutedNow = !!muted;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC =
        typeof AudioContext !== "undefined"
          ? AudioContext
          : typeof webkitAudioContext !== "undefined"
            ? webkitAudioContext
            : null;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = mutedNow ? 0 : 0.85;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
      master = null;
    }
    return ctx;
  }

  function tone({ freq = 440, to = null, dur = 0.18, type = "sine", gain = 0.18, delay = 0 }) {
    const c = ensure();
    if (!c || mutedNow || !master) return;
    try {
      const t0 = c.currentTime + delay;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(1, freq), t0);
      if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g);
      g.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.03);
    } catch {
      // 合成失败：静默
    }
  }

  function noise({ dur = 0.2, gain = 0.16, delay = 0, sweep = 1200 }) {
    const c = ensure();
    if (!c || mutedNow || !master) return;
    try {
      const t0 = c.currentTime + delay;
      const frames = Math.max(1, Math.floor(c.sampleRate * dur));
      const buffer = c.createBuffer(1, frames, c.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < frames; i += 1) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
      }
      const src = c.createBufferSource();
      src.buffer = buffer;
      const filter = c.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(sweep, t0);
      filter.frequency.exponentialRampToValueAtTime(Math.max(80, sweep * 0.28), t0 + dur);
      filter.Q.value = 0.8;
      const g = c.createGain();
      g.gain.setValueAtTime(gain, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(filter);
      filter.connect(g);
      g.connect(master);
      src.start(t0);
      src.stop(t0 + dur + 0.03);
    } catch {
      // 静默
    }
  }

  return {
    unlock() {
      const c = ensure();
      if (c && c.state === "suspended") {
        try {
          c.resume();
        } catch {
          // 忽略
        }
      }
    },
    setMuted(value) {
      mutedNow = !!value;
      if (master) {
        try {
          master.gain.value = mutedNow ? 0 : 0.85;
        } catch {
          // 忽略
        }
      }
    },
    isMuted() {
      return mutedNow;
    },
    drop() {
      // 水果落地闷响
      noise({ dur: 0.14, gain: 0.12, sweep: 520 });
      tone({ freq: 300, to: 180, dur: 0.1, type: "sine", gain: 0.12 });
    },
    merge(level) {
      const lv = Math.max(1, Math.min(11, Number(level) || 1));
      const f = 300 + lv * 72;
      tone({ freq: f, to: f * 1.75, dur: 0.14, type: "triangle", gain: 0.17 });
      tone({ freq: f * 2, dur: 0.07, type: "sine", gain: 0.06, delay: 0.012 });
    },
    chain(n) {
      const k = Math.max(0, Math.min(8, Number(n) || 0));
      const f = 500 + k * 100;
      tone({ freq: f, to: f * 1.5, dur: 0.1, type: "sine", gain: 0.12 });
    },
    harvest() {
      // 丰收号角：三连上行 + 金色颤音
      tone({ freq: 523, to: 660, dur: 0.16, type: "triangle", gain: 0.16 });
      tone({ freq: 660, to: 784, dur: 0.16, type: "triangle", gain: 0.16, delay: 0.11 });
      tone({ freq: 784, to: 1046, dur: 0.24, type: "triangle", gain: 0.18, delay: 0.22 });
      tone({ freq: 1568, dur: 0.4, type: "sine", gain: 0.1, delay: 0.24 });
      noise({ dur: 0.3, gain: 0.1, sweep: 2400, delay: 0.1 });
    },
    warn() {
      tone({ freq: 155, to: 112, dur: 0.3, type: "sine", gain: 0.13 });
    },
    over() {
      tone({ freq: 430, to: 120, dur: 0.6, type: "triangle", gain: 0.16 });
      tone({ freq: 300, to: 88, dur: 0.72, type: "sine", gain: 0.11, delay: 0.09 });
    },
    click() {
      tone({ freq: 600, to: 740, dur: 0.06, type: "sine", gain: 0.09 });
    },
  };
}
