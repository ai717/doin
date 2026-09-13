// 连连看 link-up · Web Audio 程序化合成音效（零外部音频文件）

let ctx = null;
let master = null;
let enabled = true;

function ensure() {
  if (ctx) return ctx;
  const AC = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  try {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
    master = null;
  }
  return ctx;
}

export function unlock() {
  const c = ensure();
  if (c && c.state === "suspended") {
    c.resume().catch(() => {});
  }
}

export function setEnabled(v) {
  enabled = !!v;
}

export function isEnabled() {
  return enabled;
}

function tone({ type = "sine", freq = 440, t0 = 0, dur = 0.12, gain = 0.2, slide = 0 }) {
  const c = ensure();
  if (!c || !enabled) return;
  try {
    const start = c.currentTime + t0;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    if (slide !== 0) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g);
    g.connect(master);
    o.start(start);
    o.stop(start + dur + 0.02);
  } catch {
    // 不支持 / 已关闭时静默降级
  }
}

export const sfx = {
  select: () => tone({ type: "triangle", freq: 660, dur: 0.08, gain: 0.14 }),
  reject: () => tone({ type: "sawtooth", freq: 185, dur: 0.16, gain: 0.1, slide: -70 }),
  line: () => {
    tone({ type: "sine", freq: 880, dur: 0.1, gain: 0.1 });
    tone({ type: "sine", freq: 1175, t0: 0.08, dur: 0.12, gain: 0.1 });
  },
  clear: () => {
    tone({ type: "sine", freq: 1318, dur: 0.12, gain: 0.16 });
    tone({ type: "sine", freq: 1760, t0: 0.05, dur: 0.16, gain: 0.14 });
  },
  win: () => {
    [523, 659, 784, 1046].forEach((f, i) => tone({ type: "triangle", freq: f, t0: i * 0.12, dur: 0.24, gain: 0.16 }));
  },
  shuffle: () => {
    [420, 330, 260].forEach((f, i) => tone({ type: "square", freq: f, t0: i * 0.07, dur: 0.07, gain: 0.05 }));
  },
  tick: () => tone({ type: "sine", freq: 980, dur: 0.05, gain: 0.1 }),
};
