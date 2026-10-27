// 推币机 · WebAudio 专属音色（零外部音频文件，首次手势解锁，静音或不支持时静默降级）
// 三种物理音色基元：
//   metal()   —— FM 非整数比 + 噪声瞬态，合成金币金属碰撞/落袋的清脆"叮"
//   clatter() —— 噪声缓冲 + 带通/高通动态滤波，合成整堆金币哗啦摩擦
//   thump()   —— 失谐双振荡器下潜包络，合成推板液压低鸣与金卡爆响 Kick

let ctx = null;
let master = null;
let enabled = true;

export function initAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.3;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return true;
  } catch {
    return false;
  }
}

export function setAudioEnabled(on) {
  enabled = Boolean(on);
  if (master) master.gain.value = on ? 0.3 : 0;
}

export function isAudioEnabled() {
  return enabled;
}

function ready() {
  return Boolean(ctx && master && enabled);
}

// ---- 基元：FM 金属音（非整数比调制 + 短促噪声瞬态）----
function metal(freq, dur = 0.22, gain = 0.28, ratio = 2.41, noiseGain = 0.1) {
  if (!ready()) return;
  try {
    const t = ctx.currentTime;
    const carrier = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();
    const g = ctx.createGain();
    carrier.type = "sine";
    mod.type = "sine";
    carrier.frequency.setValueAtTime(freq, t);
    mod.frequency.setValueAtTime(freq * ratio, t);
    modGain.gain.setValueAtTime(freq * 1.6, t);
    modGain.gain.exponentialRampToValueAtTime(1, t + dur);
    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    carrier.connect(g);
    g.connect(master);
    carrier.start(t);
    mod.start(t);
    carrier.stop(t + dur + 0.03);
    mod.stop(t + dur + 0.03);
    if (noiseGain > 0) noiseBurst(0.025, noiseGain, freq * 5, "highpass");
  } catch {
    /* 音频失败静默 */
  }
}

// ---- 基元：噪声缓冲 + 动态滤波（金币哗啦 / 摩擦 / 液压）----
function noiseBurst(dur, gain = 0.16, freq = 2600, type = "bandpass", sweepTo = null) {
  if (!ready()) return;
  try {
    const t = ctx.currentTime;
    const length = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(freq, t);
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + dur);
  } catch {
    /* 音频失败静默 */
  }
}

// ---- 基元：失谐双振荡器下潜（推板液压 / 金卡 Kick）----
function thump(freq, dur = 0.3, gain = 0.4, slideTo = null, detune = 14) {
  if (!ready()) return;
  try {
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(master);
    for (const sign of [-1, 1]) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.detune.value = sign * detune;
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(900, t);
      lp.frequency.exponentialRampToValueAtTime(220, t + dur);
      osc.connect(lp);
      lp.connect(g);
      osc.start(t);
      osc.stop(t + dur + 0.03);
    }
  } catch {
    /* 音频失败静默 */
  }
}

function bell(freq, dur = 0.34, gain = 0.3, ratio = 3.13) {
  metal(freq, dur, gain, ratio, 0.02);
}

// ---- 事件映射（8 种专属音效）----
export function playEvent(type, event = {}) {
  switch (type) {
    // 1. 投币入台：金属币落入投币口的清脆"叮——"，短促下滑滑音像币滚入
    case "insert": {
      if (!ready()) break;
      try {
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(1480, t);
        osc.frequency.exponentialRampToValueAtTime(880, t + 0.16);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.22, t + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
        osc.connect(g);
        g.connect(master);
        osc.start(t);
        osc.stop(t + 0.22);
      } catch { /* 静默 */ }
      noiseBurst(0.07, 0.14, 5200, "highpass");
      break;
    }
    // 2. 推板往复：机械液压"呼——咔"，推程低鸣回程轻吸
    case "pusher_forward":
      thump(74, 0.34, 0.2, 46);
      noiseBurst(0.22, 0.07, 420, "lowpass");
      break;
    case "pusher_back":
      noiseBurst(0.16, 0.05, 300, "bandpass", 900);
      break;
    // 3. 金币碰撞：金属币互碰的"哗啦"，密度越高越密
    case "clink":
      noiseBurst(0.05, 0.1, 3200 + (event.density ?? 0) * 180, "bandpass");
      metal(2200 + (event.density ?? 0) * 120, 0.07, 0.1, 2.76, 0);
      break;
    // 4. 连锁掉落：每枚"叮！"音高随连锁等级上行（4/4/4/4 档位升调）
    case "drop": {
      const step = Math.min(event.cascade ?? 1, 20);
      const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33, 36];
      const semi = scale[(step - 1) % scale.length] + 12 * Math.floor((step - 1) / scale.length);
      const freq = 523.25 * 2 ** (semi / 12);
      const kind = event.kind ?? "norm";
      if (kind === "gem") bell(freq * 1.5, 0.4, 0.34, 3.42);
      else if (kind === "gold") bell(freq * 1.25, 0.36, 0.32, 2.76);
      else bell(freq, 0.3, 0.28, 2.41);
      break;
    }
    // 5. 奖励触发：稀有币/奖励卡"咚啷"，失谐双振荡器 + 金币琶音
    case "card":
      thump(320, 0.22, 0.24, 180, 9);
      [0, 4, 7, 12].forEach((semi, i) => {
        setTimeout(() => bell(660 * 2 ** (semi / 12), 0.26, 0.2, 3.13), i * 70);
      });
      break;
    case "launch":
      noiseBurst(0.2, 0.16, 900, "bandpass", 5200);
      thump(180, 0.18, 0.2, 620, 18);
      break;
    // 6. 金卡极限 2¹⁸：机箱爆响 —— 大 Kick + 金币喷泉琶音 + 高频火花
    case "jackpot":
      thump(120, 0.75, 0.5, 42, 22);
      noiseBurst(0.7, 0.24, 700, "lowpass", 6000);
      [0, 4, 7, 12, 16, 19, 24, 28].forEach((semi, i) => {
        setTimeout(() => bell(523.25 * 2 ** (semi / 12), 0.42, 0.24, 3.42), i * 85);
      });
      break;
    case "tower_down":
      thump(96, 0.9, 0.52, 38, 26);
      noiseBurst(0.9, 0.3, 520, "lowpass", 4200);
      [0, 5, 7, 12, 17, 19, 24].forEach((semi, i) => {
        setTimeout(() => bell(392 * 2 ** (semi / 12), 0.5, 0.26, 2.76), i * 110);
      });
      break;
    // 7. 连锁中断 / 波次结束
    case "cascade_end":
      bell(392, 0.3, 0.18, 2.41);
      setTimeout(() => bell(294, 0.36, 0.16, 2.76), 90);
      break;
    // 8. 结算与界面
    case "won":
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => bell(f, 0.42, 0.28, 2.41), i * 120));
      break;
    case "lost":
      [392, 330, 262].forEach((f, i) => setTimeout(() => thump(f, 0.34, 0.26, f * 0.7), i * 170));
      break;
    case "pause_toggled":
      bell(event.isPaused ? 420 : 620, 0.16, 0.18, 2.41);
      break;
    case "blocked":
      thump(220, 0.14, 0.16, 150, 12);
      break;
    case "ui_click":
      noiseBurst(0.04, 0.1, 4200, "highpass");
      break;
    // 9. 无尽机台专属：机关补投（机械落仓）/ 侧沟吞币（闷响后滑落）
    case "token_spawn":
      thump(150, 0.2, 0.2, 90, 10);
      noiseBurst(0.26, 0.1, 700, "bandpass", 2400);
      break;
    case "lost_coin":
      noiseBurst(0.2, 0.08, 1900, "bandpass", 420);
      break;
    default:
      break;
  }
}
