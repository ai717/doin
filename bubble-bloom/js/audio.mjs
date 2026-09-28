// filepath: games/bubble-bloom/js/audio.mjs

// Web Audio 程序化音效：零外部音频文件，不支持时静默降级。

const SCALE = [0, 392, 440, 494, 587, 659, 784, 880, 988, 1175, 1319];

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let broken = false;

  function ensure() {
    if (ctx || broken) return ctx;
    try {
      const Ctor = typeof window === "undefined" ? null : window.AudioContext || window.webkitAudioContext;
      if (!Ctor) {
        broken = true;
        return null;
      }
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.2;
      master.connect(ctx.destination);
    } catch (error) {
      broken = true;
      ctx = null;
    }
    return ctx;
  }

  function tone(options) {
    const c = ensure();
    if (!c || muted) return;
    const opts = options || {};
    const start = c.currentTime + (opts.delay || 0);
    const dur = opts.dur || 0.18;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = opts.type || "sine";
    osc.frequency.setValueAtTime(Math.max(40, opts.freq || 440), start);
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(Math.max(40, opts.to), start + dur);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, opts.gain || 0.4), start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain);
    gain.connect(master || c.destination);
    osc.start(start);
    osc.stop(start + dur + 0.03);
  }

  function noteFor(tier, chain) {
    const index = Math.min(Math.max(Math.round(tier), 1), SCALE.length - 1);
    const lift = Math.min(Math.max(chain, 1) - 1, 6) * 0.06;
    return SCALE[index] * (1 + lift);
  }

  function play(name, options) {
    if (muted) return;
    const opts = options || {};
    switch (name) {
      case "drop":
        tone({ freq: 330, to: 220, dur: 0.09, type: "sine", gain: 0.24 });
        break;
      case "merge": {
        const freq = noteFor(opts.tier || 2, opts.chain || 1);
        tone({ freq, dur: 0.22, type: "triangle", gain: 0.34 });
        tone({ freq: freq * 2, dur: 0.16, type: "sine", gain: 0.12, delay: 0.02 });
        break;
      }
      case "bloom":
        for (let i = 0; i < 7; i += 1) {
          tone({ freq: 523 * Math.pow(2, i / 7), dur: 0.34, type: "triangle", gain: 0.2, delay: i * 0.06 });
        }
        tone({ freq: 120, to: 60, dur: 0.6, type: "sine", gain: 0.3 });
        break;
      case "pulse":
        tone({ freq: 200, to: 90, dur: 0.36, type: "sawtooth", gain: 0.16 });
        break;
      case "over":
        tone({ freq: 392, dur: 0.22, type: "sine", gain: 0.3 });
        tone({ freq: 311, dur: 0.26, type: "sine", gain: 0.3, delay: 0.16 });
        tone({ freq: 233, dur: 0.42, type: "sine", gain: 0.3, delay: 0.34 });
        break;
      case "ui":
        tone({ freq: 660, dur: 0.06, type: "square", gain: 0.1 });
        break;
      default:
        break;
    }
  }

  return {
    unlock() {
      const c = ensure();
      if (c && c.state === "suspended" && c.resume) {
        try {
          c.resume();
        } catch (error) {
          /* 忽略解锁失败 */
        }
      }
    },
    play,
    setMuted(value) {
      muted = Boolean(value);
    },
    isMuted() {
      return muted;
    }
  };
}
