// audio.mjs — WebAudio 程序化合成（零外部音频文件）。
// 手势解锁；静音或不支持时全部静默降级，绝不抛错。

export function createAudio() {
  let ctx = null;
  let master = null;
  let enabled = true;
  let ready = false;
  let engineVoice = null;

  function ensure() {
    if (ready || ctx) return ctx;
    try {
      const Ctor = typeof window !== "undefined" ? window.AudioContext || window.webkitAudioContext : null;
      if (!Ctor) return null;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.28;
      master.connect(ctx.destination);
      ready = true;
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function live() {
    if (!enabled) return null;
    const c = ensure();
    if (!c) return null;
    if (c.state === "suspended") c.resume().catch(() => {});
    return c;
  }

  function tone({ freq, to = null, type = "sine", dur = 0.18, gain = 0.5, delay = 0, attack = 0.006 }) {
    const c = live();
    if (!c || !master) return;
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const env = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to && to !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(env);
    env.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise({ dur = 0.14, gain = 0.25, delay = 0, freq = 1400, q = 1.2 }) {
    const c = live();
    if (!c || !master) return;
    const t0 = c.currentTime + delay;
    const frames = Math.max(1, Math.floor(c.sampleRate * dur));
    const buffer = c.createBuffer(1, frames, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq;
    filter.Q.value = q;
    const env = c.createGain();
    env.gain.setValueAtTime(gain, t0);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(env);
    env.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  function stopEngine() {
    if (!engineVoice || !ctx) return;
    const { osc, env } = engineVoice;
    engineVoice = null;
    try {
      env.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // 静默
    }
  }

  return {
    unlock() {
      const c = live();
      if (c && c.state === "suspended") c.resume().catch(() => {});
    },
    setEnabled(value) {
      enabled = !!value;
      if (!enabled) stopEngine();
    },
    isEnabled() {
      return enabled;
    },
    click() {
      tone({ freq: 420, to: 280, type: "triangle", dur: 0.07, gain: 0.22 });
    },
    countdown(n) {
      const f = n <= 0 ? 660 : 320;
      tone({ freq: f, type: "square", dur: n <= 0 ? 0.22 : 0.12, gain: 0.28 });
    },
    swing() {
      this.punch();
    },
    punch() {
      noise({ dur: 0.07, gain: 0.14, freq: 1200, q: 1.1 });
      tone({ freq: 240, to: 110, type: "square", dur: 0.08, gain: 0.18 });
    },
    kick() {
      noise({ dur: 0.11, gain: 0.22, freq: 520, q: 0.7 });
      tone({ freq: 140, to: 60, type: "sawtooth", dur: 0.14, gain: 0.22 });
      tone({ freq: 90, to: 40, type: "sine", dur: 0.16, gain: 0.16, delay: 0.04 });
    },
    clubSwing() {
      tone({ freq: 180, to: 90, type: "triangle", dur: 0.12, gain: 0.2 });
      noise({ dur: 0.1, gain: 0.18, freq: 700, q: 0.9 });
    },
    hit() {
      tone({ freq: 140, to: 70, type: "square", dur: 0.11, gain: 0.4 });
      noise({ dur: 0.09, gain: 0.28, freq: 420, q: 0.7 });
    },
    skid() {
      noise({ dur: 0.16, gain: 0.14, freq: 1800, q: 1.6 });
    },
    knockout() {
      tone({ freq: 90, to: 40, type: "sine", dur: 0.28, gain: 0.5 });
      noise({ dur: 0.2, gain: 0.32, freq: 280, q: 0.6 });
      tone({ freq: 520, to: 180, type: "triangle", dur: 0.18, gain: 0.22, delay: 0.04 });
    },
    steal() {
      tone({ freq: 740, to: 420, type: "triangle", dur: 0.16, gain: 0.3 });
      tone({ freq: 980, type: "sine", dur: 0.12, gain: 0.18, delay: 0.05 });
    },
    crash() {
      noise({ dur: 0.28, gain: 0.4, freq: 180, q: 0.5 });
      tone({ freq: 70, to: 32, type: "sine", dur: 0.32, gain: 0.45 });
    },
    remount() {
      tone({ freq: 240, to: 360, type: "triangle", dur: 0.14, gain: 0.22 });
    },
    nearMiss() {
      noise({ dur: 0.12, gain: 0.18, freq: 2100, q: 1.4 });
    },
    finish() {
      [392, 494, 587, 784].forEach((f, i) => {
        tone({ freq: f, type: "triangle", dur: 0.22, gain: 0.28, delay: i * 0.08 });
      });
    },
    fail() {
      tone({ freq: 220, to: 90, type: "sine", dur: 0.4, gain: 0.32 });
    },
    engine(speedRatio) {
      const c = live();
      if (!c || !master) return;
      const r = Math.max(0, Math.min(1, speedRatio || 0));
      if (r < 0.04) {
        stopEngine();
        return;
      }
      if (!engineVoice) {
        try {
          const osc = c.createOscillator();
          const env = c.createGain();
          osc.type = "sawtooth";
          osc.frequency.value = 50;
          env.gain.value = 0.0001;
          osc.connect(env);
          env.connect(master);
          osc.start();
          engineVoice = { osc, env };
        } catch {
          return;
        }
      }
      try {
        engineVoice.osc.frequency.setTargetAtTime(42 + r * 128, c.currentTime, 0.06);
        engineVoice.env.gain.setTargetAtTime(0.018 + r * 0.07, c.currentTime, 0.06);
      } catch {
        // 静默
      }
    },
    stopEngine,
  };
}
