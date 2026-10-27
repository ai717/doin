// ui.mjs —— 唯一碰 DOM 的层：缓存灯笼棚构件、把 hudOf() 视图模型刷成木牌文字、搭幕布与工坊清单。
// 不做任何玩法判定，也不改 game/engine 的状态。

import { strings, applyLocale, format, ghostName, ghostStateName, htmlLang } from "./i18n.mjs";
import { LEVELS, LEVELS_PER_WATCH, WATCH_NAMES } from "./levels.mjs";
import { BRUSHES } from "./engine.mjs";
import { SHEETS } from "./bench.mjs";
import { problemHint } from "./validate.mjs";

export const PROBLEM_KEY = {
  missingSpawn: "problemNoSpawn",
  missingHouse: "problemNoHouse",
  island: "problemIsland",
  noLoop: "problemTrap",
  patrol: "problemPatrol",
  pearl: "problemPearl",
  spawn: "problemSpawn",
  thin: "problemThin",
  shape: "ruleShape",
};

export const RULE_KEY = { 1: "rule1", 2: "rule2", 3: "rule3", 4: "rule4", 5: "rule5" };

export const BRUSH_KEY = {
  wall: "brushWall",
  path: "brushPath",
  dot: "brushDot",
  pearl: "brushPearl",
  house: "brushHouse",
  door: "brushDoor",
  spawn: "brushSpawn",
  fruit: "brushFruit",
  noup: "brushNoUp",
};

const BRUSH_COLOR = {
  wall: "#2b3a72",
  path: "#e9dfc6",
  dot: "#ffd98a",
  pearl: "#fff4d2",
  house: "#243059",
  door: "#f3d38b",
  spawn: "#e0a418",
  fruit: "#d4622a",
  noup: "#8fb2ff",
};

function mmss(ms) {
  const total = Math.max(0, Math.round((Number(ms) || 0) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function secs(ms) {
  return `${Math.max(0, Math.round((Number(ms) || 0) / 1000))}s`;
}

function node(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined && text !== null) el.textContent = String(text);
  return el;
}

export function createUi(root = document) {
  const byId = (id) => root.getElementById?.(id) ?? null;
  const ids = [
    "eave-now", "sound-icon", "sound-text", "btn-sound", "btn-lang", "btn-help",
    "clock-main", "clock-note", "stick-rack", "tally-total", "wick-fill", "wick-note",
    "lamp-row", "dust-fill", "dust-note", "brush-rack", "sheet-rack",
    "shell", "board", "bench", "bench-canvas", "bench-note",
    "veil-ready", "btn-start", "btn-modes", "btn-levels",
    "veil-modes", "mode-rack", "btn-close-modes",
    "veil-levels", "watch-tabs", "level-grid", "watch-progress", "btn-close-levels",
    "veil-result", "result-badge", "result-title", "result-sticks", "result-stats", "result-note", "result-actions",
    "veil-help", "btn-close-help",
    "veil-paused", "btn-veil-resume", "btn-veil-restart",
    "console-hint", "btn-dash", "dash-sub", "btn-pause", "btn-restart", "btn-open-levels",
    "btn-undo", "btn-redo", "btn-mirror", "btn-grid", "btn-clear-sheet", "btn-leave-bench", "dpad",
    "score-main", "score-best", "ghost-deck", "day-ring", "day-face", "day-note",
    "train-main", "train-note", "check-list", "btn-rehearse", "lane-code", "lane-name",
    "code-input", "btn-copy-code", "btn-load-code", "btn-save-lane", "btn-play-lane", "lane-list",
  ];
  const el = {};
  for (const id of ids) el[id.replace(/-([a-z])/g, (m, c) => c.toUpperCase())] = byId(id);

  const VEILS = {
    ready: el.veilReady,
    modes: el.veilModes,
    levels: el.veilLevels,
    result: el.veilResult,
    help: el.veilHelp,
    paused: el.veilPaused,
  };

  let locale = "zh";
  let t = strings(locale);
  let lastScore = -1;
  let noteTimer = 0;
  let soundOn = true;

  // ------------------------------------------------------------ 语言

  function setLocale(next) {
    locale = next;
    t = strings(next);
    document.documentElement.lang = htmlLang(next);
    applyLocale(root, next);
    setSound(soundOn);
    return t;
  }

  function tr(key, params) {
    return format(t[key] ?? key, params);
  }

  // ------------------------------------------------------------ 幕布与分组

  function showVeil(name) {
    for (const [key, nodeEl] of Object.entries(VEILS)) {
      if (!nodeEl) continue;
      nodeEl.hidden = key !== name;
    }
  }

  /** 门匾右侧的实时情境文字（无 HUD 可刷时由装配层直接给） */
  function setNow(text) {
    el.eaveNow.textContent = text || "";
  }

  /** 两翼与操作台在「玩法」和「扎巷坊」之间整体换装 */
  function setWorkshop(on) {
    for (const group of root.querySelectorAll("[data-group]")) {
      const want = group.dataset.group;
      group.hidden = on ? want !== "work" : want !== "play";
    }
    if (el.shell) el.shell.hidden = on;
    if (el.bench) el.bench.hidden = !on;
  }

  // ------------------------------------------------------------ HUD

  /** @param {object} view { hud, mode, levelId, records, totalStars } */
  function paintHud({ hud, mode, levelId, records, stars }) {
    if (!hud) return;
    el.clockMain.textContent =
      mode === "timed" ? mmss(hud.timeLeftMs) : mmss(hud.clockMs);
    el.clockNote.textContent =
      mode === "timed"
        ? tr("hudChain", { n: hud.lane })
        : mode === "survival"
          ? tr("hudRound", { n: hud.round })
          : `${tr("resultPar")} ${mmss(hud.parMs ?? 0)}`;
    el.clockMain.classList.toggle("is-urgent", mode === "timed" && hud.timeLeftMs <= 15000);

    el.scoreMain.textContent = hud.scoreText;
    el.scoreBest.textContent = `${tr("hudBest")} ${(records?.highScore ?? 0).toLocaleString(locale === "en" ? "en-US" : "zh-CN")}`;
    if (hud.score !== lastScore) {
      el.scoreMain.classList.remove("punch");
      void el.scoreMain.offsetWidth;
      el.scoreMain.classList.add("punch");
      lastScore = hud.score;
    }

    el.wickFill.style.width = `${Math.round(hud.wickPct * 100)}%`;
    el.wickNote.textContent = `${hud.wick} / 100`;
    el.dustFill.style.width = `${Math.round(hud.dotPct * 100)}%`;
    el.dustNote.textContent = `${hud.dotTotal - hud.dotLeft} / ${hud.dotTotal}`;

    paintLamps(hud.lives);
    paintSticks(hud);
    paintDay(hud);
    paintGhosts(hud);
    paintDash(hud);

    el.eaveNow.textContent = situation({ hud, mode, levelId });
    el.tallyTotal.textContent = tr("hudTallyMax", { n: stars ?? 0 });
    el.consoleHint.textContent = hud.mode === "campaign" && hud.watch >= 4 ? tr("fogHint") : tr("handHint");
  }

  function situation({ hud, mode, levelId }) {
    if (mode === "campaign") {
      const name = (WATCH_NAMES[locale] ?? WATCH_NAMES.zh)[Math.max(0, (hud.watch ?? 1) - 1)] ?? "";
      return `${tr("modeCampaign")} · ${name} · ${tr("hudLevelShort", { n: levelId })}`;
    }
    if (mode === "timed") return `${tr("modeTimed")} · ${tr("hudChain", { n: hud.lane })}`;
    if (mode === "survival") return `${tr("modeSurvival")} · ${tr("hudRound", { n: hud.round })}`;
    return tr("modeWorkshop");
  }

  function paintLamps(lives) {
    const row = el.lampRow;
    const shown = Math.max(0, Math.min(9, lives ?? 0));
    if (row.childElementCount !== Math.max(shown, 3)) {
      row.replaceChildren(...Array.from({ length: Math.max(shown, 3) }, () => node("span", "lamp")));
    }
    [...row.children].forEach((lamp, i) => {
      lamp.classList.toggle("out", i >= shown);
    });
    row.setAttribute("aria-label", `${tr("hudLives")} ${shown}`);
  }

  function paintSticks(hud) {
    const detail = hud.liveDetail ?? {};
    for (const stick of el.stickRack.children) {
      stick.classList.toggle("on", detail[stick.dataset.k] === true);
    }
  }

  function paintDay(hud) {
    const pct = Math.round((hud.frightPct || 0) * 100);
    el.dayRing.style.setProperty("--pct", String(pct));
    el.dayFace.textContent = pct > 0 ? `${hud.frightSec ?? 0}` : hud.phaseKind === "scatter" ? "◐" : "◑";
    el.dayNote.textContent =
      pct > 0 ? tr("hudFright") : hud.phaseKind === "scatter" ? tr("hudPhaseScatter") : tr("hudPhaseChase");
    el.trainMain.textContent = `×${hud.trainBonus}`;
    el.trainNote.textContent = hud.trainBonus > 1 ? tr("resultChain") : tr("hudTrain");
  }

  function paintGhosts(hud) {
    const deck = el.ghostDeck;
    if (deck.childElementCount !== hud.ghosts.length) {
      deck.replaceChildren(
        ...hud.ghosts.map(() => {
          const card = node("div", "ghost-card");
          card.append(node("span", "ghost-face"), node("span", "ghost-name"), node("span", "ghost-state"));
          return card;
        })
      );
    }
    hud.ghosts.forEach((g, i) => {
      const card = deck.children[i];
      card.dataset.st = g.key;
      card.style.setProperty("--gc", `var(--${g.color})`);
      card.children[1].textContent = ghostName(locale, g.color, g.name);
      card.children[2].textContent = ghostStateName(locale, g.key);
    });
  }

  function paintDash(hud) {
    el.btnDash.style.setProperty("--cool", String(hud.dashPct));
    el.btnDash.disabled = !hud.dashReady;
    if (el.dashSub) el.dashSub.textContent = hud.dashReady ? tr("dashReady") : tr("dashCool", { n: hud.dashCoolSec });
  }

  // ------------------------------------------------------------ 玩法选择

  function buildModes({ current, unlocked, onPick }) {
    const order = ["campaign", "timed", "survival", "workshop"];
    el.modeRack.replaceChildren(
      ...order.map((mode) => {
        const open = unlocked[mode] !== false;
        const card = node("button", `mode-card${mode === current ? " on" : ""}`);
        card.type = "button";
        card.dataset.mode = mode;
        card.disabled = !open;
        card.append(node("span", "mode-name", tr(`mode${mode[0].toUpperCase()}${mode.slice(1)}`)));
        card.append(node("span", "mode-desc", tr(`modeIntro${mode[0].toUpperCase()}${mode.slice(1)}`)));
        if (!open) card.append(node("span", "mode-lock", mode === "survival" ? tr("hudLocked") : tr("hudLockedTimed")));
        return card;
      })
    );
    el.modeRack.onclick = (ev) => {
      const card = ev.target.closest?.(".mode-card");
      if (card && !card.disabled) onPick(card.dataset.mode);
    };
  }

  // ------------------------------------------------------------ 更次选择

  function buildLevels({ current, data, onPick }) {
    const watchTable = WATCH_NAMES[locale] ?? WATCH_NAMES.zh;
    const tabs = [1, 2, 3, 4, 5];
    if (el.watchTabs.dataset.built !== "1") {
      el.watchTabs.replaceChildren(
        ...tabs.map((w) => {
          const tab = node("button", "watch-tab", watchTable[w - 1]);
          tab.type = "button";
          tab.dataset.watch = String(w);
          return tab;
        })
      );
      el.watchTabs.dataset.built = "1";
    }
    for (const tab of el.watchTabs.children) {
      tab.classList.toggle("on", Number(tab.dataset.watch) === Math.ceil(current / LEVELS_PER_WATCH));
    }

    const paint = (watch) => {
      let sum = 0;
      const cells = LEVELS.filter((lvl) => {
        if (lvl.watch !== watch) return false;
        return true;
      });
      el.levelGrid.replaceChildren(
        ...cells.map((lvl) => {
          const rec = data?.levels?.[lvl.id];
          sum += rec?.stars ?? 0;
          const locked = lvl.id !== 1 && data?.levels?.[lvl.id - 1]?.cleared !== true;
          const cell = node("button", `level-cell${lvl.id === current ? " on" : ""}`);
          cell.type = "button";
          cell.dataset.level = String(lvl.id);
          cell.disabled = locked;
          cell.append(node("span", "level-no", String(lvl.id)));
          cell.append(node("span", "level-stars", "★".repeat(rec?.stars ?? 0) || "·"));
          return cell;
        })
      );
      el.watchProgress.textContent = tr("watchProgress", { w: watch, n: sum });
    };

    el.levelGrid.onclick = (ev) => {
      const cell = ev.target.closest?.(".level-cell");
      if (cell && !cell.disabled) onPick(Number(cell.dataset.level));
    };
    el.watchTabs.onclick = (ev) => {
      const tab = ev.target.closest?.(".watch-tab");
      if (!tab) return;
      for (const other of el.watchTabs.children) other.classList.toggle("on", other === tab);
      paint(Number(tab.dataset.watch));
    };
    paint(Math.ceil(current / LEVELS_PER_WATCH));
  }

  // ------------------------------------------------------------ 结算

  /** @param {object} r game.result；actions: Array<{key,label,cls,on}> */
  function showResult(r, actions) {
    if (!r) return;
    el.resultBadge.hidden = !r.newBest;
    el.resultTitle.textContent = resultTitle(r);
    for (const stick of el.resultSticks.children) stick.classList.toggle("on", r.detail?.[stick.dataset.k] === true);
    const rows = resultRows(r);
    el.resultStats.replaceChildren(
      ...rows.map(([label, value]) => {
        const row = node("div");
        row.append(node("dt", null, label), node("dd", null, value));
        return row;
      })
    );
    el.resultNote.textContent = r.note || (r.cleared ? tr("resultNoteCleared") : tr("resultNoteLost"));
    el.resultActions.replaceChildren(
      ...actions.map((a) => {
        const btn = node("button", `knob${a.cls ? ` knob--${a.cls}` : ""}`, a.label);
        btn.type = "button";
        btn.onclick = a.on;
        return btn;
      })
    );
    showVeil("result");
  }

  function resultTitle(r) {
    if (r.mode === "campaign") return r.won ? tr("resultWon") : r.cleared ? tr("resultCleared") : tr("resultLost");
    if (r.mode === "timed") return tr("resultTimedOver");
    if (r.mode === "survival") return tr("resultSurvivalOver");
    return r.cleared ? tr("resultCleared") : tr("resultLost");
  }

  function resultRows(r) {
    const rows = [];
    if (r.mode === "campaign") rows.push([tr("hudWatch"), tr("hudLevel", { n: r.levelId })]);
    rows.push([tr("resultScore"), r.score.toLocaleString("en-US")]);
    rows.push([tr("resultTime"), mmss(r.timeMs)]);
    if (r.mode === "timed") {
      rows.push([tr("hudChain"), String(r.lanesCleared)]);
      rows.push([tr("hudTime"), secs(r.leftMs)]);
    } else if (r.mode === "survival") {
      rows.push([tr("hudRound", { n: r.round }), String(r.ghostsEaten ?? 0)]);
    } else {
      rows.push([tr("resultStars"), `${r.stars} / 3`]);
      rows.push([tr("resultDeaths"), String(r.deaths)]);
    }
    rows.push([tr("resultDots"), `${r.eaten} / ${r.total}`]);
    rows.push([tr("resultGhosts"), String(r.ghostsEaten)]);
    rows.push([tr("resultFruits"), String(r.fruits)]);
    rows.push([tr("resultChain"), `×${r.longestTrain}`]);
    return rows;
  }

  // ------------------------------------------------------------ 工坊

  function buildBrushes({ current, onPick }) {
    el.brushRack.replaceChildren(
      ...BRUSHES.map((brush) => {
        const chip = node("button", `brush-chip${brush === current ? " on" : ""}`);
        chip.type = "button";
        chip.dataset.brush = brush;
        const swatch = node("span", "brush-swatch");
        swatch.style.background = BRUSH_COLOR[brush] ?? "#888";
        chip.append(swatch, node("span", null, tr(BRUSH_KEY[brush] ?? brush)));
        return chip;
      })
    );
    el.brushRack.onclick = (ev) => {
      const chip = ev.target.closest?.(".brush-chip");
      if (chip) onPick(chip.dataset.brush);
    };
  }

  function buildSheets(onPick) {
    el.sheetRack.replaceChildren(
      ...SHEETS.map((sheet) => {
        const chip = node("button", "brush-chip", tr(sheet.nameKey));
        chip.type = "button";
        chip.dataset.sheet = sheet.id;
        return chip;
      })
    );
    el.sheetRack.onclick = (ev) => {
      const chip = ev.target.closest?.(".brush-chip");
      if (chip) onPick(chip.dataset.sheet);
    };
  }

  /** @param {Array<{rule:number,label:string,state:'pass'|'fail'|'warn',note?:string}>} checks */
  function showChecks(checks) {
    el.checkList.replaceChildren(
      ...checks.map((c) => {
        const li = node("li", c.state);
        li.append(node("span", "check-mark", c.state === "pass" ? "✓" : c.state === "warn" ? "!" : "✕"));
        li.append(node("span", null, c.note ? `${c.label} — ${c.note}` : c.label));
        return li;
      })
    );
  }

  /** 把 validate 的 problems 翻成「哪道验收红、为什么」 */
  function checkRows(report, gate) {
    const byRule = new Map();
    for (const p of report.problems ?? []) {
      const prev = byRule.get(p.rule);
      if (!prev) byRule.set(p.rule, { code: p.code, tiles: p.tiles?.length ?? 0, count: 1 });
      else prev.count += 1;
    }
    const rows = [];
    for (const rule of [1, 2, 3, 4]) {
      const bad = byRule.get(rule);
      rows.push({
        rule,
        label: tr(RULE_KEY[rule]),
        state: bad ? "fail" : "pass",
        note: bad ? tr(PROBLEM_KEY[problemHint(bad.code)] ?? "ruleShape") : "",
      });
    }
    rows.push({
      rule: 5,
      label: tr("rule5"),
      state: gate ? (gate.pass ? (gate.warn ? "warn" : "pass") : "fail") : "",
      note: gate ? `${Math.round(gate.eatRate * 100)}%` : tr("btnRehearse"),
    });
    return rows;
  }

  function showCode(code, name) {
    el.laneCode.textContent = code || "—";
    if (name !== undefined && document.activeElement !== el.laneName) el.laneName.value = name;
  }

  /** @param {Array<{code,name,dots,best}>} lanes */
  function buildLanes(lanes, { onOpen, onDrop }) {
    if (!lanes.length) {
      el.laneList.replaceChildren(node("li", "lane-item", tr("arenaEmpty")));
      return;
    }
    el.laneList.replaceChildren(
      ...lanes.map((lane) => {
        const li = node("li", "lane-item");
        li.append(node("span", "lane-name", lane.name || tr("arenaTitle")));
        li.append(node("span", "lane-best", tr("arenaBest", { score: (lane.best?.score ?? 0).toLocaleString("en-US") })));
        const open = node("button", null, tr("toolPlay"));
        open.type = "button";
        open.onclick = () => onOpen(lane.code);
        const drop = node("button", null, tr("toolDeleteSaved"));
        drop.type = "button";
        drop.onclick = () => onDrop(lane.code);
        li.append(open, drop);
        return li;
      })
    );
  }

  // ------------------------------------------------------------ 便签条

  function note(text) {
    el.benchNote.textContent = text || "";
    if (!text) return;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => {
      if (el.benchNote.textContent === text) el.benchNote.textContent = "";
    }, 4200);
  }

  function setSound(on) {
    soundOn = on === true;
    el.btnSound.setAttribute("aria-pressed", String(soundOn));
    el.soundIcon.textContent = soundOn ? "♪" : "✕";
    el.soundText.textContent = soundOn ? tr("soundOn") : tr("soundOff");
  }

  function setPhaseButtons({ paused, over } = {}) {
    el.btnPause.textContent = paused ? tr("btnResume") : tr("btnPause");
    el.btnPause.disabled = over === true;
  }

  function setBenchButtons({ canUndo, canRedo } = {}) {
    el.btnUndo.disabled = canUndo !== true;
    el.btnRedo.disabled = canRedo !== true;
  }

  function toggleBtn(btn, on) {
    if (!btn) return;
    btn.classList.toggle("on", on === true);
  }

  return {
    el,
    tr,
    get locale() {
      return locale;
    },
    setLocale,
    showVeil,
    setNow,
    setWorkshop,
    paintHud,
    buildModes,
    buildLevels,
    showResult,
    buildBrushes,
    buildSheets,
    showChecks,
    checkRows,
    showCode,
    buildLanes,
    note,
    setSound,
    setPhaseButtons,
    setBenchButtons,
    toggleBtn,
    mmss,
  };
}
