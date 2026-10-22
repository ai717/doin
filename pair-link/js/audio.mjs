// 原生 Web Audio 程序化音效（零外部音频文件）。
// 首次手势解锁；静音静默降级；浏览器不支持 Web Audio 时不抛错。

const NOTE = {
  C5: 523.25,
  E5: 659.25,
  G5: 783.99,
  A5: 880,
  B5: 987.77,
  D6: 1174.66,
  E6: 1318.51
};

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let broken = false;

  function ensure() {
    if (broken) return null;
    if (ctx) return ctx;
    try {
      const Ctor =
        typeof window !== "undefined" ? window.AudioContext || window.webkitAudioContext : null;
      if (!Ctor) {
        broken = true;
        return null;
      }
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch {
      broken = true;
      ctx = null;
      return null;
    }
    return ctx;
  }

  function now() {
    return ctx ? ctx.currentTime : 0;
  }

  function tone({ freq = 440, type = "sine", dur = 0.12, gain = 0.08, slideTo = 0, delay = 0 }) {
    if (muted) return;
    const ac = ensure();
    if (!ac) return;
    try {
      const t0 = now() + delay;
      const osc = ac.createOscillator();
      const amp = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(20, freq), t0);
      if (slideTo > 0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
      amp.gain.setValueAtTime(0.0001, t0);
      amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.012);
      amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(amp);
      amp.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.03);
    } catch {
      // 忽略合成异常
    }
  }

  function noise({ dur = 0.3, gain = 0.06, from = 400, to = 2400, delay = 0 }) {
    if (muted) return;
    const ac = ensure();
    if (!ac) return;
    try {
      const t0 = now() + delay;
      const frames = Math.max(1, Math.floor(ac.sampleRate * dur));
      const buffer = ac.createBuffer(1, frames, ac.sampleRate);
      const data = buffer.getChannelData(0);
      let seed = 0x9e3779b9;
      for (let i = 0; i < frames; i += 1) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        data[i] = (seed / 2147483648 - 1) * 0.9;
      }
      const src = ac.createBufferSource();
      src.buffer = buffer;
      const filter = ac.createBiquadFilter();
      filter.type = "bandpass";
      filter.Q.value = 1.2;
      filter.frequency.setValueAtTime(Math.max(60, from), t0);
      filter.frequency.exponentialRampToValueAtTime(Math.max(60, to), t0 + dur);
      const amp = ac.createGain();
      amp.gain.setValueAtTime(0.0001, t0);
      amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.02);
      amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(filter);
      filter.connect(amp);
      amp.connect(master);
      src.start(t0);
      src.stop(t0 + dur + 0.03);
    } catch {
      // 忽略合成异常
    }
  }

  function unlock() {
    const ac = ensure();
    if (!ac) return;
    try {
      if (ac.state === "suspended") ac.resume();
    } catch {
      // 忽略
    }
  }

  function setMuted(value) {
    muted = value === true;
    if (!muted) unlock();
  }

  function isMuted() {
    return muted;
  }

  function play(name, params) {
    if (muted) return;
    const options = params || {};
    switch (name) {
      case "select":
        tone({ freq: 660, type: "sine", dur: 0.06, gain: 0.07 });
        break;
      case "deselect":
        tone({ freq: 440, type: "sine", dur: 0.05, gain: 0.05 });
        break;
      case "invalid":
        tone({ freq: 190, type: "triangle", dur: 0.14, gain: 0.09 });
        tone({ freq: 150, type: "triangle", dur: 0.12, gain: 0.06, delay: 0.05 });
        break;
      case "link": {
        const folds = Math.max(0, Math.min(2, Number(options.folds) || 0));
        const freq = [NOTE.C5, NOTE.E5, NOTE.G5][folds];
        tone({ freq, type: "triangle", dur: 0.09, gain: 0.07 });
        for (let i = 0; i < folds; i += 1) {
          tone({ freq: freq * 1.06, type: "sine", dur: 0.07, gain: 0.05, slideTo: freq * 1.22, delay: 0.09 * (i + 1) });
        }
        break;
      }
      case "clear":
        noise({ dur: 0.05, gain: 0.05, from: 900, to: 3200 });
        tone({ freq: NOTE.A5, type: "sine", dur: 0.22, gain: 0.07 });
        tone({ freq: NOTE.A5 * 2, type: "sine", dur: 0.16, gain: 0.03, delay: 0.02 });
        break;
      case "combo": {
        const combo = Math.max(1, Math.floor(Number(options.combo) || 1));
        const step = Math.min(6, combo);
        const freq = NOTE.A5 * Math.pow(2, step / 12);
        tone({ freq, type: "triangle", dur: 0.18, gain: 0.07 });
        tone({ freq: freq * 1.5, type: "sine", dur: 0.12, gain: 0.035, delay: 0.04 });
        break;
      }
      case "hint":
        tone({ freq: 1244.5, type: "sine", dur: 0.1, gain: 0.06 });
        tone({ freq: 1244.5, type: "sine", dur: 0.1, gain: 0.05, delay: 0.07 });
        break;
      case "shuffle":
        noise({ dur: 0.3, gain: 0.07, from: 400, to: 2400 });
        break;
      case "win":
        [NOTE.C5, NOTE.E5, NOTE.G5].forEach((freq, i) => {
          tone({ freq, type: "triangle", dur: 0.26, gain: 0.08, delay: i * 0.12 });
        });
        tone({ freq: NOTE.C5 * 2, type: "sine", dur: 0.4, gain: 0.05, delay: 0.36 });
        break;
      case "lose":
        tone({ freq: 392, type: "triangle", dur: 0.22, gain: 0.08 });
        tone({ freq: 261.63, type: "triangle", dur: 0.32, gain: 0.07, delay: 0.16 });
        break;
      case "record":
        [NOTE.E5, NOTE.G5, NOTE.C5 * 2, NOTE.E5 * 2].forEach((freq, i) => {
          tone({ freq, type: "sine", dur: 0.18, gain: 0.06, delay: i * 0.09 });
        });
        break;
      default:
        break;
    }
  }

  return { unlock, setMuted, isMuted, play };
}
