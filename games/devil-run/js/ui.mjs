// 恶魔迷途 · 界面层（唯一碰 DOM 的层；画布内的像素归 render.mjs，
// 画布外的机台控件、弹层与文案归本层。）
//
// 硬性纪律：
//   - 界面绝不自算印章 / 用时 / 死亡，一切读 score.mjs、storage.mjs 与 game.getSummary()。
//   - 界面绝不自造 action、绝不回写引擎状态；所有意图只通过 game 的方法表达。
//   - 文案一律走 i18n，不硬编码中文。

import * as i18n from "./i18n.mjs";
import * as score from "./score.mjs";
import * as storage from "./storage.mjs";

const $ = (id) => document.getElementById(id);

// 印章图标：与 i18n 的 sealClear / sealCandle / sealFlawless 一一对应
const SEAL_ICONS = Object.freeze({ clear: "✔", candle: "🕯", flawless: "🛡" });

// 陷阱种类 → 音频回调。键与 engine 的 TRAP 常量严格同名。
// 「先承诺后翻脸」的两段式：前兆一声轻响（承诺），发动一声实的（翻脸）。
const TRAP_SFX = Object.freeze({
  collapse: "playCollapse",
  spike: "playSpike",
  ceiling: "playCeiling",
  fake: "playCollapse",
  vanish: "playVanish",
  spring: "playSpring",
  fakedoor: "playGoalGone",
  rundoor: "playGoalGone",
  gravity: "playGravityFlip",
  reverse: "playReverse",
  ghostspike: "playSpike",
  portal: "playPortal"
});

export function createUI({ game, renderer, audio }) {
  let locale = i18n.loadLocale();
  let store = storage.load();
  let lastDeaths = -1;
  let lastLevelIndex = -1;
  let lastPhase = "";
  let hintTimer = 0;
  let tipShown = { death: false, many: false, candle: false };
  let topRaf = 0;

  const els = {
    // 顶边铭牌
    nodeBadge: $("node-badge"),
    gameTitle: $("game-title"),
    nodeName: $("node-name"),
    levelTag: $("level-tag"),
    levelVal: $("level-val"),
    timeTag: $("time-tag"),
    timeVal: $("time-val"),
    deathTag: $("death-tag"),
    deathVal: $("death-val"),
    // 左翼印章台
    sealTitle: $("seal-title"),
    sealNodeId: $("seal-node-id"),
    sealNodeCount: $("seal-node-count"),
    sealBarFill: $("seal-bar-fill"),
    sealSub: $("seal-sub"),
    totalTitle: $("total-title"),
    totalCount: $("total-count"),
    levelsBtn: $("levels-btn"),
    // 舞台
    canvas: $("stage"),
    hint: $("hint"),
    // 右翼
    candleTitle: $("candle-title"),
    candleSlot: $("candle-slot"),
    candleState: $("candle-state"),
    bestTitle: $("best-title"),
    bestVal: $("best-val"),
    gravTitle: $("grav-title"),
    gravitySlot: $("gravity-slot"),
    gravityGlyph: $("gravity-glyph"),
    // 操作台
    padLeft: $("pad-left"),
    padRight: $("pad-right"),
    padJump: $("pad-jump"),
    btnRestart: $("btn-restart"),
    btnSound: $("btn-sound"),
    btnRules: $("btn-rules"),
    btnLang: $("btn-lang"),
    backHome: $("back-home"),
    // 选关弹层
    layerLevels: $("layer-levels"),
    levelsList: $("levels-list"),
    levelsHeading: $("levels-heading"),
    levelsClose: $("levels-close"),
    // 结算弹层
    layerResult: $("layer-result"),
    resultBadge: $("result-badge"),
    resultHeading: $("result-heading"),
    resultLine: $("result-line"),
    resultSeals: $("result-seals"),
    resultNote: $("result-note"),
    resultNext: $("result-next"),
    resultReplay: $("result-replay"),
    resultClose: $("result-close"),
    // 规则弹层
    layerRules: $("layer-rules"),
    rulesHeading: $("rules-heading"),
    rulesBody: $("rules-body"),
    rulesClose: $("rules-close")
  };

  const t = () => i18n.strings(locale);

  // ============================================================ 静态文案

  function applyStaticText() {
    const s = t();
    document.documentElement.lang = i18n.htmlLang(locale);
    document.title = s.docTitle;

    els.gameTitle.textContent = s.title;
    els.levelTag.textContent = s.levelLabel;
    els.timeTag.textContent = s.timeLabel;
    els.deathTag.textContent = s.deathLabel;

    els.sealTitle.textContent = s.sealsTitle;
    els.totalTitle.textContent = s.sealsTitle;
    els.levelsBtn.textContent = s.selectLevel;
    els.levelsBtn.setAttribute("aria-label", s.selectLevel);

    els.candleTitle.textContent = s.candleLabel;
    els.bestTitle.textContent = s.bestLabel;
    els.gravTitle.textContent = s.title + " · " + s.sealLabel;

    els.btnRestart.textContent = s.retry;
    els.btnRestart.setAttribute("aria-label", s.retry);
    els.btnRules.textContent = s.rules;
    els.btnRules.setAttribute("aria-label", s.rules);
    els.btnLang.textContent = s.langShort;
    els.btnLang.setAttribute("aria-label", s.ariaLang);
    els.backHome.textContent = s.backHome;

    els.canvas.setAttribute("aria-label", s.canvasAria);
    els.padLeft.setAttribute("aria-label", s.ruleControl);
    els.padRight.setAttribute("aria-label", s.ruleControl);
    els.padJump.setAttribute("aria-label", s.ruleControl);

    els.levelsHeading.textContent = s.levelsTitle;
    els.levelsClose.textContent = s.close;
    els.rulesHeading.textContent = s.ruleTitle;
    els.rulesClose.textContent = s.ruleClose;

    els.resultHeading.textContent = s.resultTitle;
    els.resultNext.textContent = s.resultNext;
    els.resultReplay.textContent = s.resultRetry;
    els.resultClose.textContent = s.close;

    renderRulesBody();
    setMuted(store.prefs.muted, { silent: true });
    renderSealNode();
    renderOverall();
    if (!els.layerLevels.hidden) renderLevels();
  }

  // 规则正文：由 i18n 的六个句子拼装（不做 innerHTML 堆 HTML 字符串，
  // 避免把文案表变成半张模板；每句都是可独立翻译的完整句子）。
  function renderRulesBody() {
    const s = t();
    const items = [
      [s.ruleGoal],
      [s.ruleControl],
      [s.ruleFair],
      [s.ruleTolerant],
      [s.ruleSeal],
      [s.ruleCandle]
    ];
    els.rulesBody.replaceChildren(
      ...items.map(([text]) => {
        const p = document.createElement("p");
        p.textContent = text;
        return p;
      })
    );
  }

  // ============================================================ 轻提示

  function showHint(text, ms = 2000) {
    if (!text) return;
    els.hint.textContent = text;
    els.hint.classList.add("show");
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => els.hint.classList.remove("show"), ms);
  }

  // ============================================================ 顶边读数

  function bump(el) {
    el.classList.remove("bump");
    void el.offsetWidth; // 强制重排以重启动画
    el.classList.add("bump");
  }

  // 高频路径：每帧都调用。
  // 时间读数会随时间连续变化，逐帧写 textContent 在桌面端开销很小；
  // 但连击/翻轴类动画（bump）只在值真的变了才触发。
  function renderTop(summary) {
    if (!summary) return;
    const s = t();

    if (summary.levelIndex !== lastLevelIndex) {
      lastLevelIndex = summary.levelIndex;
      const label = score.levelLabel(summary.levelIndex);
      els.nodeBadge.textContent = String(label.node).padStart(2, "0");
      els.nodeName.textContent = summary.nodeName || label.name || "";
      els.levelVal.textContent =
        i18n.format(s.levelName, label.node, label.step) || `${label.node}-${label.step}`;
      els.bestVal.textContent = bestClock(summary.levelIndex);
      lastDeaths = -1;
    }

    els.timeVal.textContent = summary.clock;

    if (summary.deaths !== lastDeaths) {
      const grew = lastDeaths >= 0 && summary.deaths > lastDeaths;
      els.deathVal.textContent = String(summary.deaths);
      if (grew) bump(els.deathVal);
      lastDeaths = summary.deaths;
    }

    // 蜡烛：本关是否已拿到
    const got = Boolean(summary.gotCandle);
    els.candleSlot.classList.toggle("found", got);
    els.candleState.textContent = got ? s.resultCandle : s.resultNoCandle;

    // 重力
    const flipped = summary.gravityDir < 0;
    els.gravitySlot.classList.toggle("flipped", flipped);
    els.gravityGlyph.textContent = flipped ? "↑" : "↓";
  }

  function bestClock(levelIndex) {
    const best = storage.getBestTime(store, levelIndex);
    return best === null ? "--" : score.clock(best);
  }

  // ============================================================ 印章台

  function renderSealNode() {
    const s = t();
    const label = score.levelLabel(game.levelIndex);
    const node = score.NODES.find((n) => n.id === label.node) ?? null;
    if (!node) return;

    const tally = storage.nodeSeals(store, node);
    const total = tally.total * score.SEALS_PER_LEVEL;
    const lit = tally.clear + tally.candle + tally.flawless;

    els.sealNodeId.textContent = String(node.id).padStart(2, "0");
    els.sealNodeCount.innerHTML = `<b>${lit}</b><i>/${total}</i>`;
    els.sealBarFill.style.width = `${total ? (lit / total) * 100 : 0}%`;
    els.sealSub.textContent = i18n.format(s.nodeProgress, lit, total);
  }

  function renderOverall() {
    const sealsByLevel = store.progress.seals;
    const tally = score.overallTally(sealsByLevel);
    const total = score.LEVEL_COUNT * score.SEALS_PER_LEVEL;
    const lit = tally.clear + tally.candle + tally.flawless;
    els.totalCount.innerHTML = `<b>${lit}</b><i>/${total}</i>`;
  }

  // ============================================================ 选关弹层

  function renderLevels() {
    const s = t();
    const frag = document.createDocumentFragment();

    for (const node of score.NODES) {
      const head = document.createElement("p");
      head.className = "lv-node";
      head.textContent = i18n.format(s.nodeTitle, node.id, node.name) || node.name;
      frag.appendChild(head);

      for (let i = node.from; i <= node.to; i++) {
        const label = score.levelLabel(i);
        const unlocked = storage.isLevelUnlocked(store, i);
        const cleared = storage.getSeal(store, i).clear;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "lv-btn";
        if (i === game.levelIndex) btn.classList.add("current");
        btn.disabled = !unlocked;
        btn.textContent = String(label.step);
        btn.setAttribute(
          "aria-label",
          [
            i18n.format(s.nodeTitle, label.node, label.name),
            `${s.levelLabel} ${label.step}`,
            cleared ? s.cleared : unlocked ? "" : s.locked
          ]
            .filter(Boolean)
            .join(" ")
        );
        btn.title = unlocked ? `${s.levelLabel} ${label.step}` : s.locked;

        const row = document.createElement("span");
        row.className = "lv-seals";
        const seal = storage.getSeal(store, i);
        for (const key of score.SEAL_KEYS) {
          const dot = document.createElement("span");
          dot.className = "lv-seal" + (seal[key] ? " on" : "");
          row.appendChild(dot);
        }
        btn.appendChild(row);

        if (unlocked) {
          btn.addEventListener("click", () => {
            audio.playClick();
            closeLayer(els.layerLevels);
            game.startLevel(i);
          });
        }
        frag.appendChild(btn);
      }
    }

    els.levelsList.replaceChildren(frag);
  }

  function anyLayerOpen() {
    return !els.layerLevels.hidden || !els.layerResult.hidden || !els.layerRules.hidden;
  }

  function openLayer(el) {
    el.hidden = false;
    game.setPaused(true);
    const focusable = el.querySelector("button:not([disabled])");
    if (focusable) focusable.focus();
  }

  function closeLayer(el) {
    el.hidden = true;
    if (!anyLayerOpen()) game.setPaused(false);
  }

  // ============================================================ 结算

  function renderResult(payload) {
    const s = t();
    const seals = payload.seals;
    const perfect = score.countSeals(seals) === score.SEALS_PER_LEVEL;

    els.resultBadge.textContent = perfect ? s.sealFlawless : s.resultSeal;
    els.resultHeading.textContent = perfect ? s.resultTitleFlawless : s.resultTitle;
    els.resultLine.textContent = [
      `${s.resultTime} ${payload.clock ?? score.clock(payload.elapsed)}`,
      `${s.resultBest} ${bestClock(payload.levelIndex)}`,
      `${s.resultDeaths} ${payload.deaths ?? 0}`
    ].join(" · ");

    const names = { clear: s.sealClear, candle: s.sealCandle, flawless: s.sealFlawless };
    els.resultSeals.replaceChildren(
      ...score.SEAL_KEYS.map((key) => {
        const chip = document.createElement("div");
        chip.className = "seal-chip" + (seals[key] ? " lit" : "");
        chip.title = seals[key] ? s.sealLit : s.sealLocked;

        const ico = document.createElement("span");
        ico.className = "seal-ico";
        ico.textContent = SEAL_ICONS[key];
        const name = document.createElement("span");
        name.className = "seal-name";
        name.textContent = names[key];

        chip.append(ico, name);
        return chip;
      })
    );

    // 结语：新纪录优先，其次给一句恶魔腔的调侃
    const isLast = payload.levelIndex >= score.LEVEL_COUNT - 1;
    let note;
    if (payload.isNewBest) note = s.resultNewRecord;
    else if (isLast) note = s.resultFinal;
    else if (seals.candle) note = s.resultCandle;
    else if (!seals.candle) note = s.resultNoCandle;
    else note = s.cleared;
    els.resultNote.textContent = note;

    els.resultNext.disabled = isLast;
    els.resultNext.textContent = isLast ? s.resultFinal : s.resultNext;

    openLayer(els.layerResult);
  }

  // ============================================================ 音效开关

  function setMuted(muted, opts = {}) {
    const next = Boolean(muted);
    store = { ...store, prefs: { ...store.prefs, muted: next } };
    storage.save(store);
    const s = t();
    els.btnSound.setAttribute("aria-pressed", String(!next));
    els.btnSound.textContent = next ? "✕" : "♪";
    els.btnSound.setAttribute("aria-label", s.sound);
    els.btnSound.title = s.sound;
    audio.setMuted(next);
    if (!opts.silent) audio.playClick();
  }

  // ============================================================ 语言

  function setLocale(next) {
    if (!i18n.isLocale(next) || next === locale) return;
    locale = next;
    i18n.saveLocale(next);
    lastLevelIndex = -1; // 强制刷新一次顶边文字
    applyStaticText();
    audio.playClick();
  }

  // ============================================================ 输入绑定

  const KEY_LEFT = new Set(["ArrowLeft", "a", "A"]);
  const KEY_RIGHT = new Set(["ArrowRight", "d", "D"]);
  const KEY_JUMP = new Set([" ", "ArrowUp", "w", "W"]);

  function setHeld(name, down, el) {
    game.setInput(name, down);
    if (el) el.classList.toggle("pressed", down);
  }

  function bindHold(el, name) {
    const down = (ev) => {
      ev.preventDefault();
      setHeld(name, true, el);
      audio.resume();
    };
    const up = (ev) => {
      if (ev) ev.preventDefault();
      setHeld(name, false, el);
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("pointerleave", up);
    el.addEventListener("contextmenu", (ev) => ev.preventDefault());
  }

  function bindKeyboard() {
    const onKey = (ev, down) => {
      const key = ev.key;
      if (KEY_LEFT.has(key)) {
        ev.preventDefault();
        setHeld("left", down, els.padLeft);
      } else if (KEY_RIGHT.has(key)) {
        ev.preventDefault();
        setHeld("right", down, els.padRight);
      } else if (KEY_JUMP.has(key)) {
        ev.preventDefault();
        setHeld("jump", down, els.padJump);
      } else if (down && (key === "r" || key === "R")) {
        game.restartLevel();
      } else if (down && key === "Escape") {
        if (!els.layerRules.hidden) closeLayer(els.layerRules);
        else if (!els.layerLevels.hidden) closeLayer(els.layerLevels);
        else if (!els.layerResult.hidden) closeLayer(els.layerResult);
      }
      if (down) audio.resume();
    };
    window.addEventListener("keydown", (ev) => onKey(ev, true));
    window.addEventListener("keyup", (ev) => onKey(ev, false));
    window.addEventListener("blur", () => {
      game.clearInputs();
      els.padLeft.classList.remove("pressed");
      els.padRight.classList.remove("pressed");
      els.padJump.classList.remove("pressed");
    });
  }

  function bindButtons() {
    bindHold(els.padLeft, "left");
    bindHold(els.padRight, "right");
    bindHold(els.padJump, "jump");

    els.btnRestart.addEventListener("click", () => {
      audio.playClick();
      game.restartLevel();
    });

    els.btnSound.addEventListener("click", () => setMuted(!store.prefs.muted));
    els.btnLang.addEventListener("click", () => setLocale(locale === "zh" ? "en" : "zh"));

    els.btnRules.addEventListener("click", () => {
      audio.playClick();
      openLayer(els.layerRules);
    });
    els.rulesClose.addEventListener("click", () => closeLayer(els.layerRules));

    els.levelsBtn.addEventListener("click", () => {
      audio.playClick();
      renderLevels();
      openLayer(els.layerLevels);
    });
    els.levelsClose.addEventListener("click", () => closeLayer(els.layerLevels));

    els.resultNext.addEventListener("click", () => {
      audio.playClick();
      closeLayer(els.layerResult);
      game.goNextLevel();
    });
    els.resultReplay.addEventListener("click", () => {
      audio.playClick();
      closeLayer(els.layerResult);
      game.restartLevel();
    });
    els.resultClose.addEventListener("click", () => {
      audio.playClick();
      closeLayer(els.layerResult);
    });

    // 点弹层背景关闭（结算层必须显式选择，不响应背景点击）
    for (const layer of [els.layerRules, els.layerLevels]) {
      layer.addEventListener("pointerdown", (ev) => {
        if (ev.target === layer) closeLayer(layer);
      });
    }
  }

  // ============================================================ 帧事件 → 音效 / 特效

  function trackPlayer(ev) {
    const p = renderer.worldToCanvas(ev.x, ev.y);
    return p;
  }

  function handleFrameEvents(events, summary) {
    for (const ev of events) {
      switch (ev.type) {
        case "jump":
          audio.playJump();
          break;
        case "trap_telegraph":
          audio.playTelegraph();
          break;
        case "trap_fire": {
          const fn = TRAP_SFX[ev.kind];
          if (fn) audio[fn]();
          break;
        }
        case "spring": {
          // 弹簧自己再补一记，强调"被弹飞"的滑稽感
          const p = renderer.worldToCanvas(ev.col + 0.5, ev.row + 0.5);
          renderer.spawnSpark(p.x, p.y, "rgba(120,230,220,");
          break;
        }
        case "goal_gone":
          showHint(t().tipWon, 1200);
          break;
        case "gravity_flip": {
          const p = renderer.worldToCanvas(summary.player.x, summary.player.y);
          renderer.spawnRipple(p.x, p.y, "rgba(196,106,224,");
          break;
        }
        case "controls_reversed":
          showHint(t().tipStart, 1200);
          break;
        case "portal": {
          const p = renderer.worldToCanvas(ev.x, ev.y);
          renderer.spawnRipple(p.x, p.y, "rgba(140,200,255,");
          break;
        }
        case "candle": {
          audio.playCandle();
          const p = trackPlayer(ev);
          renderer.spawnSpark(p.x, p.y, "rgba(255,209,102,");
          if (!tipShown.candle) {
            tipShown.candle = true;
            showHint(t().tipCandleNear, 1500);
          }
          break;
        }
        case "death": {
          audio.playDeath();
          const p = trackPlayer(ev);
          renderer.spawnRipple(p.x, p.y, "rgba(196,106,224,");
          renderer.spawnSpark(p.x, p.y, "rgba(196,106,224,");
          const d = summary.deathsThisRun;
          if (d >= 8 && !tipShown.many) {
            tipShown.many = true;
            showHint(t().tipManyDeaths, 1800);
          } else if (d >= 1 && !tipShown.death) {
            tipShown.death = true;
            showHint(t().tipDeath, 1600);
          }
          break;
        }
        case "respawn":
          audio.playRespawn();
          break;
        default:
          break;
      }
    }
  }

  // ============================================================ 通关结算

  function commitWin(ev) {
    const seals = score.sealsFromState(game.state);
    const elapsed = game.state.elapsed;
    const prevBest = storage.getBestTime(store, ev.levelIndex);
    const isNewBest = score.isNewBestTime(prevBest, elapsed);

    store = storage.recordClear(store, { levelIndex: ev.levelIndex, seal: seals, elapsed });
    storage.save(store);

    // 音效：满印给最漂亮的一串
    if (score.isLevelPerfect(seals)) audio.playFlawless();
    else audio.playSeal();
    audio.playWin();

    const g = game.state.goal;
    const p = renderer.worldToCanvas(g.x, g.y);
    renderer.spawnSpark(p.x, p.y, "rgba(240,196,106,");

    renderSealNode();
    renderOverall();
    renderTop(game.getSummary());
    renderResult({
      levelIndex: ev.levelIndex,
      elapsed,
      clock: score.clock(elapsed),
      deaths: ev.deaths ?? game.state.stats.deathsThisRun,
      seals,
      isNewBest
    });
  }

  function bindGame() {
    game.subscribe((ev) => {
      if (ev.type === "win") {
        commitWin(ev);
      } else if (ev.type === "level_started") {
        tipShown = { death: false, many: false, candle: false };
        const label = score.levelLabel(ev.levelIndex);
        if (label.step === 1) showHint(t().tipStart, 2200);
      } else if (ev.type === "deaths_added") {
        store = storage.recordDeath(store, game.levelIndex, ev.count);
        storage.save(store);
      }
    });
  }

  // ============================================================ 启动

  function init() {
    applyStaticText();
    bindButtons();
    bindKeyboard();
    bindGame();

    const summary = game.getSummary();
    renderTop(summary);
    renderSealNode();
    renderOverall();
    if (summary) showHint(t().tipStart, 2600);

    return {
      // 主循环每帧调用：先刷数值，再消化本帧事件
      onFrame(events, summary) {
        renderTop(summary);
        handleFrameEvents(events, summary);
        // 死亡重生后印章台与最佳用时可能变化
        if (summary && summary.levelIndex !== lastLevelIndex) renderSealNode();
      },
      // 结算弹层打开时暂停，关闭后主循环自然恢复 —— 无需额外钩子
      setLocale,
      get locale() {
        return locale;
      },
      get store() {
        return store;
      },
      refreshStore() {
        store = storage.load();
        lastLevelIndex = -1;
        renderSealNode();
        renderOverall();
      },
      destroy() {
        cancelAnimationFrame(topRaf);
        clearTimeout(hintTimer);
      }
    };
  }

  return { init, t, setLocale, setMuted };
}

export default createUI;
