export type SfxName =
  | "place"
  | "note"
  | "erase"
  | "undo"
  | "mistake"
  | "hint"
  | "win"
  | "lose"
  | "stamp"
  | "cheer";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    ctx = new AC({ latencyHint: "interactive" });
    master = ctx.createGain();
    master.gain.value = 0.12;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function unlockSfx() {
  audioContext();
}

export function setSfxEnabled(on: boolean) {
  enabled = on;
}

export function playSfx(name: SfxName) {
  if (!enabled) return;
  const ac = audioContext();
  if (!ac || !master) return;
  const t = ac.currentTime;
  switch (name) {
    case "place":
      blip(ac, t, 640, 0.05, "triangle", 0.22);
      break;
    case "note":
      blip(ac, t, 1280, 0.03, "sine", 0.1);
      break;
    case "erase":
      sweep(ac, t, 320, 180, 0.08, 0.12);
      break;
    case "undo":
      blip(ac, t, 480, 0.04, "triangle", 0.14);
      break;
    case "mistake":
      blip(ac, t, 160, 0.12, "sine", 0.18);
      break;
    case "hint":
      blip(ac, t, 784, 0.07, "sine", 0.12);
      blip(ac, t + 0.07, 988, 0.08, "sine", 0.1);
      break;
    case "win":
      blip(ac, t, 523, 0.12, "sine", 0.16);
      blip(ac, t + 0.09, 659, 0.12, "sine", 0.16);
      blip(ac, t + 0.18, 784, 0.18, "sine", 0.18);
      break;
    case "lose":
      blip(ac, t, 196, 0.16, "sine", 0.16);
      blip(ac, t + 0.14, 147, 0.2, "sine", 0.14);
      break;
    case "stamp":
      blip(ac, t, 988, 0.14, "sine", 0.14);
      blip(ac, t, 1480, 0.18, "triangle", 0.06);
      break;
    case "cheer":
      blip(ac, t, 659, 0.08, "sine", 0.12);
      blip(ac, t + 0.08, 880, 0.12, "triangle", 0.1);
      break;
  }
}

function blip(
  ac: AudioContext,
  when: number,
  freq: number,
  dur: number,
  type: OscillatorType,
  gain: number,
) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq * (0.98 + Math.random() * 0.04), when);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), when + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(g);
  g.connect(master!);
  osc.start(when);
  osc.stop(when + dur + 0.02);
  osc.onended = () => {
    osc.disconnect();
    g.disconnect();
  };
}

function sweep(
  ac: AudioContext,
  when: number,
  from: number,
  to: number,
  dur: number,
  gain: number,
) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(from, when);
  osc.frequency.exponentialRampToValueAtTime(to, when + dur);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), when + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(g);
  g.connect(master!);
  osc.start(when);
  osc.stop(when + dur + 0.02);
  osc.onended = () => {
    osc.disconnect();
    g.disconnect();
  };
}

if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", unlockSfx, { once: true });
  window.addEventListener("keydown", unlockSfx, { once: true });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") unlockSfx();
  });
}