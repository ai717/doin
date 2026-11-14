// audio.mjs — WebAudio 程序化合成音效，零外部音频文件。
// 首次用户手势解锁；静音或不支持时静默降级。

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
      master.gain.value = 0.26;
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
    wallHit: () => tone({ freq: 520, type: "square", dur: 0.04, gain: 0.08 }),
    paddleHit: () => tone({ freq: 420, type: "sine", dur: 0.07, gain: 0.16 }),
    paddleCatch: () => {
      tone({ freq: 600, endFreq: 400, type: "sine", dur: 0.1, gain: 0.14 });
    },
    brickHit: (payload) => {
      const hp = Number(payload?.brickType) || 1;
      const freq = 300 + (4 - Math.min(4, hp)) * 120;
      tone({ freq, type: "square", dur: 0.05, gain: 0.1 });
    },
    brickBreak: (payload) => {
      const combo = Math.min(20, Number(payload?.combo) || 1);
      const freq = 400 + combo * 40;
      tone({ freq, endFreq: freq * 0.6, type: "square", dur: 0.1, gain: 0.16 });
      noise({ dur: 0.1, gain: 0.1, freq: 1800, q: 0.7 });
    },
    steelHit: () => tone({ freq: 220, type: "sawtooth", dur: 0.08, gain: 0.14 }),
    explosion: () => {
      tone({ freq: 120, endFreq: 40, type: "sawtooth", dur: 0.3, gain: 0.2 });
      noise({ dur: 0.25, gain: 0.18, freq: 400, q: 0.4 });
    },
    lightning: () => tone({ freq: 1400, endFreq: 800, type: "square", dur: 0.08, gain: 0.12 }),
    multiball: () => {
      [523, 659, 784].forEach((f, i) => tone({ freq: f, type: "triangle", dur: 0.1, gain: 0.14, delay: i * 0.05 }));
    },
    laser: () => tone({ freq: 1100, endFreq: 600, type: "sawtooth", dur: 0.06, gain: 0.08 }),
    bossHit: () => tone({ freq: 180, endFreq: 120, type: "sawtooth", dur: 0.1, gain: 0.16 }),
    bossDown: () => {
      tone({ freq: 80, endFreq: 30, type: "sawtooth", dur: 0.8, gain: 0.24 });
      noise({ dur: 0.6, gain: 0.2, freq: 300, q: 0.4 });
      [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, type: "triangle", dur: 0.2, gain: 0.16, delay: 0.4 + i * 0.1 }));
    },
    shieldSave: () => {
      tone({ freq: 700, endFreq: 1000, type: "sine", dur: 0.15, gain: 0.16 });
    },
    lifeLost: () => {
      [392, 330, 262].forEach((f, i) => tone({ freq: f, type: "square", dur: 0.22, gain: 0.18, delay: i * 0.12 }));
    },
    layerClear: () => {
      [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, type: "triangle", dur: 0.18, gain: 0.16, delay: i * 0.08 }));
    },
    relicPicked: () => {
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ freq: f, type: "sine", dur: 0.14, gain: 0.14, delay: i * 0.06 }));
    },
    gameWin: () => {
      [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone({ freq: f, type: "triangle", dur: 0.22, gain: 0.18, delay: i * 0.1 }));
    },
    gameOver: () => {
      [440, 349, 262, 196].forEach((f, i) => tone({ freq: f, type: "square", dur: 0.28, gain: 0.18, delay: i * 0.15 }));
    },
    ui: () => tone({ freq: 620, endFreq: 820, type: "square", dur: 0.05, gain: 0.1 }),
  };

  return {
    unlock,
    setMuted(value) {
      muted = Boolean(value);
      if (master) {
        try {
          master.gain.value = muted ? 0 : 0.26;
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
