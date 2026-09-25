// audio.mjs — WebAudio 程序化合成音效（零外部音频文件）
// 手势解锁后才创建 AudioContext；静音或不支持时全部静默降级，绝不抛错。

export function createAudio() {
  let ctx = null;
  let master = null;
  let enabled = true;
  let ready = false;
  let chargeVoice = null;

  function ensure() {
    if (ready || ctx) return ctx;
    try {
      const Ctor = typeof window !== "undefined" ? window.AudioContext || window.webkitAudioContext : null;
      if (!Ctor) return null;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.32;
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
    for (let i = 0; i < frames; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq;
    filter.Q.value = q;
    const env = c.createGain();
    env.gain.value = gain;
    src.connect(filter);
    filter.connect(env);
    env.connect(master);
    src.start(t0);
  }

  /* ---- 蓄力：音高随蓄力比例爬升，成为玩家感知蓄力时长的听觉标尺 ---- */
  function startCharge() {
    const c = live();
    if (!c || !master || chargeVoice) return;
    const osc = c.createOscillator();
    const env = c.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(220, c.currentTime);
    env.gain.setValueAtTime(0.0001, c.currentTime);
    env.gain.exponentialRampToValueAtTime(0.16, c.currentTime + 0.05);
    osc.connect(env);
    env.connect(master);
    osc.start();
    chargeVoice = { osc, env };
  }

  function updateCharge(ratio) {
    if (!chargeVoice || !ctx) return;
    const r = Math.max(0, Math.min(1, ratio));
    try {
      chargeVoice.osc.frequency.setTargetAtTime(220 + r * 660, ctx.currentTime, 0.02);
    } catch {
      // 参数异常静默
    }
  }

  function stopCharge() {
    if (!chargeVoice || !ctx) return;
    const { osc, env } = chargeVoice;
    chargeVoice = null;
    try {
      env.gain.cancelScheduledValues(ctx.currentTime);
      env.gain.setValueAtTime(Math.max(0.0002, env.gain.value), ctx.currentTime);
      env.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.06);
      osc.stop(ctx.currentTime + 0.1);
    } catch {
      // 停止异常静默
    }
  }

  return {
    unlock() {
      const c = live();
      if (c && c.state === "suspended") c.resume().catch(() => {});
    },
    setEnabled(value) {
      enabled = !!value;
      if (!enabled) stopCharge();
    },
    isEnabled() {
      return enabled;
    },
    startCharge,
    updateCharge,
    stopCharge,
    jump() {
      tone({ freq: 320, to: 720, type: "triangle", dur: 0.16, gain: 0.4 });
      noise({ dur: 0.08, gain: 0.12, freq: 2200 });
    },
    land() {
      tone({ freq: 180, to: 110, type: "sine", dur: 0.14, gain: 0.42 });
      noise({ dur: 0.07, gain: 0.1, freq: 700, q: 0.8 });
    },
    wobble() {
      tone({ freq: 260, to: 190, type: "sine", dur: 0.2, gain: 0.3 });
      tone({ freq: 300, to: 230, type: "sine", dur: 0.26, gain: 0.2, delay: 0.09 });
    },
    perfect(combo = 1) {
      const base = 880 * Math.pow(1.0595, Math.min(12, (combo - 1) * 2));
      tone({ freq: base, type: "sine", dur: 0.22, gain: 0.5 });
      tone({ freq: base * 1.5, type: "sine", dur: 0.3, gain: 0.28, delay: 0.05 });
      tone({ freq: base * 2, type: "sine", dur: 0.34, gain: 0.16, delay: 0.1 });
      noise({ dur: 0.12, gain: 0.1, freq: 5200, q: 2 });
    },
    trampoline() {
      tone({ freq: 200, to: 900, type: "triangle", dur: 0.34, gain: 0.5 });
      tone({ freq: 400, to: 1800, type: "sine", dur: 0.3, gain: 0.22, delay: 0.04 });
    },
    vinyl() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        tone({ freq: f, type: "triangle", dur: 0.26, gain: 0.3, delay: i * 0.075 });
      });
    },
    fall() {
      tone({ freq: 420, to: 70, type: "sawtooth", dur: 0.7, gain: 0.34 });
      noise({ dur: 0.4, gain: 0.14, freq: 500, q: 0.6, delay: 0.1 });
    },
    win() {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
        tone({ freq: f, type: "triangle", dur: 0.4, gain: 0.34, delay: i * 0.09 });
      });
    },
    click() {
      tone({ freq: 520, to: 620, type: "square", dur: 0.05, gain: 0.16 });
    },
    deny() {
      tone({ freq: 200, to: 150, type: "square", dur: 0.12, gain: 0.16 });
    },
  };
}
