// Assembly: storage, locale, audio, renderer, controller and input wiring.

import {
  createGame, restart, loadTable, advanceTable, update as updateGame, drainEvents,
  shoot, setAim, setPower, cycleSpin, placeCueBall, moveCueBall, commitCueBall,
  autoPlaceCue, canShoot, canPlaceCue, legalTargetsOf, snapshot, nudgeAim, nudgePower,
} from "./game.mjs";
import { createRenderer } from "./render.mjs";
import { createUI } from "./ui.mjs";
import { createAudio } from "./audio.mjs";
import { loadGameData, saveGameData, recordClearRun, recordDuelResult } from "./storage.mjs";
import { TABLES, getTable, nextTableId, tableIndex } from "./tables.mjs";
import { clearSummary, runTier } from "./score.mjs";
import { readLang, writeLang, t, format, otherLang } from "./i18n.mjs";

const store = {
  getItem(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  setItem(key, value) {
    try { localStorage.setItem(key, value); } catch { /* degraded */ }
  },
};

function boot(root) {
  void root;
  const canvas = document.getElementById("felt");
  if (!canvas) return null;

  const reduceMotion = typeof matchMedia === "function"
    && matchMedia("(prefers-reduced-motion: reduce)").matches;

  let data = loadGameData();
  let lang = readLang(store);
  let selectedMode = data.lastMode === "duel" ? "duel" : "clear";
  const audio = createAudio();
  audio.setEnabled(data.soundEnabled);
  const renderer = createRenderer(canvas);
  renderer.setReduced(reduceMotion);

  let game = createGame({ mode: selectedMode, tableId: data.lastTable, seed: 70001 });
  let paused = false;
  let pull = 0;
  let resultShown = false;
  let hudKey = "";

  const tableSummary = (id) => {
    const best = data.tables[id] ?? null;
    const table = getTable(id);
    return {
      id,
      par: table.par,
      count: table.count,
      stars: best?.stars ?? 0,
      cleared: Boolean(best?.cleared),
      locked: false,
    };
  };

  function tableList() {
    let unlocked = true;
    return TABLES.map((table) => {
      const entry = tableSummary(table.id);
      entry.locked = !unlocked && !entry.cleared;
      unlocked = entry.cleared;
      return entry;
    });
  }

  function groupRowDisabled() {
    const chip = document.getElementById("chip-group");
    const label = chip?.previousElementSibling;
    if (!label) return;
    if (game.mode === "clear") label.setAttribute("data-i18n", "ui_left");
    else label.setAttribute("data-i18n", "ui_group");
  }

  function refreshHud(force = false) {
    const snap = snapshot(game);
    const payload = {
      mode: snap.mode,
      tableId: snap.tableId,
      tableIndex: tableIndex(snap.tableId),
      par: snap.par,
      playerTurn: snap.playerTurn,
      groups: snap.groups,
      groupRemain: snap.groupRemain,
      objectLeft: snap.objectLeft,
      shots: snap.shots,
      fouls: snap.fouls,
      run: snap.run,
      ballInHand: snap.ballInHand,
      phase: snap.phase,
    };
    const key = JSON.stringify(payload);
    if (!force && key === hudKey) return;
    hudKey = key;
    ui.renderHud(payload, lang);
    ui.setPowerBar(game.aim.power);
    ui.setSpinButtons(game.aim.spin);
  }

  function viewState() {
    const cue = game.world.balls.find((b) => b.id === 0);
    const targets = new Set(legalTargetsOf(game).map((b) => b.id));
    const placing = canPlaceCue(game);
    return {
      world: game.world,
      cue,
      aim: game.aim,
      phase: placing && game.phase !== "resolving" ? "placing" : game.phase,
      pull,
      targets,
      targetIds: targets,
      assist: Boolean(data.aimAssist) && (game.phase === "aim" || placing),
      spinPreview: Boolean(data.spinPreview),
    };
  }

  const ui = createUI({
    getState: () => ({
      aim: { ...game.aim },
      cue: game.world.balls.find((b) => b.id === 0),
      canShoot: canShoot(game) && !paused,
      canPlace: canPlaceCue(game) && !paused,
      power: game.aim.power,
      pull,
      mode: game.mode,
      phase: game.phase,
    }),
    toWorld: (x, y) => renderer.toWorld(x, y),

    onAim: (angle) => { setAim(game, angle); },
    onAimDelta: (delta) => { nudgeAim(game, delta); },
    onPower: (power) => { setPower(game, power); ui.setPowerBar(power); },
    onPowerDelta: (delta) => { nudgePower(game, delta); ui.setPowerBar(game.aim.power); },
    onSpin: (spin) => { game.aim.spin = spin; ui.setSpinButtons(spin); audio.ui(); },
    onCycleSpin: (step) => { cycleSpin(game, step); ui.setSpinButtons(game.aim.spin); audio.ui(); },
    onPullStart: () => { pull = 0; },
    onPull: (value) => {
      pull = value;
      if (value > 0.06) setPower(game, value);
      ui.setPowerBar(Math.max(value, 0.02));
    },
    onPullEnd: () => { pull = 0; ui.setPowerBar(game.aim.power); },
    onShoot: () => {
      if (!canShoot(game) || paused) return;
      const power = game.aim.power;
      if (shoot(game)) {
        audio.strike(Math.max(0.15, power));
        renderer.noteHit("shake", 0.5);
      }
    },
    onPlace: (x, y) => { moveCueBall(game, x, y); },
    onConfirmPlace: () => {
      if (commitCueBall(game)) audio.ui();
      refreshHud(true);
    },
    onAutoPlace: () => { autoPlaceCue(game); refreshHud(true); },

    onRestart: () => {
      restart(game);
      renderer.clearTrails();
      pull = 0;
      resultShown = false;
      setOverlay("none");
      refreshHud(true);
      audio.ui();
    },
    onNext: () => {
      if (advanceTable(game)) {
        renderer.clearTrails();
        resultShown = false;
        setOverlay("none");
        refreshHud(true);
      } else {
        setOverlay("tables");
      }
    },
    onPickTable: (id) => {
      loadTable(game, id);
      renderer.clearTrails();
      resultShown = false;
      setOverlay("none");
      refreshHud(true);
      audio.ui();
    },
    onMode: (mode) => {
      selectedMode = mode === "duel" ? "duel" : "clear";
      ui.setModeSelection(selectedMode);
      audio.ui();
    },
    onStart: () => {
      game = createGame({ mode: selectedMode, tableId: game.tableId ?? data.lastTable, seed: 70001 });
      renderer.clearTrails();
      resultShown = false;
      paused = false;
      setOverlay("none");
      groupRowDisabled();
      refreshHud(true);
      audio.ui();
    },
    onOpenOverlay: (name) => {
      if (name === "tables") rebuildTables();
      setOverlay(name);
      audio.ui();
    },
    onCloseOverlay: () => {
      setOverlay(paused ? "pause" : "none");
      audio.ui();
    },
    onPause: (value) => {
      paused = Boolean(value);
      setOverlay(paused ? "pause" : "none");
    },
    onResume: () => {
      paused = false;
      setOverlay("none");
    },
    onToggleSound: () => {
      data.soundEnabled = !data.soundEnabled;
      audio.setEnabled(data.soundEnabled);
      ui.setOptions(data);
      if (data.soundEnabled) audio.ui();
      data = saveGameData({ ...data, soundEnabled: data.soundEnabled });
    },
    onToggleLang: () => {
      lang = otherLang(lang);
      writeLang(store, lang);
      applyLocale();
    },
    onOption: (key, value) => {
      if (key === "soundEnabled") {
        data.soundEnabled = Boolean(value);
        audio.setEnabled(data.soundEnabled);
      } else {
        data[key] = Boolean(value);
      }
      ui.setOptions(data);
      data = saveGameData(data);
    },
    onLocaleApplied: () => { applyLocale(); },
  });

  function setOverlay(name) {
    const next = ui.setOverlay(name);
    paused = next === "pause";
    return next;
  }

  function rebuildTables() {
    ui.buildTables(tableList(), lang, game.tableId);
  }

  function applyLocale() {
    ui.applyLocale(lang);
    rebuildTables();
    ui.setModeSelection(selectedMode);
    ui.setOptions(data);
    if (resultShown && resultShown.payload) {
      ui.showResult(resultShown.payload, lang);
    }
    refreshHud(true);
  }

  function finishRun(report) {
    const snap = snapshot(game);
    if (game.mode === "clear") {
      const table = getTable(game.tableId);
      const summary = clearSummary({
        cleared: snap.lastEvent === "cleared",
        shots: snap.shots[0],
        par: table.par,
        fouls: snap.fouls[0],
        bestRun: snap.bestRun,
      });
      const payload = {
        title: summary.cleared
          ? t("resultCleared", lang)
          : t("resultFailed", lang),
        stars: summary.stars,
        shots: summary.shots,
        par: summary.par,
        fouls: summary.fouls,
        bestRun: summary.bestRun,
        hasNext: Boolean(nextTableId(game.tableId)) && summary.cleared,
      };
      resultShown = { payload };
      data = recordClearRun(data, {
        tableId: game.tableId,
        cleared: summary.cleared,
        stars: summary.stars,
        shots: summary.shots,
        fouls: summary.fouls,
        timeMs: 0,
      });
      data = saveGameData(data);
      if (summary.cleared) renderer.noteHit("celebrate", {});
      audio.clearTable();
      ui.showResult(payload, lang);
      return;
    }
    const winner = snap.winner;
    const name = winner === 0 ? t("player_a", lang) : t("player_b", lang);
    const payload = {
      title: format("resultDuel", lang, { p: name }),
      stars: 0,
      shots: snap.shots[winner ?? 0] ?? 0,
      par: 0,
      fouls: snap.fouls[winner ?? 0] ?? 0,
      bestRun: snap.bestRun,
      hasNext: false,
    };
    resultShown = { payload };
    data = recordDuelResult(data, winner);
    data = saveGameData(data);
    renderer.noteHit("celebrate", {});
    audio.clearTable();
    ui.showResult(payload, lang);
    void report;
  }

  function onShotEnd(report) {
    const snap = snapshot(game);
    if (report.foul) {
      audio.foul();
      const reason = report.reason ?? "foul";
      ui.toast(`fool_${reason}`, lang, {}, true);
      if (report.loseEight && game.mode === "clear") {
        ui.toast("eightRescue", lang, {}, true);
      }
    } else if (report.potted.length > 0) {
      const tier = runTier(snap.run);
      if (tier > 0) audio.run(tier);
      if (snap.run >= 2) ui.toast("combo", lang, { n: snap.run });
    }
    if (snap.lastEvent === "cleared" || game.rules.phase === "over") {
      setTimeout(() => finishRun(report), 620);
      return;
    }
    if (game.phase === "placing") ui.toast("bihTitle", lang, {});
    refreshHud(true);
  }

  function handleEvents() {
    for (const ev of drainEvents(game)) {
      if (ev.type === "clack") {
        audio.clack(ev.speed);
        renderer.noteHit("spark", {
          x: ev.x ?? 0, y: ev.y ?? 0, vx: 0, vy: 0, life: 0.4,
        });
      } else if (ev.type === "rail") {
        audio.rail(ev.speed);
      } else if (ev.type === "pocket") {
      renderer.noteHit("pot", { x: ev.x ?? 0, y: ev.y ?? 0 });
      renderer.noteHit("shake", 0.7);
      audio.pocket();
      } else if (ev.type === "shot-end") {
        onShotEnd(ev.report);
      }
    }
  }

  let last = 0;
  function frame(now) {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    ui.tick(dt);
    const frozen = ui.currentOverlay() !== "none";
    if (!frozen) {
      const before = game.phase;
      const res = updateGame(game, dt);
      if (res.settled && before === "resolving") refreshHud(true);
      game.elapse += dt * 1000;
    }
    handleEvents();
    renderer.draw(viewState(), frozen ? 0 : dt);
    refreshHud();
    requestAnimationFrame(frame);
  }

  function onResize() {
    renderer.resize();
  }

  if (typeof ResizeObserver === "function") {
    new ResizeObserver(onResize).observe(canvas);
  }
  globalThis.addEventListener?.("resize", onResize);
  onResize();

  applyLocale();
  ui.setModeSelection(selectedMode);
  ui.setOptions(data);
  setOverlay("menu");
  refreshHud(true);
  requestAnimationFrame(frame);

  const handle = {
    get game() { return game; },
    startRun() {
      const next = createGame({ mode: selectedMode, tableId: game.tableId ?? data.lastTable, seed: 70001 });
      game = next;
      renderer.clearTrails();
      resultShown = false;
      paused = false;
      setOverlay("none");
      refreshHud(true);
      return next;
    },
    restart() { restart(game); refreshHud(true); return game; },
    ui,
    renderer,
  };
  return handle;
}

if (document.getElementById("felt")) {
  globalThis.__billiards = boot(document);
}

export { boot };
