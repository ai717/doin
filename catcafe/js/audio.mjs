// audio.mjs — WebAudio 程序化合成（零外部文件，6 种专属音色）
// 物理噪声滤波 + FM + 失谐双振荡器，杜绝单调正弦波 beep。
// AudioContext 不可用时所有 play* 函数静默 no-op。

let ctx = null;
let isMuted = false;

function getContext() {
  if (ctx) return ctx;
  if (typeof AudioContext === "undefined" && typeof webkitAudioContext === "undefined") {
    return null;
  }
  try {
    const AudioContextClass = typeof AudioContext !== "undefined" ? AudioContext : webkitAudioContext;
    ctx = new AudioContextClass();
  } catch {
    ctx = null;
  }
  return ctx;
}

/**
 * 浏览器自动播放策略：必须在用户手势后 resume 才能播放
 */
export function initAudioOnGesture() {
  const c = getContext();
  if (c && c.state === "suspended") {
    c.resume().catch(() => {});
  }
}

export function setMuted(muted) {
  isMuted = Boolean(muted);
}

export function getMuted() {
  return isMuted;
}

export function toggleMuted() {
  setMuted(!isMuted);
  return isMuted;
}

function safePlay(fn) {
  if (isMuted) return;
  const c = getContext();
  if (!c) return;
  try {
    fn(c);
  } catch {
    // 静默忽略
  }
}

// =========================================================================
// 1. 冲咖啡蒸汽声：白噪声缓冲 + BiquadFilter highpass (>2kHz) + 低速 LFO
// =========================================================================

export function playSteam() {
  safePlay((c) => {
    const t = c.currentTime;
    const dur = 0.35;
    const bufferSize = Math.floor(c.sampleRate * dur);
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = c.createBufferSource();
    noise.buffer = buffer;

    const highpass = c.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.setValueAtTime(2000, t);
    highpass.Q.setValueAtTime(0.7, t);

    // 慢速 LFO 调制让蒸汽声有"嘶嘶"起伏
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.frequency.setValueAtTime(8, t); // 8Hz LFO
    lfoGain.gain.setValueAtTime(400, t); // ±400Hz 调制
    lfo.connect(lfoGain);
    lfoGain.connect(highpass.frequency);

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    noise.connect(highpass);
    highpass.connect(gain);
    gain.connect(c.destination);

    noise.start(t);
    lfo.start(t);
    noise.stop(t + dur);
    lfo.stop(t + dur);
  });
}

// =========================================================================
// 2. 拉花奶泡细腻声：粉噪声 + 带通 800Hz-2kHz + 快速 Attack
// =========================================================================

export function playMilk() {
  safePlay((c) => {
    const t = c.currentTime;
    const dur = 0.18;
    const bufferSize = Math.floor(c.sampleRate * dur);
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    // 粉噪声：低频多高频少（累加相邻样本）
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }

    const noise = c.createBufferSource();
    noise.buffer = buffer;

    const bandpass = c.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.setValueAtTime(1400, t);
    bandpass.Q.setValueAtTime(1.2, t);

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.1, t + 0.01); // 快速 Attack
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    noise.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(c.destination);

    noise.start(t);
    noise.stop(t + dur);
  });
}

// =========================================================================
// 3. 猫咪呼噜治愈音：30Hz + 60Hz 双振荡器失谐 + 长 Attack/Release
// =========================================================================

export function playPurr() {
  safePlay((c) => {
    const t = c.currentTime;
    const dur = 1.0;

    // 30Hz 主频（深喉音）
    const osc1 = c.createOscillator();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(30, t);

    // 60Hz 失谐八度（叠加制造喉音共振）
    const osc2 = c.createOscillator();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(60, t);
    // 微微 detune 让两频慢慢错开，更像喉咙振动
    osc2.detune.setValueAtTime(0, t);
    osc2.detune.linearRampToValueAtTime(8, t + dur);

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.25); // 长 Attack
    gain.gain.setValueAtTime(0.18, t + dur - 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur); // 长 Release

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(c.destination);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + dur);
    osc2.stop(t + dur);
  });
}

// =========================================================================
// 4. 金币"叮"声：FM 调频合成（载波 880Hz + 调制 1320Hz + 调制深度 200Hz）
// =========================================================================

export function playCoin() {
  safePlay((c) => {
    const t = c.currentTime;
    const dur = 0.22;

    // 载波（产生听感主音）
    const carrier = c.createOscillator();
    carrier.type = "sine";
    carrier.frequency.setValueAtTime(880, t); // A5

    // 调制器（给载波加频偏，模拟金属钟体共振）
    const modulator = c.createOscillator();
    modulator.type = "sine";
    modulator.frequency.setValueAtTime(1320, t); // E6 = 880 * 1.5

    const modGain = c.createGain();
    modGain.gain.setValueAtTime(200, t); // 调制深度 200Hz

    modulator.connect(modGain);
    modGain.connect(carrier.frequency);

    // 主体增益包络
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    carrier.connect(gain);
    gain.connect(c.destination);

    carrier.start(t);
    modulator.start(t);
    carrier.stop(t + dur);
    modulator.stop(t + dur);
  });
}

// =========================================================================
// 5. 窗框展开仪式音：木块碰撞噪声 + 低通 + 短 Attack
// =========================================================================

export function playWindow() {
  safePlay((c) => {
    const t = c.currentTime;
    const dur = 0.45;
    const bufferSize = Math.floor(c.sampleRate * dur);
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    // 木块碰撞：短促的低频冲击 + 较快衰减
    for (let i = 0; i < bufferSize; i++) {
      const env = Math.exp(-i / (c.sampleRate * 0.08)); // 80ms 衰减
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const noise = c.createBufferSource();
    noise.buffer = buffer;

    const lowpass = c.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(800, t); // 木质闷响 <1kHz
    lowpass.Q.setValueAtTime(1.0, t);

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.2, t + 0.02); // 短 Attack
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    noise.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(c.destination);

    noise.start(t);
    noise.stop(t + dur);
  });
}

// =========================================================================
// 6. 想念桶开启音：陶罐软木塞拔出（粉噪声 + 短包络 + 共鸣腔模拟）
// =========================================================================

export function playBucket() {
  safePlay((c) => {
    const t = c.currentTime;
    const dur = 0.3;

    // 粉噪声模拟软木摩擦
    const bufferSize = Math.floor(c.sampleRate * dur);
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.05 * white) / 1.05;
      data[i] = last * 5;
    }

    const noise = c.createBufferSource();
    noise.buffer = buffer;

    // 共鸣腔：带通滤波器模拟罐体
    const resonator = c.createBiquadFilter();
    resonator.type = "bandpass";
    resonator.frequency.setValueAtTime(380, t); // 陶器共鸣频率
    resonator.Q.setValueAtTime(4, t); // 高 Q 形成尖锐共鸣

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.15, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    noise.connect(resonator);
    resonator.connect(gain);
    gain.connect(c.destination);

    noise.start(t);
    noise.stop(t + dur);
  });
}

/**
 * 通用播放入口：根据 name 调用对应音效（便于 UI 调用 play("coin")）
 */
export function play(name) {
  switch (name) {
    case "steam": return playSteam();
    case "milk": return playMilk();
    case "purr": return playPurr();
    case "coin": return playCoin();
    case "window": return playWindow();
    case "bucket": return playBucket();
    default: return;
  }
}

/**
 * 测试用：重置内部状态（让 storage/audio 等模块在测试间互不污染）
 */
export function resetAudioForTests() {
  ctx = null;
  isMuted = false;
}