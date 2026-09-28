// audio.mjs —— WebAudio 程序化合成音效（零外部音频文件）：暗室霓虹招牌 + 镇流器控制台
//
// 音色素材只有三样，全部来自这台机器的物理属性：
//   ① 玻璃灯管轻敲  —— FM 合成（载波 sine + 非整数比调制），出马林巴/水滴的清脆玻璃感
//   ② 镇流器交流嗡鸣 —— 两枚失谐锯齿波经低通，50Hz 电网底噪，合闸/断电时扫频
//   ③ 继电器与爆管   —— 噪声缓冲过带通/高通，模拟金属咔哒与玻璃碎裂
// 严禁直接跨游戏复制粘贴：这里是霓虹灯管，不是蜂鸣器。

const A4 = 440;
/** 半音 → 频率：豆链每升一档、连吞每多一只，音高就往上走半音 */
function semi(steps) {
  return A4 * Math.pow(2, steps / 12);
}

export function createAudio({ muted = false } = {}) {
  let ctx = null;
  let master = null;
  let enabled = !muted;
  let unlockBound = false;

  function ensure() {
    if (ctx) return ctx;
    const Ctor = typeof globalThis !== "undefined" ? globalThis.AudioContext || globalThis.webkitAudioContext : null;
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

  function now() {
    return ctx ? ctx.currentTime : 0;
  }

  /** 单振荡器音符，可带指数滑音 */
  function tone({ freq = 440, to = null, dur = 0.18, type = "sine", gain = 0.3, delay = 0, attack = 0.008 }) {
    if (!enabled) return;
    const c = ensure();
    if (!c) return;
    try {
      const t0 = now() + delay;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(20, freq), t0);
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

  /** 噪声过滤波器：type 决定是"沙沙"还是"咔哒"还是"碎裂" */
  function noise({
    dur = 0.2,
    gain = 0.22,
    freq = 1200,
    to = null,
    q = 1.2,
    type = "bandpass",
    delay = 0,
    attack = 0.002,
  }) {
    if (!enabled) return;
    const c = ensure();
    if (!c) return;
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
      filter.frequency.setValueAtTime(Math.max(20, freq), t0);
      if (to && to !== freq) filter.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
      filter.Q.value = q;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + attack);
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

  /** FM 玻璃音：非整数比调制出灯管的金属泛音，比纯正弦"硬"但不刺耳 */
  function glass({ freq = 880, ratio = 2.41, index = 260, dur = 0.16, gain = 0.2, delay = 0 }) {
    if (!enabled) return;
    const c = ensure();
    if (!c) return;
    try {
      const t0 = now() + delay;
      const carrier = c.createOscillator();
      const mod = c.createOscillator();
      const modGain = c.createGain();
      const g = c.createGain();
      carrier.type = "sine";
      mod.type = "sine";
      carrier.frequency.setValueAtTime(Math.max(20, freq), t0);
      mod.frequency.setValueAtTime(Math.max(20, freq * ratio), t0);
      modGain.gain.setValueAtTime(index, t0);
      modGain.gain.exponentialRampToValueAtTime(Math.max(1, index * 0.02), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      mod.connect(modGain);
      modGain.connect(carrier.frequency);
      carrier.connect(g);
      g.connect(master);
      mod.start(t0);
      carrier.start(t0);
      mod.stop(t0 + dur + 0.03);
      carrier.stop(t0 + dur + 0.03);
    } catch {
      // 静默
    }
  }

  /** 镇流器嗡鸣：两枚失谐锯齿过低通，扫频模拟合闸 / 断电 */
  function ballast({ from = 50, to = 130, dur = 0.5, gain = 0.14, delay = 0, cutoff = 420 }) {
    if (!enabled) return;
    const c = ensure();
    if (!c) return;
    try {
      const t0 = now() + delay;
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(Math.max(20, cutoff), t0);
      lp.Q.value = 0.8;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      lp.connect(g);
      g.connect(master);
      for (const detune of [0, 7]) {
        const osc = c.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(Math.max(20, from), t0);
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
        osc.detune.setValueAtTime(detune, t0);
        osc.connect(lp);
        osc.start(t0);
        osc.stop(t0 + dur + 0.03);
      }
    } catch {
      // 静默
    }
  }

  const api = {
    /** 首次用户手势时解锁（iOS/Chrome 自动播放策略） */
    unlock() {
      const c = ensure();
      if (!c) return false;
      try {
        if (c.state === "suspended") c.resume();
      } catch {
        // 静默
      }
      return true;
    },
    /** 手势解锁只需绑一次，绑多了只会白白占用监听器 */
    bindUnlock(target) {
      if (unlockBound || !target || typeof target.addEventListener !== "function") return;
      unlockBound = true;
      const handler = () => api.unlock();
      target.addEventListener("pointerdown", handler, { passive: true });
      target.addEventListener("keydown", handler, { passive: true });
    },
    setMuted(m) {
      enabled = !m;
      if (master) master.gain.value = enabled ? 0.34 : 0;
    },
    isMuted() {
      return !enabled;
    },
    isReady() {
      return ctx !== null;
    },

    /** 吃豆：灯管轻敲。豆链每升一档抬高半音，玩家能听出自己在连 */
    pellet(chainLevel = 0) {
      const step = Math.max(0, Math.min(7, Number(chainLevel) || 0));
      glass({ freq: semi(-9 + step * 2), index: 150, dur: 0.09, gain: 0.14 });
    },

    /** 糖浆区的豆：闷一点、低一点，一听就知道踩进了黏区 */
    pelletSyrup() {
      glass({ freq: semi(-14), ratio: 1.71, index: 90, dur: 0.14, gain: 0.12 });
      noise({ dur: 0.1, gain: 0.05, freq: 320, q: 0.7, type: "lowpass" });
    },

    /** 能量豆：镇流器合闸 —— 低频 kick + 电流嗡鸣上扬 + 继电器咔哒 */
    power() {
      tone({ freq: 130, to: 44, dur: 0.34, type: "sine", gain: 0.34 });
      ballast({ from: 48, to: 168, dur: 0.55, gain: 0.16, cutoff: 700 });
      noise({ dur: 0.06, gain: 0.16, freq: 2400, q: 1.6, type: "highpass" });
    },

    /** 吞灯：玻璃爆裂，音高随 200/400/800/1600 连吞往上走 */
    eatGhost(combo = 0) {
      const step = Math.max(0, Math.min(3, Number(combo) || 0));
      noise({ dur: 0.24, gain: 0.2, freq: 2600, to: 700, q: 0.9 });
      glass({ freq: semi(-2 + step * 3), ratio: 3.13, index: 320, dur: 0.22, gain: 0.22 });
      tone({ freq: semi(-17 + step * 3), dur: 0.2, type: "triangle", gain: 0.14 });
    },

    /** 被撞灭：灯管烧断 —— 电压骤降 + 嗡鸣掐断 */
    death() {
      tone({ freq: 320, to: 42, dur: 0.6, type: "sawtooth", gain: 0.24 });
      ballast({ from: 150, to: 40, dur: 0.7, gain: 0.14, cutoff: 500 });
      noise({ dur: 0.18, gain: 0.12, freq: 900, to: 200, q: 1.1, delay: 0.05 });
    },

    /** 三条命全灭：整墙断电 */
    lost() {
      [392, 330, 262, 196].forEach((f, i) =>
        tone({ freq: f, to: f * 0.5, dur: 0.4, type: "triangle", gain: 0.16, delay: i * 0.16 }),
      );
      ballast({ from: 120, to: 30, dur: 1.2, gain: 0.12, cutoff: 400, delay: 0.1 });
    },

    /** 节拍切换：继电器咔哒。猎杀比巡游更低更沉，闭着眼也能分辨 */
    beatSwitch(mode = "scatter") {
      const hunt = mode === "chase";
      noise({ dur: 0.05, gain: 0.2, freq: hunt ? 1500 : 2600, q: 2.4, type: "highpass" });
      tone({ freq: hunt ? 92 : 146, to: hunt ? 62 : 110, dur: 0.22, type: "square", gain: 0.1 });
    },

    /** 换拍前的心跳：两声闷响，给玩家 3 秒预备 */
    heartbeat() {
      tone({ freq: 74, to: 52, dur: 0.12, type: "sine", gain: 0.2 });
      tone({ freq: 68, to: 46, dur: 0.14, type: "sine", gain: 0.16, delay: 0.19 });
    },

    /** 豆链升档：马林巴式上行，档位越高越高 */
    chainUp(level = 1) {
      const base = -5 + Math.max(0, Math.min(3, Number(level) || 1)) * 2;
      [0, 1].forEach((i) => glass({ freq: semi(base + i * 3), index: 200, dur: 0.14, gain: 0.16, delay: i * 0.06 }));
    },

    /** 豆链断了：一声下垂的泄气 */
    chainBreak() {
      tone({ freq: 300, to: 150, dur: 0.18, type: "triangle", gain: 0.1 });
    },

    /** 幽灵出巢：电流充能完毕，闸门弹开 */
    release() {
      ballast({ from: 60, to: 200, dur: 0.34, gain: 0.12, cutoff: 900 });
      noise({ dur: 0.07, gain: 0.14, freq: 1800, q: 2, type: "highpass" });
    },

    /** 被吞的幽灵回到巢里开始充能：低沉的回位咔哒 */
    recharge() {
      tone({ freq: 210, to: 120, dur: 0.18, type: "square", gain: 0.08 });
      noise({ dur: 0.09, gain: 0.1, freq: 700, q: 1.4, type: "lowpass" });
    },

    /** 压制成功：每吃满 10 颗把巢里下一只多压一会儿 —— 一声闷闷的"按住了" */
    suppress() {
      tone({ freq: 150, to: 96, dur: 0.16, type: "sine", gain: 0.14 });
    },

    /** 惊惶结束：白闪之后恢复原味，嗡鸣回落 */
    frightEnd() {
      tone({ freq: 520, to: 240, dur: 0.2, type: "triangle", gain: 0.1 });
    },

    /** 潮汐闸门开合：金属闸板落下的沉响 */
    gate(open) {
      if (open) {
        noise({ dur: 0.16, gain: 0.12, freq: 500, to: 1600, q: 1.1 });
        tone({ freq: 180, to: 300, dur: 0.14, type: "square", gain: 0.06 });
      } else {
        noise({ dur: 0.2, gain: 0.16, freq: 1600, to: 400, q: 1.1 });
        tone({ freq: 120, to: 70, dur: 0.18, type: "square", gain: 0.08 });
      }
    },

    /** 水果：玻璃风铃三连 */
    fruit() {
      [1046, 1318, 1568].forEach((f, i) => glass({ freq: f, ratio: 2.76, index: 180, dur: 0.2, gain: 0.14, delay: i * 0.06 }));
    },

    /** 奖命：镇流器过载的一声亮响 */
    extraLife() {
      [659, 880, 1175].forEach((f, i) => glass({ freq: f, index: 240, dur: 0.22, gain: 0.16, delay: i * 0.08 }));
      ballast({ from: 80, to: 220, dur: 0.5, gain: 0.1 });
    },

    /** 清盘：招牌全亮 —— 大七和弦琶音 + 稳定嗡鸣 */
    cleared() {
      [392, 494, 587, 740, 880].forEach((f, i) =>
        glass({ freq: f, ratio: 2.02, index: 200, dur: 0.4, gain: 0.16, delay: i * 0.1 }),
      );
      ballast({ from: 90, to: 130, dur: 1.4, gain: 0.1, cutoff: 800, delay: 0.2 });
    },

    /** 残局达成：短促的一声"通了" */
    setpieceClear() {
      [587, 880].forEach((f, i) => glass({ freq: f, index: 220, dur: 0.26, gain: 0.16, delay: i * 0.08 }));
    },

    /** 控制台按键：继电器微咔 */
    click() {
      noise({ dur: 0.04, gain: 0.14, freq: 2200, q: 2.6, type: "highpass" });
      tone({ freq: 620, dur: 0.05, type: "square", gain: 0.06 });
    },

    /** 无效操作：闷一声，绝不 alert */
    deny() {
      tone({ freq: 150, to: 110, dur: 0.1, type: "square", gain: 0.07 });
    },

    /** 幕布起落（弹层开合）：灯管余晖扫过 */
    curtain() {
      noise({ dur: 0.3, gain: 0.09, freq: 900, to: 300, q: 0.6, type: "lowpass" });
    },
  };

  return api;
}
