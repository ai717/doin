// DOM presentation for Oracle Glyph Match: the rubbing scroll board, level atlas and result sheet.

import { t, htmlLang } from "./i18n.mjs";
import { GLYPHS } from "./data.mjs";
import { LEVELS, CHAPTERS, levelsOfChapter } from "./levels.mjs";
import { formatTime, totalStars, chapterStars, chapterComplete } from "./score.mjs";

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function meaningOf(glyph, locale) {
  return locale === "en" ? glyph.en : glyph.zh;
}

export function glyphSvg(glyph, extraClass = "") {
  const paths = glyph.paths.map((d) => `<path d="${d}"/>`).join("");
  const dots = (glyph.dots ?? [])
    .map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="currentColor" stroke="none"/>`)
    .join("");
  return `<svg class="glyph-svg ${extraClass}" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="5.4" stroke-linecap="round" stroke-linejoin="round">${paths}${dots}</g></svg>`;
}

export function createUi(refs) {
  let locale = "zh";
  let toastTimer = 0;
  let evolutionTimers = [];
  let evolutionHide = 0;
  let lastEvolution = null;

  const reducedMotion = () => Boolean(globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);

  function applyStatic(nextLocale) {
    locale = nextLocale === "en" ? "en" : "zh";
    document.documentElement.lang = htmlLang(locale);
    document.title = t(locale, "docTitle");
    for (const node of document.querySelectorAll("[data-i18n]")) {
      node.textContent = t(locale, node.dataset.i18n);
    }
    for (const node of document.querySelectorAll("[data-i18n-aria]")) {
      node.setAttribute("aria-label", t(locale, node.dataset.i18nAria));
    }
    if (refs.langBtn) refs.langBtn.textContent = t(locale, "langShort");
    if (refs.keyHint) {
      const touch = Boolean(globalThis.matchMedia?.("(max-width: 768px)")?.matches);
      refs.keyHint.textContent = t(locale, touch ? "keyHintTouch" : "keyHint");
    }
    if (lastEvolution) {
      const { glyph } = lastEvolution;
      fillEvolution(glyph);
    }
  }

  function pickHandler(handlers, side, index) {
    return () => handlers.onPick?.(side, index);
  }

  function buildBoard({ snapshot, handlers = {} }) {
    if (!refs.oracleGrid || !refs.charGrid) return;
    refs.oracleGrid.innerHTML = "";
    refs.charGrid.innerHTML = "";

    snapshot.oracleOrder.forEach((pairIndex, displayIndex) => {
      const glyph = GLYPHS[snapshot.pairs[pairIndex]];
      if (!glyph) return;
      const card = el("button", "pair-card oracle-card");
      card.type = "button";
      card.dataset.side = "oracle";
      card.dataset.index = String(displayIndex);
      card.dataset.pair = String(pairIndex);
      card.setAttribute("aria-label", t(locale, "oracleCardAria", { n: displayIndex + 1 }));
      card.setAttribute("aria-pressed", "false");
      const frame = el("span", "glyph-frame");
      frame.innerHTML = glyphSvg(glyph);
      card.append(frame);
      card.addEventListener("click", pickHandler(handlers, "oracle", displayIndex));
      refs.oracleGrid.append(card);
    });

    snapshot.charOrder.forEach((pairIndex, displayIndex) => {
      const glyph = GLYPHS[snapshot.pairs[pairIndex]];
      if (!glyph) return;
      const card = el("button", "pair-card char-card");
      card.type = "button";
      card.dataset.side = "char";
      card.dataset.index = String(displayIndex);
      card.dataset.pair = String(pairIndex);
      card.setAttribute("aria-label", t(locale, "charCardAria", {
        char: glyph.char,
        meaning: meaningOf(glyph, locale),
      }));
      card.setAttribute("aria-pressed", "false");
      card.append(el("span", "char-main", glyph.char));
      card.append(el("span", "char-meaning", meaningOf(glyph, locale)));
      card.append(el("span", "char-stamp", "◦"));
      card.addEventListener("click", pickHandler(handlers, "char", displayIndex));
      refs.charGrid.append(card);
    });

    syncBoard(snapshot);
    drawLinks(snapshot);
  }

  function isMatched(snapshot, pairIndex) {
    return snapshot.matches.some((match) => match.pairIndex === pairIndex);
  }

  function syncBoard(snapshot) {
    const cards = document.querySelectorAll(".pair-card");
    cards.forEach((card) => {
      const side = card.dataset.side;
      const index = Number(card.dataset.index);
      const pairIndex = Number(card.dataset.pair);
      const matched = isMatched(snapshot, pairIndex);
      const selected = Boolean(snapshot.selected && snapshot.selected.side === side && snapshot.selected.index === index);
      const wrong = Boolean(snapshot.wrong && (side === "oracle" ? snapshot.wrong.oracleIndex : snapshot.wrong.charIndex) === index);
      card.classList.toggle("is-matched", matched);
      card.classList.toggle("is-selected", selected);
      card.classList.toggle("is-wrong", wrong);
      card.setAttribute("aria-pressed", selected ? "true" : "false");
      card.setAttribute("aria-disabled", matched ? "true" : "false");
      if (matched) card.disabled = true;
      else card.disabled = false;
    });
  }

  function boardRect(node) {
    return typeof node?.getBoundingClientRect === "function" ? node.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 };
  }

  function drawLinks(snapshot) {
    const svg = refs.linkLayer;
    const board = refs.board;
    if (!svg || !board) return;
    svg.innerHTML = "";
    if (!snapshot || !snapshot.matches.length) {
      svg.setAttribute("width", "0");
      svg.setAttribute("height", "0");
      return;
    }
    const base = boardRect(board);
    const width = Math.max(1, Math.round(base.width));
    const height = Math.max(1, Math.round(base.height));
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));
    svg.style.width = `${width}px`;
    svg.style.height = `${height}px`;

    for (const match of snapshot.matches) {
      const oracle = board.querySelector(`.oracle-card[data-index="${match.oracleIndex}"]`);
      const character = board.querySelector(`.char-card[data-index="${match.charIndex}"]`);
      if (!oracle || !character) continue;
      const a = boardRect(oracle);
      const b = boardRect(character);
      const horizontal = b.left >= a.right - 6;
      let x1;
      let y1;
      let x2;
      let y2;
      let d;
      if (horizontal) {
        x1 = a.right - base.left;
        y1 = a.top + a.height / 2 - base.top;
        x2 = b.left - base.left;
        y2 = b.top + b.height / 2 - base.top;
        const mid = (x1 + x2) / 2;
        d = `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
      } else {
        x1 = a.left + a.width / 2 - base.left;
        y1 = a.bottom - base.top;
        x2 = b.left + b.width / 2 - base.left;
        y2 = b.top - base.top;
        const mid = (y1 + y2) / 2;
        d = `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`;
      }
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.setAttribute("class", "trace-group");
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", d);
      path.setAttribute("class", "trace-line");
      const start = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      start.setAttribute("cx", String(x1));
      start.setAttribute("cy", String(y1));
      start.setAttribute("r", "4.5");
      start.setAttribute("class", "trace-dot");
      const end = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      end.setAttribute("cx", String(x2));
      end.setAttribute("cy", String(y2));
      end.setAttribute("r", "4.5");
      end.setAttribute("class", "trace-dot");
      group.append(path, start, end);
      svg.append(group);
    }
  }

  function updateHud(snapshot, progress) {
    const level = LEVELS[snapshot.levelIndex] ?? LEVELS[0];
    if (refs.hudChapter) {
      refs.hudChapter.textContent = t(locale, "chapterHeading", {
        n: level.chapterIndex + 1,
        name: t(locale, level.nameKey),
      });
    }
    if (refs.hudLevel) refs.hudLevel.textContent = t(locale, "levelLabel", { n: level.levelInChapter });
    if (refs.hudPairs) {
      refs.hudPairs.textContent = t(locale, "pairsRatio", { n: snapshot.matched, total: snapshot.pairCount });
    }
    if (refs.hudErrors) refs.hudErrors.textContent = String(snapshot.errors);
    if (refs.hudTime) refs.hudTime.textContent = formatTime(snapshot.time);
    if (refs.hudStars) {
      refs.hudStars.textContent = t(locale, "starsRatio", {
        n: totalStars(progress?.levels ?? {}),
        total: LEVELS.length * 3,
      });
    }
  }

  function renderLevels({ progress, currentIndex, onPick }) {
    const host = refs.levelGroups;
    if (!host) return;
    host.innerHTML = "";
    const records = progress?.levels ?? {};
    CHAPTERS.forEach((chapter, chapterIndex) => {
      const block = el("section", "chapter-block");
      const head = el("div", "chapter-head");
      const heading = el("strong", "chapter-title", t(locale, "chapterHeading", {
        n: chapterIndex + 1,
        name: t(locale, chapter.nameKey),
      }));
      const meta = el("span", "chapter-meta", t(locale, "chapterProgress", {
        n: chapterStars(records, chapterIndex),
        total: levelsOfChapter(chapterIndex).length * 3,
      }));
      head.append(heading, meta);
      if (chapterComplete(records, chapterIndex)) {
        head.append(el("span", "chapter-badge", t(locale, "chapterDone")));
      }
      block.append(head);

      const grid = el("div", "level-grid");
      for (const level of levelsOfChapter(chapterIndex)) {
        const record = records[level.id];
        const button = el("button", "level-chip");
        button.type = "button";
        button.dataset.levelIndex = String(level.index);
        if (level.index === currentIndex) button.classList.add("is-current");
        button.setAttribute("aria-label", t(locale, "levelChipAria", {
          n: level.levelInChapter,
          stars: record?.stars ?? 0,
        }));

        const top = el("span", "level-chip-top");
        top.append(el("span", "level-chip-name", t(locale, "levelLabel", { n: level.levelInChapter })));
        const starRow = el("span", "level-stars");
        for (let star = 0; star < 3; star += 1) {
          starRow.append(el("span", star < (record?.stars ?? 0) ? "star" : "star dim", "★"));
        }
        top.append(starRow);
        button.append(top);

        const preview = el("span", "level-preview");
        const glyph = GLYPHS[level.glyphs[0]];
        if (glyph) preview.innerHTML = glyphSvg(glyph);
        button.append(preview);

        button.addEventListener("click", () => onPick?.(level.index));
        grid.append(button);
      }
      block.append(grid);
      host.append(block);
    });
    if (refs.selectTotal) {
      refs.selectTotal.textContent = t(locale, "selectTotal", {
        n: totalStars(records),
        total: LEVELS.length * 3,
      });
    }
  }

  function showResult({ snapshot, progress, isNewRecord = false, chapterDone = false, allDone = false }) {
    const record = progress?.levels?.[snapshot.levelId] ?? null;
    const titleKey = allDone ? "resultAll" : chapterDone ? "resultChapter" : "resultTitle";
    if (refs.resultTitle) refs.resultTitle.textContent = t(locale, titleKey);
    if (refs.resultStars) {
      refs.resultStars.innerHTML = "";
      for (let star = 0; star < 3; star += 1) {
        refs.resultStars.append(el("span", star < snapshot.stars ? "result-star" : "result-star dim", "★"));
      }
    }
    if (refs.resultRows) {
      refs.resultRows.innerHTML = "";
      const rows = [
        [t(locale, "resultStars"), t(locale, "starsRatio", { n: snapshot.stars, total: 3 })],
        [t(locale, "resultPairs"), t(locale, "pairsRatio", { n: snapshot.matched, total: snapshot.pairCount })],
        [t(locale, "resultErrors"), String(snapshot.errors)],
        [t(locale, "resultTime"), formatTime(snapshot.time)],
      ];
      if (record?.bestTime) rows.push([t(locale, "resultBest", { time: formatTime(record.bestTime) }), ""]);
      for (const [label, value] of rows) {
        const row = el("div", "result-row");
        row.append(el("span", "result-label", label));
        row.append(el("strong", "result-value", value));
        refs.resultRows.append(row);
      }
    }
    if (refs.resultNote) {
      refs.resultNote.textContent = isNewRecord ? t(locale, "newRecord") : "";
      refs.resultNote.hidden = !isNewRecord;
    }
    openPanel("panel-result");
  }

  function setResultNext(label) {
    if (!refs.resultNext) return;
    refs.resultNext.textContent = label;
  }

  function fillEvolution(glyph) {
    if (!refs.evolutionTrack) return;
    refs.evolutionTrack.innerHTML = "";
    const stages = [
      { kind: "oracle", labelKey: "evoOracle" },
      { kind: "bronze", labelKey: "evoBronze" },
      { kind: "seal", labelKey: "evoSeal" },
      { kind: "regular", labelKey: "evoRegular" },
    ];
    stages.forEach((stage, index) => {
      const step = el("div", "evo-step");
      step.dataset.step = String(index);
      const art = el("div", "evo-art");
      if (stage.kind === "oracle") art.innerHTML = glyphSvg(glyph, "evo-glyph");
      else if (stage.kind === "bronze") art.innerHTML = glyphSvg(glyph, "evo-glyph is-bronze");
      else if (stage.kind === "seal") art.append(el("span", "evo-char is-seal", glyph.char));
      else art.append(el("span", "evo-char is-regular", glyph.char));
      step.append(art, el("span", "evo-label", t(locale, stage.labelKey)));
      refs.evolutionTrack.append(step);
    });
    if (refs.evolutionTitle) refs.evolutionTitle.textContent = t(locale, "evolutionTitle");
  }

  function clearEvolutionTimers() {
    for (const timer of evolutionTimers) globalThis.clearTimeout(timer);
    evolutionTimers = [];
    globalThis.clearTimeout(evolutionHide);
    evolutionHide = 0;
  }

  function resetEvolution() {
    clearEvolutionTimers();
    lastEvolution = null;
    if (refs.evolution) {
      refs.evolution.hidden = true;
      refs.evolution.classList.remove("is-open");
    }
  }

  function showEvolution(glyph) {
    if (!glyph || !refs.evolution) return;
    clearEvolutionTimers();
    lastEvolution = { glyph };
    fillEvolution(glyph);
    refs.evolution.hidden = false;
    refs.evolution.classList.remove("is-open");
    void refs.evolution.offsetWidth;
    refs.evolution.classList.add("is-open");
    const steps = [...refs.evolutionTrack.querySelectorAll(".evo-step")];
    steps.forEach((step) => step.classList.remove("is-lit"));
    if (reducedMotion()) {
      steps.forEach((step) => step.classList.add("is-lit"));
      evolutionHide = globalThis.setTimeout(resetEvolution, 1700);
      return;
    }
    steps.forEach((step, index) => {
      evolutionTimers.push(globalThis.setTimeout(() => step.classList.add("is-lit"), 90 + index * 340));
    });
    evolutionHide = globalThis.setTimeout(resetEvolution, 2600);
  }

  function setSound(muted) {
    if (!refs.soundBtn) return;
    refs.soundBtn.textContent = muted ? "×" : "♪";
    refs.soundBtn.setAttribute("aria-label", t(locale, muted ? "soundOff" : "soundOn"));
  }

  function openPanel(id) {
    closePanels();
    const node = typeof id === "string" ? document.getElementById(id) : id;
    if (node) node.hidden = false;
  }

  function closePanels() {
    for (const node of document.querySelectorAll(".panel")) node.hidden = true;
  }

  function anyPanelOpen() {
    return Boolean(document.querySelector(".panel:not([hidden])"));
  }

  function showToast(message, duration = 1600) {
    if (!refs.toast) return;
    refs.toast.textContent = message;
    refs.toast.classList.add("is-visible");
    globalThis.clearTimeout(toastTimer);
    toastTimer = globalThis.setTimeout(() => {
      refs.toast.classList.remove("is-visible");
      globalThis.setTimeout(() => {
        if (!refs.toast.classList.contains("is-visible")) refs.toast.textContent = "";
      }, 240);
    }, duration);
  }

  return {
    applyStatic,
    buildBoard,
    syncBoard,
    drawLinks,
    updateHud,
    renderLevels,
    showResult,
    setResultNext,
    showEvolution,
    resetEvolution,
    setSound,
    openPanel,
    closePanels,
    anyPanelOpen,
    showToast,
    get locale() {
      return locale;
    },
  };
}
