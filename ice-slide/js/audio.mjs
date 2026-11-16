// filepath: games/ice-slide/js/audio.mjs
// 音效：纯 Web Audio 程序化合成，零外部音频文件。PRD §4.4 六音色规划——
//   1 冰面滑行唰：噪声缓冲 + 带通扫频（滑行越远音越高越长）
//   2 撞墙停咚：低频木响 + 高频冰晶瞬态 + 碎冰茬（双段/三段）
//   3 推箱咕噜：噪声低通扫频 + 低频正弦垫音
//   4 灯标叮铃：FM 编钟（调制器接载波频率，衰减调制指数）
//   5 通关：FM 编钟大七和弦上行琶音 + 噪声低通风声收束
//   6 极地氛围：噪声 LFO 低通风声（间歇冰晶微响）
// 工厂模式 createAudio({ muted, Context }) 便于测试注入替身；静音/不支持时全部静默降级。
// 严禁单振荡器 beep；音色与 sokoban（木料货场）完全不同。

const MIN_FREQ = 20;

function defaultContext() {
  if (typeof window === "undefined") return null;
  return window.AudioContext || window.webkitAudioContext || null;
}

/** 2 秒单声道白噪声缓冲（滑行/推箱/撞墙/氛围共用） */
function makeNoise(ctx) {
  const len = Math.floor(ctx.sampleRate * 2);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export function createAudio(options = {}) {
  const ContextCtor = options.Context || defaultContext;
  let ctx = null;
  let master = null;
  let noise = null;
  let muted = options.muted === true;
  let unlocked = false;
  let failed = false;
  let ambientOn = false;
  let ambientNodes = null;
  let tickTimer = 0;

  function ready() {
    return !muted && unlocked && ctx && master;
  }

  /** 在第一次真实用户手势里调用；重复调用无副作用 */
  function unlock() {
    if (failed || unlocked) return !!ctx;
    let Ctor = null;
    try {
      Ctor = ContextCtor();
      if (!Ctor) {
        failed = true;
        return false;
      }
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
      noise = makeNoise(ctx);
      unlocked = true;
    } catch {
      ctx = null;
      master = null;
      failed = true;
      return false;
    }
    try {
      if (ctx.state === "suspended") ctx.resume();
    } catch {
      /* 某些浏览器需要更晚的时机恢复，忽略 */
    }
    return true;
  }

  function setMuted(value) {
    const next = value === true;
    if (next === muted) return;
    muted = next;
    if (muted) ambient(false);
  }

  function isMuted() {
    return muted;
  }

  // ---------- 基础合成件 ----------

  /** 包络：快速起音 + 指数衰减，返回 gain 节点（已接 master） */
  function envGain(t0, peak, dur, attack = 0.012) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    g.connect(master);
    return g;
  }

  /** 振荡器音：freq -> to 的指数扫频 */
  function tone({ type = "sine", freq, to, dur, peak = 0.2, at = 0 }) {
    if (!ready()) return;
    try {
      const t0 = ctx.currentTime + at;
      const osc = ctx.createOscillator();
      const g = envGain(t0, peak, dur);
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(MIN_FREQ, freq), t0);
      osc.frequency.exponentialRampToValueAtTime(Math.max(MIN_FREQ, to), t0 + dur);
      osc.connect(g);
      osc.start(t0);
      osc.stop(t0 + dur + 0.03);
    } catch {
      /* 合成失败静默降级 */
    }
  }

  /** 噪声片段：经滤波器（调用方传入 filter 工厂）后发声 */
  function noiseHit({ dur, peak = 0.2, filter, at = 0, sweepTo }) {
    if (!ready()) return;
    try {
      const t0 = ctx.currentTime + at;
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      const g = envGain(t0, peak, dur);
      const f = filter(ctx, t0);
      src.connect(f);
      f.connect(g);
      if (sweepTo !== undefined && f.frequency && f.frequency.exponentialRampToValueAtTime) {
        f.frequency.exponentialRampToValueAtTime(Math.max(MIN_FREQ, sweepTo), t0 + dur);
      }
      src.start(t0);
      src.stop(t0 + dur + 0.03);
    } catch {
      /* 合成失败静默降级 */
    }
  }

  function bandpass(ctx, t0) {
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.setValueAtTime(900, t0);
    f.Q.value = 1.1;
    return f;
  }

  function lowpass(ctx, t0) {
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(320, t0);
    f.Q.value = 0.8;
    return f;
  }

  function highpass(ctx, t0) {
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.setValueAtTime(4200, t0);
    f.Q.value = 0.7;
    return f;
  }

  /** FM 编钟：载波 + 倍频调制器（指数衰减的调制深度 -> 金属铃芯） */
  function bell({ freq, dur = 0.5, peak = 0.22, at = 0 }) {
    if (!ready()) return;
    try {
      const t0 = ctx.currentTime + at;
      const carrier = ctx.createOscillator();
      const mod = ctx.createOscillator();
      const modDepth = ctx.createGain();
      const g = envGain(t0, peak, dur, 0.006);
      carrier.type = "sine";
      carrier.frequency.setValueAtTime(freq, t0);
      mod.type = "sine";
      mod.frequency.setValueAtTime(freq * 2, t0);
      modDepth.gain.setValueAtTime(freq * 1.6, t0);
      modDepth.gain.exponentialRampToValueAtTime(1, t0 + dur * 0.8);
      mod.connect(modDepth);
      modDepth.connect(carrier.frequency);
      carrier.connect(g);
      mod.start(t0);
      carrier.start(t0);
      mod.stop(t0 + dur + 0.03);
      carrier.stop(t0 + dur + 0.03);
    } catch {
      /* 合成失败静默降级 */
    }
  }

  // ---------- 事件音效 ----------

  /** 冰面滑行"唰——"：距离越远，起音越高、持续越久 */
  function slide(dist = 2) {
    const d = Math.max(1, Math.min(12, dist));
    const dur = Math.min(0.52, 0.16 + d * 0.028);
    const startFreq = 620 + d * 46;
    noiseHit({
      dur,
      peak: 0.1 + Math.min(0.06, d * 0.006),
      filter: (c, t0) => {
        const f = bandpass(c, t0);
        f.frequency.setValueAtTime(startFreq, t0);
        return f;
      },
      sweepTo: Math.min(3400, startFreq * 3),
    });
    // 冰屑高频点缀
    noiseHit({ dur: 0.05, peak: 0.05, filter: highpass, at: dur * 0.7 });
  }

  /** 撞墙"咚" + 冰晶脆响 + 碎冰茬 */
  function hitWall() {
    tone({ type: "triangle", freq: 132, to: 52, dur: 0.15, peak: 0.42 });
    noiseHit({ dur: 0.08, peak: 0.2, filter: highpass });
    for (let i = 0; i < 3; i++) {
      noiseHit({ dur: 0.035, peak: 0.09, filter: highpass, at: 0.05 + i * 0.055 });
    }
  }

  /** 推箱"咕噜"：低频噪声扫频 + 垫音 */
  function push() {
    noiseHit({
      dur: 0.34,
      peak: 0.24,
      filter: (c, t0) => {
        const f = lowpass(c, t0);
        f.frequency.setValueAtTime(260, t0);
        return f;
      },
      sweepTo: 620,
    });
    tone({ type: "sine", freq: 96, to: 74, dur: 0.3, peak: 0.16 });
  }

  /** 箱入灯标"叮铃"：双音 FM 编钟 */
  function goal() {
    bell({ freq: 1046.5, dur: 0.42, peak: 0.24 });
    bell({ freq: 1568, dur: 0.5, peak: 0.18, at: 0.09 });
  }

  /** 通关：大七和弦上行琶音 + 风声收束 */
  function win() {
    const chord = [523.25, 659.25, 783.99, 987.77]; // C E G B 大七
    chord.forEach((freq, i) => bell({ freq, dur: 0.55, peak: 0.2, at: i * 0.11 }));
    noiseHit({
      dur: 1.3,
      peak: 0.05,
      filter: (c, t0) => {
        const f = lowpass(c, t0);
        f.frequency.setValueAtTime(420, t0);
        return f;
      },
      sweepTo: 180,
      at: 0.34,
    });
  }

  /** UI 点击 */
  function click() {
    tone({ type: "triangle", freq: 640, to: 620, dur: 0.05, peak: 0.1 });
  }

  /** 撤销：下行短音 */
  function undo() {
    tone({ type: "sine", freq: 420, to: 250, dur: 0.12, peak: 0.12 });
  }

  /** 极地氛围：LFO 低通风声 + 间歇冰晶微响 */
  function ambient(on) {
    if (on === false) {
      if (tickTimer) {
        clearInterval(tickTimer);
        tickTimer = 0;
      }
      if (ambientNodes) {
        try {
          ambientNodes.src.stop();
          ambientNodes.lfo.stop();
        } catch {
          /* 忽略 */
        }
        ambientNodes = null;
      }
      ambientOn = false;
      return;
    }
    if (ambientOn || !ready()) return;
    try {
      const t0 = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.setValueAtTime(300, t0);
      f.Q.value = 0.6;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.038, t0 + 1.2);
      // 风声起伏：LFO 驱动截止频率
      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.setValueAtTime(0.07, t0);
      const lfoDepth = ctx.createGain();
      lfoDepth.gain.setValueAtTime(130, t0);
      lfo.connect(lfoDepth);
      lfoDepth.connect(f.frequency);
      src.connect(f);
      f.connect(g);
      g.connect(master);
      src.start(t0);
      lfo.start(t0);
      ambientNodes = { src, lfo };
      ambientOn = true;
      // 间歇冰晶微响
      tickTimer = setInterval(() => {
        if (!ready() || !ambientOn) return;
        try {
          noiseHit({ dur: 0.04, peak: 0.018, filter: highpass });
        } catch {
          /* 忽略 */
        }
      }, 3800);
    } catch {
      ambientNodes = null;
      ambientOn = false;
    }
  }

  function isAmbientOn() {
    return ambientOn;
  }

  function dispose() {
    ambient(false);
    if (ctx) {
      try {
        ctx.close();
      } catch {
        /* 忽略 */
      }
      ctx = null;
      master = null;
      noise = null;
      unlocked = false;
    }
  }

  return {
    unlock,
    setMuted,
    isMuted,
    /** 按名派发（main 统一入口）；slide 可传距离 */
    play(name, arg) {
      switch (name) {
        case "slide": slide(arg); break;
        case "hitWall": hitWall(); break;
        case "push": push(); break;
        case "goal": goal(); break;
        case "win": win(); break;
        case "click": click(); break;
        case "undo": undo(); break;
        default: break;
      }
    },
    slide,
    hitWall,
    push,
    goal,
    win,
    click,
    undo,
    ambient,
    isAmbientOn,
    dispose,
  };
}
