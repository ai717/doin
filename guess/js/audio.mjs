// audio.mjs —— WebAudio 程序化合成音效（零外部音频文件），手势解锁，不支持时静默降级
// 回波用左右声像表达方向：目标更大 → 右舷，更小 → 左舷，听觉本身就携带信息。

let ctx = null;
let master = null;
let muted = false;
let broken = false;

function ensure() {
  if (broken) return null;
  if (ctx) return ctx;
  try {
    const AC = typeof window !== "undefined" ? window.AudioContext || window.webkitAudioContext : null;
    if (!AC) {
      broken = true;
      return null;
    }
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
  } catch {
    broken = true;
    ctx = null;
  }
  return ctx;
}

export function unlock() {
  const c = ensure();
  if (!c) return;
  try {
    if (c.state === "suspended") c.resume();
  } catch {
    // 静默
  }
}

export function setMuted(value) {
  muted = value === true;
  if (master) master.gain.value = muted ? 0 : 0.32;
}

export function isMuted() {
  return muted;
}

function env(node, { attack = 0.01, hold = 0.05, release = 0.18, peak = 0.6 } = {}) {
  const c = ensure();
  if (!c) return;
  const t = c.currentTime;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  g.gain.setValueAtTime(Math.max(0.0002, peak), t + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  node.connect(g);
  const out = c.createStereoPanner ? c.createStereoPanner() : null;
  if (out) {
    g.connect(out);
    out.connect(master);
    return out;
  }
  g.connect(master);
  return null;
}

function tone({ freq = 440, type = "sine", dur = 0.2, peak = 0.5, pan = 0, sweep = 0 } = {}) {
  const c = ensure();
  if (!c || muted) return;
  const osc = c.createOscillator();
  osc.type = type;
  const t = c.currentTime;
  osc.frequency.setValueAtTime(freq, t);
  if (sweep) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + sweep), t + dur);
  const panner = env(osc, { attack: 0.012, hold: dur * 0.35, release: dur * 0.6, peak });
  if (panner && panner.pan) panner.pan.value = Math.max(-1, Math.min(1, pan));
  osc.start(t);
  osc.stop(t + dur + 0.4);
}

function noiseBurst({ dur = 0.12, peak = 0.25, pan = 0 } = {}) {
  const c = ensure();
  if (!c || muted) return;
  const frames = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, frames, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = c.createBufferSource();
  src.buffer = buf;
  const panner = env(src, { attack: 0.005, hold: dur * 0.2, release: dur * 0.8, peak });
  if (panner && panner.pan) panner.pan.value = Math.max(-1, Math.min(1, pan));
  src.start();
}

/** 投掷浮标：低频入水「咚」 */
export function playCast() {
  tone({ freq: 168, type: "sine", dur: 0.26, peak: 0.5, sweep: -70 });
  noiseBurst({ dur: 0.09, peak: 0.12 });
}

/** 回波：声像左右表达方向，温度越高音越亮 */
export function playEcho(dir, temp) {
  const pan = dir === "higher" ? 0.65 : dir === "lower" ? -0.65 : 0;
  const base = temp === "hot" ? 720 : temp === "warm" ? 560 : 430;
  if (dir === null || dir === undefined) {
    noiseBurst({ dur: 0.16, peak: 0.16 });
    tone({ freq: 220, type: "triangle", dur: 0.14, peak: 0.18 });
    return;
  }
  tone({ freq: base, type: "triangle", dur: 0.16, peak: 0.42, pan });
  if (temp === "hot") tone({ freq: base * 1.5, type: "sine", dur: 0.12, peak: 0.22, pan });
}

/** 命中：上行三音 + 气泡尾音 */
export function playHit() {
  [523, 659, 880].forEach((f, i) => setTimeout(() => tone({ freq: f, type: "triangle", dur: 0.22, peak: 0.5 }), i * 90));
  setTimeout(() => noiseBurst({ dur: 0.3, peak: 0.1 }), 260);
}

export function playLose() {
  [330, 262, 196].forEach((f, i) => setTimeout(() => tone({ freq: f, type: "sine", dur: 0.3, peak: 0.4 }), i * 130));
}

export function playTool(kind) {
  if (kind === "probe") tone({ freq: 880, type: "sine", dur: 0.14, peak: 0.3, sweep: 260 });
  else if (kind === "scan") tone({ freq: 420, type: "sawtooth", dur: 0.2, peak: 0.2, sweep: 380 });
  else tone({ freq: 300, type: "triangle", dur: 0.12, peak: 0.25, sweep: -120 });
}

export function playUi() {
  tone({ freq: 620, type: "square", dur: 0.06, peak: 0.14 });
}

export function playReject() {
  tone({ freq: 140, type: "sawtooth", dur: 0.12, peak: 0.22 });
}
