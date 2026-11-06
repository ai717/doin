// 音效：零音频文件，全部用 WebAudio 实时合成（噪声缓冲 + BiquadFilter + FM 调频）。
//
// 本作的音效签名是「波次翻转音阶」：翻转第 k 枚 = 五声音阶第 k 级，
// 第 k 枚的音还要比第 1 枚晚 (k−1)×45ms 发出。
// ★ 这个 45ms 的节奏由**音频时钟**负责（tone 的 start 时刻），不由 setTimeout 负责 ——
//   主线程抖动再大，琶音也不会散；UI 的可视化用同一个常量 FLIP_STEP_MS 排程，
//   两边共用一个数，改节奏只需改这里。
//
// 降级策略：没有 AudioContext / 被自动播放策略拒绝 / 构造抛错 → 永久静默，绝不抛异常、
// 绝不反复重试。首次用户手势前不得启动 AudioContext（unlock 由 UI 在第一次交互时调用）。

// 宫商角徵羽（C4 D4 E4 G4 A4）。翻转序号超出 5 就继续往上翻八度。
export const PENTATONIC = Object.freeze([261.63, 293.66, 329.63, 392.0, 440.0]);

// 波次翻转的节拍：第 k 枚相对第 1 枚延后 (k−1) × 45ms。
export const FLIP_STEP_MS = 45;

// 第 k 枚（k 从 1 起）对应的五声音阶音高，超过五级继续升八度。
export function flipTone(k) {
  const index = Math.max(0, Math.trunc(numberOr(k, 1)) - 1);
  const octave = Math.floor(index / PENTATONIC.length);
  return PENTATONIC[index % PENTATONIC.length] * 2 ** octave;
}

export function cascadeDelayMs(k) {
  return Math.max(0, Math.trunc(numberOr(k, 1)) - 1) * FLIP_STEP_MS;
}

export function createAudio(options = {}) {
  let context = null;
  let master = null;
  let noise = null;
  let failed = false;
  let muted = Boolean(options.muted);
  let volume = clamp01(options.volume ?? 0.8);

  function ensure() {
    if (context || failed) return context;
    try {
      const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Ctor) {
        failed = true;
        return null;
      }
      context = new Ctor();
      master = context.createGain();
      master.gain.setValueAtTime(volume, context.currentTime);
      master.connect(context.destination);
    } catch (error) {
      failed = true;
      context = null;
      master = null;
    }
    return context;
  }

  function ready() {
    if (muted) return null;
    const ctx = ensure();
    if (!ctx || !master) return null;
    try {
      if (ctx.state === "suspended" && typeof ctx.resume === "function") ctx.resume();
    } catch (error) {
      // 解锁失败不影响后续排程
    }
    return ctx;
  }

  // 噪声缓冲：用确定性 LCG 填充，而不是 Math.random ——
  // 这样每次会话的噪声音色完全一致（噪声是音色，不该是随机事件），
  // 也让全站"任何模块都不许出现 Math.random"这条纪律没有例外。
  function noiseBuffer(ctx) {
    if (noise) return noise;
    const length = Math.floor(ctx.sampleRate * 1);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 0x9e3779b9;
    for (let i = 0; i < length; i += 1) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      data[i] = (seed / 0x3fffffff) - 1;
    }
    noise = buffer;
    return noise;
  }

  function envelope(ctx, start, peak, attack, duration) {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + duration);
    return gain;
  }

  function chain(nodes) {
    for (let i = 0; i < nodes.length - 1; i += 1) nodes[i].connect(nodes[i + 1]);
    nodes[nodes.length - 1].connect(master);
  }

  // 噪声脉冲：材质感全在这里（低通=闷、带通=脆、高通=气声），是"实体音"与"蜂鸣器"的分水岭。
  function noiseHit(spec) {
    const ctx = ready();
    if (!ctx) return;
    try {
      const start = ctx.currentTime + (spec.delay ?? 0);
      const duration = spec.duration ?? 0.03;
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = spec.type ?? "lowpass";
      filter.frequency.setValueAtTime(spec.frequency, start);
      if (spec.q != null) filter.Q.setValueAtTime(spec.q, start);
      if (spec.sweepTo != null) filter.frequency.exponentialRampToValueAtTime(spec.sweepTo, start + duration);
      const gain = envelope(ctx, start, spec.gain ?? 0.08, spec.attack ?? 0.002, duration);
      chain([source, filter, gain]);
      source.start(start, 0, duration + 0.02);
      source.stop(start + duration + 0.05);
    } catch (error) {
      // 音频永远不该打断游戏
    }
  }

  // 单音（可选 FM 调制、可选滤波、可选滑音、可选失谐）。
  function tone(spec) {
    const ctx = ready();
    if (!ctx) return;
    try {
      const start = ctx.currentTime + (spec.delay ?? 0);
      const duration = spec.duration ?? 0.12;
      const carrier = ctx.createOscillator();
      carrier.type = spec.type ?? "sine";
      carrier.frequency.setValueAtTime(spec.frequency, start);
      if (spec.slideTo != null) {
        carrier.frequency.exponentialRampToValueAtTime(spec.slideTo, start + duration);
      }
      if (spec.detune != null && carrier.detune) carrier.detune.setValueAtTime(spec.detune, start);

      const gain = envelope(ctx, start, spec.gain ?? 0.09, spec.attack ?? 0.008, duration);
      const tail = [];
      if (spec.filter) {
        const filter = ctx.createBiquadFilter();
        filter.type = spec.filter;
        filter.frequency.setValueAtTime(spec.filterFrequency ?? 1200, start);
        if (spec.filterSweepTo != null) {
          filter.frequency.exponentialRampToValueAtTime(spec.filterSweepTo, start + duration);
        }
        tail.push(filter);
      }
      tail.push(gain);
      chain([carrier, ...tail]);
      carrier.start(start);
      carrier.stop(start + duration + 0.05);

      // FM：调制器 → 调制增益 → 载波频率。调制指数从 index 衰减到 endIndex，
      // 指数给足才有"马林巴/编钟"的木体与金属味，纯正弦永远只是蜂鸣器。
      if (spec.index != null) {
        const ratio = spec.ratio ?? 2;
        const modulator = ctx.createOscillator();
        modulator.type = spec.modType ?? "sine";
        const modFrequency = spec.frequency * ratio;
        modulator.frequency.setValueAtTime(modFrequency, start);
        const depth = ctx.createGain();
        depth.gain.setValueAtTime(spec.index * modFrequency, start);
        depth.gain.exponentialRampToValueAtTime(
          Math.max(0.0001, (spec.endIndex ?? spec.index * 0.1) * modFrequency),
          start + duration,
        );
        modulator.connect(depth).connect(carrier.frequency);
        modulator.start(start);
        modulator.stop(start + duration + 0.05);
      }
    } catch (error) {
      // 同上
    }
  }

  return {
    isMuted: () => muted,
    getVolume: () => volume,
    setMuted(value) {
      muted = Boolean(value);
    },
    // 音量总控：muted 之外还有一路总增益，设置抽屉里的滑杆直接改这里。
    setVolume(value) {
      volume = clamp01(value);
      if (master) {
        try {
          master.gain.setValueAtTime(volume, context.currentTime);
        } catch (error) {
          // 忽略
        }
      }
    },
    // 必须由第一次用户手势调用，浏览器才允许发声。
    unlock() {
      ready();
    },

    // 1 · 落子：陶片压在绒布上的闷响（噪声脉冲低通 600 + 150Hz 正弦体 + 绒布拖尾）
    place() {
      noiseHit({ type: "lowpass", frequency: 600, duration: 0.008, gain: 0.14, attack: 0.001 });
      tone({ frequency: 150, type: "sine", duration: 0.04, gain: 0.11, attack: 0.004 });
      noiseHit({ type: "lowpass", frequency: 900, duration: 0.06, gain: 0.03, delay: 0.012 });
    },

    // 2 · ★ 翻转（招牌）：带通噪声的"啪" + 第 k 级五声音阶的 FM 铃音，第 k 枚自动延后 (k−1)×45ms
    flip(k) {
      const delay = cascadeDelayMs(k) / 1000;
      noiseHit({ type: "bandpass", frequency: 1600, q: 3, duration: 0.025, gain: 0.09, delay });
      tone({
        frequency: flipTone(k),
        ratio: 2,
        index: 2.6,
        endIndex: 0.25,
        duration: 0.09,
        gain: 0.075,
        delay,
      });
    },

    // 3 · 得角：黄铜编钟（载波 220，调制 220×1.41，指数 6 → 0.5，1.4s）+ 极轻的金属余韵
    corner() {
      tone({ frequency: 220, ratio: 1.41, index: 6, endIndex: 0.5, duration: 1.4, gain: 0.1, attack: 0.006 });
      tone({ frequency: 440, type: "sine", duration: 0.5, gain: 0.022, delay: 0.03 });
      noiseHit({ type: "bandpass", frequency: 3200, q: 1.4, duration: 0.25, gain: 0.014, delay: 0.02 });
    },

    // 4 · 陷阱位（X / C）：下行小二度，是提醒不是惩罚
    trap() {
      tone({ frequency: 440, type: "triangle", duration: 0.06, gain: 0.075, filter: "lowpass", filterFrequency: 1200 });
      tone({ frequency: 415, type: "triangle", duration: 0.06, gain: 0.075, delay: 0.06, filter: "lowpass", filterFrequency: 1200 });
    },

    // 5 · 合法落点提示：玻璃微光，几乎像气声
    hint() {
      noiseHit({ type: "highpass", frequency: 4000, duration: 0.012, gain: 0.035 });
      tone({ frequency: 1800, type: "sine", duration: 0.02, gain: 0.018, attack: 0.003 });
    },

    // 6 · Pass：让位的风铃（1046 + 1568，各 120ms，错开 40ms）
    passTurn() {
      tone({ frequency: 1046, type: "sine", duration: 0.12, gain: 0.06 });
      tone({ frequency: 1568, type: "sine", duration: 0.12, gain: 0.05, delay: 0.04 });
      noiseHit({ type: "highpass", frequency: 5200, duration: 0.16, gain: 0.012, delay: 0.02 });
    },

    // 7 · 天平归位：黄铜机械的"叮"+"咔"
    balance() {
      tone({ frequency: 1200, type: "triangle", duration: 0.03, gain: 0.05, attack: 0.001 });
      noiseHit({ type: "bandpass", frequency: 2500, q: 2, duration: 0.015, gain: 0.05, attack: 0.001 });
    },

    // 7b · 天平倾覆：归位音 + 90Hz 低音下潜
    tilt() {
      tone({ frequency: 1200, type: "triangle", duration: 0.03, gain: 0.05, attack: 0.001 });
      noiseHit({ type: "bandpass", frequency: 2500, q: 2, duration: 0.015, gain: 0.05, attack: 0.001 });
      tone({ frequency: 90, type: "sine", duration: 0.3, gain: 0.11, attack: 0.02 });
    },

    // 黄铜按键：与天平归位同源的"嗒"，供设置抽屉与仪表条按钮使用
    press() {
      tone({ frequency: 1200, type: "triangle", duration: 0.03, gain: 0.05, attack: 0.001 });
      noiseHit({ type: "bandpass", frequency: 2500, q: 2, duration: 0.015, gain: 0.05, attack: 0.001 });
    },

    // 8 · 终局结算：温暖的马林巴四音 + 收尾长钟（胜=上行，负=下行）
    settle(won = true) {
      const degrees = won ? [0, 1, 2, 3] : [3, 2, 1, 0];
      degrees.forEach((degree, index) => {
        tone({
          frequency: flipTone(degree + 1) * (won ? 1 : 0.5),
          ratio: 3.5,
          index: 1.8,
          endIndex: 0.05,
          duration: 0.2,
          gain: 0.085,
          attack: 0.004,
          delay: index * 0.09,
        });
      });
      tone({ frequency: 220, ratio: 1.41, index: 3, endIndex: 0.3, duration: 1.2, gain: 0.07, delay: 0.34 });
    },

    // 9 · 完美局 64:0：唯一允许华丽的时刻（失谐双锯齿上行 + 低音 Kick + 五声琶音）
    perfect() {
      tone({ frequency: 220, slideTo: 880, type: "sawtooth", duration: 0.4, gain: 0.05, detune: -8 });
      tone({ frequency: 220, slideTo: 880, type: "sawtooth", duration: 0.4, gain: 0.05, detune: 8 });
      tone({ frequency: 60, slideTo: 34, type: "sine", duration: 0.18, gain: 0.16, attack: 0.004 });
      [1, 2, 3, 4, 5].forEach((degree, index) => {
        tone({
          frequency: flipTone(degree),
          ratio: 2,
          index: 2,
          endIndex: 0.2,
          duration: 0.16,
          gain: 0.06,
          delay: 0.2 + index * 0.07,
        });
      });
    },

    // 10 · 连击断（Flip Rush）：下行三音 + 低通扫频，明确的失落但只有一瞬
    comboBreak() {
      [523, 392, 262].forEach((frequency, index) => {
        tone({
          frequency,
          type: "sawtooth",
          duration: 0.05,
          gain: 0.06,
          delay: index * 0.05,
          filter: "lowpass",
          filterFrequency: 2000,
          filterSweepTo: 600,
        });
      });
    },
  };
}

function numberOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
