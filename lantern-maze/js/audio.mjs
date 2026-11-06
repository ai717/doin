// audio.mjs —— WebAudio 程序化合成音效（零外部音频文件），手势解锁，静音或不支持时静默降级

const DOT_SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];

export function createAudio({ muted = false } = {}) {
  let ctx = null;
  let master = null;
  let bed = null;
  let enabled = !muted;
  let unlocked = false;
  let dotStep = 0;

  function ensure() {
    if (ctx) return ctx;
    const Ctor = typeof globalThis !== "undefined" ? globalThis.AudioContext || globalThis.webkitAudioContext : null;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.32;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
      master = null;
    }
    return ctx;
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
      for (let i = 0; i < frames; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
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

  /** 夜色底噪：极轻的风与虫鸣衬底，随静音开关一起起停 */
  function startBed() {
    const c = ensure();
    if (!c || bed || !enabled) return;
    try {
      const frames = Math.floor(c.sampleRate * 2.4);
      const buf = c.createBuffer(1, frames, c.sampleRate);
      const data = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < frames; i += 1) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.2;
      }
      const src = c.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 420;
      const g = c.createGain();
      g.gain.value = 0.05;
      src.connect(lp);
      lp.connect(g);
      g.connect(master);
      src.start();
      bed = { src, g };
    } catch {
      bed = null;
    }
  }

  function stopBed() {
    if (!bed) return;
    try {
      bed.src.stop();
    } catch {
      // 忽略
    }
    bed = null;
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
    if (enabled) startBed();
  }

  const api = {
    unlock,
    isMuted: () => !enabled,
    setMuted(next) {
      enabled = !next;
      if (enabled) {
        unlock();
        startBed();
      } else stopBed();
    },
    /** 光尘：五声音阶爬梯，吃完一段再回落 */
    dot() {
      const semi = DOT_SCALE[dotStep % DOT_SCALE.length];
      dotStep += 1;
      tone({ freq: 440 * Math.pow(2, semi / 12), dur: 0.06, type: "triangle", gain: 0.11 });
    },
    resetDotScale() {
      dotStep = 0;
    },
    /** 日曜珠：一记锣 */
    pearl() {
      dotStep = 0;
      tone({ freq: 196, to: 188, dur: 0.5, type: "sine", gain: 0.3 });
      tone({ freq: 587, dur: 0.34, type: "triangle", gain: 0.16, delay: 0.01 });
      noise({ dur: 0.3, gain: 0.12, freq: 2400, q: 0.7 });
    },
    /** 天亮开始 */
    frightStart() {
      tone({ freq: 330, to: 660, dur: 0.3, type: "sine", gain: 0.18 });
    },
    /** 吞影魅：滑音上扬 */
    eatGhost(chain = 1) {
      const base = 300 * Math.pow(1.12, Math.min(4, chain));
      tone({ freq: base, to: base * 3, dur: 0.26, type: "sawtooth", gain: 0.16 });
      tone({ freq: base * 2, dur: 0.14, type: "sine", gain: 0.1, delay: 0.06 });
    },
    /** 惊惶将尽：两记白闪的提示音 */
    frightWarn() {
      tone({ freq: 880, dur: 0.08, type: "square", gain: 0.1 });
      tone({ freq: 880, dur: 0.08, type: "square", gain: 0.1, delay: 0.16 });
    },
    frightEnd() {
      tone({ freq: 520, to: 240, dur: 0.22, type: "sine", gain: 0.12 });
    },
    /** 提灯爆亮 */
    dash() {
      noise({ dur: 0.24, gain: 0.2, freq: 3200, q: 0.6, type: "highpass" });
      tone({ freq: 1200, to: 2600, dur: 0.16, type: "sine", gain: 0.12 });
    },
    /** 出匣 */
    release() {
      tone({ freq: 148, to: 96, dur: 0.24, type: "triangle", gain: 0.14 });
    },
    /** 更次切换（猎杀↔巡游）：木梆 */
    phase() {
      noise({ dur: 0.07, gain: 0.14, freq: 900, q: 3 });
      tone({ freq: 660, dur: 0.07, type: "square", gain: 0.07 });
    },
    /** 流明灯登场/谢幕 */
    fruitIn() {
      tone({ freq: 740, to: 988, dur: 0.2, type: "sine", gain: 0.14 });
    },
    fruit() {
      [784, 988, 1175].forEach((f, i) => tone({ freq: f, dur: 0.18, type: "triangle", gain: 0.16, delay: i * 0.05 }));
    },
    /** 熄灯：噗 + 下行三音 */
    caught() {
      noise({ dur: 0.3, gain: 0.24, freq: 420, q: 0.5, type: "lowpass" });
      [392, 330, 262].forEach((f, i) => tone({ freq: f, dur: 0.26, type: "sine", gain: 0.16, delay: 0.1 + i * 0.16 }));
    },
    respawn() {
      tone({ freq: 262, to: 392, dur: 0.24, type: "sine", gain: 0.12 });
    },
    /** 清巷：更鼓三响 */
    cleared() {
      [0, 0.22, 0.44].forEach((d) => {
        tone({ freq: 110, to: 62, dur: 0.34, type: "sine", gain: 0.34, delay: d });
        noise({ dur: 0.16, gain: 0.12, freq: 300, q: 0.8, type: "lowpass", delay: d });
      });
      [523, 659, 784].forEach((f, i) => tone({ freq: f, dur: 0.3, type: "triangle", gain: 0.12, delay: 0.5 + i * 0.09 }));
    },
    /** 天亮大结算 */
    won() {
      [392, 494, 587, 784, 988].forEach((f, i) => tone({ freq: f, dur: 0.5, type: "sine", gain: 0.18, delay: i * 0.13 }));
    },
    lost() {
      [330, 262, 196, 147].forEach((f, i) => tone({ freq: f, dur: 0.42, type: "sine", gain: 0.2, delay: i * 0.19 }));
    },
    extraLife() {
      [659, 880, 1175].forEach((f, i) => tone({ freq: f, dur: 0.2, type: "triangle", gain: 0.16, delay: i * 0.07 }));
    },
    /** 破晓冲刺的续时/扣时 */
    timeAdd() {
      tone({ freq: 620, to: 1040, dur: 0.16, type: "triangle", gain: 0.14 });
    },
    round() {
      tone({ freq: 120, to: 70, dur: 0.4, type: "sine", gain: 0.26 });
    },
    refill() {
      noise({ dur: 0.4, gain: 0.1, freq: 1800, q: 0.5 });
    },
    /** 机台按键：梆 / 咔 */
    click() {
      noise({ dur: 0.05, gain: 0.16, freq: 1400, q: 2.2 });
      tone({ freq: 520, dur: 0.05, type: "square", gain: 0.07 });
    },
    deny() {
      tone({ freq: 180, to: 140, dur: 0.1, type: "square", gain: 0.07 });
    },
    /** 工坊落笔 */
    brush() {
      noise({ dur: 0.05, gain: 0.07, freq: 2600, q: 1.4 });
    },
    /** 幕布起落 */
    curtain() {
      noise({ dur: 0.36, gain: 0.1, freq: 620, q: 0.6, type: "lowpass" });
    },
  };

  return api;
}
