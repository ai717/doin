// 专属音色：全部由 WebAudio 现场合成，零音频文件。
// 材质思路（微缩城市沙盘 + 桌面棋盘）：
//   掷骰 = 木壳骰子在桌面滚动的闷响（噪声脉冲 + 低通 + 木质敲击序列）
//   买地 = 橡皮图章「嘭」+ 纸面摩擦尾音
//   收租 = 硬币落铁盒（失谐双振荡器金属泛音 + 高频噪声点缀）
//   陷阱 = 弹簧「嘣」+ 滑稽下坠滑音
//   破产 = 低沉警铃两声 + 玻璃碎裂
//   胜利 = FM 编钟上行琶音 + 礼花噼啪
// AudioParam 一律走 .value 与调度方法，只读属性直接赋值会抛错。

let ctx = null;
let enabled = true;
let noiseBuffer = null;
let lastHop = 0;

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
  const length = Math.floor(ac.sampleRate * 0.7);
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    last = 0.84 * last + 0.16 * white;
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

function noiseSource(ac, when, duration = 0.5) {
  const source = ac.createBufferSource();
  source.buffer = noise(ac);
  source.loop = true;
  source.start(when);
  source.stop(when + duration);
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

/** 掷骰：木壳骰子在桌面上滚动的三连闷响。 */
export function diceRoll() {
  const ac = audioContext();
  if (!ac || !enabled) return;
  try {
    const base = ac.currentTime + 0.01;
    const knocks = [0, 0.14, 0.24, 0.31];
    knocks.forEach((offset, index) => {
      const when = base + offset;
      const body = ac.createOscillator();
      body.type = "triangle";
      body.frequency.setValueAtTime(190 - index * 22, when);
      body.frequency.exponentialRampToValueAtTime(90 - index * 10, when + 0.07);
      const env = gainNode(ac, 0.0001);
      decay(ac, env, when, 0.34 - index * 0.05, 0.004, 0.09);
      body.connect(env).connect(ac.destination);
      body.start(when);
      body.stop(when + 0.12);

      const clack = noiseSource(ac, when, 0.1);
      const band = ac.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = 1500 + index * 250;
      band.Q.value = 2.2;
      const clackEnv = gainNode(ac, 0.0001);
      decay(ac, clackEnv, when, 0.16 - index * 0.02, 0.002, 0.05);
      clack.connect(band).connect(clackEnv).connect(ac.destination);
    });
  } catch {
    // 音效只是装点。
  }
}

/** 棋子跳格：轻快的小沙锤。 */
export function hop() {
  const ac = audioContext();
  if (!ac || !enabled) return;
  const now = ac.currentTime;
  if (now - lastHop < 0.07) return;
  lastHop = now;
  try {
    const when = now + 0.002;
    const src = noiseSource(ac, when, 0.08);
    const band = ac.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 2400;
    band.Q.value = 3;
    const env = gainNode(ac, 0.0001);
    decay(ac, env, when, 0.1, 0.002, 0.05);
    src.connect(band).connect(env).connect(ac.destination);
  } catch {
    // ignore
  }
}

/** 买地盖章：橡皮图章「嘭」+ 纸面摩擦。 */
export function stamp() {
  const ac = audioContext();
  if (!ac || !enabled) return;
  try {
    const when = ac.currentTime + 0.005;
    const body = ac.createOscillator();
    body.type = "sine";
    body.frequency.setValueAtTime(150, when);
    body.frequency.exponentialRampToValueAtTime(48, when + 0.14);
    const env = gainNode(ac, 0.0001);
    decay(ac, env, when, 0.5, 0.005, 0.2);
    body.connect(env).connect(ac.destination);
    body.start(when);
    body.stop(when + 0.26);

    const slap = noiseSource(ac, when, 0.2);
    const low = ac.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = 1100;
    const slapEnv = gainNode(ac, 0.0001);
    decay(ac, slapEnv, when, 0.3, 0.003, 0.08);
    slap.connect(low).connect(slapEnv).connect(ac.destination);

    const rub = noiseSource(ac, when + 0.06, 0.2);
    const band = ac.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.setValueAtTime(2600, when + 0.06);
    band.frequency.linearRampToValueAtTime(900, when + 0.2);
    band.Q.value = 1.1;
    const rubEnv = gainNode(ac, 0.0001);
    rubEnv.gain.setValueAtTime(0.0001, when + 0.06);
    rubEnv.gain.linearRampToValueAtTime(0.1, when + 0.1);
    rubEnv.gain.exponentialRampToValueAtTime(0.0001, when + 0.24);
    rub.connect(band).connect(rubEnv).connect(ac.destination);
  } catch {
    // ignore
  }
}

/** 收租进账：硬币叮当落铁盒（失谐双振荡器 + 高频噪声）。 */
export function coins(pitch = 1) {
  const ac = audioContext();
  if (!ac || !enabled) return;
  try {
    const base = ac.currentTime + 0.005;
    const partials = [1568, 2093, 2637];
    partials.forEach((freq, index) => {
      const when = base + index * 0.06;
      const oscA = ac.createOscillator();
      oscA.type = "sine";
      oscA.frequency.value = freq * pitch;
      const oscB = ac.createOscillator();
      oscB.type = "sine";
      oscB.frequency.value = freq * pitch * 1.007;
      const env = gainNode(ac, 0.0001);
      decay(ac, env, when, 0.16 - index * 0.03, 0.002, 0.22);
      oscA.connect(env);
      oscB.connect(env);
      env.connect(ac.destination);
      oscA.start(when);
      oscB.start(when);
      oscA.stop(when + 0.3);
      oscB.stop(when + 0.3);
    });
    const shimmer = noiseSource(ac, base, 0.16);
    const high = ac.createBiquadFilter();
    high.type = "highpass";
    high.frequency.value = 5200;
    const shimEnv = gainNode(ac, 0.0001);
    decay(ac, shimEnv, base, 0.06, 0.003, 0.12);
    shimmer.connect(high).connect(shimEnv).connect(ac.destination);
  } catch {
    // ignore
  }
}

/** 交租出账：下行短滑音。 */
export function payOut() {
  const ac = audioContext();
  if (!ac || !enabled) return;
  try {
    const when = ac.currentTime + 0.004;
    const osc = ac.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(660, when);
    osc.frequency.exponentialRampToValueAtTime(240, when + 0.16);
    const env = gainNode(ac, 0.0001);
    decay(ac, env, when, 0.14, 0.004, 0.14);
    osc.connect(env).connect(ac.destination);
    osc.start(when);
    osc.stop(when + 0.22);
  } catch {
    // ignore
  }
}

/** 陷阱触发：弹簧「嘣」+ 滑稽下坠。 */
export function spring() {
  const ac = audioContext();
  if (!ac || !enabled) return;
  try {
    const when = ac.currentTime + 0.004;
    const boing = ac.createOscillator();
    boing.type = "sawtooth";
    boing.frequency.setValueAtTime(110, when);
    boing.frequency.exponentialRampToValueAtTime(330, when + 0.08);
    boing.frequency.exponentialRampToValueAtTime(70, when + 0.34);
    const wobble = ac.createOscillator();
    wobble.type = "sine";
    wobble.frequency.value = 13;
    const wobbleGain = gainNode(ac, 26);
    wobble.connect(wobbleGain).connect(boing.frequency);
    const env = gainNode(ac, 0.0001);
    decay(ac, env, when, 0.2, 0.008, 0.3);
    const low = ac.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = 1200;
    boing.connect(low).connect(env).connect(ac.destination);
    boing.start(when);
    wobble.start(when);
    boing.stop(when + 0.4);
    wobble.stop(when + 0.4);
  } catch {
    // ignore
  }
}

/** 用卡：纸牌抽出的沙沙 + 干脆的拍击。 */
export function cardSwish() {
  const ac = audioContext();
  if (!ac || !enabled) return;
  try {
    const when = ac.currentTime + 0.003;
    const src = noiseSource(ac, when, 0.18);
    const band = ac.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.setValueAtTime(1900, when);
    band.frequency.linearRampToValueAtTime(3600, when + 0.1);
    band.Q.value = 1.4;
    const env = gainNode(ac, 0.0001);
    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(0.16, when + 0.04);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.2);
    src.connect(band).connect(env).connect(ac.destination);
    const tick = ac.createOscillator();
    tick.type = "square";
    tick.frequency.value = 2100;
    const tickEnv = gainNode(ac, 0.0001);
    decay(ac, tickEnv, when + 0.12, 0.08, 0.002, 0.03);
    tick.connect(tickEnv).connect(ac.destination);
    tick.start(when + 0.12);
    tick.stop(when + 0.2);
  } catch {
    // ignore
  }
}

/** 道具店小铃铛：FM 亮铃两声。 */
export function shopBell() {
  const ac = audioContext();
  if (!ac || !enabled) return;
  try {
    const base = ac.currentTime + 0.01;
    [880, 1174.7].forEach((freq, index) => {
      const when = base + index * 0.12;
      const carrier = ac.createOscillator();
      carrier.type = "sine";
      carrier.frequency.value = freq;
      const mod = ac.createOscillator();
      mod.type = "sine";
      mod.frequency.value = freq * 2.41;
      const modGain = gainNode(ac, freq * 0.8);
      mod.connect(modGain).connect(carrier.frequency);
      const env = gainNode(ac, 0.0001);
      decay(ac, env, when, 0.16, 0.004, 0.4);
      carrier.connect(env).connect(ac.destination);
      carrier.start(when);
      mod.start(when);
      carrier.stop(when + 0.5);
      mod.stop(when + 0.5);
    });
  } catch {
    // ignore
  }
}

/** 破产警报：低沉警铃两声 + 玻璃碎裂轻响。 */
export function bankruptAlarm() {
  const ac = audioContext();
  if (!ac || !enabled) return;
  try {
    const base = ac.currentTime + 0.01;
    [0, 0.34].forEach((offset) => {
      const when = base + offset;
      const bell = ac.createOscillator();
      bell.type = "square";
      bell.frequency.value = 196;
      const mod = ac.createOscillator();
      mod.type = "sine";
      mod.frequency.value = 392;
      const modGain = gainNode(ac, 60);
      mod.connect(modGain).connect(bell.frequency);
      const env = gainNode(ac, 0.0001);
      decay(ac, env, when, 0.22, 0.006, 0.24);
      const low = ac.createBiquadFilter();
      low.type = "lowpass";
      low.frequency.value = 900;
      bell.connect(low).connect(env).connect(ac.destination);
      bell.start(when);
      mod.start(when);
      bell.stop(when + 0.3);
      mod.stop(when + 0.3);
    });
    const crash = noiseSource(ac, base + 0.5, 0.3);
    const glass = ac.createBiquadFilter();
    glass.type = "highpass";
    glass.frequency.value = 3400;
    const glassEnv = gainNode(ac, 0.0001);
    glassEnv.gain.setValueAtTime(0.0001, base + 0.5);
    glassEnv.gain.linearRampToValueAtTime(0.12, base + 0.52);
    glassEnv.gain.exponentialRampToValueAtTime(0.0001, base + 0.78);
    crash.connect(glass).connect(glassEnv).connect(ac.destination);
  } catch {
    // ignore
  }
}

/** 胜利：FM 编钟上行琶音 + 礼花噼啪。 */
export function victory() {
  const ac = audioContext();
  if (!ac || !enabled) return;
  try {
    const base = ac.currentTime + 0.02;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((freq, index) => {
      const when = base + index * 0.09;
      const carrier = ac.createOscillator();
      carrier.type = "sine";
      carrier.frequency.value = freq;
      const mod = ac.createOscillator();
      mod.type = "sine";
      mod.frequency.value = freq * 2.01;
      const modGain = gainNode(ac, freq * 0.9);
      mod.connect(modGain).connect(carrier.frequency);
      const env = gainNode(ac, 0.0001);
      decay(ac, env, when, 0.18, 0.005, 0.6);
      carrier.connect(env).connect(ac.destination);
      carrier.start(when);
      mod.start(when);
      carrier.stop(when + 0.7);
      mod.stop(when + 0.7);
    });
    const sparkle = noiseSource(ac, base + 0.5, 0.9);
    const crackle = ac.createBiquadFilter();
    crackle.type = "highpass";
    crackle.frequency.value = 4200;
    const crackleEnv = gainNode(ac, 0.0001);
    crackleEnv.gain.setValueAtTime(0.0001, base + 0.5);
    crackleEnv.gain.linearRampToValueAtTime(0.07, base + 0.62);
    crackleEnv.gain.linearRampToValueAtTime(0.03, base + 1.0);
    crackleEnv.gain.exponentialRampToValueAtTime(0.0001, base + 1.35);
    sparkle.connect(crackle).connect(crackleEnv).connect(ac.destination);
  } catch {
    // ignore
  }
}

/** 失利：下行小调三音。 */
export function defeat() {
  const ac = audioContext();
  if (!ac || !enabled) return;
  try {
    const base = ac.currentTime + 0.02;
    [392, 329.63, 261.63].forEach((freq, index) => {
      const when = base + index * 0.16;
      const osc = ac.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const env = gainNode(ac, 0.0001);
      decay(ac, env, when, 0.16, 0.01, 0.3);
      osc.connect(env).connect(ac.destination);
      osc.start(when);
      osc.stop(when + 0.36);
    });
  } catch {
    // ignore
  }
}

/** 通用按钮：干燥的木质轻叩。 */
export function click() {
  const ac = audioContext();
  if (!ac || !enabled) return;
  try {
    const when = ac.currentTime + 0.002;
    const src = noiseSource(ac, when, 0.06);
    const band = ac.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 1750;
    band.Q.value = 3.2;
    const env = gainNode(ac, 0.0001);
    decay(ac, env, when, 0.11, 0.002, 0.04);
    src.connect(band).connect(env).connect(ac.destination);
  } catch {
    // ignore
  }
}

/** 掷骰落定后的轻脆提示。 */
export function diceSettle() {
  const ac = audioContext();
  if (!ac || !enabled) return;
  try {
    const when = ac.currentTime + 0.004;
    const osc = ac.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(920, when);
    osc.frequency.exponentialRampToValueAtTime(620, when + 0.1);
    const env = gainNode(ac, 0.0001);
    decay(ac, env, when, 0.12, 0.003, 0.12);
    osc.connect(env).connect(ac.destination);
    osc.start(when);
    osc.stop(when + 0.18);
  } catch {
    // ignore
  }
}
