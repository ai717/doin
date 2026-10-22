// UI 层：渲染循环、指针/键盘输入、DOM 面板、语言热更新装配。
// 唯一碰 DOM 的模块（Canvas 绘制委托 render.mjs）。不碰规则、不自算分。

import { RED, sideOf, rowOf, colOf, idx, ROWS, COLS } from "./engine.mjs";
import { draw } from "./render.mjs";
import { XiangqiGame, MODE_CAMPAIGN, MODE_AI, MODE_2P } from "./game.mjs";
import { TIER_KEYS, tierConfig } from "./ai.mjs";
import { PUZZLE_CHAPTERS, PUZZLES } from "./puzzles.mjs";
import { campaignStars, duelSummary, MAX_UNDO_PER_DUEL, badgeKeyForTier } from "./score.mjs";
import * as storage from "./storage.mjs";
import { strings, t, getLocale, setLocale, htmlLang } from "./i18n.mjs";
import * as audio from "./audio.mjs";

export function createApp() {
  const canvas = document.getElementById("board");
  const els = {
    statusLeft: document.getElementById("status-left"),
    statusRight: document.getElementById("status-right"),
    cardLevel: document.getElementById("card-level"),
    cardGoal: document.getElementById("card-goal"),
    cardMoves: document.getElementById("card-moves"),
    duelRecord: document.getElementById("duel-record"),
    duelStreak: document.getElementById("duel-streak"),
    badgeRow: document.getElementById("badge-row"),
    tierList: document.getElementById("tier-list"),
    btnUndo: document.getElementById("btn-undo"),
    btnRestart: document.getElementById("btn-restart"),
    btnLevels: document.getElementById("btn-levels"),
    btnHint: document.getElementById("btn-hint"),
    btnSound: document.getElementById("btn-sound"),
    btnLang: document.getElementById("btn-lang"),
    btnHelp: document.getElementById("btn-help"),
    drawer: document.getElementById("level-drawer"),
    drawerChapters: document.getElementById("drawer-chapters"),
    btnDrawerClose: document.getElementById("btn-drawer-close"),
    resultModal: document.getElementById("result-modal"),
    resultTitle: document.getElementById("result-title"),
    resultDetail: document.getElementById("result-detail"),
    btnResultPrimary: document.getElementById("btn-result-primary"),
    btnResultSecondary: document.getElementById("btn-result-secondary"),
    helpModal: document.getElementById("help-modal"),
    helpBody: document.getElementById("help-body"),
    btnHelpClose: document.getElementById("btn-help-close"),
    tabs: {
      [MODE_CAMPAIGN]: document.getElementById("tab-campaign"),
      [MODE_AI]: document.getElementById("tab-ai"),
      [MODE_2P]: document.getElementById("tab-2p"),
    },
  };

  const app = {
    mode: MODE_CAMPAIGN,
    cursor: idx(9, 4),
    dragging: null,
    dragArmed: false,
    save: storage.loadSave(),
    lastOver: null,
  };

  // 首个未通关残局（即开即玩默认载入）
  function firstUnfinishedLevel() {
    for (const chapter of PUZZLE_CHAPTERS) {
      for (const levelKey of chapter.levels) {
        if (!app.save.campaign.levels[levelKey]) return levelKey;
      }
    }
    return PUZZLE_CHAPTERS[0].levels[0];
  }

  function levelUnlocked(levelKey) {
    const n = Number(levelKey.slice("level_".length));
    if (n <= 1) return true;
    return Boolean(app.save.campaign.levels[`level_${n - 1}`]);
  }

  // 构造期 XiangqiGame 会同步回调 onChange，此时 game 还未完成赋值 ——
  // syncPanels 以 null 哨兵防御，构造完成后再由 applyLocale 补齐首帧同步。
  let game = null;
  game = new XiangqiGame({
    mode: MODE_CAMPAIGN,
    levelKey: firstUnfinishedLevel(),
    hintEnabled: app.save.settings.hint,
    aiTier: app.save.aiTier,
    onChange: () => syncPanels(),
    onEvent: (type, payload) => handleEvent(type, payload),
    onOver: (summary) => handleOver(summary),
  });
  app.game = game;

  // ─── 事件音效 ──────────────────────────────────────────────────
  function handleEvent(type) {
    if (app.save.settings.sound !== true) return;
    switch (type) {
      case "select":
      case "denied":
        audio.playDrag();
        break;
      case "move":
        audio.playPlace();
        break;
      case "capture":
        audio.playCapture();
        break;
      case "check":
        audio.playCheck();
        break;
      case "over":
        audio.playMate();
        break;
      default:
        break;
    }
  }

  // ─── 终局处理 ──────────────────────────────────────────────────
  function handleOver(summary) {
    app.lastOver = summary;
    if (summary.mode === MODE_CAMPAIGN && summary.redWon && summary.levelKey) {
      app.save = storage.recordCampaignResult(summary.levelKey, summary.stars, summary.movesUsed);
    } else if (summary.mode === MODE_AI) {
      app.save = storage.recordDuelResult(summary.redWon, summary.draw, summary.aiTier);
    }
    syncPanels();

    const primary = els.btnResultPrimary;
    if (summary.mode === MODE_CAMPAIGN) {
      if (summary.redWon) {
        els.resultTitle.textContent = t("winTitle");
        els.resultDetail.textContent = t("winDetail", { n: summary.movesUsed, par: summary.par });
        const n = Number(summary.levelKey.slice("level_".length));
        const next = `level_${n + 1}`;
        if (PUZZLES[next]) {
          primary.textContent = t("btnNextLevel");
          primary.dataset.intent = "next";
        } else {
          primary.textContent = t("btnLevels");
          primary.dataset.intent = "levels";
        }
      } else {
        els.resultTitle.textContent = t("loseTitle");
        els.resultDetail.textContent = t("loseDetail");
        primary.textContent = t("btnRetry");
        primary.dataset.intent = "retry";
      }
    } else if (summary.draw) {
      els.resultTitle.textContent = t("duelDrawTitle");
      els.resultDetail.textContent = t("uiDraw");
      primary.textContent = t("btnAgain");
      primary.dataset.intent = "again";
    } else if (summary.redWon) {
      els.resultTitle.textContent = t("duelWinTitle");
      const badge = summary.mode === MODE_AI ? t("badgeEarned", { tier: t(summary.aiTier) }) : "";
      els.resultDetail.textContent = badge;
      primary.textContent = t("btnAgain");
      primary.dataset.intent = "again";
    } else {
      els.resultTitle.textContent = t("duelLoseTitle");
      els.resultDetail.textContent = t("uiCheck");
      primary.textContent = t("btnAgain");
      primary.dataset.intent = "again";
    }
    els.resultModal.hidden = false;
  }

  // ─── 面板同步（每次 onChange / over / locale）──────────────────
  function syncPanels() {
    if (!game) return;
    const state = game.state;
    const fx = state.fx;

    // 状态条
    let left;
    if (state.status !== "playing") {
      const kind = state.result?.kind;
      left = kind === "perpetual" ? t("uiPerpetual")
        : kind === "stalemate" ? t("uiStalemate")
        : kind === "bare" || kind === "repetition" ? t("uiDraw")
        : t("uiMate");
    } else if (game.aiThinking) {
      left = t("thinking");
    } else if (game.mode === MODE_2P) {
      left = state.turn === RED ? t("redTurn") : t("blackTurn");
    } else {
      left = t("redTurn");
    }
    if (state.status === "playing" && fx.checkFlash > 0) left = t("uiCheck");
    els.statusLeft.textContent = left;

    if (game.mode === MODE_CAMPAIGN) {
      const par = game.par();
      els.statusRight.textContent = `${t("statMoves", { n: game.movesUsed() })} / ${t("statPar", { par })}`;
      els.cardLevel.textContent = levelDisplayName(game.levelKey);
      els.cardGoal.textContent = t("goalText", { par });
      els.cardMoves.textContent = t("statMoves", { n: game.movesUsed() });
    } else if (game.mode === MODE_AI) {
      const tier = tierConfig(game.aiTier);
      els.statusRight.textContent = `${t(game.aiTier)}${game.undoLeft < MAX_UNDO_PER_DUEL ? ` · ${t("undoCount", { n: game.undoLeft })}` : ""}`;
      els.cardLevel.textContent = t("modeAi");
      els.cardGoal.textContent = `${t("statDepth", { n: tier.depth })} · ${t("statBlunder", { pct: Math.round(tier.blunderRate * 100) })}`;
      els.cardMoves.textContent = "";
    } else {
      els.statusRight.textContent = `${t("sideRed")} / ${t("sideBlack")}`;
      els.cardLevel.textContent = t("mode2p");
      els.cardGoal.textContent = t("selectPiece");
      els.cardMoves.textContent = state.status === "playing" ? (state.turn === RED ? t("redTurn") : t("blackTurn")) : "";
    }

    // 记分簿
    const summary = duelSummary(app.save.duel);
    els.duelRecord.textContent = t("duelRecord", { w: summary.wins, l: summary.losses, d: summary.draws });
    els.duelStreak.textContent = t("streakText", { n: summary.streak });
    renderBadges(summary.badges);
    renderTierList();
    renderTabs();
    els.btnUndo.disabled = !game.undoAvailable();
    els.btnHint.classList.toggle("active", game.hintEnabled);
    els.btnHint.textContent = game.hintEnabled ? t("hintOn") : t("hintOff");
  }

  function levelDisplayName(levelKey) {
    const n = Number(levelKey.slice("level_".length));
    const chapterIndex = Math.floor((n - 1) / 6);
    const chapter = PUZZLE_CHAPTERS[chapterIndex];
    if (!chapter) return t("levelShort", { n });
    return t("levelTitle", { ch: chapterIndex + 1, chapter: t(chapter.key), n: ((n - 1) % 6) + 1 });
  }

  function renderBadges(badges) {
    els.badgeRow.textContent = "";
    for (const key of TIER_KEYS) {
      const chip = document.createElement("span");
      chip.className = "badge-chip" + (badges[badgeKeyForTier(key)] ? " earned" : "");
      chip.textContent = badges[badgeKeyForTier(key)] ? t(key) : t("badgeLocked");
      els.badgeRow.appendChild(chip);
    }
  }

  function renderTierList() {
    els.tierList.textContent = "";
    for (const key of TIER_KEYS) {
      const tier = tierConfig(key);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tier-btn" + (game.aiTier === key ? " active" : "");
      const name = document.createElement("span");
      name.textContent = t(key);
      const meta = document.createElement("span");
      meta.className = "tier-badge" + (app.save.duel.badges[badgeKeyForTier(key)] ? " earned" : "");
      meta.textContent = `${t("statDepth", { n: tier.depth })} · ${Math.round(tier.blunderRate * 100)}%`;
      btn.appendChild(name);
      btn.appendChild(meta);
      btn.addEventListener("click", () => {
        game.aiTier = key;
        app.save = storage.saveAiTier(key);
        if (game.mode !== MODE_AI) switchMode(MODE_AI);
        else syncPanels();
      });
      els.tierList.appendChild(btn);
    }
  }

  function renderTabs() {
    for (const [mode, tab] of Object.entries(els.tabs)) {
      tab.classList.toggle("active", game.mode === mode);
    }
  }

  // ─── 选关抽屉 ──────────────────────────────────────────────────
  function renderDrawer() {
    els.drawerChapters.textContent = "";
    PUZZLE_CHAPTERS.forEach((chapter, chapterIndex) => {
      const block = document.createElement("div");
      block.className = "chapter-block";
      const name = document.createElement("h3");
      name.className = "chapter-name";
      name.textContent = `${chapterIndex + 1} · ${t(chapter.key)}`;
      block.appendChild(name);
      const grid = document.createElement("div");
      grid.className = "level-grid";
      for (const levelKey of chapter.levels) {
        const n = Number(levelKey.slice("level_".length));
        const record = app.save.campaign.levels[levelKey];
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "level-chip" + (game.levelKey === levelKey ? " current" : "");
        chip.disabled = !levelUnlocked(levelKey);
        chip.title = chip.disabled ? t("levelLocked") : "";
        const no = document.createElement("span");
        no.className = "no";
        no.textContent = String(((n - 1) % 6) + 1);
        const stars = document.createElement("span");
        stars.className = "stars";
        stars.textContent = record ? "★".repeat(record.stars) + "☆".repeat(3 - record.stars) : "·";
        chip.appendChild(no);
        chip.appendChild(stars);
        chip.addEventListener("click", () => {
          els.drawer.hidden = true;
          game.newGame(MODE_CAMPAIGN, { levelKey });
        });
        grid.appendChild(chip);
      }
      block.appendChild(grid);
      els.drawerChapters.appendChild(block);
    });
  }

  function switchMode(mode) {
    els.resultModal.hidden = true;
    if (mode === MODE_CAMPAIGN) {
      game.newGame(MODE_CAMPAIGN, { levelKey: game.levelKey ?? firstUnfinishedLevel() });
    } else {
      game.newGame(mode, { aiTier: game.aiTier });
    }
    syncPanels();
  }

  // ─── 渲染循环 ──────────────────────────────────────────────────
  let lastTime = 0;
  function frame(now) {
    const dt = Math.min(100, lastTime ? now - lastTime : 16.7);
    lastTime = now;
    game.stepFrame(dt);
    drawView();
    requestAnimationFrame(frame);
  }

  function drawView() {
    const state = game.state;
    draw(canvas, state, {
      selected: game.selected,
      legalTargets: game.legalTargets(),
      checkIndex: state.fx.checkFlash > 0 ? state.fx.checkAt : -1,
      hint: game.hintMove(),
      dragging: app.dragging,
      cursor: app.cursor,
    });
  }

  // ─── 指针输入（点选 + 拖放双通道）──────────────────────────────
  // pixelToCell 需要与 render.computeMetrics 一致的度量，这里直接重算
  function hitCell(event) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return -1;
    const cs = Math.min(rect.width / (COLS + 1.2), rect.height / (ROWS + 1.4));
    const ox = (rect.width - (COLS - 1) * cs) / 2;
    const oy = (rect.height - (ROWS - 1) * cs) / 2;
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const col = Math.round((x - ox) / cs);
    const row = Math.round((y - oy) / cs);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return -1;
    const dist = Math.hypot(x - (ox + col * cs), y - (oy + row * cs));
    if (dist > cs * 0.46) return -1;
    return idx(row, col);
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (event.button === 2) return;
    canvas.setPointerCapture(event.pointerId);
    const cell = hitCell(event);
    app.dragArmed = cell >= 0 && game.isHumanTurn()
      && state_hasOwnPiece(cell);
    if (!app.dragArmed) {
      game.tapSquare(cell);
      return;
    }
    app.dragging = { from: cell, x: event.clientX - canvas.getBoundingClientRect().left, y: event.clientY - canvas.getBoundingClientRect().top };
  });

  function state_hasOwnPiece(cell) {
    const piece = game.state.board[cell];
    return piece !== 0 && sideOf(piece) === game.state.turn;
  }

  canvas.addEventListener("pointermove", (event) => {
    if (!app.dragging) return;
    const rect = canvas.getBoundingClientRect();
    app.dragging = { from: app.dragging.from, x: event.clientX - rect.left, y: event.clientY - rect.top };
  });

  canvas.addEventListener("pointerup", (event) => {
    if (app.dragging) {
      const from = app.dragging.from;
      app.dragging = null;
      const to = hitCell(event);
      if (to >= 0 && to !== from) game.dragMove(from, to);
      else if (to === from) game.tapSquare(from);
      else drawView();
      return;
    }
    app.dragArmed = false;
  });

  canvas.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    game.cancelSelection();
  });

  // ─── 键盘 ──────────────────────────────────────────────────────
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!els.helpModal.hidden) { els.helpModal.hidden = true; return; }
      if (!els.drawer.hidden) { els.drawer.hidden = true; return; }
      if (!els.resultModal.hidden) { els.resultModal.hidden = true; return; }
      game.cancelSelection();
      return;
    }
    if (event.key === "u" || event.key === "U") {
      game.undo();
      return;
    }
    if (game.mode === MODE_AI && /^[1-5]$/.test(event.key)) {
      const key = `ai_${event.key}`;
      game.aiTier = key;
      app.save = storage.saveAiTier(key);
      syncPanels();
      return;
    }
    const moves = {
      ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
      w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
      W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0],
    };
    if (moves[event.key]) {
      event.preventDefault();
      const [dc, dr] = moves[event.key];
      const col = Math.min(COLS - 1, Math.max(0, colOf(app.cursor) + dc));
      const row = Math.min(ROWS - 1, Math.max(0, rowOf(app.cursor) + dr));
      app.cursor = idx(row, col);
      return;
    }
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      if (!els.helpModal.hidden || !els.drawer.hidden) return;
      game.tapSquare(app.cursor);
    }
  });

  // ─── 按钮 ──────────────────────────────────────────────────────
  els.btnUndo.addEventListener("click", () => game.undo());
  els.btnRestart.addEventListener("click", () => {
    els.resultModal.hidden = true;
    game.restart();
    syncPanels();
  });
  els.btnLevels.addEventListener("click", () => {
    if (game.mode !== MODE_CAMPAIGN) switchMode(MODE_CAMPAIGN);
    renderDrawer();
    els.drawer.hidden = false;
  });
  els.btnDrawerClose.addEventListener("click", () => { els.drawer.hidden = true; });
  els.btnHint.addEventListener("click", () => {
    const next = !game.hintEnabled;
    game.setHintEnabled(next);
    app.save = storage.saveSettings({ hint: next });
    syncPanels();
  });
  els.btnSound.addEventListener("click", () => {
    const next = !app.save.settings.sound;
    app.save = storage.saveSettings({ sound: next });
    audio.setMuted(!next);
    if (next) audio.startAmbience();
    els.btnSound.textContent = next ? "🔊" : "🔇";
    syncPanels();
  });
  els.btnHelp.addEventListener("click", () => { els.helpBody.textContent = t("helpBody"); els.helpModal.hidden = false; });
  els.btnHelpClose.addEventListener("click", () => { els.helpModal.hidden = true; });
  els.btnResultPrimary.addEventListener("click", () => {
    els.resultModal.hidden = true;
    const intent = els.btnResultPrimary.dataset.intent;
    if (intent === "next") {
      const n = Number(app.lastOver.levelKey.slice("level_".length));
      game.newGame(MODE_CAMPAIGN, { levelKey: `level_${n + 1}` });
    } else if (intent === "retry" || intent === "again") {
      game.restart();
    } else if (intent === "levels") {
      switchMode(MODE_CAMPAIGN);
      renderDrawer();
      els.drawer.hidden = false;
    }
    syncPanels();
  });
  els.btnResultSecondary.addEventListener("click", () => {
    els.resultModal.hidden = true;
    if (game.mode !== MODE_CAMPAIGN) switchMode(MODE_CAMPAIGN);
    renderDrawer();
    els.drawer.hidden = false;
  });
  for (const [mode, tab] of Object.entries(els.tabs)) {
    tab.addEventListener("click", () => switchMode(mode));
  }

  // ─── 语言热更新（零副作用）────────────────────────────────────
  function applyLocale(locale) {
    setLocale(locale);
    document.documentElement.lang = htmlLang(locale);
    document.title = t("docTitle");
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (t(key) !== undefined) el.textContent = t(key);
    });
    document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      const key = el.getAttribute("data-i18n-aria");
      if (t(key) !== undefined) el.setAttribute("aria-label", t(key));
    });
    els.btnLang.textContent = locale === "en" ? "中文" : "EN";
    els.helpBody.textContent = t("helpBody");
    els.btnHint.textContent = game.hintEnabled ? t("hintOn") : t("hintOff");
    syncPanels();
    if (!els.drawer.hidden) renderDrawer();
    drawView();
  }

  els.btnLang.addEventListener("click", () => {
    const next = getLocale() === "en" ? "zh" : "en";
    try { localStorage.setItem("doin.lang", next); } catch { /* 静默 */ }
    applyLocale(next);
  });

  // ─── 启动 ──────────────────────────────────────────────────────
  audio.setMuted(app.save.settings.sound !== true);
  els.btnSound.textContent = app.save.settings.sound ? "🔊" : "🔇";
  const initialLocale = (() => {
    try { return localStorage.getItem("doin.lang") === "en" ? "en" : "zh"; } catch { return "zh"; }
  })();
  applyLocale(initialLocale);
  document.addEventListener("pointerdown", () => {
    if (app.save.settings.sound) audio.startAmbience();
  }, { once: true });
  requestAnimationFrame(frame);

  return { game, app, applyLocale };
}
