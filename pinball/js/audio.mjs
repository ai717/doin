// 霓虹弹珠台 · WebAudio 程序化合成音效（零外部音频文件，手势解锁，静默降级）

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
      master.gain.value = 0.32;
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
  if (master) master.gain.value = on ? 0.32 : 0;
}

export function isAudioEnabled() {
  return enabled;
}

function tone(freq, type, dur, gain = 0.5, slideTo = null) {
  if (!ctx || !master || !enabled) return;
  try {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  } catch {
    /* 音频失败静默 */
  }
}

function noise(dur, gain = 0.2, filterFreq = 3000) {
  if (!ctx || !master || !enabled) return;
  try {
    const t = ctx.currentTime;
    const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = filterFreq;
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

// ---- 事件音效映射 ----
export function playEvent(type, event = {}) {
  switch (type) {
    case "launched":
      tone(220, "sawtooth", 0.18, 0.4, 520);
      break;
    case "flipper_hit":
      noise(0.05, 0.35, 900);
      tone(520, "square", 0.06, 0.3);
      break;
    case "wall_hit":
      tone(240, "sine", 0.05, 0.2);
      break;
    case "brick_hit":
      tone(480 + (event.tier === "S" ? 80 : 0) + (event.tier === "A" ? -60 : 0), "triangle", 0.05, 0.18);
      break;
    case "brick_broken":
      if (event.tier === "G") noise(0.12, 0.3, 4200);
      else if (event.tier === "S") { noise(0.14, 0.35, 1800); tone(320, "square", 0.1, 0.25); }
      else { noise(0.18, 0.4, 700); tone(180, "sine", 0.16, 0.4); tone(2400, "sine", 0.2, 0.2); }
      break;
    case "bumper":
      tone(720, "sine", 0.08, 0.45);
      break;
    case "sling":
      tone(300, "sawtooth", 0.12, 0.35, 640);
      break;
    case "target_down":
      tone(640, "square", 0.07, 0.3);
      break;
    case "all_targets":
      tone(880, "square", 0.1, 0.35);
      setTimeout(() => tone(1320, "square", 0.14, 0.3), 90);
      break;
    case "spinner":
      tone(980, "sine", 0.08, 0.25);
      break;
    case "rollover":
      tone(1100, "sine", 0.09, 0.3);
      break;
    case "ramp":
      tone(440, "sawtooth", 0.2, 0.35, 1320);
      break;
    case "combo_up":
      tone(420 + Math.min(event.combo || 0, 24) * 45, "square", 0.06, 0.22);
      break;
    case "combo_reset":
      tone(180, "sine", 0.15, 0.3, 90);
      break;
    case "effect":
      if (event.effect === "multiball") { tone(1200, "sine", 0.15, 0.4); setTimeout(() => tone(1500, "sine", 0.18, 0.4), 110); }
      else if (event.effect === "storm") { noise(0.4, 0.4, 400); tone(90, "sine", 0.4, 0.4, 200); }
      else if (event.effect === "frenzy") { tone(660, "square", 0.12, 0.35); setTimeout(() => tone(880, "square", 0.12, 0.35), 100); }
      else if (event.effect === "save") { tone(500, "sine", 0.3, 0.35, 1000); }
      break;
    case "storm_row":
      noise(0.25, 0.3, 500);
      break;
    case "ball_saved":
      tone(600, "sine", 0.25, 0.4, 1200);
      break;
    case "ball_restored":
      tone(520, "sine", 0.2, 0.4, 780);
      break;
    case "drain":
      tone(260, "sine", 0.3, 0.4, 80);
      break;
    case "nudge":
      noise(0.08, 0.3, 2000);
      break;
    case "stage_clear":
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, "square", 0.18, 0.35), i * 110));
      break;
    case "stage_fail":
      [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, "triangle", 0.22, 0.35), i * 160));
      break;
    case "game_over":
      [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, "triangle", 0.25, 0.35), i * 170));
      break;
    case "pause_toggled":
      tone(440, "sine", 0.07, 0.2);
      break;
    default:
      break;
  }
}
