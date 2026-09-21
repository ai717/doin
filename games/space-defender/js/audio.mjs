// audio.mjs — WebAudio 程序化合成音效，零外部音频文件。
// 首次用户手势解锁；静音或不支持时静默降级，绝不抛错给游戏层。

const NOISE_SECONDS = 0.4;

export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let muted = false;
  let unlocked = false;
  let supported = true;

  function ensure() {
    if (ctx || !supported) return ctx;
    try {
      const Ctor = typeof window !== "undefined" ? window.AudioContext || window.webkitAudioContext : null;
      if (!Ctor) {
        supported = false;
        return null;
      }
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.28;
      master.connect(ctx.destination);
      const length = Math.floor(ctx.sampleRate * NOISE_SECONDS);
      noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    } catch {
      supported = false;
      ctx = null;
    }
    return ctx;
  }

  function unlock() {
    unlocked = true;
    const c = ensure();
    if (!c) return;
    try {
      if (c.state === "suspended") c.resume();
    } catch {
      // 忽略
    }
  }

  function tone({ freq = 440, endFreq, type = "square", dur = 0.12, gain = 0.3, delay = 0 }) {
    const c = ensure();
    if (!c || muted || !unlocked) return;
    try {
      const t0 = c.currentTime + delay;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (Number.isFinite(endFreq)) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g).connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch {
      // 单个音效失败不影响游戏
    }
  }

  function noise({ dur = 0.16, gain = 0.24, freq = 1200, q = 1, delay = 0 }) {
    const c = ensure();
    if (!c || muted || !unlocked) return;
    try {
      const t0 = c.currentTime + delay;
      const src = c.createBufferSource();
      src.buffer = noiseBuffer;
      const filter = c.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = freq;
      filter.Q.value = q;
      const g = c.createGain();
      g.gain.setValueAtTime(gain, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(filter).connect(g).connect(master);
      src.start(t0);
      src.stop(t0 + dur + 0.02);
    } catch {
      // 忽略
    }
  }

  const SOUNDS = {
    shot: () => tone({ freq: 880, endFreq: 1500, type: "square", dur: 0.07, gain: 0.14 }),
    drone: () => tone({ freq: 1320, endFreq: 1800, type: "triangle", dur: 0.06, gain: 0.08 }),
    chip: () => tone({ freq: 420, endFreq: 300, type: "square", dur: 0.05, gain: 0.1 }),
    kill: (payload) => {
      const combo = Math.min(8, Number(payload?.combo) || 1);
      const freq = 300 + combo * 55;
      tone({ freq, endFreq: freq * 0.6, type: "square", dur: 0.11, gain: 0.18 });
      noise({ dur: 0.14, gain: 0.16, freq: 1500, q: 0.8 });
    },
    graze: () => tone({ freq: 2100, endFreq: 2600, type: "sine", dur: 0.05, gain: 0.09 }),
    hit: () => {
      tone({ freq: 180, endFreq: 90, type: "sawtooth", dur: 0.22, gain: 0.22 });
      noise({ dur: 0.2, gain: 0.2, freq: 500, q: 0.6 });
    },
    overload: () => {
      tone({ freq: 120, endFreq: 620, type: "sawtooth", dur: 0.35, gain: 0.2 });
      tone({ freq: 660, type: "triangle", dur: 0.3, gain: 0.12, delay: 0.08 });
    },
    overloadEnd: () => tone({ freq: 620, endFreq: 140, type: "triangle", dur: 0.28, gain: 0.14 }),
    capture: () => tone({ freq: 90, endFreq: 160, type: "sawtooth", dur: 1.1, gain: 0.16 }),
    rescue: () => {
      [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, type: "triangle", dur: 0.16, gain: 0.16, delay: i * 0.07 }));
    },
    pickup: () => {
      tone({ freq: 700, endFreq: 1100, type: "sine", dur: 0.1, gain: 0.14 });
      tone({ freq: 1100, type: "sine", dur: 0.08, gain: 0.1, delay: 0.08 });
    },
    breach: () => tone({ freq: 150, endFreq: 110, type: "square", dur: 0.3, gain: 0.16 }),
    lifeLost: () => {
      [392, 330, 262].forEach((f, i) => tone({ freq: f, type: "square", dur: 0.2, gain: 0.18, delay: i * 0.11 }));
    },
    bossDown: () => {
      tone({ freq: 70, endFreq: 40, type: "sawtooth", dur: 0.9, gain: 0.26 });
      noise({ dur: 0.7, gain: 0.24, freq: 300, q: 0.4 });
      [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, type: "triangle", dur: 0.2, gain: 0.15, delay: 0.5 + i * 0.09 }));
    },
    waveClear: () => {
      [523, 659, 784].forEach((f, i) => tone({ freq: f, type: "triangle", dur: 0.16, gain: 0.16, delay: i * 0.08 }));
    },
    campaignWin: () => {
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ freq: f, type: "triangle", dur: 0.22, gain: 0.17, delay: i * 0.11 }));
    },
    gameOver: () => {
      [440, 349, 262, 196].forEach((f, i) => tone({ freq: f, type: "square", dur: 0.26, gain: 0.18, delay: i * 0.14 }));
    },
    ui: () => tone({ freq: 620, endFreq: 820, type: "square", dur: 0.05, gain: 0.1 }),
  };

  return {
    unlock,
    setMuted(value) {
      muted = Boolean(value);
      if (master) {
        try {
          master.gain.value = muted ? 0 : 0.28;
        } catch {
          // 忽略
        }
      }
    },
    isMuted() {
      return muted;
    },
    play(name, payload) {
      const fn = SOUNDS[name];
      if (!fn || muted) return;
      fn(payload);
    },
  };
}
