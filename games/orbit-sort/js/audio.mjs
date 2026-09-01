// Web Audio feedback with no external audio assets.

export function createAudio({ soundOn: initialSoundOn = true } = {}) {
  let context = null;
  let soundOn = initialSoundOn;

  function activate() {
    if (!context && "AudioContext" in window) context = new AudioContext();
    if (context?.state === "suspended") context.resume().catch(() => {});
  }

  function tone({ frequency, endFrequency = frequency, duration, type = "sine", gain = 0.05, delay = 0 }) {
    if (!soundOn || !context) return;
    const now = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration);
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(gain, now + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(envelope).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  function play(kind) {
    if (kind === "extract") tone({ frequency: 250, endFrequency: 420, duration: 0.09, type: "square", gain: 0.025 });
    if (kind === "insert") tone({ frequency: 330, endFrequency: 230, duration: 0.08, type: "triangle", gain: 0.04 });
    if (kind === "invalid") tone({ frequency: 120, endFrequency: 95, duration: 0.11, type: "sawtooth", gain: 0.025 });
    if (kind === "complete") {
      [392, 494, 587].forEach((frequency, index) => tone({ frequency, duration: 0.22, type: "sine", gain: 0.045, delay: index * 0.08 }));
    }
    if (kind === "unfreeze") {
      tone({ frequency: 620, endFrequency: 900, duration: 0.13, type: "triangle", gain: 0.035 });
      tone({ frequency: 980, endFrequency: 1260, duration: 0.1, type: "sine", gain: 0.022, delay: 0.05 });
    }
  }

  return {
    activate,
    play,
    toggle() {
      soundOn = !soundOn;
      return soundOn;
    },
    isOn() { return soundOn; },
  };
}
