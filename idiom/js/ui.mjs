// 页面 UI：HUD、榜单、图鉴、典故卡与结算面板。文案全部来自 i18n。
import { BOARDS, LEVELS_PER_BOARD } from "./boards.mjs";
import { t, htmlLang } from "./i18n.mjs";
import { boardStars, atlasIds } from "./score.mjs";

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function formatTime(ms) {
  const total = Math.max(0, Math.round(Number(ms) / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function createUi(refs, { onLocale } = {}) {
  let locale = "zh";

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
    if (refs.keyHint) refs.keyHint.textContent = t(locale, locale === "zh" ? "keyHint" : "keyHintTyping");
    if (refs.gridTitle) refs.gridTitle.textContent = t(locale, "gridTitle");
    onLocale?.(locale);
  }

  function setHud({ boardName, numeral, levelLabel, stars = 0, time = "0:00", best = "" }) {
    if (refs.hudBoard) refs.hudBoard.textContent = boardName;
    if (refs.hudNumeral) refs.hudNumeral.textContent = numeral;
    if (refs.hudLevel) refs.hudLevel.textContent = levelLabel;
    if (refs.hudTime) refs.hudTime.textContent = time;
    if (refs.hudStars) {
      refs.hudStars.innerHTML = "";
      for (let i = 0; i < 3; i += 1) {
        const star = el("span", i < stars ? "" : "dim", "★");
        refs.hudStars.appendChild(star);
      }
      refs.hudStars.setAttribute("aria-label", best || t(locale, "starsLabel"));
    }
    if (refs.gridProgress) refs.gridProgress.title = best;
  }

  function setTime(text) {
    if (refs.hudTime) refs.hudTime.textContent = text;
  }

  function setHintState({ hintsLeft, disabled }) {
    if (!refs.hintBtn) return;
    refs.hintBtn.textContent = hintsLeft > 0 ? t(locale, "hintLeft", { n: hintsLeft }) : t(locale, "noHintsLeft");
    refs.hintBtn.disabled = Boolean(disabled) || hintsLeft <= 0;
  }

  let toastTimer = 0;
  function showToast(message, duration = 1800) {
    if (!refs.toast) return;
    refs.toast.textContent = message;
    refs.toast.classList.add("is-visible");
    globalThis.clearTimeout(toastTimer);
    toastTimer = globalThis.setTimeout(() => refs.toast.classList.remove("is-visible"), duration);
  }

  function hideToast() {
    refs.toast?.classList.remove("is-visible");
  }

  function setSoundButton(muted) {
    if (!refs.soundBtn) return;
    refs.soundBtn.textContent = muted ? "×" : "♪";
    refs.soundBtn.setAttribute("aria-label", t(locale, muted ? "soundOff" : "soundOn"));
  }

  function openPanel(id) {
    for (const panel of document.querySelectorAll(".panel")) {
      if (panel.id !== id) panel.hidden = true;
    }
    const panel = document.getElementById(id);
    if (panel) panel.hidden = false;
  }

  function closePanels() {
    for (const panel of document.querySelectorAll(".panel")) panel.hidden = true;
  }

  function anyPanelOpen() {
    return [...document.querySelectorAll(".panel")].some((panel) => !panel.hidden);
  }

  function renderBoards({ progress, current, onPick, onPlay }) {
    const wrap = refs.boardCards;
    if (!wrap) return;
    wrap.innerHTML = "";
    for (const board of BOARDS) {
      const card = el("div", "board-card");
      if (board.id === current.boardId) card.classList.add("is-current");
      const head = el("div", "board-card-head");
      head.append(el("span", "board-numeral", board.numeral));
      head.append(el("span", "board-name", t(locale, board.nameKey)));
      card.append(head);
      card.append(el("p", "board-desc", t(locale, board.descKey)));

      const stars = boardStars(progress, locale, board.id);
      const levels = progress?.boards?.[locale]?.[board.id]?.levels ?? {};
      const done = Object.keys(levels).filter((key) => (levels[key]?.stars ?? 0) > 0).length;
      const meta = el("div", "board-meta");
      meta.append(el("span", "board-stars", `★ ${stars} / ${LEVELS_PER_BOARD * 3}`));
      meta.append(el("span", "", t(locale, "levelsDone", { done })));
      card.append(meta);

      const dots = el("div", "board-dots");
      for (let i = 0; i < LEVELS_PER_BOARD; i += 1) {
        const dot = el("span", "board-dot");
        if ((levels[String(i)]?.stars ?? 0) > 0) dot.classList.add("on");
        dots.append(dot);
      }
      card.append(dots);

      const levelWrap = el("div", "board-levels");
      levelWrap.setAttribute("aria-label", t(locale, "levelGridAria", { board: t(locale, board.nameKey) }));
      for (let i = 0; i < LEVELS_PER_BOARD; i += 1) {
        const record = levels[String(i)];
        const chip = el("button", "level-chip");
        chip.type = "button";
        const label = el("span", "", t(locale, "levelShort", { n: i + 1 }));
        chip.append(label);
        if (record?.stars) {
          chip.classList.add("has-stars");
          chip.append(el("span", "chip-stars", "★".repeat(record.stars)));
        }
        chip.addEventListener("click", () => onPick(board.id, i));
        levelWrap.append(chip);
      }
      card.append(levelWrap);
      card.addEventListener("dblclick", () => onPlay(board.id));
      wrap.append(card);
    }
  }

  function renderAtlas({ progress, boardId, onTab, onOpenCard }) {
    const tabs = refs.atlasTabs;
    if (!tabs) return;
    tabs.innerHTML = "";
    for (const board of BOARDS) {
      const tab = el("button", "atlas-tab", t(locale, board.nameKey));
      tab.type = "button";
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", String(board.id === boardId));
      if (board.id === boardId) tab.classList.add("is-active");
      tab.addEventListener("click", () => onTab(board.id));
      tabs.append(tab);
    }

    const pool = refs.poolFor?.(locale, boardId) ?? [];
    const ids = new Set(atlasIds(progress, locale, boardId));
    if (refs.atlasProgress) {
      refs.atlasProgress.textContent = t(locale, "atlasProgress", {
        done: ids.size,
        total: pool.length,
      });
    }
    const grid = refs.atlasGrid;
    if (!grid) return;
    grid.innerHTML = "";
    if (!pool.length) {
      grid.append(el("p", "panel-desc", t(locale, "atlasEmpty")));
      return;
    }
    pool.forEach((entry, index) => {
      const unlocked = ids.has(entry.id);
      const card = el("button", "atlas-card");
      card.type = "button";
      card.classList.toggle("is-locked", !unlocked);
      card.append(el("span", "card-index", String(index + 1).padStart(2, "0")));
      card.append(el("span", "card-word", unlocked ? entry.text : "▤ ▤ ▤"));
      card.append(el("span", "card-note", unlocked ? entry.def : t(locale, "cardLocked")));
      if (unlocked) card.addEventListener("click", () => onOpenCard(entry.id));
      else card.disabled = true;
      grid.append(card);
    });
  }

  function showCard({ entry, lang = locale, onCopy }) {
    if (!entry) return;
    refs.cardWord.textContent = entry.text;
    refs.cardBody.innerHTML = "";
    const fields = lang === "en"
      ? [
          [t(locale, "cardStory"), entry.story, ""],
          [t(locale, "cardOrigin"), entry.source, ""],
        ]
      : [
          [t(locale, "cardSource"), entry.source, ""],
          [t(locale, "cardStory"), entry.story, ""],
          [t(locale, "cardExample"), entry.example, "is-example"],
        ];
    for (const [label, value, extra] of fields) {
      if (!value) continue;
      const field = el("div", "card-field");
      field.append(el("span", "card-label", label));
      const text = el("p", `card-value ${extra}`.trim(), value);
      field.append(text);
      refs.cardBody.append(field);
    }
    refs.copyBtn.onclick = () => onCopy?.(entry);
  }

  function hideCard() {
    refs.cardWord.textContent = "";
    refs.cardBody.innerHTML = "";
  }

  function showResult({ stars, hintsUsed, elapsed, cards }) {
    if (!refs.resultStars) return;
    refs.resultStars.innerHTML = "";
    for (let i = 0; i < 3; i += 1) {
      const star = el("span", `star${i < stars ? "" : " dim"}`, "★");
      refs.resultStars.append(star);
    }
    if (refs.resultRows) {
      refs.resultRows.innerHTML = "";
      const rows = [
        [t(locale, "resultStars"), t(locale, "starUnit", { n: stars })],
        [t(locale, "resultHints"), String(hintsUsed)],
        [t(locale, "resultTime"), formatTime(elapsed)],
      ];
      if (cards?.length) rows.push([t(locale, "resultCards"), cards.join(" · ")]);
      for (const [label, value] of rows) {
        const row = el("div", "result-row");
        row.append(el("span", "", label));
        row.append(el("strong", "", value));
        refs.resultRows.append(row);
      }
    }
  }

  function setNextLabel(label) {
    if (refs.nextBtn) refs.nextBtn.textContent = label;
  }

  return {
    applyStatic,
    setHud,
    setTime,
    setHintState,
    showToast,
    hideToast,
    setSoundButton,
    openPanel,
    closePanels,
    anyPanelOpen,
    renderBoards,
    renderAtlas,
    showCard,
    hideCard,
    showResult,
    setNextLabel,
    get locale() {
      return locale;
    },
  };
}
