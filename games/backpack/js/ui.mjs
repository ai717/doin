// ui.mjs — 背包竞技场渲染层（唯一碰 DOM / Canvas 的层）
// 长桌机台：左背包棋盘 / 右商队柜台 / 战斗幕布 / 覆盖面板。
// 交互：点击选择、拖拽摆放、拖到另一件上交换、拖出棋盘出售、R 旋转、右键旋转。

import { strings, format, pickLocalized } from "./i18n.mjs";
import { ITEMS, CLASSES, ENEMIES, EXPEDITION, CLASS_ORDER, PUZZLES, enemyForRound } from "./data.mjs";
import { expansionCost } from "./engine.mjs";
import { RANK_NAMES } from "./score.mjs";
import { defaultState, setMuted as storageSetMuted, recordPuzzle, recordExpedition, recordMirror } from "./storage.mjs";
import { hashSeed } from "./game.mjs";
import * as SFX from "./audio.mjs";

const PUZZLE_LIST = PUZZLES;

const $ = (id) => document.getElementById(id);

export function createUI(controller, { save, loadSave, saveRun, loadRun, clearRun }) {
  const ui = {
    controller,
    locale: controller.getState().lang,
    selectedUid: null,
    drag: null,
    battleTimer: null,
  };

  const T = () => strings(ui.locale);
  const fmt = (key, ...args) => format(T()[key] ?? key, ...args);

  function nameOf(itemId) {
    const data = ITEMS[itemId];
    return data ? pickLocalized(data.name, ui.locale, itemId) : itemId;
  }

  // ---------------- 通用面板工具 ----------------
  function panel(id) {
    return $(id);
  }

  function showPanel(id) {
    for (const p of document.querySelectorAll(".panel")) p.hidden = true;
    const el = panel(id);
    if (el) el.hidden = false;
    $("overlay").hidden = false;
  }

  function hideOverlay() {
    $("overlay").hidden = true;
    for (const p of document.querySelectorAll(".panel")) p.hidden = true;
  }

  function toast(message) {
    const wrap = $("toasts");
    const el = document.createElement("p");
    el.className = "toast";
    el.textContent = message;
    wrap.appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));
    SFX.toast();
    setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => el.remove(), 400);
    }, 2400);
  }

  // ---------------- 渲染入口 ----------------
  function render() {
    const state = controller.getState();
    ui.locale = state.lang;
    applyLang();
    if (state.mode === "menu") renderMenu();
    else if (state.mode === "expedition") renderExpedition();
    else if (state.mode === "puzzle") renderPuzzle();
    else if (state.mode === "mirror") renderMirror();
  }

  function applyLang() {
    document.documentElement.lang = ui.locale === "zh" ? "zh-CN" : "en";
    document.title = T().docTitle;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", T().metaDesc);
    const back = $("back-home");
    if (back) back.textContent = T().back;
    const sound = $("sound-btn");
    if (sound) {
      sound.setAttribute("aria-label", T().ariaSound);
      sound.title = T().sound;
      sound.innerHTML = `<span>${ui.muted ? "✕" : "♪"}</span>`;
    }
    const lang = $("lang-btn");
    if (lang) {
      lang.setAttribute("aria-label", T().ariaLang);
      lang.title = T().langSwitch;
      lang.textContent = T().langSwitch;
    }
    const help = $("help-btn");
    if (help) {
      help.setAttribute("aria-label", T().ariaHelp);
      help.title = T().help;
    }
    const reset = $("reset-btn");
    if (reset) {
      reset.setAttribute("aria-label", T().resetBtn);
      reset.title = T().resetBtn;
    }
    const plateName = document.querySelector(".plate-name");
    if (plateName) plateName.textContent = T().appTitle;
    const plateSub = document.querySelector(".plate-sub");
    if (plateSub) plateSub.textContent = T().kicker;
  }

  // ---------------- 菜单 ----------------
  function renderMenu() {
    const state = controller.getState();
    const progress = state.progress ?? loadSave().progress;
    const stage = $("stage");
    stage.innerHTML = `
      <section class="ready-scene">
        <div class="ready-herald">
          <p class="kicker">${T().kicker}</p>
          <h1 class="title">${T().appTitle}</h1>
          <p class="lede">${T().readyDesc}</p>
          <p class="rank-line">${T().hudClass}：${rankBadge(progress.rank)} · ${T().resultRank}：${rankName(progress.rank)} · ${progress.wins} ${T().hudWins}</p>
        </div>
        <div class="menu-actions">
          <button type="button" class="key key-primary" id="btn-start">${T().btnStart}</button>
          ${savedRunExists() ? `<button type="button" class="key" id="btn-continue">${T().btnContinue}</button>` : ""}
          <button type="button" class="key" id="btn-puzzles">${T().btnPuzzles}</button>
          <button type="button" class="key" id="btn-mirror">${T().btnMirror}</button>
        </div>
        <div class="seed-zone">
          <label for="seed-input">${T().seedLabel}</label>
          <input id="seed-input" type="text" maxlength="24" placeholder="${T().seedPlaceholder}" autocomplete="off" spellcheck="false">
          <button type="button" class="key key-small" id="btn-seed">${T().btnSeedGo}</button>
        </div>
      </section>`;
    bindMenu(stage, progress);
  }

  function savedRunExists() {
    return Boolean(loadRun());
  }

  function rankName(rank) {
    return rankNameLocalized(rank);
  }

  function rankNameLocalized(rank) {
    const names = T().rankNames;
    return names[Math.max(0, Math.min(names.length - 1, Number(rank) || 0))] ?? names[0];
  }

  function rankBadge(rank) {
    const icons = ["🥉", "🥈", "🥇", "💎", "👑"];
    return icons[Math.max(0, Math.min(icons.length - 1, Number(rank) || 0))];
  }

  function bindMenu(stage, progress) {
    const seedValue = () => normalizeSeedInput($("seed-input").value);
    $("btn-start").addEventListener("click", () => {
      SFX.click();
      showClassPick(seedValue());
    });
    const cont = $("btn-continue");
    if (cont) cont.addEventListener("click", () => {
      SFX.click();
      if (controller.resumeExpedition()) hideOverlay();
    });
    $("btn-puzzles").addEventListener("click", () => {
      SFX.click();
      showPuzzles();
    });
    $("btn-mirror").addEventListener("click", () => {
      SFX.click();
      controller.startMirror();
      hideOverlay();
    });
    $("btn-seed").addEventListener("click", () => {
      SFX.click();
      showClassPick(seedValue());
    });
    $("seed-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        showClassPick(seedValue());
      }
    });
  }

  function normalizeSeedInput(raw) {
    if (!raw) return null;
    const code = String(raw).toUpperCase().replace(/\s+/g, "").slice(0, 24);
    return code || null;
  }

  // ---------------- 职业 / 背包选择 ----------------
  function showClassPick(seed) {
    ui.pendingSeed = seed;
    const stage = $("stage");
    stage.innerHTML = `
      <section class="pick-scene">
        <h2 class="scene-title">${T().classPickTitle}</h2>
        <div class="class-cards" id="class-cards">
          ${CLASS_ORDER.map((cid) => {
            const cls = CLASSES[cid];
            const locked = !(loadSave().progress.unlocked?.[cid]);
            return `<button type="button" class="class-card ${locked ? "is-locked" : ""}" data-class="${cid}" ${locked ? "disabled" : ""}>
              <span class="class-icon">${cls.icon}</span>
              <b>${pickLocalized(cls.name, ui.locale, cid)}</b>
              <i>${pickLocalized(cls.desc, ui.locale, "")}</i>
            </button>`;
          }).join("")}
        </div>
        <div class="bag-cards" id="bag-cards" hidden>
          <h3 class="scene-sub">${T().bagPickTitle}</h3>
          <button type="button" class="bag-card is-active" data-bag="A"><b>${T().bagA}</b><i>${bagPreview("A")}</i></button>
          <button type="button" class="bag-card" data-bag="B"><b>${T().bagB}</b><i>${bagPreview("B")}</i></button>
          <button type="button" class="key key-primary" id="btn-confirm">${T().btnClassConfirm}</button>
        </div>
      </section>`;
    let chosenClass = null;
    let chosenBag = "A";
    const cards = stage.querySelectorAll(".class-card");
    cards.forEach((card) => {
      card.addEventListener("click", () => {
        if (card.disabled) {
          SFX.invalid();
          return;
        }
        SFX.click();
        cards.forEach((c) => c.classList.remove("is-active"));
        card.classList.add("is-active");
        chosenClass = card.dataset.class;
        $("bag-cards").hidden = false;
      });
    });
    stage.querySelectorAll(".bag-card").forEach((card) => {
      card.addEventListener("click", () => {
        SFX.click();
        stage.querySelectorAll(".bag-card").forEach((c) => c.classList.remove("is-active"));
        card.classList.add("is-active");
        chosenBag = card.dataset.bag;
      });
    });
    $("btn-confirm").addEventListener("click", () => {
      if (!chosenClass) {
        toast(fmt("classPickTitle"));
        SFX.invalid();
        return;
      }
      SFX.victory();
      controller.startExpedition({ classId: chosenClass, bag: chosenBag, seed: hashSeedValue(ui.pendingSeed) });
      hideOverlay();
    });
  }

  function hashSeedValue(code) {
    if (!code) return null;
    return hashSeed(code);
  }

  function bagPreview(bag) {
    // 简洁文字预览：职业开局物品
    const previewClass = CLASS_ORDER[0];
    const cls = CLASSES[previewClass];
    const ids = bag === "B" ? cls.startersB : cls.startersA;
    return ids.map((id) => ITEMS[id].icon).join(" ");
  }

  // ---------------- 残局列表 ----------------
  function showPuzzles() {
    const progress = loadSave().progress;
    const stars = progress.stars ?? {};
    const stage = $("stage");
    const chapters = [1, 2, 3];
    stage.innerHTML = `
      <section class="puzzles-scene">
        <h2 class="scene-title">${T().puzzlesTitle}</h2>
        <p class="scene-sub">${fmt("puzzleStars", totalStars(stars), 90)}</p>
        ${chapters.map((ch) => `
          <div class="puzzle-chapter">
            <h3>${fmt("puzzlesChapter", T().chapterNames[ch - 1])}</h3>
            <div class="puzzle-grid">
              ${PUZZLE_IDS.filter((id) => PUZZLE_OF(id).chapter === ch).map((id) => {
                const p = PUZZLE_OF(id);
                const st = stars[id] ?? 0;
                const idx = PUZZLE_IDS.indexOf(id);
                const unlocked = idx === 0 || (stars[PUZZLE_IDS[idx - 1]] ?? 0) > 0;
                return `<button type="button" class="puzzle-cell ${unlocked ? "" : "is-locked"}" data-id="${id}" ${unlocked ? "" : "disabled"}>
                  <b>${id.replace("p", "")}</b>
                  <span class="stars">${"★".repeat(st)}${"☆".repeat(3 - st)}</span>
                  <i>${ITEMS[p.tray[0].id].icon}…</i>
                </button>`;
              }).join("")}
            </div>
          </div>`).join("")}
        <div class="scene-actions">
          <button type="button" class="key" id="btn-puzzles-back">${T().btnClose}</button>
        </div>
      </section>`;
    stage.querySelectorAll(".puzzle-cell").forEach((cell) => {
      cell.addEventListener("click", () => {
        SFX.click();
        controller.startPuzzle(cell.dataset.id);
        hideOverlay();
      });
    });
    $("btn-puzzles-back").addEventListener("click", () => {
      SFX.click();
      render();
    });
  }

  const PUZZLE_IDS = [...loadPuzzleIds()];

  function loadPuzzleIds() {
    // 由 data 导入的 PUZZLES 顺序
    return PUZZLE_LIST.map((p) => p.id);
  }

  function PUZZLE_OF(id) {
    return PUZZLE_LIST.find((p) => p.id === id);
  }

  function totalStars(stars) {
    return Object.values(stars).reduce((s, v) => s + v, 0);
  }

  // ---------------- 远征主舞台 ----------------
  function renderExpedition() {
    const state = controller.getState();
    const run = state.run;
    if (!run) {
      render();
      return;
    }
    const stage = $("stage");
    stage.innerHTML = `
      <section class="expedition">
        <div class="board-side">
          <header class="side-head">
            <h2>${T().hudClass} ${pickLocalized(CLASSES[run.classId].name, ui.locale)} · ${run.bag === "B" ? T().bagB : T().bagA}</h2>
            <div class="run-chips">
              <span class="chip">${T().hudGold} <b id="chip-gold">${run.gold}</b></span>
              <span class="chip">${T().hudRound} <b id="chip-round">${run.round}/${EXPEDITION.maxRounds}</b></span>
              <span class="chip chip-win">${T().hudWins} <b id="chip-wins">${run.wins}</b></span>
              <span class="chip chip-loss">${T().hudLosses} <b id="chip-losses">${run.losses}</b></span>
            </div>
          </header>
          <div class="board-frame">
            <div class="board" id="board" data-mode="expedition" aria-label="${T().ariaBoard}"></div>
          </div>
          <div class="board-actions">
            <button type="button" class="key key-small" id="expand-btn">${expansionBtnLabel(run)}</button>
            <span class="hint-line">${T().rotateHint}</span>
            <button type="button" class="key key-small key-quiet" id="abandon-btn">${T().btnRetryExpedition}</button>
          </div>
        </div>
        <aside class="counter-side">
          <header class="side-head">
            <h2>${T().shopTitle}</h2>
            <span class="chip">+${incomeLabel(run)}</span>
          </header>
          <div class="shop" id="shop"></div>
          <div class="rack" id="rack" aria-label="待放架"></div>
          <div class="info-panel" id="info-panel"></div>
          <div class="enemy-card" id="enemy-card"></div>
          <button type="button" class="key key-primary key-big" id="battle-btn">${T().btnBattle}</button>
        </aside>
      </section>`;
    drawBoard(run.grid, run.items, "expedition");
    drawShop(run);
    drawRack(run.rack, "rack");
    drawEnemyCard(run);
    bindBoard(run, "expedition");
    bindExpButtons(run);
  }

  function incomeLabel(run) {
    return Math.min(EXPEDITION.incomeBase + run.round, EXPEDITION.incomeCap);
  }

  function expansionBtnLabel(run) {
    const cost = expansionCost(run.expansionCount);
    if (cost === null) return T().expansionFull;
    return format(T().expansionBtn, cost);
  }

  function drawBoard(grid, items, mode) {
    const board = $("board");
    const cell = boardCellSize(grid);
    board.style.setProperty("--cols", grid.cols);
    board.style.setProperty("--rows", grid.rows);
    board.style.setProperty("--cell", `${cell}px`);
    board.style.width = `${grid.cols * cell}px`;
    board.style.height = `${grid.rows * cell}px`;
    let html = "";
    for (let y = 0; y < grid.rows; y += 1) {
      for (let x = 0; x < grid.cols; x += 1) {
        const blocked = grid.blocked.has(`${x},${y}`);
        html += `<div class="cell ${blocked ? "is-blocked" : ""}" data-x="${x}" data-y="${y}" style="left:${x * cell}px;top:${y * cell}px;width:${cell}px;height:${cell}px"></div>`;
      }
    }
    board.innerHTML = html;
    for (const item of items) {
      if (item.x < 0 || item.y < 0) continue;
      board.appendChild(itemEl(item, cell, mode));
    }
  }

  function boardCellSize(grid) {
    const frame = $("board-frame");
    const width = frame ? frame.clientWidth : 420;
    return Math.max(34, Math.min(64, Math.floor((width - 12) / grid.cols)));
  }

  function itemEl(item, cell, mode) {
    const data = ITEMS[item.id];
    const w = item.rot % 2 === 0 ? data.w : data.h;
    const h = item.rot % 2 === 0 ? data.h : data.w;
    const el = document.createElement("button");
    el.type = "button";
    el.className = "item";
    el.dataset.uid = String(item.uid);
    el.dataset.mode = mode;
    el.dataset.itemId = item.id;
    el.style.width = `${w * cell}px`;
    el.style.height = `${h * cell}px`;
    el.style.transform = `translate(${item.x * cell}px, ${item.y * cell}px)`;
    el.innerHTML = `<span class="item-icon">${data.icon}</span><span class="item-name">${nameOf(item.id)}</span>`;
    return el;
  }

  function drawShop(run) {
    const shop = $("shop");
    shop.innerHTML = run.shop.map((offer, i) => `
      <button type="button" class="shop-item" data-slot="${i}" data-item-id="${offer.id}">
        <span class="shop-icon">${ITEMS[offer.id].icon}</span>
        <span class="shop-name">${nameOf(offer.id)}</span>
        <span class="shop-cost">${offer.cost} 🪙</span>
      </button>`).join("");
  }

  function drawRack(items, mode) {
    const rack = $("rack");
    if (!rack) return;
    if (!items.length) {
      rack.innerHTML = `<p class="rack-empty">${T().shopHint}</p>`;
      return;
    }
    rack.innerHTML = items.map((it) => `
      <button type="button" class="rack-item" data-uid="${it.uid}" data-item-id="${it.id}">
        <span class="item-icon">${ITEMS[it.id].icon}</span>
        <span class="item-name">${nameOf(it.id)}</span>
      </button>`).join("");
  }

  function drawEnemyCard(run) {
    const enemy = ENEMIES[enemyForRound(run.round)];
    const el = $("enemy-card");
    if (!el) return;
    const scaling = scalingText(run.round);
    el.innerHTML = `
      <p class="enemy-label">${T().roundEnemy}</p>
      <p class="enemy-main">${enemy.icon} <b>${pickLocalized(enemy.name, ui.locale)}</b></p>
      <p class="enemy-sub">${pickLocalized(enemy.desc, ui.locale, "")}</p>
      <p class="enemy-scale">${scaling}</p>`;
  }

  function scalingText(round) {
    const hp = 1 + (round - 1) * 0.1;
    return `HP ×${hp.toFixed(1)}`;
  }

  function bindExpButtons(run) {
    $("expand-btn").addEventListener("click", () => {
      const before = run.gold;
      controller.buyExpansion();
      if (run.gold < before) SFX.expand();
      else SFX.invalid();
    });
    $("battle-btn").addEventListener("click", () => {
      SFX.click();
      beginExpeditionBattle();
    });
    $("abandon-btn").addEventListener("click", () => {
      SFX.click();
      controller.abandonRun();
      render();
    });
  }

  function beginExpeditionBattle() {
    const battle = controller.beginBattle();
    if (!battle) return;
    showCurtain();
    startBattleLoop({
      step: () => controller.stepBattle(0.1),
      end: () => {
        const result = controller.settleBattle();
        hideCurtain();
        const run = controller.getState().run;
        if (run && result && !result.over) {
          render();
          if (result.won) SFX.victory(); else SFX.defeat();
          toast(fmt("toastBattleStart", run.round, enemyNameOf(run.round)));
        } else if (run && result && result.over) {
          showExpeditionEnd(result, run);
        } else if (!run) {
          render();
        }
      },
    });
  }

  function enemyNameOf(round) {
    return pickLocalized(ENEMIES[enemyForRound(round)].name, ui.locale);
  }

  // ---------------- 残局主舞台 ----------------
  function renderPuzzle() {
    const puzzle = controller.getState().puzzle;
    if (!puzzle) {
      render();
      return;
    }
    const stage = $("stage");
    const enemy = ENEMIES[puzzle.enemy];
    stage.innerHTML = `
      <section class="puzzle">
        <div class="board-side">
          <header class="side-head">
            <h2>${T().puzzlesTitle} · ${puzzle.id.replace("p", "")}</h2>
            <span class="chip">${T().hudRound} ${fmt("puzzlesChapter", T().chapterNames[puzzle.chapter - 1])}</span>
          </header>
          <div class="board-frame">
            <div class="board" id="board" data-mode="puzzle" aria-label="${T().ariaBoard}"></div>
          </div>
          <div class="board-actions">
            <button type="button" class="key key-small" id="puzzle-hint">${T().btnHint}</button>
            <button type="button" class="key key-small" id="puzzle-reset">${T().btnRetry}</button>
            <span class="hint-line">${T().rotateHint}</span>
          </div>
        </div>
        <aside class="counter-side">
          <header class="side-head">
            <h2>${T().puzzlesTitle}</h2>
            <span class="chip">★ ${puzzleStarsSaved(puzzle.id)}/3</span>
          </header>
          <div class="rack rack-puzzle" id="rack" aria-label="残局物品架"></div>
          <div class="info-panel" id="info-panel"></div>
          <div class="enemy-card" id="enemy-card">
            <p class="enemy-label">${T().roundEnemy}</p>
            <p class="enemy-main">${enemy.icon} <b>${pickLocalized(enemy.name, ui.locale)}</b></p>
            <p class="enemy-sub">${pickLocalized(enemy.desc, ui.locale, "")}</p>
            <p class="enemy-scale">${fmt("puzzleStarHp")} · ${fmt("puzzleStarTime", puzzle.starTime)}</p>
          </div>
          <button type="button" class="key key-primary key-big" id="puzzle-fight">${T().btnSubmit}</button>
        </aside>
      </section>`;
    drawBoard(puzzle.grid, puzzle.placed, "puzzle");
    drawRack(puzzle.tray, "puzzle");
    bindBoard(puzzle, "puzzle");
    $("puzzle-fight").addEventListener("click", () => {
      SFX.click();
      if (!puzzle.placed.length) {
        toast(T().btnSubmit);
        SFX.invalid();
        return;
      }
      beginPuzzleBattle();
    });
    $("puzzle-hint").addEventListener("click", () => {
      SFX.click();
      const hint = controller.requestHint();
      showHint(hint);
    });
    $("puzzle-reset").addEventListener("click", () => {
      SFX.click();
      for (const it of [...puzzle.placed]) controller.removePuzzleItem(it.uid);
      renderPuzzle();
    });
  }

  function puzzleStarsSaved(id) {
    return loadSave().progress.stars?.[id] ?? 0;
  }

  function beginPuzzleBattle() {
    const battle = controller.beginPuzzleBattle();
    if (!battle) return;
    showCurtain();
    startBattleLoop({
      step: () => controller.stepPuzzleBattle(0.1),
      end: () => {
        const result = controller.settlePuzzleBattle();
        hideCurtain();
        if (result && result.won) {
          SFX.victory();
          showPuzzleEnd(result);
        } else {
          SFX.defeat();
          toast(T().battleLose);
          renderPuzzle();
        }
      },
    });
  }

  function showHint(hint) {
    const overlay = $("hint-panel");
    if (!hint) {
      toast(T().btnHint);
      return;
    }
    const puzzle = controller.getState().puzzle;
    $("hint-title").textContent = T().hintTitle;
    const list = $("hint-list");
    list.innerHTML = hint.map((it, i) => {
      const data = ITEMS[it.id];
      return `<li><span class="hint-icon">${data.icon}</span> ${nameOf(it.id)} <small>(${it.x}, ${it.y}) ${it.rot ? "↻" : ""}</small></li>`;
    }).join("");
    showPanel("hint-panel");
    $("hint-close").onclick = () => hideOverlay();
  }

  function showPuzzleEnd(result) {
    const puzzle = controller.getState().puzzle;
    $("puzzle-end-title").textContent = T().puzzleVictory;
    $("puzzle-end-desc").textContent = fmt("puzzleVictoryDesc", Math.round(result.hpPct * 100), result.time.toFixed(1));
    const tray = $("puzzle-end-stars");
    tray.innerHTML = "★".repeat(result.stars) + "☆".repeat(3 - result.stars);
    $("puzzle-end-got").textContent = fmt("puzzleStarsGot", result.stars);
    showPanel("puzzle-end-panel");
    $("puzzle-end-retry").onclick = () => {
      SFX.click();
      hideOverlay();
      const p = controller.getState().puzzle;
      if (p) {
        for (const it of [...p.placed]) controller.removePuzzleItem(it.uid);
        renderPuzzle();
      }
    };
    $("puzzle-end-next").onclick = () => {
      SFX.click();
      hideOverlay();
      const idx = PUZZLE_IDS.indexOf(puzzle.id);
      const next = PUZZLE_IDS[idx + 1];
      if (next) controller.startPuzzle(next);
      else showPuzzles();
    };
    $("puzzle-end-list").onclick = () => {
      SFX.click();
      hideOverlay();
      showPuzzles();
    };
  }

  // ---------------- 镜像 ----------------
  function renderMirror() {
    const mirror = controller.getState().mirror;
    if (!mirror) {
      render();
      return;
    }
    const stage = $("stage");
    stage.innerHTML = `
      <section class="mirror">
        <div class="mirror-herald">
          <p class="kicker">${T().kicker}</p>
          <h2 class="title">${T().mirrorTitle}</h2>
          <p class="lede">${T().mirrorDesc}</p>
          <p class="rank-line">${fmt("mirrorRound", mirror.floor)} · ${fmt("mirrorBest", Math.max(mirror.floor - 1, mirrorBestRounds()))}</p>
          <button type="button" class="key key-primary key-big" id="mirror-fight">${T().btnMirrorFight}</button>
          <button type="button" class="key" id="mirror-exit">${T().btnClose}</button>
        </div>
      </section>`;
    $("mirror-fight").addEventListener("click", () => {
      SFX.click();
      beginMirrorBattle();
    });
    $("mirror-exit").addEventListener("click", () => {
      SFX.click();
      controller.exitMirror();
      render();
    });
  }

  function mirrorBestRounds() {
    return loadSave().progress.mirror?.rounds ?? 0;
  }

  function beginMirrorBattle() {
    const battle = controller.beginMirrorBattle();
    if (!battle) return;
    showCurtain();
    startBattleLoop({
      step: () => controller.stepMirrorBattle(0.1),
      end: () => {
        const result = controller.settleMirrorBattle();
        hideCurtain();
        const mirror = controller.getState().mirror;
        if (mirror && result && result.won) {
          SFX.victory();
          toast(fmt("toastMirrorStronger", mirror.floor));
          renderMirror();
        } else if (mirror && result) {
          SFX.defeat();
          showMirrorEnd(result);
        } else {
          render();
        }
      },
    });
  }

  function showMirrorEnd(result) {
    $("mirror-end-title").textContent = T().mirrorDefeat;
    $("mirror-end-desc").textContent = fmt("mirrorResult", result.floor);
    $("mirror-end-best").textContent = fmt("mirrorBest", Math.max(result.floor, mirrorBestRounds()));
    showPanel("mirror-end-panel");
    $("mirror-end-retry").onclick = () => {
      SFX.click();
      hideOverlay();
      controller.startMirror();
    };
    $("mirror-end-exit").onclick = () => {
      SFX.click();
      hideOverlay();
      controller.exitMirror();
      render();
    };
  }

  // ---------------- 战斗幕布 ----------------
  function showCurtain() {
    $("curtain").hidden = false;
    const canvas = $("battle-canvas");
    canvas.width = canvas.clientWidth * devicePixelRatio;
    canvas.height = canvas.clientHeight * devicePixelRatio;
    requestAnimationFrame(() => drawBattleFrame(null));
  }

  function hideCurtain() {
    if (ui.battleTimer) {
      clearInterval(ui.battleTimer);
      ui.battleTimer = null;
    }
    $("curtain").hidden = true;
  }

  function startBattleLoop({ step, end }) {
    let queue = [];
    ui.battleTimer = setInterval(() => {
      const battle = ui.currentBattle;
      const ended = step();
      if (queue.length) {
        drawBattleFrame(battle);
        queue = [];
      }
      if (ended) {
        clearInterval(ui.battleTimer);
        ui.battleTimer = null;
        setTimeout(() => {
          drawBattleFrame(battle);
          setTimeout(end, 500);
        }, 200);
      }
    }, 40);
  }

  function drawBattleFrame(battle) {
    const canvas = $("battle-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const state = controller.getState();
    if (!battle) {
      battle = state.run?.battle?.state ?? state.puzzle?.battle ?? state.mirror?.battle;
    }
    if (!battle) return;
    ui.currentBattle = battle;
    const [p0, p1] = battle.sides;
    const meta = battleMeta();
    // 背景
    const bg = ctx.createLinearGradient(0, 0, w, 0);
    bg.addColorStop(0, "#1c2333");
    bg.addColorStop(0.5, "#262c3f");
    bg.addColorStop(1, "#191f2e");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    // 时间与回合
    ctx.fillStyle = "rgba(232,219,186,0.85)";
    ctx.font = "600 13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${T().battleTitle} · ${battle.time.toFixed(1)}s`, w / 2, 18);
    // 中线
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.moveTo(w / 2, 24);
    ctx.lineTo(w / 2, h - 8);
    ctx.stroke();
    drawSide(ctx, p0, w / 2 - 90, meta.iconPlayer, meta.labelPlayer, true);
    drawSide(ctx, p1, w / 2 + 30, meta.iconEnemy, meta.labelEnemy, false);
    // 疲劳警示
    if (battle.time > EXPEDITION.fatigueAfter) {
      ctx.fillStyle = "rgba(255,80,60,0.92)";
      ctx.font = "800 15px sans-serif";
      ctx.fillText(T().battleFatigue, w / 2, h - 12);
    }
    // 事件浮动
    for (const ev of battle._fx || []) {
      const fx = ev;
      fx.age += 1;
      fx.y -= 0.6;
      const alpha = Math.max(0, 1 - fx.age / 40);
      if (fx.kind === "hit" || fx.kind === "crit" || fx.kind === "trap" || fx.kind === "fatigue") {
        ctx.fillStyle = fx.kind === "crit" ? `rgba(255,215,90,${alpha})` : `rgba(255,240,220,${alpha})`;
        ctx.font = `${fx.kind === "crit" ? 800 : 600} ${fx.kind === "crit" ? 16 : 13}px sans-serif`;
        ctx.fillText(`${fx.kind === "fatigue" ? "⚡" : ""}${Math.round(fx.value)}`, fx.x, fx.y);
      }
    }
    battle._fx = (battle._fx || []).filter((fx) => fx.age < 40);
    for (const ev of (ui.lastEvents || [])) {
      const side = ev.side === "player" ? 0 : 1;
      const x = side === 0 ? w / 2 - 90 : w / 2 + 30;
      if (ev.kind === "hit" || ev.kind === "crit" || ev.kind === "trap" || ev.kind === "fatigue") {
        battle._fx.push({ x: x + 30 + Math.random() * 40, y: h - 70 - Math.random() * 20, kind: ev.kind, value: ev.value, age: 0 });
        if (ev.kind === "crit") SFX.crit();
      } else if (ev.kind === "burn" || ev.kind === "poison") {
        battle._fx.push({ x: x + 40, y: h - 50, kind: ev.kind, value: ev.value, age: 0 });
      } else if (ev.kind === "heal") {
        SFX.heal();
      }
    }
    ui.lastEvents = [];
  }

  function battleMeta() {
    const state = controller.getState();
    if (state.run?.battle) {
      const run = state.run;
      return {
        iconPlayer: CLASSES[run.classId].icon,
        labelPlayer: pickLocalized(CLASSES[run.classId].name, ui.locale),
        iconEnemy: ENEMIES[run.battle.enemy.archetype.id].icon,
        labelEnemy: pickLocalized(run.battle.enemy.archetype.name, ui.locale),
      };
    }
    if (state.puzzle?.battle) {
      const p = state.puzzle;
      return {
        iconPlayer: "🎒",
        labelPlayer: T().appTitle,
        iconEnemy: ENEMIES[p.enemy].icon,
        labelEnemy: pickLocalized(ENEMIES[p.enemy].name, ui.locale),
      };
    }
    const m = state.mirror;
    return {
      iconPlayer: CLASSES[m?.source?.classId ?? "berserker"].icon,
      labelPlayer: T().appTitle,
      iconEnemy: "🪞",
      labelEnemy: T().mirrorTitle,
    };
  }

  function drawSide(ctx, side, x, icon, label, isPlayer) {
    const w = 150;
    const h = 150;
    const hpPct = Math.max(0, side.hp / side.spec.maxHp);
    const resPct = Math.max(0, side.res / side.spec.maxRes);
    // 头像
    ctx.font = "46px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(icon, x + w / 2, 64);
    // 名字
    ctx.fillStyle = "rgba(232,219,186,0.9)";
    ctx.font = "600 12px sans-serif";
    ctx.fillText(label, x + w / 2, 82);
    // 血条
    bar(ctx, x, 92, w, 14, hpPct, "#8a2f2f", "#e05b4a", `${Math.max(0, Math.round(side.hp))}/${side.spec.maxHp}`);
    // 资源条
    bar(ctx, x, 110, w, 8, resPct, "#1f4d63", "#4aa3d8", "");
    // 状态
    const badges = [];
    if (side.status.burn > 0) badges.push(`🔥${side.status.burn}`);
    if (side.status.poison > 0) badges.push(`☠️${side.status.poison}`);
    if (side.status.stunUntil > 0) badges.push("⏸");
    if (badges.length) {
      ctx.font = "12px sans-serif";
      ctx.fillText(badges.join(" "), x + w / 2, 132);
    }
    // 武器条
    let wy = 138;
    for (const wd of side.weapons.slice(0, 2)) {
      ctx.font = "10px sans-serif";
      ctx.fillStyle = "rgba(220,210,190,0.55)";
      ctx.fillText(`${ITEMS[wd.itemId].icon} ${wd.dmg[0]}-${wd.dmg[1]}`, x + 4, wy);
      wy += 12;
    }
  }

  function bar(ctx, x, y, w, h, pct, fillA, fillB, label) {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, fillB);
    grad.addColorStop(1, fillA);
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w * Math.max(0, pct), h);
    if (label) {
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = "700 10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(label, x + w / 2, y + h - 2);
    }
  }

  // ---------------- 远征结算 ----------------
  function showExpeditionEnd(result, run) {
    const prog = expeditionEndProgress();
    $("expedition-end-title").textContent = result.won ? T().resultWin : T().resultLose;
    $("expedition-end-desc").textContent = result.won
      ? fmt("resultWinDesc", result.round, result.wins, result.losses)
      : fmt("resultLoseDesc", result.round, result.wins, result.losses, rankName(currentRank()));
    $("expedition-end-stats").innerHTML = `
      <p>${T().resultGold}：<b>${result.gold}</b></p>
      <p>${T().resultItems}：<b>${result.items}</b></p>
      <p>${T().resultRank}：<b>${rankName(currentRank())} ${prog.promoted ? "↑" : ""}</b></p>`;
    $("expedition-end-seed").textContent = `${T().hudSeed}：${run.seedCode}`;
    showPanel("expedition-end-panel");
    $("expedition-end-retry").onclick = () => {
      SFX.click();
      hideOverlay();
      showClassPick(null);
    };
    $("expedition-end-copy").onclick = () => {
      copyText(run.seedCode);
      toast(T().seedCopied);
      SFX.click();
    };
    $("expedition-end-menu").onclick = () => {
      SFX.click();
      hideOverlay();
      controller.abandonRun();
      render();
    };
  }

  function expeditionEndProgress() {
    const state = controller.getState();
    const run = state.run;
    if (!run) return { promoted: 0, partial: 0 };
    const wins = run.wins;
    return {
      promoted: wins >= EXPEDITION.winsNeeded ? 1 : 0,
      partial: wins >= 6 ? 0.5 : 0,
    };
  }

  function currentRank() {
    return loadSave().progress.rank ?? 0;
  }

  function copyText(text) {
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text);
        return;
      }
    } catch (error) {
      // 回退到 execCommand
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    } catch (error) {
      // 忽略
    }
  }

  // ---------------- 背包交互（拖拽 / 点击 / 旋转） ----------------
  function bindBoard(boardState, mode) {
    const board = $("board");
    if (!board) return;
    board.addEventListener("pointerdown", onBoardDown.bind(null, boardState, mode));
    // 右击旋转
    board.addEventListener("contextmenu", (e) => {
      const el = e.target.closest(".item");
      if (!el) return;
      e.preventDefault();
      rotateSelected(el, boardState, mode);
    });
  }

  function onBoardDown(boardState, mode, e) {
    if (e.button === 2) return;
    const itemEl = e.target.closest(".item");
    const cell = e.target.closest(".cell");
    for (const el of document.querySelectorAll(".item.is-selected")) el.classList.remove("is-selected");
    if (!itemEl) {
      // 点击空格 → 清除选择
      ui.selectedUid = null;
      refreshInfo();
      return;
    }
    e.preventDefault();
    itemEl.classList.add("is-selected");
    const uid = Number(itemEl.dataset.uid);
    ui.selectedUid = uid;
    refreshInfo();
    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;
    let ghost = null;

    const move = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!dragging && Math.hypot(dx, dy) > 8) {
        dragging = true;
        ghost = makeGhost(itemEl);
        SFX.rotate();
      }
      if (dragging && ghost) {
        ghost.style.left = `${ev.clientX - ghost.offsetWidth / 2}px`;
        ghost.style.top = `${ev.clientY - ghost.offsetHeight / 2}px`;
        paintDropPreview(ev, boardState, mode, uid, itemEl);
      }
    };
    const up = (ev) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (ghost) ghost.remove();
      clearDropPreview();
      if (!dragging) return; // 单击 → 已选中
      const result = resolveDrop(ev, boardState, mode, uid);
      if (result === "sell") {
        sellByDrag(mode, uid);
      }
      ui.selectedUid = null;
      refreshInfo();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function makeGhost(itemEl) {
    const ghost = document.createElement("div");
    ghost.className = "ghost";
    ghost.innerHTML = itemEl.innerHTML;
    ghost.style.width = `${itemEl.offsetWidth}px`;
    ghost.style.height = `${itemEl.offsetHeight}px`;
    document.body.appendChild(ghost);
    return ghost;
  }

  function paintDropPreview(ev, boardState, mode, uid, itemEl) {
    const board = $("board");
    const rect = board.getBoundingClientRect();
    const cell = boardCellSize(boardState.grid);
    const data = ITEMS[itemEl.dataset.itemId];
    const rot = placedRotOf(boardState, mode, uid, itemEl.dataset.itemId);
    const w = rot % 2 === 0 ? data.w : data.h;
    const h = rot % 2 === 0 ? data.h : data.w;
    const col = Math.floor((ev.clientX - rect.left) / cell);
    const row = Math.floor((ev.clientY - rect.top) / cell);
    clearDropPreview();
    const preview = document.createElement("div");
    preview.className = "drop-preview";
    preview.style.left = `${col * cell}px`;
    preview.style.top = `${row * cell}px`;
    preview.style.width = `${w * cell}px`;
    preview.style.height = `${h * cell}px`;
    const valid = isPlaceValid(boardState, mode, uid, col, row, rot);
    preview.classList.toggle("is-bad", !valid);
    board.appendChild(preview);
    ui.dropPreview = { el: preview, col, row, rot };
  }

  function placedRotOf(boardState, mode, uid, itemId) {
    const placed = mode === "expedition" ? boardState.items : boardState.placed;
    const it = placed.find((x) => x.uid === uid);
    return it ? it.rot : 0;
  }

  function isPlaceValid(boardState, mode, uid, col, row, rot) {
    const grid = boardState.grid;
    const placed = mode === "expedition" ? boardState.items.filter((it) => it.x >= 0) : boardState.placed;
    const item = placed.find((it) => it.uid === uid);
    if (!item) return false;
    const data = ITEMS[item.id];
    const w = rot % 2 === 0 ? data.w : data.h;
    const h = rot % 2 === 0 ? data.h : data.w;
    if (col < 0 || row < 0 || col + w > grid.cols || row + h > grid.rows) return false;
    for (let dy = 0; dy < h; dy += 1) {
      for (let dx = 0; dx < w; dx += 1) {
        const key = `${col + dx},${row + dy}`;
        if (grid.blocked.has(key)) return false;
        const other = placed.find((o) => o.uid !== uid);
        if (other && overlapCell(placed, other, col + dx, row + dy)) return false;
      }
    }
    return true;
  }

  function overlapCell(placed, other, x, y) {
    const data = ITEMS[other.id];
    const w = other.rot % 2 === 0 ? data.w : data.h;
    const h = other.rot % 2 === 0 ? data.h : data.w;
    return x >= other.x && x < other.x + w && y >= other.y && y < other.y + h;
  }

  function resolveDrop(ev, boardState, mode, uid) {
    // 拖到棋盘 → 移动/摆放；拖到另一件物品上 → 交换；拖出棋盘 → 出售
    const board = $("board");
    const rect = board.getBoundingClientRect();
    const insideBoard = ev.clientX >= rect.left && ev.clientX <= rect.right && ev.clientY >= rect.top && ev.clientY <= rect.bottom;
    const cell = boardCellSize(boardState.grid);
    if (!insideBoard) return "sell";
    const col = Math.floor((ev.clientX - rect.left) / cell);
    const row = Math.floor((ev.clientY - rect.top) / cell);
    const placed = mode === "expedition" ? boardState.items.filter((it) => it.x >= 0) : boardState.placed;
    const item = placed.find((it) => it.uid === uid);
    if (!item) return null;
    // 交换检测：落点中心落在另一件物品上
    const target = placed.find((o) => {
      if (o.uid === uid) return false;
      const data = ITEMS[o.id];
      const w = o.rot % 2 === 0 ? data.w : data.h;
      const h = o.rot % 2 === 0 ? data.h : data.w;
      const cx = ev.clientX - rect.left - col * cell;
      const cy = ev.clientY - rect.top - row * cell;
      return cx >= 0 && cx < cell * w && cy >= 0 && cy < cell * h && col >= o.x && col < o.x + w && row >= o.y && row < o.y + h;
    });
    if (target) {
      if (mode === "expedition") {
        const next = controller.swapItems(uid, target.uid);
        if (next) {
          SFX.place();
          renderStage();
        }
      }
      return null;
    }
    // 移动
    const rot = item.rot;
    if (mode === "expedition") {
      const next = controller.moveItem(uid, col, row, rot);
      if (next) {
        SFX.place();
        renderStage();
      } else {
        SFX.invalid();
      }
    } else {
      const next = controller.movePuzzleItem(uid, col, row, rot);
      if (next) {
        SFX.place();
        renderStage();
      } else {
        SFX.invalid();
      }
    }
    return null;
  }

  function sellByDrag(mode, uid) {
    if (mode === "expedition") {
      const value = controller.sellItem(uid);
      if (value) {
        SFX.sell();
        toast(`${fmt("toastSell", "", value)}`);
        renderStage();
      } else {
        SFX.invalid();
      }
    } else {
      controller.removePuzzleItem(uid);
      SFX.click();
      renderStage();
    }
  }

  function rotateSelected(el, boardState, mode) {
    const uid = Number(el.dataset.uid);
    if (mode === "expedition") {
      const next = controller.rotateItem(uid);
      if (next) {
        SFX.rotate();
        renderStage();
      } else SFX.invalid();
    } else {
      // 残局：先移回再以新方向放回（保持位置）
      const item = boardState.placed.find((it) => it.uid === uid);
      if (!item) return;
      controller.removePuzzleItem(uid);
      const placed = controller.getState().puzzle.placed;
      const moved = controller.placePuzzleItem(uid, item.x, item.y, (item.rot + 1) % 4);
      if (!moved) {
        // 旋转后放不回去 → 放回原位原方向
        controller.placePuzzleItem(uid, item.x, item.y, item.rot);
        SFX.invalid();
        return;
      }
      SFX.rotate();
      renderStage();
    }
  }

  function clearDropPreview() {
    if (ui.dropPreview) {
      ui.dropPreview.el.remove();
      ui.dropPreview = null;
    }
  }

  function refreshInfo() {
    const info = $("info-panel");
    if (!info) return;
    if (ui.selectedUid === null) {
      info.innerHTML = `<p class="info-empty">${T().rotateHint}</p>`;
      return;
    }
    const stats = controller.selectedItemStats(ui.selectedUid);
    if (!stats) {
      info.innerHTML = `<p class="info-empty">${T().rotateHint}</p>`;
      return;
    }
    const data = ITEMS[stats.item.id];
    info.innerHTML = `
      <p class="info-name">${data.icon} <b>${nameOf(stats.item.id)}</b></p>
      <p class="info-desc">${itemBlurb(stats.item.id)}</p>
      <div class="info-actions">
        <button type="button" class="key key-small" data-act="rotate">${T().rotateHint.split("，")[0]}</button>
        <button type="button" class="key key-small key-quiet" data-act="sell">${T().sellBtn.replace("+{0}", "")} ${sellValue(stats.item)}</button>
      </div>`;
    info.querySelector('[data-act="rotate"]').addEventListener("click", () => {
      SFX.click();
      const el = document.querySelector(`.item[data-uid="${ui.selectedUid}"]`);
      const mode = controller.getState().mode === "expedition" ? "expedition" : "puzzle";
      const bs = mode === "expedition" ? controller.getState().run : controller.getState().puzzle;
      if (el) rotateSelected(el, bs, mode);
    });
    info.querySelector('[data-act="sell"]').addEventListener("click", () => {
      SFX.click();
      sellByDrag(modeOfState(), ui.selectedUid);
      ui.selectedUid = null;
    });
  }

  function modeOfState() {
    return controller.getState().mode === "expedition" ? "expedition" : "puzzle";
  }

  function itemBlurb(itemId) {
    const data = ITEMS[itemId];
    if (data.type === "weapon") {
      const w = data.weapon;
      return `${w.dmg[0]}-${w.dmg[1]} dmg · ${w.cd}s cd · ${w.hit}% hit · ${w.crit}% crit`;
    }
    if (data.type === "armor" || data.type === "shield") {
      const a = data.armor;
      return `armor ${a.armor ?? 0} · block ${a.block ?? 0}%${a.dodge ? ` · dodge ${a.dodge}%` : ""}`;
    }
    if (data.type === "food") {
      const f = data.food;
      return `every ${f.interval}s → ${f.heal ? `heal ${f.heal}` : ""}${f.stamina ? ` +${f.stamina} res` : ""}${f.mana ? ` +${f.mana} mana` : ""}${f.buff ? ` ${f.buff.stat} +${f.buff.value}/${f.buff.dur}s` : ""}`;
    }
    if (data.type === "trinket") {
      const parts = [];
      if (data.aura) parts.push(`${T().shopHint} → ${data.aura.stat} +${data.aura.value}`);
      if (data.adjBonus) parts.push(`${nameOf(itemId)}: ${Object.entries(data.adjBonus).filter(([k]) => k !== "needs").map(([k, v]) => `${k} +${v}`).join(", ")}`);
      if (data.rowBonus) parts.push(`${T().rotateHint} top row ${data.rowBonus.stat} +${data.rowBonus.value}`);
      if (data.openBonus) parts.push(`open cells → dmg +${data.openBonus.per}/cell`);
      if (data.trinket) {
        for (const [k, v] of Object.entries(data.trinket)) parts.push(`${k} +${v}`);
      }
      if (data.battleStart) parts.push(`${data.battleStart.dmg} dmg + slow ${data.battleStart.slow * 100}%/${data.battleStart.dur}s at start`);
      return parts.join(" · ");
    }
    if (data.type === "gem") {
      const g = data.gem;
      return `${g.color} gem Lv${g.level} → ${g.stat} +${g.value}`;
    }
    return "";
  }

  function sellValue(item) {
    return `🪙 ${Math.max(1, Math.floor(ITEMS[item.id].cost * 0.7))}`;
  }

  function renderStage() {
    const mode = controller.getState().mode;
    if (mode === "expedition") renderExpedition();
    else if (mode === "puzzle") renderPuzzle();
  }

  // ---------------- 外部意图（shop / rack 拖拽） ----------------
  function bindShopAndRack() {
    document.addEventListener("pointerdown", onShopRackDown);
  }

  function onShopRackDown(e) {
    const shopEl = e.target.closest(".shop-item");
    const rackEl = e.target.closest(".rack-item");
    if (!shopEl && !rackEl) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;
    let ghost = null;
    const move = (ev) => {
      if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 8) {
        dragging = true;
        ghost = makeGhost(shopEl || rackEl);
        SFX.rotate();
      }
      if (dragging && ghost) {
        ghost.style.left = `${ev.clientX - ghost.offsetWidth / 2}px`;
        ghost.style.top = `${ev.clientY - ghost.offsetHeight / 2}px`;
      }
    };
    const up = (ev) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (ghost) ghost.remove();
      const board = $("board");
      const rect = board?.getBoundingClientRect();
      const overBoard = rect && ev.clientX >= rect.left && ev.clientX <= rect.right && ev.clientY >= rect.top && ev.clientY <= rect.bottom;
      if (shopEl) {
        const slot = Number(shopEl.dataset.slot);
        if (!dragging) {
          // 单击购买
          buyFromShop(slot, null);
          return;
        }
        if (overBoard) {
          // 拖到棋盘：购买并直接摆放
          const offer = buyFromShop(slot, (uid) => {
            const mode = controller.getState().mode;
            if (mode !== "expedition") return null;
            const grid = controller.getState().run.grid;
            const cell = boardCellSize(grid);
            const col = Math.floor((ev.clientX - rect.left) / cell);
            const row = Math.floor((ev.clientY - rect.top) / cell);
            const rot = 0;
            const placed = controller.getState().run.items.filter((it) => it.x >= 0);
            const run = controller.getState().run;
            const result = controller.placeFromRack(uid, col, row, rot);
            return result;
          });
          if (offer) {
            SFX.place();
            renderStage();
          }
          return;
        }
        return;
      }
      if (rackEl) {
        const uid = Number(rackEl.dataset.uid);
        if (!dragging) {
          // 单击 → 选中/旋转
          const next = controller.rotateItem(uid);
          if (next) {
            SFX.rotate();
            renderStage();
          }
          return;
        }
        if (overBoard) {
          const mode = controller.getState().mode;
          const grid = mode === "expedition" ? controller.getState().run.grid : controller.getState().puzzle.grid;
          const cell = boardCellSize(grid);
          const col = Math.floor((ev.clientX - rect.left) / cell);
          const row = Math.floor((ev.clientY - rect.top) / cell);
          const rot = rackRotOf(uid);
          if (mode === "expedition") {
            const result = controller.placeFromRack(uid, col, row, rot);
            if (result) {
              SFX.place();
              renderStage();
            } else SFX.invalid();
          } else {
            const result = controller.placePuzzleItem(uid, col, row, rot);
            if (result) {
              SFX.place();
              renderStage();
            } else SFX.invalid();
          }
        }
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function rackRotOf(uid) {
    const run = controller.getState().run;
    const puzzle = controller.getState().puzzle;
    const it = run?.rack.find((x) => x.uid === uid) || puzzle?.tray.find((x) => x.uid === uid);
    return it ? it.rot : 0;
  }

  function buyFromShop(slot, onPlaced) {
    const offer = controller.buyItem(slot);
    if (!offer) {
      toast(T().toastGoldShort);
      SFX.invalid();
      return null;
    }
    SFX.buy();
    toast(`${fmt("toastBuy", nameOf(offer.itemId))} · 🪙${offer.cost}`);
    renderStage();
    // 买完先放入架，onPlaced 再由拖拽路径立即摆放
    if (onPlaced) {
      const run = controller.getState().run;
      if (run) {
        const rackItem = run.rack[run.rack.length - 1];
        onPlaced(rackItem.uid);
      }
    }
    return offer;
  }

  // ---------------- 顶栏与面板绑定 ----------------
  function bindStatic() {
    const tools = document.getElementById("tools");
    if (tools) {
      tools.addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;
        if (btn.id === "help-btn") {
          SFX.click();
          showHelp();
        } else if (btn.id === "sound-btn") {
          toggleMute();
        } else if (btn.id === "lang-btn") {
          toggleLang();
        } else if (btn.id === "reset-btn") {
          SFX.click();
          showResetConfirm();
        }
      });
    }
  }

  function showHelp() {
    $("help-title").textContent = T().helpTitle;
    $("help-list").innerHTML = T().helpItems.map((item) => `<li>${item}</li>`).join("");
    showPanel("help-panel");
    $("help-close").onclick = () => hideOverlay();
  }

  function showResetConfirm() {
    $("reset-title").textContent = T().resetBtn;
    $("reset-desc").textContent = T().resetConfirm;
    $("reset-btn-go").textContent = T().resetConfirmBtn;
    showPanel("reset-panel");
    $("reset-btn-go").onclick = () => {
      const next = save(resetProgress());
      ui.resetSaved = next;
      clearRun();
      toast(T().resetBtn);
      SFX.click();
      hideOverlay();
      location.reload();
    };
    $("reset-cancel").onclick = () => hideOverlay();
  }

  function resetProgress() {
    return defaultState();
  }

  function toggleMute() {
    ui.muted = !ui.muted;
    setMutedPref(ui.muted);
    SFX.click();
    applyLang();
  }

  function setMutedPref(muted) {
    try {
      const state = loadSave();
      save(storageSetMuted(state, muted));
    } catch (error) {
      // 忽略
    }
  }

  function toggleLang() {
    const next = ui.locale === "zh" ? "en" : "zh";
    controller.setLang(next);
    saveLocalePref(next);
    SFX.click();
    render();
  }

  function saveLocalePref(locale) {
    try {
      localStorage.setItem("doin.lang", locale);
    } catch (error) {
      // 忽略
    }
  }

  // ---------------- 启动 ----------------
  function init() {
    const stage = $("stage");
    stage.innerHTML = "";
    bindStatic();
    bindShopAndRack();
    applyLang();
    const state = controller.getState();
    ui.muted = loadSave().prefs?.muted ?? false;
    SFX.setMuted(ui.muted);

    controller.on((type, payload) => {
      if (type === "battle-step") {
        ui.lastEvents = payload.events || [];
        const battle = payload.battle;
        requestAnimationFrame(() => drawBattleFrame(battle));
      } else if (type === "battle-start") {
        requestAnimationFrame(() => drawBattleFrame(null));
      } else if (type === "craft") {
        SFX.craft();
        toast(`${fmt("toastCraft", nameOf(payload.itemId))}`);
      } else if (type === "toast-seen") {
        // 保留
      } else if (type === "persist") {
        if (payload === null) clearRun();
        else saveRun(payload);
      } else if (type === "puzzle-end") {
        const { stars, won } = payload;
        if (won && stars > 0) {
          const prog = loadSave();
          const next = recordPuzzle(prog, { puzzleId: payload.puzzleId, stars });
          save(next.state);
        }
      } else if (type === "expedition-end") {
        if (payload.abandoned) return;
        const prog = loadSave();
        const wins = payload.result?.wins ?? 0;
        const promoted = payload.progress?.promoted ?? 0;
        const rank = Math.min(4, (prog.progress.rank ?? 0) + promoted);
        save(recordExpedition(prog, { rank, wins, expeditions: 1 }));
        if (promoted) toast(fmt("toastRankUp", rankName(rank)));
      } else if (type === "mirror-end") {
        const prog = loadSave();
        const next = recordMirror(prog, { rounds: payload.result?.floor ?? 0, damage: payload.result?.damage ?? 0 });
        save(next.state);
        if (next.isRecord) toast(`${T().newBestBadge} ${fmt("mirrorRound", payload.result?.floor ?? 0)}`);
      } else if (type === "mirror-win") {
        const prog = loadSave();
        const next = recordMirror(prog, { rounds: payload.floor - 1, damage: 0 });
        save(next.state);
      } else if (type === "update") {
        // 舞台渲染在调用方自行触发；这里只处理需要全量刷新的场合
      } else if (type === "toast") {
        const msg = payload.message;
        if (msg === "gold-short") toast(T().toastGoldShort);
        else if (msg === "full") toast(T().toastFull);
      } else if (type === "buy") {
        SFX.buy();
      } else if (type === "sell") {
        SFX.sell();
      } else if (type === "mode") {
        render();
      }
    });
    render();
  }

  function rotateFocused() {
    const el = document.querySelector(".item.is-selected");
    if (!el) return;
    const mode = controller.getState().mode === "expedition" ? "expedition" : "puzzle";
    const bs = mode === "expedition" ? controller.getState().run : controller.getState().puzzle;
    if (bs) rotateSelected(el, bs, mode);
  }

  function sellFocused() {
    const el = document.querySelector(".item.is-selected");
    if (!el) return;
    sellByDrag(modeOfState(), Number(el.dataset.uid));
    ui.selectedUid = null;
    refreshInfo();
  }

  function closeOverlay() {
    hideOverlay();
  }

  return { init, render, rotateFocused, sellFocused, closeOverlay };
}
