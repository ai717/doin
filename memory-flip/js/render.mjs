// 盲盒记忆牌 — UI 渲染层（唯一碰 DOM 的层）
// 题材：潮玩盲盒工坊·咯哒车间；中央传送带工作台 + 左集藏册抽屉 + 右工坊日志便签

import { strings, totemName, chapterName, chapterDesc } from "./i18n.mjs";
import { LEVELS, CHAPTERS } from "./levels.mjs";
import { STATUS, ACTION, MECH } from "./engine.mjs";
import { isLevelUnlocked } from "./game.mjs";
import { TOTEM_IDS, totemGlyph } from "./data.mjs";

/**
 * 给图腾派稳定且唯一的颜色：按在 TOTEM_IDS 中的 index 均匀分布色相。
 * 30 种图腾 → 30 个独立色相（间距 12°），保证不同图腾绝不撞色；
 * 同一对的两张牌是同一 id → 同色（配对视觉提示，故意的）。
 */
export function totemColor(totemId) {
  if (!totemId) return "#cccccc";
  const idx = TOTEM_IDS.indexOf(totemId);
  if (idx < 0) return "#cccccc";
  const hue = Math.round((idx * 360) / TOTEM_IDS.length) % 360;
  // 治愈蜡笔调：中饱和 + 高明度
  return `hsl(${hue}, 65%, 82%)`;
}

/** 取当前 locale 的字符串 */
function t(locale) {
  return strings[locale] ?? strings.zh;
}

/**
 * 渲染游戏主体到 #game-root（顶栏已静态化在 index.html）。
 * mode: "menu" | "campaign" | "daily" | "sandbox" | "rules" | "settle"
 */
export function renderRoot(root, locale, mode, controller, storage) {
  if (!root) return;
  root.innerHTML = renderBody(locale, mode, controller, storage);
}

/** 更新顶栏音效按钮图标（顶栏静态化后需单独维护） */
export function updateSoundIcon(storage) {
  const btn = (typeof document !== "undefined") ? document.getElementById("btn-sound") : null;
  if (!btn) return;
  btn.textContent = storage?.soundEnabled === false ? "🔇" : "🔊";
}

function renderBody(locale, mode, controller, storage) {
  switch (mode) {
    case "campaign": return renderCampaign(locale, controller);
    case "daily": return renderCampaign(locale, controller);
    case "sandbox": return renderCampaign(locale, controller);
    case "rules": return renderRules(locale);
    case "settle": return renderSettle(locale, controller);
    case "menu":
    default:
      return renderMenu(locale, storage);
  }
}

function renderMenu(locale, storage) {
  const T = t(locale);
  const totalStars = storage ? Object.values(storage.levelStars || {}).reduce((s, r) => s + (r?.stars || 0), 0) : 0;
  const flawless = storage ? Object.values(storage.levelStars || {}).filter((r) => r?.flawless).length : 0;

  const chapterCards = Object.values(CHAPTERS).map((ch) => {
    const lvList = LEVELS.filter((lv) => lv.chapter === ch.order);
    const cleared = lvList.filter((lv) => storage?.levelStars?.[lv.id]?.stars > 0).length;
    const total = lvList.length;
    const isUnlocked = ch.order === 1 || (storage && LEVELS.filter((lv) => lv.chapter === ch.order - 1).every((lv) => storage.levelStars?.[lv.id]?.stars > 0));
    return `
      <section class="chapter-card ${isUnlocked ? "" : "is-locked"}">
        <header class="chapter-head">
          <h3>${chapterName(locale, ch.order)}</h3>
          <span class="chapter-progress">${cleared}/${total}</span>
        </header>
        <p class="chapter-desc">${chapterDesc(locale, ch.order)}</p>
        <div class="level-grid">
          ${lvList.map((lv) => renderLevelCard(lv, storage, locale)).join("")}
        </div>
      </section>
    `;
  }).join("");

  return `
    <div class="menu-wrap">
      <div class="menu-summary">
        <span class="summary-pill">★ ${totalStars}</span>
        <span class="summary-pill">🏅 ${flawless}</span>
      </div>
      <div class="menu-modes">
        <button type="button" class="mode-btn mode-campaign" data-mode="campaign-first">${T.modeCampaign}</button>
        <button type="button" class="mode-btn mode-daily" data-mode="daily">${T.modeDaily}</button>
        <button type="button" class="mode-btn mode-sandbox" data-mode="sandbox-config">${T.modeSandbox}</button>
      </div>
      <div class="chapter-list">
        ${chapterCards}
      </div>
    </div>
  `;
}

function renderLevelCard(lv, storage, locale) {
  const T = t(locale);
  const unlocked = isLevelUnlocked(storage, lv.id);
  const r = storage?.levelStars?.[lv.id];
  const stars = r?.stars ?? 0;
  const starsHtml = Array.from({ length: 3 }, (_, i) =>
    `<span class="level-star ${i < stars ? "is-on" : ""}">★</span>`).join("");
  const flawlessBadge = r?.flawless ? `<span class="flawless-dot" title="${T.flawlessBadge}">🏅</span>` : "";
  return `
    <button type="button"
            class="level-card ${unlocked ? "" : "is-locked"}"
            data-level="${lv.id}"
            ${unlocked ? "" : "disabled"}>
      <span class="level-no">${lv.id.replace("level_", "").replace("_", ".")}</span>
      <span class="level-stars">${starsHtml}</span>
      ${flawlessBadge}
      ${unlocked ? "" : `<span class="level-lock">🔒</span>`}
    </button>
  `;
}

function renderCampaign(locale, controller) {
  if (!controller?.state) return "";
  const T = t(locale);
  const s = controller.state;
  const cols = s.cols;
  const rows = s.rows;

  // HUD 状态条
  const matchedPairs = s.foundPairs.length;
  const totalPairs = s.totemCount;
  const missBudget = s.missBudget !== null
    ? `<span class="hud-pill">${T.missBudget}: <strong>${Math.max(0, s.missBudget - s.misses)}</strong></span>`
    : "";

  // 盘面网格
  const cells = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const idx = r * cols + c;
      const tile = s.grid[idx];
      const isOpen = s.faceUp[idx];
      const isEmpty = tile === null;
      const color = totemColor(tile);
      const glyph = tile ? totemGlyph(tile) : "";
      const nameKey = tile ? `totem_${tile}` : "";
      const displayName = tile ? totemName(locale, tile) : "";
      cells.push(`
        <button type="button"
                class="box ${isEmpty ? "is-empty" : ""} ${isOpen ? "is-open" : "is-closed"}"
                data-idx="${idx}"
                style="--box-color:${color}"
                ${isEmpty ? "disabled" : ""}
                aria-label="${isEmpty ? "" : (isOpen ? `${glyph} ${displayName}` : T.btnStart)}">
          ${isEmpty ? "" : (isOpen ? `<span class="box-figure" data-totem="${tile}"><span class="figure-glyph">${glyph}</span><span class="figure-name">${displayName}</span></span>` : `<span class="box-lid"></span>`)}
        </button>
      `);
    }
  }

  // 集藏册（左侧抽屉）
  const foundTotemsHtml = s.foundPairs.map((tot, i) => {
    const color = totemColor(tot);
    const glyph = totemGlyph(tot);
    return `<li class="codex-item" style="--box-color:${color}" title="${totemName(locale, tot)}">
      <span class="codex-figure"><span class="figure-glyph">${glyph}</span><span class="figure-name">${totemName(locale, tot)}</span></span>
    </li>`;
  }).join("");

  // 工坊日志（右侧便签）
  const chapterLabel = controller.level?.chapter ? chapterName(locale, controller.level.chapter) : "";
  const mechHint = s.mech === MECH.NONE ? T.chDesc_1
    : s.mech === MECH.RING4 ? T.chDesc_2
    : s.mech === MECH.RING8 ? T.chDesc_3
    : s.mech === MECH.GEAR ? T.chDesc_4
    : T.chDesc_5;

  return `
    <div class="campaign-wrap">
      <aside class="codex-drawer" aria-label="Codex">
        <h3 class="drawer-title" data-i18n="pairs">${T.pairs}</h3>
        <ul class="codex-list">${foundTotemsHtml || `<li class="codex-empty">${T.welcomeDesc.slice(0, 16)}…</li>`}</ul>
      </aside>

      <section class="workshop-stage" aria-label="Board">
        <div class="stage-hud">
          <span class="hud-pill">${T.pairs}: <strong>${matchedPairs}/${totalPairs}</strong></span>
          <span class="hud-pill">${T.misses}: <strong>${s.misses}</strong></span>
          <span class="hud-pill">${T.combo}: <strong>${s.combo}</strong></span>
          ${missBudget}
        </div>
        <div class="belt-rail" aria-hidden="true"></div>
        <div class="box-grid" style="--grid-cols:${cols};--grid-rows:${rows};">
          ${cells.join("")}
        </div>
        <div class="belt-rail" aria-hidden="true"></div>
      </section>

      <aside class="workshop-log" aria-label="Log">
        <div class="log-card">
          <h3 class="log-title">${chapterLabel || T.modeSandbox}</h3>
          <p class="log-mech">${mechHint}</p>
          <p class="log-misses">${T.misses}: ${s.misses}${s.missBudget !== null ? ` / ${s.missBudget}` : ""}</p>
          <p class="log-combo">${T.maxCombo}: ${s.maxCombo}</p>
        </div>
      </aside>
    </div>
  `;
}

function renderRules(locale) {
  const T = t(locale);
  return `
    <div class="rules-wrap">
      <h2>${T.rulesTitle}</h2>
      <ul class="rules-list">
        <li>${T.ruleFlip}</li>
        <li>${T.ruleMatch}</li>
        <li>${T.ruleMiss}</li>
        <li>${T.ruleMech}</li>
        <li>${T.ruleKeys}</li>
        <li>${T.rulePause}</li>
        <li>${T.ruleDaily}</li>
        <li>${T.ruleSandbox}</li>
      </ul>
      <button type="button" class="mode-btn" data-mode="menu">${T.btnBack}</button>
    </div>
  `;
}

function renderSettle(locale, controller) {
  const T = t(locale);
  const s = controller.state;
  const ms = controller.endedAt - controller.startedAt;
  const seconds = (ms / 1000).toFixed(1);
  const isWin = s.status === STATUS.WON;
  const title = isWin ? T.winTitle : T.loseTitle;
  const flawless = isWin && s.misses === 0;
  const flawlessHtml = flawless ? `<div class="flawless-badge">${T.flawlessBadge}</div>` : "";

  return `
    <div class="settle-wrap">
      <h2>${title}</h2>
      ${flawlessHtml}
      <div class="settle-summary">
        <div class="summary-line"><span>${T.finalMisses}</span><strong>${s.misses}</strong></div>
        <div class="summary-line"><span>${T.finalCombo}</span><strong>${s.maxCombo}</strong></div>
        <div class="summary-line"><span>${T.finalTime}</span><strong>${seconds}s</strong></div>
      </div>
      <div class="settle-actions">
        ${isWin && controller.mode === "campaign" ? `<button type="button" class="mode-btn" data-mode="next">${T.btnNext}</button>` : ""}
        <button type="button" class="mode-btn" data-mode="replay">${T.btnReplay}</button>
        <button type="button" class="mode-btn mode-btn-alt" data-mode="menu">${T.btnBack}</button>
      </div>
    </div>
  `;
}

/** 沙盒配置面板 */
export function renderSandboxConfig(locale, limits) {
  const T = t(locale);
  return `
    <div class="sandbox-config">
      <h2>${T.sandboxTitle}</h2>
      <p class="sandbox-tip">${T.sandboxTip}</p>
      <label class="config-row">
        <span>${T.sandboxSize}</span>
        <select id="sandbox-size">
          ${[4, 5, 6].flatMap((r) => [4, 5, 6].map((c) => (r * c) % 2 === 0 ? `<option value="${r}x${c}">${r}×${c}</option>` : "")).join("")}
        </select>
      </label>
      <label class="config-row">
        <span>${T.sandboxMech}</span>
        <select id="sandbox-mech">
          <option value="none">${T.chDesc_1}</option>
          <option value="ring4" selected>${T.chDesc_2}</option>
          <option value="ring8">${T.chDesc_3}</option>
          <option value="gear">${T.chDesc_4}</option>
        </select>
      </label>
      <label class="config-row">
        <span>${T.sandboxSeed}</span>
        <input id="sandbox-seed" type="number" min="1" value="${Math.floor(Math.random() * 99999) + 1}">
      </label>
      <button type="button" class="mode-btn" data-mode="sandbox-start">${T.sandboxStart}</button>
      <button type="button" class="mode-btn mode-btn-alt" data-mode="menu">${T.btnBack}</button>
    </div>
  `;
}