// DOM HUD 层：棋盘格、徽章化 HUD、按钮台、面板、toast、i18n 应用、键盘焦点。
// 只读 engine state；不修改任何规则状态。

import { COLS, ROWS, SOLID_COLS, SOLID_ROWS } from "./engine.mjs";
import { motifById, tileStops } from "./motifs.mjs";
import { formatClock } from "./score.mjs";
import { DEFAULT_LOCALE, isLocale, table, t } from "./i18n.mjs";

const SVG_NS = "http://www.w3.org/2000/svg";
const TIMER_CIRCUMFERENCE = 2 * Math.PI * 30;
const COMBO_CIRCUMFERENCE = 2 * Math.PI * 16;
const TOAST_MS = 1900;

export function createUi(options = {}) {
  const doc = options.document || (typeof document !== "undefined" ? document : null);
  if (!doc) return null;

  const byId = (id) => doc.getElementById(id);

  const el = {
    board: byId("board"),
    fx: byId("fx"),
    levelPlaque: byId("level-plaque"),
    levelName: byId("level-name"),
    timerText: byId("timer-text"),
    timerRing: byId("timer-ring"),
    comboCount: byId("combo-count"),
    comboLamp: byId("combo-lamp"),
    comboRing: byId("combo-ring"),
    scoreValue: byId("score-value"),
    bestValue: byId("best-value"),
    stars: byId("stars"),
    hintCount: byId("hint-count"),
    shuffleCount: byId("shuffle-count"),
    btnHint: byId("btn-hint"),
    btnShuffle: byId("btn-shuffle"),
    btnPause: byId("btn-pause"),
    btnLang: byId("btn-lang"),
    overlay: byId("overlay"),
    panels: {
      start: byId("panel-start"),
      pause: byId("panel-pause"),
      result: byId("panel-result"),
      help: byId("panel-help"),
      levels: byId("panel-levels")
    },
    startProgress: byId("start-progress"),
    resultTitle: byId("result-title"),
    resultStars: byId("result-stars"),
    resultLines: byId("result-lines"),
    resultScore: byId("result-score"),
    resultBestBadge: byId("result-best-badge"),
    resultBurst: byId("result-burst"),
    levelGrid: byId("level-grid"),
    boardLive: byId("board-live"),
    toast: byId("toast")
  };

  const starNodes = el.stars ? Array.from(el.stars.querySelectorAll(".star")) : [];
  const resultStarNodes = el.resultStars
    ? Array.from(el.resultStars.querySelectorAll(".star"))
    : [];

  /** @type {Array<Array<{el: HTMLElement, tile: HTMLElement, svg: SVGElement, value: number}>>} */
  const grid = [];
  let locale = DEFAULT_LOCALE;
  let focusCell = null;
  let toastTimer = 0;
  let scoreBumpTimer = 0;
  let lastScore = 0;

  /* ------------------------------------------------------------ 棋盘构建 */

  function buildBoard() {
    if (!el.board) return;
    const frag = doc.createDocumentFragment();
    for (let r = 0; r < ROWS; r += 1) {
      const row = [];
      for (let c = 0; c < COLS; c += 1) {
        const solid = r >= 1 && r <= SOLID_ROWS && c >= 1 && c <= SOLID_COLS;
        let node;
        let tile = null;
        let svg = null;
        if (solid) {
          node = doc.createElement("button");
          node.type = "button";
          node.className = "cell";
          node.setAttribute("role", "gridcell");
          node.setAttribute("tabindex", "-1");
          tile = doc.createElement("span");
          tile.className = "tile";
          svg = doc.createElementNS(SVG_NS, "svg");
          svg.setAttribute("viewBox", "0 0 32 32");
          svg.setAttribute("class", "glyph");
          svg.setAttribute("aria-hidden", "true");
          svg.setAttribute("focusable", "false");
          tile.appendChild(svg);
          node.appendChild(tile);
        } else {
          node = doc.createElement("div");
          node.className = "cell is-void";
          node.setAttribute("aria-hidden", "true");
        }
        node.dataset.r = String(r);
        node.dataset.c = String(c);
        frag.appendChild(node);
        row.push({ el: node, tile, svg, value: -1 });
      }
      grid.push(row);
    }
    el.board.insertBefore(frag, el.fx || null);
  }

  function paintTile(entry, value) {
    if (!entry.tile || !entry.svg) return;
    entry.value = value;
    while (entry.svg.firstChild) entry.svg.removeChild(entry.svg.firstChild);
    if (value === 0) {
      entry.el.classList.add("is-empty");
      entry.el.classList.remove("has-tile");
      entry.tile.removeAttribute("style");
      return;
    }
    entry.el.classList.remove("is-empty");
    entry.el.classList.add("has-tile");
    const motif = motifById(value);
    const stops = tileStops(value);
    entry.tile.style.setProperty("--tile-lt", stops.lt);
    entry.tile.style.setProperty("--tile-mid", stops.mid);
    entry.tile.style.setProperty("--tile-dk", stops.dk);
    for (let i = 0; i < motif.paths.length; i += 1) {
      const path = doc.createElementNS(SVG_NS, "path");
      path.setAttribute("d", motif.paths[i]);
      path.setAttribute("fill-rule", "evenodd");
      entry.svg.appendChild(path);
    }
  }

  function cellLabel(r, c, value) {
    if (value === 0) return formatText(t(locale, "cellEmpty"), { r: r, c: c });
    const motif = motifById(value);
    const name = locale === "en" ? motif.en : motif.zh;
    return formatText(t(locale, "cellTile"), { r: r, c: c, name: name });
  }

  function formatText(str, vars) {
    if (typeof str !== "string") return "";
    return str.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));
  }

  /* ------------------------------------------------------------ 键盘焦点 */

  function focusableCells() {
    const list = [];
    for (let r = 1; r <= SOLID_ROWS; r += 1) {
      for (let c = 1; c <= SOLID_COLS; c += 1) list.push({ r: r, c: c });
    }
    return list;
  }

  function setFocus(cell, moveDom) {
    if (!cell) return;
    focusCell = { r: cell.r, c: cell.c };
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        const entry = grid[r][c];
        if (!entry.tile) continue;
        entry.el.setAttribute("tabindex", r === focusCell.r && c === focusCell.c ? "0" : "-1");
      }
    }
    if (moveDom) {
      const entry = grid[focusCell.r][focusCell.c];
      if (entry && typeof entry.el.focus === "function") {
        try {
          entry.el.focus({ preventScroll: true });
        } catch {
          entry.el.focus();
        }
      }
    }
  }

  function ensureFocus(board) {
    if (focusCell && board[focusCell.r][focusCell.c] !== 0) {
      setFocus(focusCell, false);
      return;
    }
    const all = focusableCells();
    for (let i = 0; i < all.length; i += 1) {
      if (board[all[i].r][all[i].c] !== 0) {
        setFocus(all[i], false);
        return;
      }
    }
    setFocus({ r: 1, c: 1 }, false);
  }

  function moveFocus(dr, dc, board) {
    if (!focusCell || !board) return false;
    let r = focusCell.r;
    let c = focusCell.c;
    for (let step = 0; step < ROWS + COLS; step += 1) {
      r += dr;
      c += dc;
      if (r < 1 || r > SOLID_ROWS || c < 1 || c > SOLID_COLS) return false;
      if (board[r][c] !== 0) {
        setFocus({ r: r, c: c }, true);
        return true;
      }
    }
    return false;
  }

  /* ------------------------------------------------------------ 渲染 */

  function render(state, meta) {
    if (!state) return;
    const board = state.board;

    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        const entry = grid[r][c];
        if (!entry || !entry.tile) continue;
        const value = board[r][c];
        if (entry.value !== value) paintTile(entry, value);
        entry.el.setAttribute("aria-label", cellLabel(r, c, value));
        const selected = state.selected && state.selected.r === r && state.selected.c === c;
        entry.el.classList.toggle("is-selected", Boolean(selected));
        const hinted =
          state.hintPair &&
          state.hintPair.some((cell) => cell.r === r && cell.c === c);
        entry.el.classList.toggle("is-hint", Boolean(hinted));
      }
    }

    ensureFocus(board);

    if (el.levelPlaque) el.levelPlaque.textContent = String(state.level);
    if (el.levelName) {
      const name = state.params.chapterName;
      el.levelName.textContent = locale === "en" ? name.en : name.zh;
    }

    renderClocks(state);

    if (el.bestValue && meta && Number.isFinite(meta.best)) {
      el.bestValue.textContent = String(meta.best);
    }

    const stars = state.phase === "won" ? state.stars : meta && Number.isFinite(meta.stars) ? meta.stars : 0;
    for (let i = 0; i < starNodes.length; i += 1) {
      starNodes[i].classList.toggle("is-on", i < stars);
    }
    if (el.stars) {
      el.stars.setAttribute(
        "aria-label",
        (locale === "en" ? "Stars " : "星级 ") + stars + " / 3"
      );
    }

    if (el.hintCount) el.hintCount.textContent = String(state.hintsLeft);
    if (el.shuffleCount) el.shuffleCount.textContent = String(state.shufflesLeft);
    if (el.btnHint) el.btnHint.disabled = state.hintsLeft <= 0 || state.phase !== "playing";
    if (el.btnShuffle) el.btnShuffle.disabled = state.shufflesLeft <= 0 || state.phase !== "playing";
    if (el.btnPause) el.btnPause.disabled = state.phase !== "playing" && state.phase !== "paused";
  }

  /** 高频部分（每帧调用）：倒计时、连击窗口、得分。只在数值变化时写 DOM。 */
  function renderClocks(state) {
    if (!state) return;

    const ratio = state.params.timeMs > 0 ? state.remainingMs / state.params.timeMs : 0;
    const clock = formatClock(state.remainingMs);
    if (el.timerText && el.timerText.textContent !== clock) el.timerText.textContent = clock;
    const timerFill = el.timerRing ? el.timerRing.querySelector(".ring-fill") : null;
    if (timerFill) {
      timerFill.style.strokeDashoffset = String(TIMER_CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, ratio))));
    }
    if (el.timerRing) el.timerRing.classList.toggle("is-low", ratio <= 0.2);

    const combo = String(state.combo);
    if (el.comboCount && el.comboCount.textContent !== combo) el.comboCount.textContent = combo;
    if (el.comboLamp) el.comboLamp.classList.toggle("is-hot", state.combo >= 1);
    const comboFill = el.comboRing ? el.comboRing.querySelector(".ring-fill") : null;
    if (comboFill) {
      const comboRatio = Math.max(0, Math.min(1, state.comboTimerMs / 3000));
      comboFill.style.strokeDashoffset = String(COMBO_CIRCUMFERENCE * (1 - comboRatio));
    }

    if (el.scoreValue) {
      const next = String(state.score);
      if (el.scoreValue.textContent !== next) {
        el.scoreValue.textContent = next;
        if (state.score !== lastScore) bump(el.scoreValue);
      }
      lastScore = state.score;
    }
  }

  function bump(node) {
    if (!node) return;
    node.classList.remove("bump");
    void node.offsetWidth;
    node.classList.add("bump");
    if (scoreBumpTimer) clearTimeout(scoreBumpTimer);
    scoreBumpTimer = setTimeout(() => node.classList.remove("bump"), 380);
  }

  function flash(cell, kind) {
    if (!cell) return;
    const entry = grid[cell.r] && grid[cell.r][cell.c];
    if (!entry) return;
    const cls = kind === "invalid" ? "is-invalid" : "is-breath";
    entry.el.classList.remove(cls);
    void entry.el.offsetWidth;
    entry.el.classList.add(cls);
    setTimeout(() => entry.el.classList.remove(cls), kind === "invalid" ? 300 : 480);
  }

  function flashComboLamp() {
    if (!el.comboLamp) return;
    el.comboLamp.classList.remove("flash");
    void el.comboLamp.offsetWidth;
    el.comboLamp.classList.add("flash");
    setTimeout(() => el.comboLamp.classList.remove("flash"), 760);
  }

  function announce(text) {
    if (!el.boardLive) return;
    el.boardLive.textContent = "";
    setTimeout(() => {
      el.boardLive.textContent = text;
    }, 30);
  }

  function toast(key, vars) {
    if (!el.toast) return;
    el.toast.textContent = formatText(t(locale, key), vars || {});
    el.toast.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.toast.hidden = true;
    }, TOAST_MS);
  }

  /* ------------------------------------------------------------ 面板 */

  function openPanel(name) {
    if (!el.overlay) return;
    el.overlay.hidden = false;
    Object.keys(el.panels).forEach((key) => {
      const node = el.panels[key];
      if (node) node.hidden = key !== name;
    });
    const target = el.panels[name];
    if (target) {
      const focusable = target.querySelector("button");
      if (focusable) setTimeout(() => focusable.focus(), 40);
    }
  }

  function closePanel() {
    if (!el.overlay) return;
    el.overlay.hidden = true;
    Object.keys(el.panels).forEach((key) => {
      const node = el.panels[key];
      if (node) node.hidden = true;
    });
  }

  function panelOpen() {
    return Boolean(el.overlay && !el.overlay.hidden);
  }

  function fillStars(nodes, count, stagger) {
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i];
      node.classList.remove("is-on");
      if (i < count) {
        node.style.animationDelay = stagger ? i * 180 + "ms" : "0ms";
        setTimeout(() => node.classList.add("is-on"), stagger ? i * 180 : 0);
      }
    }
  }

  function showResult(payload) {
    const isEndless = payload.mode === "endless";
    const won = payload.phase === "won";
    if (el.resultTitle) {
      el.resultTitle.textContent = isEndless
        ? t(locale, "endlessOver")
        : won
          ? t(locale, "levelClear")
          : payload.failReason === "deadlock"
            ? t(locale, "loseDeadlock")
            : t(locale, "loseTimeUp");
    }
    fillStars(resultStarNodes, won ? payload.stars : 0, true);

    if (el.resultLines) {
      el.resultLines.textContent = "";
      const rows = isEndless
        ? [
            [t(locale, "endlessBoards"), String(payload.clearedBoards)],
            [t(locale, "resComboPeak"), String(payload.comboPeak)],
            [t(locale, "endlessBest"), String(payload.best)]
          ]
        : [
            [t(locale, "resPairs"), String(payload.clearedPairs)],
            [t(locale, "resComboPeak"), String(payload.comboPeak)],
            [t(locale, "resTimeBonus"), "+" + String(payload.timeBonus)],
            [t(locale, "resItemBonus"), "+" + String(payload.itemBonus)]
          ];
      rows.forEach((row, i) => {
        const dt = doc.createElement("dt");
        dt.textContent = row[0];
        dt.style.animationDelay = 120 + i * 90 + "ms";
        const dd = doc.createElement("dd");
        dd.textContent = row[1];
        dd.style.animationDelay = 120 + i * 90 + "ms";
        el.resultLines.appendChild(dt);
        el.resultLines.appendChild(dd);
      });
    }

    if (el.resultScore) el.resultScore.textContent = String(payload.score);
    if (el.resultBestBadge) el.resultBestBadge.hidden = !payload.record;
    const nextBtn = byId("btn-next");
    if (nextBtn) nextBtn.textContent = t(locale, isEndless ? "selectLevel" : "nextLevel");
    if (el.resultBurst) buildBurst(el.resultBurst);
    openPanel("result");
  }

  function buildBurst(host) {
    host.textContent = "";
    const count = 16;
    for (let i = 0; i < count; i += 1) {
      const dot = doc.createElement("i");
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const dist = 70 + Math.random() * 90;
      dot.style.setProperty("--dx", Math.round(Math.cos(angle) * dist) + "px");
      dot.style.setProperty("--dy", Math.round(Math.sin(angle) * dist) + "px");
      dot.style.setProperty("--delay", Math.round(Math.random() * 140) + "ms");
      host.appendChild(dot);
    }
  }

  function setStartProgress(progress) {
    if (!el.startProgress) return;
    const unlocked = progress && Number.isFinite(progress.unlocked) ? progress.unlocked : 1;
    el.startProgress.textContent = unlocked + " / 36";
  }

  function buildLevels(progress, currentLevel, onChoose) {
    if (!el.levelGrid) return;
    el.levelGrid.textContent = "";
    const unlocked = progress && Number.isFinite(progress.unlocked) ? progress.unlocked : 1;
    const levels = progress && progress.levels ? progress.levels : {};
    for (let level = 1; level <= 36; level += 1) {
      const btn = doc.createElement("button");
      btn.type = "button";
      btn.className = "level-btn";
      btn.textContent = String(level);
      const locked = level > unlocked;
      btn.disabled = locked;
      btn.setAttribute(
        "aria-label",
        locked
          ? formatText(t(locale, "levelLocked"), { n: level })
          : formatText(t(locale, "levelButton"), { n: level })
      );
      const record = levels[String(level)];
      const starRow = doc.createElement("span");
      starRow.className = "level-stars";
      for (let s = 0; s < 3; s += 1) {
        const star = doc.createElement("span");
        star.className = "star" + (record && s < record.stars ? " is-on" : "");
        starRow.appendChild(star);
      }
      btn.appendChild(starRow);
      if (level === currentLevel) btn.classList.add("is-current");
      btn.addEventListener("click", () => onChoose(level));
      el.levelGrid.appendChild(btn);
    }
  }

  /* ------------------------------------------------------------ i18n */

  function applyStaticI18n(nextLocale) {
    locale = isLocale(nextLocale) ? nextLocale : DEFAULT_LOCALE;
    doc.documentElement.setAttribute("lang", locale === "zh" ? "zh-CN" : "en");

    const tableRef = table(locale);
    doc.querySelectorAll("[data-i18n]").forEach((node) => {
      const key = node.getAttribute("data-i18n");
      if (key && typeof tableRef[key] === "string") node.textContent = tableRef[key];
    });
    doc.querySelectorAll("[data-i18n-label]").forEach((node) => {
      const key = node.getAttribute("data-i18n-label");
      if (key && typeof tableRef[key] === "string") node.setAttribute("aria-label", tableRef[key]);
    });
    doc.querySelectorAll("[data-i18n-title]").forEach((node) => {
      const key = node.getAttribute("data-i18n-title");
      if (key && typeof tableRef[key] === "string") node.setAttribute("title", tableRef[key]);
    });

    if (el.btnLang) el.btnLang.textContent = locale === "zh" ? "EN" : "中文";
    if (el.board) {
      el.board.setAttribute(
        "aria-label",
        formatText(t(locale, "boardAria"), { rows: SOLID_ROWS, cols: SOLID_COLS })
      );
    }
  }

  buildBoard();

  return {
    el,
    grid,
    render,
    renderClocks,
    flash,
    flashComboLamp,
    announce,
    toast,
    openPanel,
    closePanel,
    panelOpen,
    showResult,
    setStartProgress,
    buildLevels,
    applyStaticI18n,
    setFocus,
    moveFocus,
    focusCell: () => focusCell,
    getLocale: () => locale
  };
}
