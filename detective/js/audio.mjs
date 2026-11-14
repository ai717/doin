// 专属音色：全部由 WebAudio 现场合成，零音频文件。
// 材质思路：纸张靠噪声 + 带通，印章靠低频失谐下潜 + 噪声脉冲，
// 金属靠高频双正弦，顿悟靠 FM 马林巴大七和弦，结案靠木槌三响 + 铜管余音。
// 任何 AudioParam 一律走 .value 与调度方法（只读属性直接赋值会在严格模式抛错）。

let ctx = null;
let enabled = true;
let noiseBuffer = null;
let lastStretch = 0;

function audioContext() {
  if (ctx) return ctx;
  try {
    const Ctor = typeof window !== "undefined" ? window.AudioContext || window.webkitAudioContext : null;
    if (!Ctor) return null;
    ctx = new Ctor();
  } catch {
    ctx = null;
  }
  return ctx;
}

function noise(ac) {
  if (noiseBuffer) return noiseBuffer;
  const length = Math.floor(ac.sampleRate * 0.6);
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    last = 0.86 * last + 0.14 * white;
    data[i] = last;
  }
  noiseBuffer = buffer;
  return buffer;
}

function gainNode(ac, value) {
  const gain = ac.createGain();
  gain.gain.value = value;
  return gain;
}

function noiseSource(ac, when) {
  const source = ac.createBufferSource();
  source.buffer = noise(ac);
  source.loop = true;
  source.start(when);
  return source;
}

function decay(ac, gain, when, peak, attack, release) {
  const g = gain.gain;
  g.setValueAtTime(0.0001, when);
  g.linearRampToValueAtTime(peak, when + attack);
  g.exponentialRampToValueAtTime(0.0001, when + attack + release);
}

export function setEnabled(on) {
  enabled = Boolean(on);
  if (!enabled && ctx && typeof ctx.suspend === "function") {
    try {
      ctx.resume?.();
    } catch {
      // 忽略：静音不需要状态保证。
    }
  }
  return enabled;
}

export function isEnabled() {
  return enabled;
}

export function unlock() {
  const ac = audioContext();
  if (ac && typeof ac.resume === "function" && ac.state === "suspended") {
    try {
      ac.resume();
    } catch {
      // 用户手势之前无法恢复，静默等待下一次点击。
    }
  }
}

/** 印章落下：次声下潜 + 纸张受压的闷响。 */
export function stamp() {
  const ac = audioContext();
  if (!ac || !enabled) return;
  try {
    const when = ac.currentTime + 0.005;
    const body = ac.createOscillator();
    body.type = "sine";
    body.frequency.setValueAtTime(120, when);
    body.frequency.exponentialRampToValueAtTime(42, when + 0.16);
    const bodyGain = gainNode(ac, 0.0001);
    decay(ac, bodyGain, when, 0.5, 0.006, 0.23);
    body.connect(bodyGain).connect(ac.destination);
    body.start(when);
    body.stop(when + 0.3);

    const slap = noiseSource(ac, when);
    const filter = ac.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    const slapGain = gainNode(ac, 0.0001);
    decay(ac, slapGain, when, 0.35, 0.004, 0.09);
    slap.connect(filter).connect(slapGain).connect(ac.destination);
    slap.stop(when + 0.14);
  } catch {
    // 音效只是装点，坏节点不许打断落印。
  }
}

/** 纸页翻动：干燥的沙沙声。 */
export function paper() {
  const ac = audioContext();
  if (!ac || !enabled) return;
  try {
    const when = ac.currentTime + 0.004;
    const src = noiseSource(ac, when);
    const band = ac.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.setValueAtTime(1300, when);
    band.frequency.linearRampToValueAtTime(3100, when + 0.14);
    band.Q.value = 1.2;
    const env = gainNode(ac, 0.0001);
    const g = env.gain;
    g.setValueAtTime(0.0001, when);
    g.linearRampToValueAtTime(0.18, when + 0.03);
    g.linearRampToValueAtTime(0.06, when + 0.1);
    g.exponentialRampToValueAtTime(0.0001, when + 0.22);
    src.connect(band).connect(env).connect(ac.destination);
    src.stop(when + 0.26);
  } catch {
    // ignore
  }
}

/** 黄铜回形针 / 物证袋的金属轻响。 */
export function clip() {
  const ac = audioContext();
  if (!ac || !enabled) return;
  try {
    const when = ac.currentTime + 0.003;
    const mix = gainNode(ac, 0.0001);
    decay(ac, mix, when, 0.16, 0.002, 0.14);
    mix.connect(ac.destination);
    for (const freq of [2410, 2480]) {
      const osc = ac.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(mix);
      osc.start(when);
      osc.stop(when + 0.16);
    }
  } catch {
    // ignore
  }
}

/** 线索互斥：低音锯齿突然塌下去。 */
export function jolt() {
  const ac = audioContext();
  if (!ac || !enabled) return;
  try {
    const when = ac.currentTime + 0.004;
    const osc = ac.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(186, when);
    osc.frequency.exponentialRampToValueAtTime(74, when + 0.26);
    const notch = ac.createBiquadFilter();
    notch.type = "bandstop";
    notch.frequency.value = 420;
    notch.Q.value = 6;
    const env = gainNode(ac, 0.0001);
    decay(ac, env, when, 0.14, 0.01, 0.28);
    osc.connect(notch).connect(env).connect(ac.destination);
    osc.start(when);
    osc.stop(when + 0.32);
  } catch {
    // ignore
  }
}

/** 逻辑贯通：FM 马林巴奏 Cmaj7 上行。 */
export function eureka() {
  const ac = audioContext();
  if (!ac || !enabled) return;
  try {
    const base = ac.currentTime + 0.01;
    const notes = [261.63, 329.63, 392.0, 493.88];
    notes.forEach((freq, index) => {
      const when = base + index * 0.075;
      const carrier = ac.createOscillator();
      carrier.type = "sine";
      carrier.frequency.value = freq;
      const mod = ac.createOscillator();
      mod.type = "sine";
      mod.frequency.value = freq * 3.02;
      const modGain = gainNode(ac, freq * 1.1);
      mod.connect(modGain).connect(carrier.frequency);
      const env = gainNode(ac, 0.0001);
      decay(ac, env, when, 0.2, 0.005, 0.5);
      carrier.connect(env).connect(ac.destination);
      carrier.start(when);
      mod.start(when);
      carrier.stop(when + 0.56);
      mod.stop(when + 0.56);
    });
  } catch {
    // ignore
  }
}

/** 结案：木槌三响 + 低音铜管余音。 */
export function fanfare() {
  const ac = audioContext();
  if (!ac || !enabled) return;
  try {
    const base = ac.currentTime + 0.02;
    [0, 0.18, 0.36].forEach((offset, index) => {
      const when = base + offset;
      const osc = ac.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(96 - index * 6, when);
      osc.frequency.exponentialRampToValueAtTime(44, when + 0.12);
      const env = gainNode(ac, 0.0001);
      decay(ac, env, when, 0.3 - index * 0.05, 0.004, 0.16);
      osc.connect(env).connect(ac.destination);
      osc.start(when);
      osc.stop(when + 0.2);
    });
    const horn = ac.createOscillator();
    horn.type = "sawtooth";
    horn.frequency.setValueAtTime(146.83, base + 0.4);
    horn.frequency.linearRampToValueAtTime(196.0, base + 0.9);
    const hornFilter = ac.createBiquadFilter();
    hornFilter.type = "lowpass";
    hornFilter.frequency.value = 1100;
    const hornEnv = gainNode(ac, 0.0001);
    const g = hornEnv.gain;
    g.setValueAtTime(0.0001, base + 0.4);
    g.linearRampToValueAtTime(0.18, base + 0.52);
    g.exponentialRampToValueAtTime(0.0001, base + 1.5);
    horn.connect(hornFilter).connect(hornEnv).connect(ac.destination);
    horn.start(base + 0.4);
    horn.stop(base + 1.55);
  } catch {
    // ignore
  }
}

/** 按钮：干涩的木质轻叩。 */
export function click() {
  const ac = audioContext();
  if (!ac || !enabled) return;
  try {
    const when = ac.currentTime + 0.002;
    const src = noiseSource(ac, when);
    const band = ac.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 1700;
    band.Q.value = 3.4;
    const env = gainNode(ac, 0.0001);
    decay(ac, env, when, 0.12, 0.002, 0.05);
    src.connect(band).connect(env).connect(ac.destination);
    src.stop(when + 0.08);
  } catch {
    // ignore
  }
}

/** 换案时的长纸声，兼作节流。 */
export function stretch(intensity = 1) {
  const ac = audioContext();
  if (!ac || !enabled) return;
  const now = ac.currentTime;
  if (now - lastStretch < 0.18) return;
  lastStretch = now;
  try {
    const when = now + 0.002;
    const src = noiseSource(ac, when);
    const band = ac.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.setValueAtTime(700 + 600 * Math.min(1, intensity), when);
    band.Q.value = 0.9;
    const env = gainNode(ac, 0.0001);
    decay(ac, env, when, 0.12, 0.02, 0.2);
    src.connect(band).connect(env).connect(ac.destination);
    src.stop(when + 0.24);
  } catch {
    // ignore
  }
}
