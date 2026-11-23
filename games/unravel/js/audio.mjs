// unravel audio — procedural WebAudio synth for a yarn workshop.
// Material palette: band-passed noise for wool friction, wood knocks for spools,
// FM bells for merges, soft low thumps for rejects. No external files, no beeps.

let ctx = null;
let master = null;
let noiseBuffer = null;
let muted = false;

function ac() {
  if (typeof window === "undefined" || typeof window.AudioContext === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new window.AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
      const len = Math.floor(ctx.sampleRate * 1.2);
      noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") {
    try {
      ctx.resume();
    } catch {
      /* ignore */
    }
  }
  return ctx;
}

export function unlockAudio() {
  ac();
}

export function setMuted(value) {
  muted = !!value;
  if (master) master.gain.value = muted ? 0 : 0.55;
}

export function isMuted() {
  return muted;
}

function noiseSource(when) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  src.start(when, Math.random() * 0.8);
  return src;
}

function envelope(gainNode, when, attack, hold, release, peak) {
  const g = gainNode.gain;
  g.setValueAtTime(0.0001, when);
  g.exponentialRampToValueAtTime(peak, when + attack);
  g.setValueAtTime(peak, when + attack + hold);
  g.exponentialRampToValueAtTime(0.0001, when + attack + hold + release);
}

// Wool strand being pulled: band-passed friction noise, slight pitch rise.
export function playPull(step = 0) {
  if (!ac()) return;
  const t = ctx.currentTime;
  const src = noiseSource(t);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 5;
  bp.frequency.setValueAtTime(700 + step * 90, t);
  bp.frequency.exponentialRampToValueAtTime(1400 + step * 110, t + 0.28);
  const g = ctx.createGain();
  envelope(g, t, 0.05, 0.16, 0.12, 0.35);
  src.connect(bp).connect(g).connect(master);
  src.stop(t + 0.42);
}

// Wooden spool click: filtered knock plus a short low body resonance.
export function playSpool() {
  if (!ac()) return;
  const t = ctx.currentTime;
  const src = noiseSource(t);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1900;
  bp.Q.value = 2.5;
  const g = ctx.createGain();
  envelope(g, t, 0.004, 0.02, 0.07, 0.5);
  src.connect(bp).connect(g).connect(master);
  src.stop(t + 0.15);
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(170, t);
  osc.frequency.exponentialRampToValueAtTime(120, t + 0.09);
  const og = ctx.createGain();
  envelope(og, t, 0.004, 0.01, 0.08, 0.4);
  osc.connect(og).connect(master);
  osc.start(t);
  osc.stop(t + 0.14);
}

// FM marimba for a merge, plus a soft basket thud.
export function playMerge(complexity = 0) {
  if (!ac()) return;
  const t = ctx.currentTime;
  const base = 523.25 * Math.pow(2, Math.min(complexity, 4) / 12);
  const carrier = ctx.createOscillator();
  carrier.type = "sine";
  carrier.frequency.value = base;
  const mod = ctx.createOscillator();
  mod.type = "sine";
  mod.frequency.value = base * 1.41;
  const modGain = ctx.createGain();
  modGain.gain.setValueAtTime(base * 1.8, t);
  modGain.gain.exponentialRampToValueAtTime(1, t + 0.35);
  mod.connect(modGain).connect(carrier.frequency);
  const g = ctx.createGain();
  envelope(g, t, 0.008, 0.05, 0.45, 0.42);
  carrier.connect(g).connect(master);
  carrier.start(t);
  mod.start(t);
  carrier.stop(t + 0.6);
  mod.stop(t + 0.6);
  const thud = ctx.createOscillator();
  thud.type = "sine";
  thud.frequency.setValueAtTime(140, t + 0.05);
  thud.frequency.exponentialRampToValueAtTime(70, t + 0.22);
  const tg = ctx.createGain();
  envelope(tg, t + 0.05, 0.01, 0.02, 0.18, 0.5);
  thud.connect(tg).connect(master);
  thud.start(t + 0.05);
  thud.stop(t + 0.3);
}

// Gentle low thump for a blocked spool: soft, never harsh.
export function playReject() {
  if (!ac()) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(110, t);
  osc.frequency.exponentialRampToValueAtTime(72, t + 0.14);
  const g = ctx.createGain();
  envelope(g, t, 0.01, 0.03, 0.14, 0.4);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + 0.24);
}

// Knot snapping free: short pluck plus a fibrous tick.
export function playUntie() {
  if (!ac()) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(540, t);
  osc.frequency.exponentialRampToValueAtTime(320, t + 0.09);
  const g = ctx.createGain();
  envelope(g, t, 0.005, 0.02, 0.1, 0.4);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + 0.16);
  const src = noiseSource(t);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 2600;
  const ng = ctx.createGain();
  envelope(ng, t, 0.003, 0.01, 0.05, 0.3);
  src.connect(hp).connect(ng).connect(master);
  src.stop(t + 0.1);
}

// Win: knit friction sweep then a warm ascending bell cluster (non C-E-G-C).
export function playWin() {
  if (!ac()) return;
  const t = ctx.currentTime;
  const src = noiseSource(t);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 3;
  bp.frequency.setValueAtTime(500, t);
  bp.frequency.exponentialRampToValueAtTime(2200, t + 0.5);
  const g = ctx.createGain();
  envelope(g, t, 0.08, 0.25, 0.25, 0.25);
  src.connect(bp).connect(g).connect(master);
  src.stop(t + 0.65);
  const bells = [415.3, 554.37, 622.25, 830.61];
  bells.forEach((freq, i) => {
    const start = t + 0.1 + i * 0.13;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const mod = ctx.createOscillator();
    mod.type = "sine";
    mod.frequency.value = freq * 2.76;
    const mg = ctx.createGain();
    mg.gain.setValueAtTime(freq * 1.2, start);
    mg.gain.exponentialRampToValueAtTime(1, start + 0.4);
    mod.connect(mg).connect(osc.frequency);
    const bg = ctx.createGain();
    envelope(bg, start, 0.01, 0.04, 0.5, 0.3);
    osc.connect(bg).connect(master);
    osc.start(start);
    mod.start(start);
    osc.stop(start + 0.7);
    mod.stop(start + 0.7);
  });
}

// Soft UI tick for drawer and toolbar interactions.
export function playTick() {
  if (!ac()) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = 660;
  const g = ctx.createGain();
  envelope(g, t, 0.003, 0.01, 0.06, 0.18);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + 0.1);
}
