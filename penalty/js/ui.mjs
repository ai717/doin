// Only DOM-touching layer. Renders a snapshot; never mutates match state.

import { strings, format } from "./i18n.mjs";
import { shotDots, scoreLine, rate } from "./score.mjs";

const ZONE_NAMES = ["zoneTL", "zoneTC", "zoneTR", "zoneML", "zoneMC", "zoneMR", "zoneBL", "zoneBC", "zoneBR"];

function zoneCenter(zone) {
  const column = zone % 3;
  const row = Math.floor(zone / 3);
  return { x: ((column + 0.5) / 3) * 100, y: ((row + 0.5) / 3) * 100 };
}

function easeOut(value) {
  return 1 - (1 - value) * (1 - value);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Ball trajectory from the spot into the mouth, then the outcome branch.
// Pure function of (progress, zone, result) so a paused frame is identical.
export function ballFrame(progress, zone, result) {
  const target = zone === null ? { x: 50, y: 50 } : zoneCenter(zone);
  const start = { x: 50, y: 99 };
  if (progress <= 0.16) {
    const t = progress / 0.16;
    return { x: 50, y: lerp(99, 108, t), scale: lerp(1, 0.93, t) };
  }
  if (progress <= 0.72) {
    const t = easeOut((progress - 0.16) / 0.56);
    return {
      x: lerp(start.x, target.x, t),
      y: lerp(108, target.y, t),
      scale: lerp(0.93, 1, t),
    };
  }
  const t = (progress - 0.72) / 0.28;
  if (result === "save") {
    const away = target.x < 50 ? -1 : 1;
    return { x: target.x + away * 42 * t, y: target.y - 30 * t, scale: lerp(1, 0.62, t) };
  }
  if (result === "wide") {
    const away = target.x < 50 ? -1 : 1;
    return { x: target.x + away * 72 * t, y: target.y - 56 * t, scale: lerp(1, 0.55, t) };
  }
  return { x: target.x, y: target.y + 9 * t, scale: lerp(1, 0.78, t) };
}

export function keeperFrame(progress, dive) {
  const idle = { x: 50, y: 64 };
  if (dive === null) return idle;
  const target = zoneCenter(dive);
  const t = easeOut(Math.min(1, progress / 0.72));
  const y = target.y > 66 ? 78 : target.y < 34 ? 34 : 58;
  return { x: lerp(idle.x, target.x, t), y: lerp(idle.y, y, t) };
}

export function createUI() {
  const $ = (id) => document.getElementById(id);
  const el = {
    scoreA: $("score-a"), scoreB: $("score-b"), dotsA: $("dots-a"), dotsB: $("dots-b"),
    nameA: $("name-a"), nameB: $("name-b"), round: $("round-label"), phase: $("phase-label"),
    zones: Array.from(document.querySelectorAll(".zone")),
    powers: Array.from(document.querySelectorAll(".power-btn")),
    ball: $("ball"), keeper: $("keeper"), goal: $("goal-frame"),
    shoot: $("btn-shoot"), undo: $("btn-undo"), status: $("status-line"),
    handoff: $("handoff-layer"), pause: $("pause-layer"), result: $("result-layer"),
    drawer: $("mode-drawer"),
    resultTitle: $("result-title"), resultLine: $("result-line"),
    resultSub: $("result-sub"), resultStars: $("result-stars"),
    modes: Array.from(document.querySelectorAll(".mode-opt")),
    diffs: Array.from(document.querySelectorAll(".diff-opt")),
    firsts: Array.from(document.querySelectorAll(".first-opt")),
  };
  let lastResultKey = "";

  function sideLabel(side, t, mode) {
    if (mode === "mode_solo") return side === "side_a" ? t.you : t.cpu;
    return side === "side_a" ? t.sideA : t.sideB;
  }

  function renderDots(container, results, side) {
    const dots = shotDots({ results }, side);
    const key = `${side}:${dots.join(",")}`;
    if (container.dataset.key === key) return;
    container.dataset.key = key;
    container.replaceChildren(...dots.map((result) => {
      const span = document.createElement("span");
      span.className = `dot ${result}`;
      return span;
    }));
  }

  function render(snap, locale) {
    const t = strings(locale);
    const humanShoots = snap.mode === "mode_duo" || snap.shooter === "side_a";
    const humanKeeps = snap.mode === "mode_duo" || snap.shooter === "side_b";
    const shooting = snap.phase === "shooter";
    const keeping = snap.phase === "keeper";
    const masked = snap.phase === "handoff";

    el.scoreA.textContent = String(snap.score.side_a);
    el.scoreB.textContent = String(snap.score.side_b);
    el.nameA.textContent = sideLabel("side_a", t, snap.mode);
    el.nameB.textContent = sideLabel("side_b", t, snap.mode);
    el.round.textContent = snap.suddenDeath ? t.suddenDeath : format(t.round, snap.round);
    renderDots(el.dotsA, snap.results, "side_a");
    renderDots(el.dotsB, snap.results, "side_b");

    let phaseText = t.statusReady;
    if (snap.finished) phaseText = t.statusDone;
    else if (snap.phase === "reveal") phaseText = t.statusReveal;
    else if (masked) phaseText = t.locked;
    else if (keeping) phaseText = humanKeeps ? t.keeperTurn : t.aiThinking;
    else if (shooting) phaseText = humanShoots ? t.shooterTurn : t.aiPreparing;
    el.phase.textContent = phaseText;

    el.zones.forEach((button) => {
      const zone = Number(button.dataset.zone);
      const selected = shooting && snap.target === zone;
      button.classList.toggle("selected", selected || (masked && snap.lockedZone === zone) || (snap.phase === "reveal" && snap.lockedZone === zone));
      button.classList.toggle("dive-mode", keeping && humanKeeps);
      button.classList.toggle("hidden-choice", masked);
      const usable = (shooting && humanShoots) || (keeping && humanKeeps);
      button.disabled = !usable;
      button.title = t[ZONE_NAMES[zone]];
    });

    el.powers.forEach((button) => {
      button.classList.toggle("active", snap.power === button.dataset.power);
      button.disabled = !shooting || !humanShoots;
    });

    let shootText = t.chooseZonePower;
    let shootEnabled = false;
    if (shooting && humanShoots) {
      shootText = snap.target !== null && snap.power ? t.shootNow : t.chooseZonePower;
      shootEnabled = snap.target !== null && snap.power;
    } else if (masked) {
      shootText = t.handoffBtn;
    } else if (keeping && humanKeeps) {
      shootText = t.keeperPrompt;
    } else if (snap.phase === "reveal" && !snap.revealDone) {
      shootText = t.revealing;
    } else if (snap.revealDone) {
      shootText = t.continueNext;
      shootEnabled = true;
    } else if (snap.finished) {
      shootText = t.replay;
      shootEnabled = true;
    }
    el.shoot.textContent = shootText;
    el.shoot.disabled = shootEnabled === false;
    el.status.textContent = phaseText;
    el.undo.hidden = !(masked || (shooting && snap.target !== null));

    const dive = snap.phase === "reveal" || snap.finished ? (snap.dive ?? snap.lastShot?.dive ?? null) : null;
    const keeper = keeperFrame(snap.revealT, dive);
    el.keeper.style.setProperty("--keeper-x", `${keeper.x}%`);
    el.keeper.style.setProperty("--keeper-y", `${keeper.y}%`);
    el.keeper.classList.toggle("diving", dive !== null);

    const ball = ballFrame(snap.revealT, snap.lockedZone, snap.lastShot?.result ?? null);
    el.ball.style.setProperty("--ball-x", `${ball.x}%`);
    el.ball.style.setProperty("--ball-y", `${ball.y}%`);
    el.ball.style.setProperty("--ball-scale", String(ball.scale));

    const ripple = snap.lastShot?.result === "goal" && snap.revealT > 0.7;
    el.goal.classList.toggle("ripple", ripple);

    el.handoff.hidden = !masked;
    el.pause.hidden = !snap.paused;
    el.modes.forEach((button) => button.classList.toggle("active", button.dataset.mode === snap.mode));
    el.diffs.forEach((button) => button.classList.toggle("active", button.dataset.diff === snap.difficulty));
    el.firsts.forEach((button) => button.classList.toggle("active", button.dataset.first === snap.firstShooter));

    const resultKey = snap.finished ? `${snap.winner}:${snap.score.side_a}:${snap.score.side_b}` : "";
    if (resultKey && resultKey !== lastResultKey) {
      lastResultKey = resultKey;
      const winner = snap.winner;
      el.resultTitle.textContent = winner ? format(t.resultWin, sideLabel(winner, t, snap.mode)) : t.resultDraw;
      el.resultLine.textContent = scoreLine(snap.summary);
      const goals = snap.score.side_a + snap.score.side_b;
      const saves = snap.results.filter((shot) => shot.result === "save").length;
      el.resultSub.textContent = format(t.resultSub, goals, saves);
      el.resultStars.textContent = "★".repeat(rate(snap.summary));
    }
    if (!resultKey) lastResultKey = "";
  }

  function showResult(visible) {
    el.result.hidden = !visible;
  }

  function showDrawer(visible) {
    el.drawer.hidden = !visible;
  }

  function zoneName(zone, locale) {
    return strings(locale)[ZONE_NAMES[zone]];
  }

  return { render, showResult, showDrawer, zoneName, elements: el };
}
