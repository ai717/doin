// 莓园打地鼠 — WebAudio 程序化合成音效（零外部音频文件）

let audioCtx = null;
let masterGain = null;
let unlocked = false;
let muted = false;

const MASTER_VOLUME = 0.32;

function ensureCtx() {
  if (audioCtx) return audioCtx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = muted ? 0 : MASTER_VOLUME;
    masterGain.connect(audioCtx.destination);
    return audioCtx;
  } catch {
    return null;
  }
}

export function unlockAudio() {
  const ctx = ensureCtx();
  if (!ctx) return false;
  if (ctx.state === "suspended") ctx.resume();
  unlocked = true;
  return true;
}

export function setMuted(value) {
  muted = Boolean(value);
  if (masterGain) masterGain.gain.value = muted ? 0 : MASTER_VOLUME;
}

export function isMuted() {
  return muted;
}

function tone({ type = "sine", freq = 440, to = null, dur = 0.2, gain = 0.4, delay = 0 }) {
  const ctx = ensureCtx();
  if (!ctx) return;
  const now = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), now + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(gain, now + 0.008);
  g.gain.exponentialRampToValueAtTime(0.001, now + dur);
  osc.connect(g).connect(masterGain);
  osc.start(now);
  osc.stop(now + dur + 0.02);
}

function noise({ dur = 0.16, gain = 0.3, delay = 0, filterFreq = 1200 }) {
  const ctx = ensureCtx();
  if (!ctx) return;
  const now = ctx.currentTime + delay;
  const frames = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = filterFreq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + dur);
  src.connect(filter).connect(g).connect(masterGain);
  src.start(now);
}

/** 木槌命中：闷响木质"啵" */
export function playWhack(combo = 0) {
  if (!unlocked || muted) return;
  const step = Math.min(11, Math.floor(combo / 3));
  tone({ type: "triangle", freq: 196 * Math.pow(2, step / 12), to: 110, dur: 0.14, gain: 0.5 });
  noise({ dur: 0.1, gain: 0.22, filterFreq: 900 });
}

/** 金鼠：清脆上行叮 */
export function playGold() {
  if (!unlocked || muted) return;
  tone({ type: "sine", freq: 880, dur: 0.18, gain: 0.35 });
  tone({ type: "sine", freq: 1318, dur: 0.22, gain: 0.25, delay: 0.06 });
}

/** 铁盔掀盔：金属 clank */
export function playClank() {
  if (!unlocked || muted) return;
  tone({ type: "square", freq: 320, to: 180, dur: 0.12, gain: 0.22 });
  noise({ dur: 0.08, gain: 0.18, filterFreq: 2600 });
}

/** 炸弹误击：爆响 */
export function playBomb() {
  if (!unlocked || muted) return;
  noise({ dur: 0.4, gain: 0.5, filterFreq: 480 });
  tone({ type: "sawtooth", freq: 120, to: 40, dur: 0.36, gain: 0.3 });
}

/** 漏掉：轻"咻" */
export function playMiss() {
  if (!unlocked || muted) return;
  tone({ type: "sine", freq: 520, to: 240, dur: 0.16, gain: 0.14 });
}

/** 狂热开启：上行琶音 */
export function playFrenzy() {
  if (!unlocked || muted) return;
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
    tone({ type: "triangle", freq, dur: 0.2, gain: 0.3, delay: i * 0.06 });
  });
}

/** 开局 */
export function playStart() {
  if (!unlocked || muted) return;
  tone({ type: "triangle", freq: 440, dur: 0.12, gain: 0.3 });
  tone({ type: "triangle", freq: 660, dur: 0.18, gain: 0.3, delay: 0.1 });
}

/** 结算 */
export function playOver() {
  if (!unlocked || muted) return;
  [659.25, 523.25, 392.0].forEach((freq, i) => {
    tone({ type: "triangle", freq, dur: 0.28, gain: 0.3, delay: i * 0.12 });
  });
}
