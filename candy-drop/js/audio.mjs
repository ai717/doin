// audio.mjs: WebAudio 程序化合成音效（零外部音频文件），手势解锁，静音或不支持时静默降级

function noop() {}

export function createAudio({ muted = false } = {}) {
  let ctx = null;
  let master = null;
  let enabled = !muted;
  let unlocked = false;

  function ensure() {
    if (ctx) return ctx;
    const Ctor = typeof globalThis !== "undefined"
      ? globalThis.AudioContext || globalThis.webkitAudioContext
      : null;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.34;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
      master = null;
    }
    return ctx;
  }

  function unlock() {
    if (unlocked) return;
    const c = ensure();
    if (!c) return;
    unlocked = true;
    try {
      if (c.state === "suspended" && typeof c.resume === "function") c.resume();
    } catch {
      // 忽略
    }
  }

  function now() {
    return ctx ? ctx.currentTime : 0;
  }

  function tone({ freq = 440, to = null, dur = 0.18, type = "sine", gain = 0.3, delay = 0, attack = 0.008 }) {
    const c = ensure();
    if (!c || !enabled) return;
    try {
      const t0 = now() + delay;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (to && to !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g);
      g.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.03);
    } catch {
      // 合成失败静默
    }
  }

  function noise({ dur = 0.2, gain = 0.22, freq = 1200, q = 1.2, type = "bandpass", delay = 0 }) {
    const c = ensure();
    if (!c || !enabled) return;
    try {
      const t0 = now() + delay;
      const frames = Math.max(1, Math.floor(c.sampleRate * dur));
      const buf = c.createBuffer(1, frames, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < frames; i += 1) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
      }
      const src = c.createBufferSource();
      src.buffer = buf;
      const filter = c.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = freq;
      filter.Q.value = q;
      const g = c.createGain();
      g.gain.setValueAtTime(gain, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(filter);
      filter.connect(g);
      g.connect(master);
      src.start(t0);
      src.stop(t0 + dur + 0.02);
    } catch {
      // 静默
    }
  }

  const api = {
    unlock,
    isMuted: () => !enabled,
    setMuted(next) {
      enabled = !next;
      if (enabled) unlock();
    },
    /** 割断绳子：一记干脆的擦声 + 轻微下滑 */
    cut() {
      noise({ dur: 0.13, gain: 0.2, freq: 2600, q: 0.9 });
      tone({ freq: 780, to: 320, dur: 0.09, type: "triangle", gain: 0.14 });
    },
    /** 收星：清脆的两声铃 */
    star(index = 0) {
      const base = [880, 1108, 1318][Math.min(2, Math.max(0, index))];
      tone({ freq: base, dur: 0.16, type: "triangle", gain: 0.22 });
      tone({ freq: base * 1.5, dur: 0.12, type: "sine", gain: 0.12, delay: 0.05 });
    },
    /** 进入气泡：低沉的吸附声 */
    capture() {
      tone({ freq: 220, to: 440, dur: 0.22, type: "sine", gain: 0.2 });
    },
    /** 戳破气泡 */
    pop() {
      tone({ freq: 520, to: 1200, dur: 0.09, type: "sine", gain: 0.18 });
      noise({ dur: 0.08, gain: 0.16, freq: 1800, q: 0.8 });
    },
    /** 气垫吹风 */
    puff() {
      noise({ dur: 0.42, gain: 0.18, freq: 700, q: 0.6, type: "lowpass" });
    },
    /** 撞墙 */
    bump() {
      tone({ freq: 180, to: 120, dur: 0.08, type: "square", gain: 0.08 });
    },
    /** 进嘴：上行小琶音 */
    win() {
      [523, 659, 784, 1046].forEach((f, i) => {
        tone({ freq: f, dur: 0.24, type: "triangle", gain: 0.2, delay: i * 0.075 });
      });
    },
    /** 失败：下行两音 */
    lose() {
      tone({ freq: 392, dur: 0.18, type: "sine", gain: 0.18 });
      tone({ freq: 262, to: 196, dur: 0.34, type: "sine", gain: 0.18, delay: 0.14 });
    },
    /** 绳索绷紧（弹性绳拉长时的轻微吱声） */
    creak() {
      noise({ dur: 0.1, gain: 0.05, freq: 3200, q: 2.4 });
    },
  };

  if (!enabled) return api;
  return api;
}

export const silentAudio = {
  unlock: noop,
  isMuted: () => true,
  setMuted: noop,
  cut: noop,
  star: noop,
  capture: noop,
  pop: noop,
  puff: noop,
  bump: noop,
  win: noop,
  lose: noop,
  creak: noop,
};
