// 魔方工坊专属音色：塑料滑轨噪声、磁吸卡扣、空气视角风、FM 木琴通关和弦。
// 全部程序化合成，零外部音频文件；不支持 WebAudio 时静默降级。

export function createAudio() {
  let context = null;
  let master = null;
  let noise = null;
  let muted = false;

  function ensure() {
    if (muted) return null;
    if (context) {
      if (context.state === "suspended") context.resume().catch(() => {});
      return context;
    }
    const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Ctor) return null;
    try {
      context = new Ctor();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      const length = Math.floor(context.sampleRate * 0.6);
      noise = context.createBuffer(1, length, context.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
      return context;
    } catch (error) {
      context = null;
      return null;
    }
  }

  function now() {
    return context ? context.currentTime : 0;
  }

  function gainNode(value = 1) {
    const node = context.createGain();
    node.gain.value = value;
    node.connect(master);
    return node;
  }

  function noiseSource() {
    const source = context.createBufferSource();
    source.buffer = noise;
    return source;
  }

  // 塑料滑轨：带通噪声 + 低频木体
  function snap(intensity = 1) {
    if (!ensure()) return;
    const t = now();
    const power = Math.min(1.6, Math.max(0.4, intensity));
    const bed = noiseSource();
    const band = context.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.setValueAtTime(1500 + power * 700, t);
    band.Q.value = 1.4;
    const envelope = gainNode(0);
    envelope.gain.setValueAtTime(0.0001, t);
    envelope.gain.exponentialRampToValueAtTime(0.24 * power, t + 0.004);
    envelope.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
    bed.connect(band).connect(envelope);
    bed.start(t);
    bed.stop(t + 0.08);

    const body = context.createOscillator();
    body.type = "triangle";
    body.frequency.setValueAtTime(190 + power * 30, t);
    body.frequency.exponentialRampToValueAtTime(120, t + 0.07);
    const bodyGain = gainNode(0);
    bodyGain.gain.setValueAtTime(0.11 * power, t);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    body.connect(bodyGain);
    body.start(t);
    body.stop(t + 0.1);
  }

  // 快速打乱：一串不同音高的短促卡扣
  function scrambleTick(index = 0) {
    if (!ensure()) return;
    const t = now();
    const source = noiseSource();
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 900 + (index % 7) * 120;
    filter.Q.value = 2.2;
    const envelope = gainNode(0);
    envelope.gain.setValueAtTime(0.0001, t);
    envelope.gain.exponentialRampToValueAtTime(0.12, t + 0.003);
    envelope.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    source.connect(filter).connect(envelope);
    source.start(t);
    source.stop(t + 0.05);
  }

  // 视角旋转：低通噪声的轻微空气流动
  function orbit() {
    if (!ensure()) return;
    const t = now();
    const source = noiseSource();
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(420, t);
    filter.frequency.linearRampToValueAtTime(1100, t + 0.18);
    filter.frequency.linearRampToValueAtTime(500, t + 0.3);
    const envelope = gainNode(0);
    envelope.gain.setValueAtTime(0.0001, t);
    envelope.gain.linearRampToValueAtTime(0.055, t + 0.08);
    envelope.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    source.connect(filter).connect(envelope);
    source.start(t);
    source.stop(t + 0.34);
  }

  // FM 提示音：温润玻音
  function hint() {
    if (!ensure()) return;
    const t = now();
    const carrier = context.createOscillator();
    const modulator = context.createOscillator();
    const modGain = context.createGain();
    carrier.type = "sine";
    carrier.frequency.value = 880;
    modulator.type = "sine";
    modulator.frequency.value = 1760;
    modGain.gain.setValueAtTime(420, t);
    modGain.gain.exponentialRampToValueAtTime(5, t + 0.28);
    modulator.connect(modGain).connect(carrier.frequency);
    const envelope = gainNode(0);
    envelope.gain.setValueAtTime(0.0001, t);
    envelope.gain.exponentialRampToValueAtTime(0.16, t + 0.01);
    envelope.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    carrier.connect(envelope);
    carrier.start(t);
    modulator.start(t);
    carrier.stop(t + 0.34);
    modulator.stop(t + 0.34);
  }

  // 通关：FM 木琴四音和弦 + 金属泛音尾
  function win() {
    if (!ensure()) return;
    const t = now();
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, index) => {
      const start = t + index * 0.085;
      const carrier = context.createOscillator();
      const modulator = context.createOscillator();
      const modGain = context.createGain();
      carrier.type = "sine";
      carrier.frequency.value = freq;
      modulator.type = "sine";
      modulator.frequency.value = freq * 2;
      modGain.gain.setValueAtTime(180, start);
      modGain.gain.exponentialRampToValueAtTime(4, start + 0.5);
      modulator.connect(modGain).connect(carrier.frequency);
      const envelope = gainNode(0);
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.exponentialRampToValueAtTime(0.16, start + 0.012);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + 0.7);
      carrier.connect(envelope);
      carrier.start(start);
      modulator.start(start);
      carrier.stop(start + 0.75);
      modulator.stop(start + 0.75);
    });

    const shimmer = noiseSource();
    const band = context.createBiquadFilter();
    band.type = "highpass";
    band.frequency.value = 3200;
    const envelope = gainNode(0);
    envelope.gain.setValueAtTime(0.0001, t);
    envelope.gain.linearRampToValueAtTime(0.06, t + 0.1);
    envelope.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
    shimmer.connect(band).connect(envelope);
    shimmer.start(t);
    shimmer.stop(t + 0.9);
  }

  function setMuted(value) {
    muted = Boolean(value);
    if (master && context) {
      master.gain.setTargetAtTime(muted ? 0 : 0.5, context.currentTime, 0.02);
    }
  }

  return {
    ensure,
    snap,
    scrambleTick,
    orbit,
    hint,
    win,
    setMuted,
    isMuted: () => muted,
    dispose: () => {
      if (context) context.close().catch(() => {});
      context = null;
      master = null;
      noise = null;
    },
  };
}
