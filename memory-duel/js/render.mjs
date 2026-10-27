// 记忆对决 · DOM 与 Canvas 渲染层 (唯一操作 DOM 的视图层)
// 包含 15 种纯矢量秘牌符文渲染、双翼街机机台舞台构建、卡牌 3D 翻转、粒子特效与状态更新

import { t } from "./i18n.mjs";
import { AI_TIERS } from "./ai.mjs";
import { PUZZLES } from "./puzzles.mjs";

// 15 款精美矢量符文 SVG
export function getTotemSvg(totemKey) {
  const svgs = {
    rune_star: `
      <svg viewBox="0 0 100 100" class="totem-icon" aria-hidden="true">
        <defs>
          <radialGradient id="grad_star" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#fff6d1" />
            <stop offset="60%" stop-color="#ffd15c" />
            <stop offset="100%" stop-color="#e08e0b" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,215,92,0.35)" stroke-width="2" />
        <path d="M50 12 L55 38 L81 38 L60 54 L68 80 L50 64 L32 80 L40 54 L19 38 L45 38 Z" fill="url(#grad_star)" filter="drop-shadow(0 0 6px rgba(255,209,92,0.6))" />
        <circle cx="50" cy="50" r="6" fill="#fff" />
      </svg>`,
    rune_eye: `
      <svg viewBox="0 0 100 100" class="totem-icon" aria-hidden="true">
        <defs>
          <radialGradient id="grad_eye" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#bbf7ff" />
            <stop offset="70%" stop-color="#38d6fc" />
            <stop offset="100%" stop-color="#0284c7" />
          </radialGradient>
        </defs>
        <path d="M12 50 C26 24 74 24 88 50 C74 76 26 76 12 50 Z" fill="rgba(2,132,199,0.2)" stroke="#38d6fc" stroke-width="3" />
        <circle cx="50" cy="50" r="18" fill="url(#grad_eye)" />
        <circle cx="50" cy="50" r="8" fill="#0f172a" />
        <circle cx="53" cy="47" r="3" fill="#ffffff" />
      </svg>`,
    rune_fire: `
      <svg viewBox="0 0 100 100" class="totem-icon" aria-hidden="true">
        <defs>
          <linearGradient id="grad_fire" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stop-color="#ea580c" />
            <stop offset="50%" stop-color="#f97316" />
            <stop offset="100%" stop-color="#fde047" />
          </linearGradient>
        </defs>
        <path d="M50 10 C58 32 82 46 72 74 C64 92 36 92 28 74 C18 46 42 32 50 10 Z" fill="url(#grad_fire)" filter="drop-shadow(0 0 8px rgba(249,115,22,0.7))" />
        <path d="M50 36 C54 48 64 56 60 70 C56 80 44 80 40 70 C36 56 46 48 50 36 Z" fill="#fef08a" />
      </svg>`,
    rune_crystal: `
      <svg viewBox="0 0 100 100" class="totem-icon" aria-hidden="true">
        <defs>
          <linearGradient id="grad_crys" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#e879f9" />
            <stop offset="50%" stop-color="#c084fc" />
            <stop offset="100%" stop-color="#7e22ce" />
          </linearGradient>
        </defs>
        <polygon points="50,12 80,36 72,82 50,92 28,82 20,36" fill="url(#grad_crys)" stroke="#f0abfc" stroke-width="2" />
        <polyline points="50,12 50,92" stroke="#ffffff" stroke-width="1.5" opacity="0.6" />
        <polyline points="20,36 50,48 80,36" stroke="#ffffff" stroke-width="1.5" opacity="0.6" />
      </svg>`,
    rune_ring: `
      <svg viewBox="0 0 100 100" class="totem-icon" aria-hidden="true">
        <circle cx="50" cy="50" r="34" fill="none" stroke="#eab308" stroke-width="8" stroke-dasharray="16 4" filter="drop-shadow(0 0 5px rgba(234,179,8,0.5))" />
        <circle cx="50" cy="22" r="10" fill="#22c55e" stroke="#ffffff" stroke-width="2" />
        <circle cx="50" cy="50" r="18" fill="rgba(234,179,8,0.15)" />
      </svg>`,
    rune_feather: `
      <svg viewBox="0 0 100 100" class="totem-icon" aria-hidden="true">
        <path d="M30 82 Q34 40 78 18 Q62 48 46 86 Z" fill="#818cf8" stroke="#c7d2fe" stroke-width="2" />
        <line x1="30" y1="84" x2="68" y2="30" stroke="#ffffff" stroke-width="2" />
        <circle cx="78" cy="18" r="4" fill="#a5b4fc" />
      </svg>`,
    rune_sun: `
      <svg viewBox="0 0 100 100" class="totem-icon" aria-hidden="true">
        <circle cx="50" cy="50" r="22" fill="#f59e0b" stroke="#fef08a" stroke-width="3" />
        <g stroke="#f59e0b" stroke-width="3" stroke-linecap="round">
          <line x1="50" y1="12" x2="50" y2="20" />
          <line x1="50" y1="80" x2="50" y2="88" />
          <line x1="12" y1="50" x2="20" y2="50" />
          <line x1="80" y1="50" x2="88" y2="50" />
          <line x1="24" y1="24" x2="30" y2="30" />
          <line x1="70" y1="70" x2="76" y2="76" />
          <line x1="24" y1="76" x2="30" y2="70" />
          <line x1="70" y1="30" x2="76" y2="24" />
        </g>
      </svg>`,
    rune_tear: `
      <svg viewBox="0 0 100 100" class="totem-icon" aria-hidden="true">
        <path d="M50 14 C50 14 76 52 76 68 C76 82 64 90 50 90 C36 90 24 82 24 68 C24 52 50 14 50 14 Z" fill="#06b6d4" stroke="#67e8f9" stroke-width="3" filter="drop-shadow(0 0 6px rgba(6,182,212,0.6))" />
        <ellipse cx="44" cy="64" rx="8" ry="14" fill="#cffafe" opacity="0.6" transform="rotate(-20 44 64)" />
      </svg>`,
    rune_hourglass: `
      <svg viewBox="0 0 100 100" class="totem-icon" aria-hidden="true">
        <polygon points="26,18 74,18 50,50 74,82 26,82 50,50" fill="rgba(245,158,11,0.2)" stroke="#fbbf24" stroke-width="3" />
        <line x1="20" y1="18" x2="80" y2="18" stroke="#d97706" stroke-width="5" stroke-linecap="round" />
        <line x1="20" y1="82" x2="80" y2="82" stroke="#d97706" stroke-width="5" stroke-linecap="round" />
        <circle cx="50" cy="50" r="3" fill="#fef3c7" />
        <path d="M38 74 Q50 68 62 74 Z" fill="#fbbf24" />
      </svg>`,
    rune_tome: `
      <svg viewBox="0 0 100 100" class="totem-icon" aria-hidden="true">
        <rect x="22" y="20" width="56" height="64" rx="6" fill="#831843" stroke="#f472b6" stroke-width="3" />
        <path d="M34 20 L34 84" stroke="#fda4af" stroke-width="2" />
        <polygon points="46,42 62,50 46,58" fill="#fbbf24" />
      </svg>`,
    rune_compass: `
      <svg viewBox="0 0 100 100" class="totem-icon" aria-hidden="true">
        <circle cx="50" cy="50" r="36" fill="rgba(16,185,129,0.15)" stroke="#10b981" stroke-width="3" />
        <polygon points="50,20 58,50 50,44 42,50" fill="#ef4444" />
        <polygon points="50,80 58,50 50,56 42,50" fill="#94a3b8" />
        <circle cx="50" cy="50" r="4" fill="#f8fafc" />
      </svg>`,
    rune_chalice: `
      <svg viewBox="0 0 100 100" class="totem-icon" aria-hidden="true">
        <path d="M30 22 L70 22 C70 52 56 58 50 64 C44 58 30 52 30 22 Z" fill="#eab308" stroke="#fef08a" stroke-width="2.5" />
        <line x1="50" y1="64" x2="50" y2="82" stroke="#ca8a04" stroke-width="5" />
        <line x1="32" y1="82" x2="68" y2="82" stroke="#ca8a04" stroke-width="5" stroke-linecap="round" />
        <ellipse cx="50" cy="30" rx="14" ry="4" fill="#a855f7" />
      </svg>`,
    rune_spark: `
      <svg viewBox="0 0 100 100" class="totem-icon" aria-hidden="true">
        <polygon points="54,12 28,48 48,48 42,88 74,44 52,44" fill="#a855f7" stroke="#e9d5ff" stroke-width="2" filter="drop-shadow(0 0 8px rgba(168,85,247,0.7))" />
      </svg>`,
    rune_lotus: `
      <svg viewBox="0 0 100 100" class="totem-icon" aria-hidden="true">
        <path d="M50 20 C42 42 34 60 50 78 C66 60 58 42 50 20 Z" fill="#ec4899" opacity="0.9" />
        <path d="M22 62 C34 50 48 58 50 78 C32 76 22 68 22 62 Z" fill="#f472b6" opacity="0.8" />
        <path d="M78 62 C66 50 52 58 50 78 C68 76 78 68 78 62 Z" fill="#f472b6" opacity="0.8" />
        <circle cx="50" cy="74" r="5" fill="#fef08a" />
      </svg>`,
    rune_scale: `
      <svg viewBox="0 0 100 100" class="totem-icon" aria-hidden="true">
        <line x1="50" y1="18" x2="50" y2="84" stroke="#eab308" stroke-width="4" stroke-linecap="round" />
        <line x1="20" y1="32" x2="80" y2="32" stroke="#eab308" stroke-width="3" stroke-linecap="round" />
        <polygon points="14,64 34,64 24,32" fill="rgba(234,179,8,0.2)" stroke="#eab308" stroke-width="1.5" />
        <polygon points="66,64 86,64 76,32" fill="rgba(234,179,8,0.2)" stroke="#eab308" stroke-width="1.5" />
        <line x1="32" y1="84" x2="68" y2="84" stroke="#ca8a04" stroke-width="5" stroke-linecap="round" />
      </svg>`,
  };

  return svgs[totemKey] || svgs.rune_star;
}

// 卡背金纹 SVG
export const CARD_BACK_SVG = `
  <svg viewBox="0 0 100 140" class="card-back-pattern" aria-hidden="true">
    <rect x="4" y="4" width="92" height="132" rx="8" fill="none" stroke="rgba(232, 196, 106, 0.4)" stroke-width="1.5" />
    <rect x="8" y="8" width="84" height="124" rx="6" fill="none" stroke="rgba(232, 196, 106, 0.2)" stroke-dasharray="3 3" />
    <circle cx="50" cy="70" r="28" fill="rgba(232, 196, 106, 0.06)" stroke="rgba(232, 196, 106, 0.5)" stroke-width="1.5" />
    <circle cx="50" cy="70" r="16" fill="none" stroke="rgba(232, 196, 106, 0.3)" stroke-width="1" />
    <path d="M50 48 L54 66 L72 70 L54 74 L50 92 L46 74 L28 70 L46 66 Z" fill="rgba(232, 196, 106, 0.6)" />
    <circle cx="50" cy="70" r="3" fill="#ffffff" />
  </svg>
`;

export class MemoryDuelRenderer {
  constructor(container, locale = "zh") {
    this.container = container;
    this.locale = locale;
    this.dom = {};
  }

  setLocale(loc) {
    this.locale = loc;
  }

  // 构建核心机台结构
  buildStageSkeleton() {
    this.container.innerHTML = `
      <div id="duel-stage" class="duel-stage">
        <!-- 移动端紧凑顶条 HUD -->
        <div id="mobile-hud" class="mobile-hud">
          <div class="mobile-stat player-stat">
            <span class="m-label" id="m-player-title">${t("playerVault", this.locale)}</span>
            <span class="m-val" id="m-player-pairs">0 / 5</span>
            <span class="m-sp" id="m-player-sp">💎 5 SP</span>
          </div>
          <div class="mobile-turn-badge" id="m-turn-badge">
            <span id="m-turn-text">${t("turnPlayer", this.locale)}</span>
          </div>
          <div class="mobile-stat ai-stat">
            <span class="m-label" id="m-ai-title">${t("opponentVault", this.locale)}</span>
            <span class="m-val" id="m-ai-pairs">0 / 5</span>
            <span class="m-sp" id="m-ai-sp">💎 5 SP</span>
          </div>
        </div>

        <!-- 游戏主对决舞台 (双栏舒展布局) -->
        <div id="duel-arena" class="duel-arena">
          
          <!-- 左翼：玩家战利品宝箱与策略控制台 -->
          <aside id="left-vault-panel" class="vault-wing player-wing">
            <div class="vault-box-header">
              <div class="vault-chest-icon">🎁</div>
              <div class="vault-meta">
                <h2 id="hud-player-title" class="vault-title">${t("playerVault", this.locale)}</h2>
                <div class="vault-progress-bar">
                  <div id="player-progress-fill" class="progress-fill" style="width: 0%"></div>
                </div>
              </div>
            </div>

            <!-- 战利品数据看板 -->
            <div class="vault-counters">
              <div class="vault-pill">
                <span class="pill-label">${t("pairsLabel", this.locale)}</span>
                <span id="player-pairs-val" class="pill-num">0</span>
              </div>
              <div class="vault-pill">
                <span class="pill-label">${t("lockedLabel", this.locale)}</span>
                <span id="player-locked-val" class="pill-num">0</span>
              </div>
              <div class="vault-pill">
                <span class="pill-label">${t("looseLabel", this.locale)}</span>
                <span id="player-loose-val" class="pill-num">0</span>
              </div>
            </div>

            <!-- 策略点与实体行动操控台 -->
            <div class="tactical-deck">
              <div class="sp-bar-header">
                <span class="sp-text">${t("spLabel", this.locale)}</span>
                <div id="player-sp-gems" class="sp-gems">
                  <span class="sp-gem active">💎</span>
                  <span class="sp-gem active">💎</span>
                  <span class="sp-gem active">💎</span>
                  <span class="sp-gem active">💎</span>
                  <span class="sp-gem active">💎</span>
                </div>
              </div>

              <!-- 行动按钮组 -->
              <div class="action-buttons-group">
                <button id="btn-action-flip" class="action-btn btn-flip" data-action="flip" title="${t("actionFlipDesc", this.locale)}">
                  <span class="btn-icon">🎴</span>
                  <span class="btn-label">${t("actionFlip", this.locale)}</span>
                </button>
                <button id="btn-action-scout" class="action-btn btn-scout" data-action="scout" title="${t("actionScoutDesc", this.locale)}">
                  <span class="btn-icon">👁️</span>
                  <span class="btn-label">${t("actionScout", this.locale)}</span>
                </button>
                <button id="btn-action-steal" class="action-btn btn-steal" data-action="steal" title="${t("actionStealDesc", this.locale)}">
                  <span class="btn-icon">🗡️</span>
                  <span class="btn-label">${t("actionSteal", this.locale)}</span>
                </button>
                <button id="btn-action-lock" class="action-btn btn-lock" data-action="lock" title="${t("actionLockDesc", this.locale)}">
                  <span class="btn-icon">🛡️</span>
                  <span class="btn-label">${t("actionLock", this.locale)}</span>
                </button>
              </div>

              <!-- 侦察取消按钮（仅侦察模式可见） -->
              <button id="btn-cancel-scout" class="btn-cancel-scout hidden" data-action="cancel_scout">
                ${t("cancelScout", this.locale)}
              </button>
            </div>

            <!-- 实时战况情报小视窗 -->
            <div id="event-ticker" class="event-ticker">
              <span id="ticker-text" class="ticker-text">${t("turnPlayer", this.locale)}</span>
            </div>
          </aside>

          <!-- 中央：魔法牌桌主网格 -->
          <main id="board-center" class="board-center">
            <div id="board-banner" class="board-banner">
              <span id="round-indicator" class="round-indicator">${t("roundTurn", this.locale, { n: 1 })}</span>
              <span id="goal-indicator" class="goal-indicator">${t("targetGoal", this.locale)}: 5</span>
              <span id="combo-badge" class="combo-badge hidden">2 COMBO</span>
            </div>

            <!-- 牌桌网格容器 -->
            <div id="cards-grid" class="cards-grid grid-5x4" role="grid" aria-label="Memory Duel Board">
              <!-- 卡牌由 JS 动态生成 -->
            </div>

            <!-- 状态提示浮条 -->
            <div id="status-hint" class="status-hint">
              <span id="hint-text"></span>
            </div>
          </main>

          <!-- 右翼：AI 占卜师与对手战利品 -->
          <aside id="right-ai-panel" class="vault-wing ai-wing">
            <div class="ai-avatar-card">
              <div class="ai-avatar-mask" id="ai-mask-icon">🔮</div>
              <div class="ai-meta">
                <span id="ai-persona-title" class="ai-badge">${t("aiNoviceTitle", this.locale)}</span>
                <h3 id="ai-persona-name" class="ai-name">${t("aiNoviceName", this.locale)}</h3>
                <p id="ai-persona-desc" class="ai-desc">${t("aiNoviceDesc", this.locale)}</p>
              </div>
            </div>

            <!-- 对手战利品看板 -->
            <div class="vault-box-header">
              <div class="vault-chest-icon">🗝️</div>
              <div class="vault-meta">
                <h2 id="hud-opponent-title" class="vault-title">${t("opponentVault", this.locale)}</h2>
                <div class="vault-progress-bar">
                  <div id="ai-progress-fill" class="progress-fill ai-fill" style="width: 0%"></div>
                </div>
              </div>
            </div>

            <div class="vault-counters">
              <div class="vault-pill">
                <span class="pill-label">${t("pairsLabel", this.locale)}</span>
                <span id="ai-pairs-val" class="pill-num">0</span>
              </div>
              <div class="vault-pill">
                <span class="pill-label">${t("lockedLabel", this.locale)}</span>
                <span id="ai-locked-val" class="pill-num">0</span>
              </div>
              <div class="vault-pill">
                <span class="pill-label">${t("looseLabel", this.locale)}</span>
                <span id="ai-loose-val" class="pill-num">0</span>
              </div>
            </div>

            <!-- 对手 SP 隐藏博弈显示 -->
            <div class="ai-sp-box">
              <span class="sp-text">${t("spLabel", this.locale)}</span>
              <div id="ai-sp-used" class="ai-sp-used">
                ${t("aiHiddenSp", this.locale, { used: 0 })}
              </div>
            </div>

            <!-- 模式/关卡选择按钮区 -->
            <div class="stage-nav-dock">
              <button id="btn-open-modes" class="bar-btn dock-btn" data-action="open_modes">
                ${t("modeLabel", this.locale)}
              </button>
            </div>
          </aside>

        </div>
      </div>

      <!-- 终局结算弹窗 -->
      <dialog id="modal-gameover" class="game-modal">
        <div class="modal-card">
          <div id="modal-result-icon" class="modal-big-icon">👑</div>
          <h2 id="modal-result-title" class="modal-title">${t("victoryTitle", this.locale)}</h2>
          <p id="modal-result-desc" class="modal-desc"></p>

          <div class="stars-display" id="modal-stars-box">
            <span class="star-icon">⭐</span>
            <span class="star-icon">⭐</span>
            <span class="star-icon">⭐</span>
          </div>

          <div class="modal-stats-grid">
            <div class="stat-row">
              <span class="stat-name">${t("statNetPairs", this.locale)}</span>
              <span id="mstat-net-pairs" class="stat-val">+2</span>
            </div>
            <div class="stat-row">
              <span class="stat-name">${t("statRemainingSp", this.locale)}</span>
              <span id="mstat-rem-sp" class="stat-val">3</span>
            </div>
            <div class="stat-row">
              <span class="stat-name">${t("statMistakes", this.locale)}</span>
              <span id="mstat-mistakes" class="stat-val">1</span>
            </div>
            <div class="stat-row">
              <span class="stat-name">${t("statTurns", this.locale)}</span>
              <span id="mstat-turns" class="stat-val">6</span>
            </div>
          </div>

          <div class="modal-actions">
            <button id="btn-modal-next" class="btn-primary" data-action="modal_next">
              ${t("btnNextStage", this.locale)}
            </button>
            <button id="btn-modal-retry" class="btn-secondary" data-action="modal_retry">
              ${t("btnRetryDuel", this.locale)}
            </button>
          </div>
        </div>
      </dialog>

      <!-- 模式与关卡选择抽屉/弹窗 -->
      <dialog id="modal-modes" class="game-modal">
        <div class="modal-card modal-large">
          <h2 class="modal-title">${t("modeLabel", this.locale)}</h2>
          
          <div class="mode-tabs">
            <button id="tab-challenge" class="tab-btn active" data-action="tab_challenge">${t("tabChallenge", this.locale)}</button>
            <button id="tab-endgame" class="tab-btn" data-action="tab_endgame">${t("tabEndgame", this.locale)}</button>
          </div>

          <div id="panel-challenge-select" class="modes-panel">
            <div class="challenge-cards">
              <div class="tier-card" data-tier="novice">
                <div class="tier-icon">🔮</div>
                <h4>${t("aiNoviceName", this.locale)}</h4>
                <p>${t("aiNoviceDesc", this.locale)}</p>
                <button class="tier-start-btn" data-action="start_tier" data-tier="novice">${t("aiNoviceTitle", this.locale)}</button>
              </div>
              <div class="tier-card" data-tier="veteran">
                <div class="tier-icon">🧿</div>
                <h4>${t("aiVeteranName", this.locale)}</h4>
                <p>${t("aiVeteranDesc", this.locale)}</p>
                <button class="tier-start-btn" data-action="start_tier" data-tier="veteran">${t("aiVeteranTitle", this.locale)}</button>
              </div>
              <div class="tier-card" data-tier="master">
                <div class="tier-icon">👁️‍🗨️</div>
                <h4>${t("aiMasterName", this.locale)}</h4>
                <p>${t("aiMasterDesc", this.locale)}</p>
                <button class="tier-start-btn" data-action="start_tier" data-tier="master">${t("aiMasterTitle", this.locale)}</button>
              </div>
            </div>
          </div>

          <div id="panel-endgame-select" class="modes-panel hidden">
            <div id="puzzles-grid" class="puzzles-grid">
              <!-- 15 个残局关卡按钮 -->
            </div>
          </div>

          <button id="btn-close-modes" class="btn-secondary" data-action="close_modes">
            ${t("rulesClose", this.locale)}
          </button>
        </div>
      </dialog>

      <!-- 规则说明弹窗 -->
      <dialog id="modal-rules" class="game-modal">
        <div class="modal-card modal-large">
          <h2 class="modal-title">${t("rulesTitle", this.locale)}</h2>
          <div class="rules-body">
            <h3>${t("rulesSection1Title", this.locale)}</h3>
            <p>${t("rulesSection1Body", this.locale)}</p>
            <h3>${t("rulesSection2Title", this.locale)}</h3>
            <p>${t("rulesSection2Body", this.locale)}</p>
            <h3>${t("rulesSection3Title", this.locale)}</h3>
            <p>${t("rulesSection3Body", this.locale)}</p>
          </div>
          <button id="btn-close-rules" class="btn-primary" data-action="close_rules">
            ${t("rulesClose", this.locale)}
          </button>
        </div>
      </dialog>
    `;

    this.cacheDomReferences();
  }

  cacheDomReferences() {
    this.dom.grid = document.getElementById("cards-grid");
    this.dom.roundIndicator = document.getElementById("round-indicator");
    this.dom.goalIndicator = document.getElementById("goal-indicator");
    this.dom.comboBadge = document.getElementById("combo-badge");
    this.dom.tickerText = document.getElementById("ticker-text");
    this.dom.hintText = document.getElementById("hint-text");

    this.dom.playerPairs = document.getElementById("player-pairs-val");
    this.dom.playerLocked = document.getElementById("player-locked-val");
    this.dom.playerLoose = document.getElementById("player-loose-val");
    this.dom.playerProgress = document.getElementById("player-progress-fill");
    this.dom.playerSpGems = document.getElementById("player-sp-gems");

    this.dom.aiPairs = document.getElementById("ai-pairs-val");
    this.dom.aiLocked = document.getElementById("ai-locked-val");
    this.dom.aiLoose = document.getElementById("ai-loose-val");
    this.dom.aiProgress = document.getElementById("ai-progress-fill");
    this.dom.aiSpUsed = document.getElementById("ai-sp-used");

    this.dom.mPlayerPairs = document.getElementById("m-player-pairs");
    this.dom.mPlayerSp = document.getElementById("m-player-sp");
    this.dom.mAiPairs = document.getElementById("m-ai-pairs");
    this.dom.mAiSp = document.getElementById("m-ai-sp");
    this.dom.mTurnText = document.getElementById("m-turn-text");

    this.dom.btnScout = document.getElementById("btn-action-scout");
    this.dom.btnSteal = document.getElementById("btn-action-steal");
    this.dom.btnLock = document.getElementById("btn-action-lock");
    this.dom.btnFlip = document.getElementById("btn-action-flip");
    this.dom.btnCancelScout = document.getElementById("btn-cancel-scout");

    this.dom.modalGameOver = document.getElementById("modal-gameover");
    this.dom.modalModes = document.getElementById("modal-modes");
    this.dom.modalRules = document.getElementById("modal-rules");
  }

  // 渲染或更新整个棋盘卡片
  renderBoard(board, isScoutingMode, activeActor) {
    if (!this.dom.grid) return;
    const count = board.length;
    
    // 设置网格行列类名
    this.dom.grid.className = "cards-grid";
    if (count <= 10) {
      this.dom.grid.classList.add("grid-compact");
    } else if (count <= 20) {
      this.dom.grid.classList.add("grid-5x4");
    } else if (count <= 24) {
      this.dom.grid.classList.add("grid-6x4");
    } else {
      this.dom.grid.classList.add("grid-6x5");
    }

    if (isScoutingMode) {
      this.dom.grid.classList.add("scouting-active");
    }

    // 检查是否需要重建卡片 DOM
    const currentCards = this.dom.grid.querySelectorAll(".duel-card");
    if (currentCards.length !== board.length) {
      this.dom.grid.innerHTML = "";
      board.forEach((card, idx) => {
        const cardEl = document.createElement("button");
        cardEl.className = "duel-card";
        cardEl.dataset.index = String(idx);
        cardEl.setAttribute("aria-label", t("actionFlip", this.locale));

        cardEl.innerHTML = `
          <div class="card-inner">
            <div class="card-face card-back">
              ${CARD_BACK_SVG}
              <div class="scout-eye-mark hidden">👁️</div>
            </div>
            <div class="card-face card-front">
              <div class="totem-wrapper" id="totem-wrap-${idx}">
                ${getTotemSvg(card.totem)}
              </div>
              <div class="totem-name">${t(`totem_${card.totem}`, this.locale)}</div>
            </div>
          </div>
        `;
        this.dom.grid.appendChild(cardEl);
      });
    }

    // 更新每张卡牌的翻转与状态
    board.forEach((card, idx) => {
      const cardEl = this.dom.grid.querySelector(`.duel-card[data-index="${idx}"]`);
      if (!cardEl) return;

      const eyeMark = cardEl.querySelector(".scout-eye-mark");
      if (eyeMark) {
        if (card.scoutedBy && card.scoutedBy.player) {
          eyeMark.classList.remove("hidden");
        } else {
          eyeMark.classList.add("hidden");
        }
      }

      if (card.state === "removed") {
        cardEl.classList.add("card-removed");
        cardEl.classList.remove("card-revealed", "card-glow");
        cardEl.setAttribute("disabled", "true");
      } else if (card.state === "revealed") {
        cardEl.classList.add("card-revealed", "card-glow");
        cardEl.classList.remove("card-removed");
        cardEl.removeAttribute("disabled");
      } else {
        // hidden
        cardEl.classList.remove("card-revealed", "card-removed", "card-glow");
        cardEl.removeAttribute("disabled");
      }
    });
  }

  // 更新 HUD、宝箱与按钮可用性
  updateHud(snapshot) {
    const { engine, isScoutingMode, isPlayerTurn } = snapshot;
    const player = engine.players.player;
    const opponent = engine.players.opponent;
    const target = engine.targetPairs;

    // 回合与目标
    if (this.dom.roundIndicator) {
      this.dom.roundIndicator.textContent = t("roundTurn", this.locale, { n: engine.turnCount });
    }
    if (this.dom.goalIndicator) {
      this.dom.goalIndicator.textContent = `${t("targetGoal", this.locale)}: ${target}`;
    }

    // 连击标记
    if (this.dom.comboBadge) {
      if (engine.comboCount > 1) {
        this.dom.comboBadge.textContent = t("comboBonus", this.locale, { n: engine.comboCount });
        this.dom.comboBadge.classList.remove("hidden");
      } else {
        this.dom.comboBadge.classList.add("hidden");
      }
    }

    // 玩家数据
    if (this.dom.playerPairs) this.dom.playerPairs.textContent = String(player.pairs);
    if (this.dom.playerLocked) this.dom.playerLocked.textContent = String(player.lockedPairs);
    if (this.dom.playerLoose) this.dom.playerLoose.textContent = String(player.looseCards);
    if (this.dom.playerProgress) {
      const pct = Math.min(100, Math.round((player.pairs / target) * 100));
      this.dom.playerProgress.style.width = `${pct}%`;
    }

    // 玩家 SP 宝石展示
    if (this.dom.playerSpGems) {
      const gems = this.dom.playerSpGems.querySelectorAll(".sp-gem");
      gems.forEach((gem, i) => {
        if (i < player.sp) {
          gem.classList.add("active");
          gem.classList.remove("spent");
        } else {
          gem.classList.remove("active");
          gem.classList.add("spent");
        }
      });
    }

    // 对手数据
    if (this.dom.aiPairs) this.dom.aiPairs.textContent = String(opponent.pairs);
    if (this.dom.aiLocked) this.dom.aiLocked.textContent = String(opponent.lockedPairs);
    if (this.dom.aiLoose) this.dom.aiLoose.textContent = String(opponent.looseCards);
    if (this.dom.aiProgress) {
      const pct = Math.min(100, Math.round((opponent.pairs / target) * 100));
      this.dom.aiProgress.style.width = `${pct}%`;
    }
    if (this.dom.aiSpUsed) {
      const used = 5 - opponent.sp;
      this.dom.aiSpUsed.textContent = t("aiHiddenSp", this.locale, { used });
    }

    // 移动端 HUD 同步
    if (this.dom.mPlayerPairs) this.dom.mPlayerPairs.textContent = `${player.pairs} / ${target}`;
    if (this.dom.mPlayerSp) this.dom.mPlayerSp.textContent = `💎 ${player.sp} SP`;
    if (this.dom.mAiPairs) this.dom.mAiPairs.textContent = `${opponent.pairs} / ${target}`;
    if (this.dom.mAiSp) this.dom.mAiSp.textContent = `💎 ${opponent.sp} SP`;
    if (this.dom.mTurnText) {
      this.dom.mTurnText.textContent = isPlayerTurn ? t("turnPlayer", this.locale) : t("turnOpponent", this.locale);
    }

    // 按钮交互状态
    const unlockedPlayerPairs = player.pairs - player.lockedPairs;
    const unlockedOpponentPairs = opponent.pairs - opponent.lockedPairs;
    const canAct = isPlayerTurn && engine.turnPhase === "action_select" && !engine.winner;

    if (this.dom.btnScout) {
      this.dom.btnScout.disabled = !canAct || player.sp < 1;
      if (isScoutingMode) {
        this.dom.btnScout.classList.add("active-state");
      } else {
        this.dom.btnScout.classList.remove("active-state");
      }
    }

    if (this.dom.btnSteal) {
      this.dom.btnSteal.disabled = !canAct || player.sp < 2 || unlockedOpponentPairs <= 0;
    }

    if (this.dom.btnLock) {
      this.dom.btnLock.disabled = !canAct || player.sp < 1 || unlockedPlayerPairs <= 0;
    }

    if (this.dom.btnFlip) {
      this.dom.btnFlip.disabled = !canAct;
    }

    if (this.dom.btnCancelScout) {
      if (isScoutingMode) {
        this.dom.btnCancelScout.classList.remove("hidden");
      } else {
        this.dom.btnCancelScout.classList.add("hidden");
      }
    }

    // 提示文案更新
    if (this.dom.hintText) {
      if (isScoutingMode) {
        this.dom.hintText.textContent = t("scoutClickHint", this.locale);
      } else if (engine.turnPhase === "first_flipped") {
        this.dom.hintText.textContent = `${t("needSelectSecond", this.locale)} ${t("clickSameToCancel", this.locale)}`;
      } else if (!isPlayerTurn) {
        this.dom.hintText.textContent = t("turnOpponent", this.locale);
      } else {
        this.dom.hintText.textContent = "";
      }
    }
  }

  // 更新 AI 信息卡
  updateAiPersona(tierKey) {
    const tier = AI_TIERS[tierKey] || AI_TIERS.novice;
    const nameEl = document.getElementById("ai-persona-name");
    const titleEl = document.getElementById("ai-persona-title");
    const descEl = document.getElementById("ai-persona-desc");
    if (nameEl) nameEl.textContent = t(tier.nameKey, this.locale);
    if (titleEl) titleEl.textContent = t(tier.titleKey, this.locale);
    if (descEl) descEl.textContent = t(tier.descKey, this.locale);
  }

  // 渲染战况消息日志
  logMessage(text) {
    if (this.dom.tickerText) {
      this.dom.tickerText.textContent = text;
      this.dom.tickerText.classList.remove("bump");
      void this.dom.tickerText.offsetWidth; // 触发 reflow
      this.dom.tickerText.classList.add("bump");
    }
  }

  // 终局弹窗展示
  showGameOver(snapshot) {
    const { engine, summary, stars, mode } = snapshot;
    if (!this.dom.modalGameOver) return;

    const iconEl = document.getElementById("modal-result-icon");
    const titleEl = document.getElementById("modal-result-title");
    const descEl = document.getElementById("modal-result-desc");
    const starsBox = document.getElementById("modal-stars-box");
    const nextBtn = document.getElementById("btn-modal-next");

    const isWin = engine.winner === "player";
    const isTie = engine.winner === "tie";

    if (iconEl) iconEl.textContent = isWin ? "👑" : isTie ? "🤝" : "💔";
    if (titleEl) titleEl.textContent = isWin ? t("victoryTitle", this.locale) : isTie ? t("tieTitle", this.locale) : t("defeatTitle", this.locale);

    if (descEl) {
      if (isWin) {
        descEl.textContent = engine.winReason === "target_reached" ? t("winTargetReached", this.locale) : t("winBoardCleared", this.locale);
      } else {
        descEl.textContent = engine.winReason === "target_reached" ? t("defeatTargetReached", this.locale) : t("defeatBoardCleared", this.locale);
      }
    }

    // 渲染星星
    if (starsBox) {
      starsBox.innerHTML = "";
      for (let s = 1; s <= 3; s++) {
        const star = document.createElement("span");
        star.className = `star-icon ${s <= stars ? "lit" : "unlit"}`;
        star.textContent = "⭐";
        starsBox.appendChild(star);
      }
    }

    // 数据指标
    if (summary) {
      const netEl = document.getElementById("mstat-net-pairs");
      const spEl = document.getElementById("mstat-rem-sp");
      const mistEl = document.getElementById("mstat-mistakes");
      const turnsEl = document.getElementById("mstat-turns");
      if (netEl) netEl.textContent = `${summary.netPairs >= 0 ? "+" : ""}${summary.netPairs}`;
      if (spEl) spEl.textContent = String(summary.playerSp);
      if (mistEl) mistEl.textContent = String(summary.mistakes);
      if (turnsEl) turnsEl.textContent = String(summary.turnCount);
    }

    if (nextBtn) {
      nextBtn.textContent = mode === "endgame" ? t("btnNextPuzzle", this.locale) : t("btnNextStage", this.locale);
      nextBtn.style.display = isWin ? "inline-block" : "none";
    }

    this.dom.modalGameOver.showModal();
  }

  closeGameOver() {
    if (this.dom.modalGameOver && this.dom.modalGameOver.open) {
      this.dom.modalGameOver.close();
    }
  }

  // 渲染残局关卡列表
  renderPuzzleGrid(puzzlesProgress, currentPuzzleIndex) {
    const grid = document.getElementById("puzzles-grid");
    if (!grid) return;
    grid.innerHTML = "";

    PUZZLES.forEach((p, idx) => {
      const isUnlocked = idx <= puzzlesProgress.unlockedLevel;
      const stars = puzzlesProgress.stars[idx] || 0;
      const card = document.createElement("div");
      card.className = `puzzle-cell ${isUnlocked ? "unlocked" : "locked"} ${idx === currentPuzzleIndex ? "active" : ""}`;
      card.dataset.index = String(idx);

      let starStr = "";
      for (let s = 0; s < 3; s++) {
        starStr += s < stars ? "⭐" : "☆";
      }

      card.innerHTML = `
        <div class="pz-num">${idx + 1}</div>
        <div class="pz-title">${t(p.titleKey, this.locale)}</div>
        <div class="pz-stars">${isUnlocked ? starStr : "🔒"}</div>
        <button class="pz-btn" data-action="start_puzzle" data-index="${idx}" ${isUnlocked ? "" : "disabled"}>
          ${isUnlocked ? t("btnSelectMode", this.locale) || "GO" : "🔒"}
        </button>
      `;
      grid.appendChild(card);
    });
  }
}
