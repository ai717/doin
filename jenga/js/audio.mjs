// 叠叠乐 · 程序化合成音效（零外部音频文件）
//
// 音色口径（老木匠工作台）：床上抽出，最高 extra 音色而不能是单振荡器 beep。
//   抽块 → 木纹摩擦：噪声过带通 sweep + 末端木咔
//   落位 → 沉稳「笃」：低频正弦 + 噪声瞬态
//   咯吱 → 失谐锯齿 + LFO 抖动（随判危度爬升）
//   塔倒 → 噪声串 + 低频冲击序列 + 尘埃
//   连击 → FM 木琴五声音阶上行；封神 → 大七和弦
//
// 静音或 WebAudio 不可用时一律静默降级（不应有过任何异常抛到调用方）。

import { clamp } from "./engine.mjs";
import { TRIPLE_STREAK } from "./score.mjs";

let ctx = null;
let master = null;
let enabled = true;
let noiseBuffer = null;
let lastCreak = 0;
let lastClack = 0;

// 五声音阶（相对半音）：宫 商 角 徵 羽 —— 连击逐级上行时用
const PENTATONIC = [0, 2, 4, 7, 9];
const BASE_FREQ = 523.25; // C5

export function initAudio() {
  if (ctx) {
    if (ctx.state === "suspended") ctx.resume?.();
    return true;
  }
  try {
    const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Ctor) return false;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = enabled ? 0.5 : 0;
    master.connect(ctx.destination);
    noiseBuffer = makeNoise(2);
    return true;
  } catch {
    ctx = null;
    return false;
  }
}

export function setAudioEnabled(value) {
  enabled = Boolean(value);
  if (master) master.gain.value = enabled ? 0.5 : 0;
}

export function isAudioEnabled() {
  return enabled;
}

function makeNoise(seconds) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let lastV = 0;
  for (let i = 0; i < len; i += 1) {
    const white = Math.random() * 2 - 1;
    // 轻微低通：让噪声更接近木头摩擦的厚实质感，而不是电视雪花
    lastV = (lastV + 0.22 * white) / 1.22;
    data[i] = lastV * 3.2;
  }
  return buf;
}

function noiseSource(playbackRate = 1) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  src.playbackRate.value = playbackRate;
  src.loop = true;
  return src;
}

function envGain(peak, attack, decay, startAt = 0) {
  const g = ctx.createGain();
  const t = ctx.currentTime + startAt;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  return g;
}

function ready() {
  if (!enabled || !ctx || !master) return false;
  if (ctx.state === "suspended") ctx.resume?.();
  return true;
}

// ---------------------------------------------------------------- 音色

// 1. 抽块：木质摩擦「嘎——咔」，带通从 900Hz 扫到 320Hz，末端一记短咔
function playPull(intensity = 1) {
  const dur = 0.5;
  const src = noiseSource(1);
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.Q.value = 4.5;
  const now = ctx.currentTime;
  band.frequency.setValueAtTime(900, now);
  band.frequency.exponentialRampToValueAtTime(320, now + dur * 0.8);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.32 * clamp(intensity, 0.4, 1.4), now + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  src.connect(band).connect(g).connect(master);
  src.start(now);
  src.stop(now + dur + 0.05);
  woodClick(dur * 0.82, 0.16, 780);
}

// 2. 木块互碰：FM 木琴短音（600Hz 起，80ms 衰减）
function woodClick(delay = 0, gain = 0.2, freq = 620) {
  if (!ctx) return;
  const now = ctx.currentTime + delay;
  const carrier = ctx.createOscillator();
  const mod = ctx.createOscillator();
  const modGain = ctx.createGain();
  carrier.frequency.value = freq;
  mod.frequency.value = freq * 2.4;
  modGain.gain.setValueAtTime(freq * 1.6, now);
  modGain.gain.exponentialRampToValueAtTime(1, now + 0.08);
  mod.connect(modGain).connect(carrier.frequency);
  const g = envGain(gain, 0.004, 0.09, delay);
  carrier.connect(g).connect(master);
  carrier.start(now);
  mod.start(now);
  carrier.stop(now + 0.2);
  mod.stop(now + 0.2);
}

// 3. 落位：低频正弦「笃」+ 短促噪声瞬态
function playStack(slotEcc = 0) {
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(165, now);
  osc.frequency.exponentialRampToValueAtTime(96, now + 0.16);
  const g = envGain(0.42, 0.006, 0.2);
  osc.connect(g).connect(master);
  osc.start(now);
  osc.stop(now + 0.3);

  const src = noiseSource(1);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 460 + Math.abs(slotEcc) * 260;
  const ng = envGain(0.18, 0.003, 0.08);
  src.connect(lp).connect(ng).connect(master);
  src.start(now);
  src.stop(now + 0.16);
  woodClick(0.01, 0.12, 520);
}

// 4. 咯吱：失谐锯齿 + LFO 抖动，强度随判危度爬升
function playCreak(danger = 0) {
  if (!ctx) return;
  const now = ctx.currentTime;
  if (now - lastCreak < 0.55) return;
  lastCreak = now;
  const level = clamp(danger, 0.15, 1);
  const dur = 0.5 + level * 0.5;
  const base = 88 + level * 26;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.1 * level, now + 0.12);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 320 + level * 380;

  for (const detune of [-9, 6]) {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = base;
    osc.detune.value = detune;
    osc.connect(lp);
    osc.start(now);
    osc.stop(now + dur + 0.05);
  }
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 5.5 + level * 7;
  lfoGain.gain.value = 120 * level;
  lfo.connect(lfoGain).connect(lp.frequency);
  lfo.start(now);
  lfo.stop(now + dur + 0.05);
  lp.connect(g).connect(master);
}

// 5. 塔倒：低频冲击序列 + 木块碰撞噪声串 + 尘埃尾巴
function playCollapse() {
  if (!ctx) return;
  const now = ctx.currentTime;
  for (let i = 0; i < 7; i += 1) {
    const delay = i * 0.075 + Math.random() * 0.05;
    const t = now + delay;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(180 - i * 12, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.22);
    const g = envGain(0.34 - i * 0.03, 0.005, 0.26, delay);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + 0.4);
    woodClick(delay + 0.01, 0.16, 380 + Math.random() * 420);
  }
  const dust = noiseSource(0.7);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 1400;
  const dg = ctx.createGain();
  dg.gain.setValueAtTime(0.0001, now + 0.1);
  dg.gain.exponentialRampToValueAtTime(0.13, now + 0.35);
  dg.gain.exponentialRampToValueAtTime(0.0001, now + 1.9);
  dust.connect(hp).connect(dg).connect(master);
  dust.start(now + 0.1);
  dust.stop(now + 2);
}

// 6. 连击：FM 木琴琶音逐级上行（五声音阶）
function playStreak(streak) {
  if (!ctx) return;
  const n = Math.max(1, Math.floor(streak));
  const step = PENTATONIC[(n - 1) % PENTATONIC.length];
  const octave = Math.floor((n - 1) / PENTATONIC.length);
  const freq = BASE_FREQ * 2 ** (step / 12 + octave * 0.5);
  const now = ctx.currentTime;
  const carrier = ctx.createOscillator();
  const mod = ctx.createOscillator();
  const modGain = ctx.createGain();
  carrier.type = "sine";
  carrier.frequency.value = freq;
  mod.frequency.value = freq * 3.1;
  modGain.gain.setValueAtTime(freq * 1.4, now);
  modGain.gain.exponentialRampToValueAtTime(1, now + 0.12);
  mod.connect(modGain).connect(carrier.frequency);
  const g = envGain(0.24, 0.004, 0.34);
  carrier.connect(g).connect(master);
  carrier.start(now);
  mod.start(now);
  carrier.stop(now + 0.5);
  mod.stop(now + 0.5);
  if (n >= TRIPLE_STREAK) {
    const shine = noiseSource(1.6);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = freq * 2;
    bp.Q.value = 6;
    const sg = envGain(0.08, 0.02, 0.4, 0.02);
    shine.connect(bp).connect(sg).connect(master);
    shine.start(now + 0.02);
    shine.stop(now + 0.5);
  }
}

// 7. 封神：大七和弦 + 木纹流光垫底
function playSpire() {
  if (!ctx) return;
  const now = ctx.currentTime;
  const root = BASE_FREQ / 2;
  const chord = [1, 5 / 4, 3 / 2, 15 / 8]; // 大七和弦
  chord.forEach((ratio, i) => {
    for (const detune of [-6, 7]) {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? "triangle" : "sine";
      osc.frequency.value = root * ratio;
      osc.detune.value = detune;
      const g = envGain(0.12, 0.08, 1.8, i * 0.05);
      osc.connect(g).connect(master);
      osc.start(now);
      osc.stop(now + 2.2);
    }
  });
  const dust = noiseSource(1.2);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(700, now);
  bp.frequency.exponentialRampToValueAtTime(4200, now + 1.4);
  bp.Q.value = 3;
  const dg = envGain(0.1, 0.12, 1.4);
  dust.connect(bp).connect(dg).connect(master);
  dust.start(now);
  dust.stop(now + 1.8);
}

// 8. 阵风：带通扫过的噪声涌
function playGust() {
  if (!ctx) return;
  const now = ctx.currentTime;
  const src = noiseSource(0.85);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(320, now);
  bp.frequency.exponentialRampToValueAtTime(1500, now + 0.5);
  bp.frequency.exponentialRampToValueAtTime(260, now + 1.3);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.16, now + 0.45);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
  src.connect(bp).connect(g).connect(master);
  src.start(now);
  src.stop(now + 1.5);
}

function playClick(freq = 320, gain = 0.1) {
  if (ctx) woodClick(0, gain, freq);
}

function playWrong() {
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const detune of [-14, 11]) {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(196, now);
    osc.frequency.exponentialRampToValueAtTime(104, now + 0.28);
    osc.detune.value = detune;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 620;
    const g = envGain(0.16, 0.01, 0.3);
    osc.connect(lp).connect(g).connect(master);
    osc.start(now);
    osc.stop(now + 0.4);
  }
}

function playWin() {
  if (!ctx) return;
  const now = ctx.currentTime;
  [0, 4, 7, 12].forEach((semi, i) => {
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = BASE_FREQ * 2 ** (semi / 12);
    const g = envGain(0.14, 0.01, 0.5, i * 0.08);
    osc.connect(g).connect(master);
    osc.start(now + i * 0.08);
    osc.stop(now + i * 0.08 + 0.7);
  });
}

// ---------------------------------------------------------------- 事件入口

export function playEvent(type, payload = {}) {
  if (!ready()) return;
  try {
    switch (type) {
      case "pull":
        playPull(payload.intensity ?? 1);
        break;
      case "stack":
        playStack(payload.slot === 0 ? -1 : payload.slot === 2 ? 1 : 0);
        break;
      case "clack": {
        const now = ctx.currentTime;
        if (now - lastClack > 0.12) {
          lastClack = now;
          woodClick(0, 0.09, 520 + Math.random() * 180);
        }
        break;
      }
      case "creak":
        playCreak(payload.danger ?? 0.4);
        break;
      case "collapse":
        playCollapse();
        break;
      case "streak":
        playStreak(payload.streak ?? 1);
        break;
      case "spire":
        playSpire();
        break;
      case "gust":
        playGust();
        break;
      case "wrong":
        playWrong();
        break;
      case "correct":
        playStreak(1);
        playClick(880, 0.08);
        break;
      case "win":
        playWin();
        break;
      case "blocked":
        playWrong();
        break;
      case "ui_click":
        playClick(340, 0.08);
        break;
      default:
        break;
    }
  } catch {
    /* 音频异常绝不影响对局 */
  }
}

export function closeAudio() {
  try {
    if (ctx) ctx.close?.();
  } catch {
    /* 忽略 */
  }
  ctx = null;
  master = null;
  noiseBuffer = null;
}
