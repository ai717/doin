// audio.mjs —— WebAudio 程序化合成音效（零外部音频文件，静默降级）。
// 题材：霓虹积木工坊。六种专属音色，严禁单调蜂鸣器：
//   1. snap   拼块吸附：FM 短音 + 噪声瞬态，软胶"嗒"
//   2. clear  满行消除：噪声串 + 高频扫频玻璃碎裂，多行密度翻倍
//   3. cross  十字共鸣：失谐双振荡器下潜 + 噪声爆发，"嘭—哗"双段
//   4. combo  连击音阶：FM 木琴五声音阶逐级上行
//   5. ambient 霓虹氛围：失谐锯齿波 + LFO 低嗡，随连击强度微升调
//   6. record/over：破纪录明亮琶音；终局低音下滑 + 噪声收束

let ctx = null;
let master = null;
let ambientNodes = null;
let muted = false;

function context() {
  if (ctx) return ctx;
  try {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

/** 噪声缓冲（复用）：白噪声 1s */
let noiseBuffer = null;
function noise(c) {
  if (noiseBuffer) return noiseBuffer;
  const length = Math.floor(c.sampleRate);
  noiseBuffer = c.createBuffer(1, length, c.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  return noiseBuffer;
}

function env(gainNode, t0, peak, attack, decay) {
  const g = gainNode.gain;
  g.setValueAtTime(0.0001, t0);
  g.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + attack);
  g.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
}

function osc(c, type, freq, t0, dur, peak, detune = 0) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (detune) o.detune.setValueAtTime(detune, t0);
  const g = c.createGain();
  env(g, t0, peak, 0.008, dur);
  o.connect(g);
  g.connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.1);
  return o;
}

function noiseBurst(c, t0, dur, peak, filterType, freq, q = 1) {
  const src = c.createBufferSource();
  src.buffer = noise(c);
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.setValueAtTime(freq, t0);
  filter.Q.value = q;
  const g = c.createGain();
  env(g, t0, peak, 0.006, dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.1);
  return { src, filter };
}

function ready() {
  if (muted) return null;
  const c = context();
  if (!c) return null;
  if (c.state === "suspended") c.resume().catch(() => {});
  return c;
}

// ---------------------------------------------------------------- 音效

/** 1. 拼块吸附：FM 短音 + 噪声瞬态，软胶"嗒" */
export function playSnap() {
  const c = ready();
  if (!c) return;
  const t = c.currentTime;
  const carrier = osc(c, "sine", 520, t, 0.12, 0.5);
  const mod = c.createOscillator();
  mod.type = "sine";
  mod.frequency.setValueAtTime(980, t);
  const modGain = c.createGain();
  modGain.gain.setValueAtTime(420, t);
  modGain.gain.exponentialRampToValueAtTime(1, t + 0.09);
  mod.connect(modGain);
  modGain.connect(carrier.frequency);
  mod.start(t);
  mod.stop(t + 0.2);
  noiseBurst(c, t, 0.05, 0.12, "highpass", 1800);
}

/** 2. 满行消除：玻璃碎裂噪声串 + 高频扫频，多行密度翻倍 */
export function playClear(lines = 1) {
  const c = ready();
  if (!c) return;
  const t = c.currentTime;
  const bursts = Math.min(4, Math.max(1, lines));
  for (let i = 0; i < bursts; i += 1) {
    const at = t + i * 0.07;
    const b = noiseBurst(c, at, 0.28, 0.3, "bandpass", 2600 + i * 500, 2.5);
    b.filter.frequency.exponentialRampToValueAtTime(5200 + i * 900, at + 0.26);
  }
  osc(c, "triangle", 320, t, 0.18, 0.22);
}

/** 3. 十字共鸣：失谐双振荡器下潜 + 噪声爆发，"嘭—哗"双段 */
export function playCross() {
  const c = ready();
  if (!c) return;
  const t = c.currentTime;
  osc(c, "sawtooth", 180, t, 0.3, 0.34, -14);
  osc(c, "sawtooth", 180, t, 0.3, 0.34, 14);
  const o = c.createOscillator();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(220, t);
  o.frequency.exponentialRampToValueAtTime(55, t + 0.32);
  const g = c.createGain();
  env(g, t, 0.4, 0.01, 0.34);
  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + 0.5);
  noiseBurst(c, t + 0.04, 0.4, 0.4, "lowpass", 900, 0.8);
}

/** 4. 连击音阶：FM 木琴五声音阶逐级上行 */
const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760];
export function playCombo(combo = 1) {
  const c = ready();
  if (!c) return;
  const t = c.currentTime;
  const freq = PENTATONIC[Math.min(PENTATONIC.length - 1, Math.max(0, combo - 1))];
  const carrier = osc(c, "sine", freq, t, 0.34, 0.42);
  const mod = c.createOscillator();
  mod.type = "sine";
  mod.frequency.setValueAtTime(freq * 2, t);
  const modGain = c.createGain();
  modGain.gain.setValueAtTime(freq, t);
  modGain.gain.exponentialRampToValueAtTime(1, t + 0.22);
  mod.connect(modGain);
  modGain.connect(carrier.frequency);
  mod.start(t);
  mod.stop(t + 0.4);
  osc(c, "sine", freq * 2, t, 0.2, 0.1);
}

/** 6a. 破纪录：FM 明亮上行琶音 */
export function playRecord() {
  const c = ready();
  if (!c) return;
  const t = c.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
    const at = t + i * 0.09;
    const carrier = osc(c, "sine", freq, at, 0.3, 0.34);
    const mod = c.createOscillator();
    mod.type = "sine";
    mod.frequency.setValueAtTime(freq * 2.5, at);
    const modGain = c.createGain();
    modGain.gain.setValueAtTime(freq * 0.8, at);
    modGain.gain.exponentialRampToValueAtTime(1, at + 0.2);
    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    mod.start(at);
    mod.stop(at + 0.36);
  });
}

/** 6b. 终局：低音下滑 + 噪声收束 */
export function playOver() {
  const c = ready();
  if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = "triangle";
  o.frequency.setValueAtTime(330, t);
  o.frequency.exponentialRampToValueAtTime(65, t + 0.9);
  const g = c.createGain();
  env(g, t, 0.4, 0.02, 0.9);
  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + 1.1);
  const b = noiseBurst(c, t, 0.7, 0.18, "lowpass", 1400, 0.7);
  b.filter.frequency.exponentialRampToValueAtTime(220, t + 0.7);
}

/** UI 微反馈（取块/旋转/按钮）：短促木屑点击 */
export function playUi() {
  const c = ready();
  if (!c) return;
  const t = c.currentTime;
  noiseBurst(c, t, 0.05, 0.1, "bandpass", 2400, 3);
  osc(c, "sine", 740, t, 0.06, 0.12);
}

/** 非法落子警示：两声闷「咚」+ 低频噪团，与 UI 点击音明确区分 */
export function playReject() {
  const c = ready();
  if (!c) return;
  const t = c.currentTime;
  osc(c, "triangle", 180, t, 0.09, 0.22);
  osc(c, "triangle", 120, t + 0.07, 0.11, 0.18);
  noiseBurst(c, t, 0.08, 0.08, "lowpass", 500, 1);
}

// ---------------------------------------------------------------- 氛围

/** 5. 霓虹氛围低嗡：失谐锯齿波 + LFO，连击强度微升调 */
export function startAmbient() {
  const c = ready();
  if (!c || ambientNodes) return;
  try {
    const t = c.currentTime;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.045, t + 1.5);
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 320;
    const a = c.createOscillator();
    a.type = "sawtooth";
    a.frequency.value = 55;
    const b = c.createOscillator();
    b.type = "sawtooth";
    b.frequency.value = 55.4;
    const lfo = c.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.13;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 40;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    a.connect(filter);
    b.connect(filter);
    filter.connect(g);
    g.connect(master);
    a.start(t);
    b.start(t);
    lfo.start(t);
    ambientNodes = { g, filter, a, b, lfo };
  } catch {
    ambientNodes = null;
  }
}

export function setAmbientIntensity(combo = 0) {
  if (!ambientNodes || !ctx) return;
  try {
    const target = 320 + Math.min(8, Math.max(0, combo)) * 60;
    ambientNodes.filter.frequency.setTargetAtTime(target, ctx.currentTime, 0.4);
  } catch {
    /* ignore */
  }
}

export function stopAmbient() {
  if (!ambientNodes || !ctx) return;
  try {
    const t = ctx.currentTime;
    ambientNodes.g.gain.setTargetAtTime(0.0001, t, 0.3);
    const nodes = ambientNodes;
    ambientNodes = null;
    setTimeout(() => {
      try {
        nodes.a.stop();
        nodes.b.stop();
        nodes.lfo.stop();
      } catch {
        /* ignore */
      }
    }, 1200);
  } catch {
    ambientNodes = null;
  }
}

// ---------------------------------------------------------------- 总控

/** 用户手势后解锁音频（移动端要求） */
export function unlock() {
  const c = context();
  if (c && c.state === "suspended") c.resume().catch(() => {});
}

export function setMuted(next) {
  muted = Boolean(next);
  if (master && ctx) {
    master.gain.setTargetAtTime(muted ? 0.0001 : 0.9, ctx.currentTime, 0.05);
  }
  if (muted) stopAmbient();
}

export function isMuted() {
  return muted;
}

export function resetForTests() {
  if (ambientNodes) {
    try {
      ambientNodes.a.stop();
      ambientNodes.b.stop();
      ambientNodes.lfo.stop();
    } catch {
      /* ignore */
    }
  }
  ambientNodes = null;
  muted = false;
  ctx = null;
  master = null;
  noiseBuffer = null;
}
