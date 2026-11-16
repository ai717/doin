// 盲盒竞拍 · 渲染层（唯一碰 DOM 的层）
// 只输出 HTML 结构（data-action / data-* 供 main 事件委托），不绑定监听、不自己算分。

import { strings, format } from "./i18n.mjs";
import { PERSONAS, emotionText, estimateAiBidRange } from "./ai.mjs";
import {
  estimateRange,
  visiblePrivateHints,
  currentCrate,
  currentMarket,
  dossierSummary,
  humanIndex,
  estimateCrate,
  CATEGORIES,
} from "./engine.mjs";
import { computeRating, computeBadges } from "./score.mjs";
import { CHALLENGES, challengeStars } from "./challenge.mjs";

const CAT_KEY = { antique: "catAntique", art: "catArt", misc: "catMisc", metal: "catMetal", toy: "catToy" };

function catName(cat, t) {
  return t[CAT_KEY[cat]] || cat;
}

function hintText(hint, t) {
  if (!hint) return "";
  if (hint.value) {
    const key = hint.kind === "declared" ? "hintDeclared" : hint.kind === "scan" ? "hintScan" : hint.kind === "size" ? "hintSize" : "hintCondition";
    if (hint.kind === "declared") return format(t[key], { lo: hint.value.lo, hi: hint.value.hi });
    if (hint.kind === "scan") return format(t[key], { cat: catName(hint.cat, t) });
    return t[key];
  }
  const key = hint.kind === "weight" ? "hintWeight" : hint.kind === "label" ? "hintLabel" : hint.kind === "decoration" ? "hintDecoration" : hint.kind === "seal" ? "hintSeal" : "hintSound";
  if (key === "hintWeight") return t[key];
  return format(t[key], { cat: catName(hint.cat, t) });
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function coin(value) {
  return "$" + Math.round(value).toLocaleString("en-US");
}

// ---------------------------------------------------------------- 视图入口

export function renderApp(app, view, data) {
  app.innerHTML = view === "menu" ? renderMenu(data) : view === "challenge" ? renderChallenge(data) : view === "game" ? renderGame(data) : view === "result" ? renderResult(data) : "";
}

// ---------------------------------------------------------------- 主菜单

function renderMenu({ t, locale, saved, challengeCleared }) {
  const prefs = saved.prefs;
  const stats = saved.stats;
  const difficulty = prefs.difficulty;
  const character = prefs.character;
  const chars = ["detective", "expert", "gossip", "hoarder"];
  const diffs = ["easy", "standard", "hard"];
  const badgeName = (id) => (id === "snip" ? t.badgeSnip : id === "bag" ? t.badgeBag : id === "tight" ? t.badgeTight : t.badgeSedan);
  const ratingText = (r) => (r ? t["rating" + r] : "—");
  return `
  <section class="menu-panel">
    <div class="menu-title">${esc(t.title)}</div>
    <div class="menu-subtitle">${esc(t.subtitle)} · DOIN</div>

    <div class="menu-block">
      <div class="menu-label">${esc(t.selectCharacter)}</div>
      <div class="char-grid">
        ${chars.map((c) => {
          const active = character === c ? " active" : "";
          return `<button class="char-card${active}" data-action="pick-char" data-char="${c}">
            <span class="char-icon">${c === "detective" ? "🔦" : c === "expert" ? "🧮" : c === "gossip" ? "👂" : "💰"}</span>
            <span class="char-name">${esc(t["char" + cap(c)])}</span>
            <span class="char-desc">${esc(t["char" + cap(c) + "Desc"])}</span>
          </button>`;
        }).join("")}
      </div>
    </div>

    <div class="menu-block">
      <div class="menu-label">${esc(t.difficulty)}</div>
      <div class="diff-row">
        ${diffs.map((d) => `<button class="diff-btn${difficulty === d ? " active" : ""}" data-action="pick-diff" data-diff="${d}">${esc(t["diff" + cap(d)])}</button>`).join("")}
      </div>
    </div>

    <div class="menu-actions">
      <button class="big-btn" data-action="start-free">${esc(t.start)} 🛒</button>
      <button class="big-btn alt" data-action="open-challenge">${esc(t.challenge)} ${challengeCleared ? "★" : ""}</button>
    </div>

    <div class="menu-stats">
      <div class="stat-cell"><span>${esc(t.gamesPlayed)}</span><b>${stats.gamesPlayed}</b></div>
      <div class="stat-cell"><span>${esc(t.bestAsset)}</span><b>${coin(stats.bestAsset)}</b></div>
      <div class="stat-cell"><span>${esc(t.bestRating)}</span><b>${esc(ratingText(stats.bestRating))}</b></div>
      <div class="stat-cell"><span>${esc(t.badgesGot)}</span><b>${stats.badges.length ? stats.badges.map(badgeName).join(" ") : "—"}</b></div>
    </div>
  </section>`;
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------- 残局挑战

function renderChallenge({ t, locale, saved }) {
  const chal = saved.challenges || { unlocked: [1], stars: {} };
  const cleared = chal.stars && Object.keys(chal.stars).length;
  return `
  <section class="challenge-panel">
    <div class="menu-title">${esc(t.challengeTitle)}</div>
    <div class="menu-subtitle">${esc(t.challengeStars)}</div>
    <div class="challenge-list">
      ${CHALLENGES.map((c) => {
        const unlocked = chal.unlocked.includes(c.id);
        const stars = chal.stars[c.id] || 0;
        return `<button class="chal-card${unlocked ? "" : " locked"}" ${unlocked ? `data-action="start-challenge" data-id="${c.id}"` : ""}>
          <span class="chal-id">${String(c.id).padStart(2, "0")}</span>
          <span class="chal-main">
            <span class="chal-name">${esc(t["challenge" + c.id])} <i>${stars ? "★".repeat(stars) : ""}</i></span>
            <span class="chal-desc">${esc(t["challenge" + c.id + "Desc"])}</span>
          </span>
          <span class="chal-lock">${unlocked ? "" : "🔒"}</span>
        </button>`;
      }).join("")}
    </div>
    <div class="menu-actions">
      <button class="big-btn alt" data-action="back-menu">${esc(t.back)}</button>
    </div>
  </section>`;
}

// ---------------------------------------------------------------- 对局

function renderGame(data) {
  const { state, t, locale } = data;
  const human = humanIndex(state);
  const me = state.players[human];
  const crate = currentCrate(state);
  const market = currentMarket(state);
  const rnd = state.roundIndex + 1;
  return `
  <div class="arena" data-phase="${state.phase}">
    ${renderRivals(state, t, locale)}
    ${renderStage(state, t, locale)}
    ${renderIntel(data)}
  </div>
  ${renderOverlay(data)}`;
}

function renderRivals(state, t, locale) {
  const human = humanIndex(state);
  const cards = state.players.map((p, i) => {
    if (i === human) return "";
    const persona = PERSONAS[p.personaId];
    const summary = dossierSummary(p);
    const tend = summary.rounds === 0 ? "" : summary.spent / (p.initialCash || 1) > 0.5 ? t.tendHigh : summary.spent / (p.initialCash || 1) > 0.2 ? t.tendMid : t.tendLow;
    const emotion = p.emotion ? `<div class="emo-bubble">${esc(emotionText(p.personaId, p.emotion.kind, locale))}</div>` : "";
    return `<div class="rival-card" data-rival="${i}">
      <div class="rival-head">
        <span class="rival-icon">${persona.icon}</span>
        <span class="rival-name">${esc(locale === "en" ? persona.nameEn : persona.nameZh)}</span>
        <span class="rival-cash">${coin(p.cash)}</span>
      </div>
      <div class="rival-tag">${esc(locale === "en" ? persona.titleEn : persona.titleZh)}</div>
      <div class="rival-tend"><span>${esc(t.tendLabel)}</span><b>${esc(tend)}</b></div>
      <div class="rival-meter"><span class="fill" style="width:${Math.min(100, Math.round((summary.spent / (p.initialCash || 1)) * 100))}%"></span></div>
      ${emotion}
    </div>`;
  }).join("");
  return `<aside class="panel rivals-panel">
    <div class="panel-title">${esc(t.opponentTitle)}</div>
    <div class="rivals">${cards}</div>
  </aside>`;
}

function renderStage(state, t, locale) {
  const crate = currentCrate(state);
  const rnd = state.roundIndex + 1;
  const reveal = state.reveal;
  const open = state.open;
  const human = humanIndex(state);
  let stageInner;
  if (state.phase === "bid") {
    stageInner = `<div class="crate-stand" id="crate-stand">
      <div class="crate-box" id="crate-box">
        <div class="crate-lid"></div>
        <div class="crate-body"></div>
        <div class="crate-strap"></div>
        <div class="crate-tag">?</div>
      </div>
      <div class="crate-glow"></div>
      <div class="crate-label">${esc(t.hintCategory)} · ${catName(crate.category === "misc" ? "misc" : crate.category, t)}?</div>
    </div>`;
  } else if (state.phase === "reveal") {
    const ranked = reveal.ranked.map((r) => {
      const p = state.players[r.i];
      const persona = p.kind === "ai" ? PERSONAS[p.personaId] : null;
      const label = p.kind === "human" ? t.youName : (locale === "en" ? persona.nameEn : persona.nameZh);
      return `<div class="bid-card${r.i === reveal.winner ? " winner" : ""}">
        <span class="bid-name">${r.i === human ? esc(t.youName) : esc(label)}</span>
        <span class="bid-amount">${coin(r.amount)}</span>
        ${r.i === reveal.winner ? `<span class="bid-mark">${reveal.snipe ? esc(t.snipeLabel) : "🥇"}</span>` : ""}
      </div>`;
    }).join("");
    stageInner = `<div class="reveal-board">
      <div class="reveal-title">${esc(t.revealTitle)}</div>
      <div class="bid-grid">${ranked}</div>
      <div class="reveal-note">${reveal.snipe ? esc(t.snipeLabel) + " · " + format(t.snipePay, { pay: coin(reveal.pay) }) : format(t.payLabel, {}) + " " + coin(reveal.pay)}</div>
    </div>`;
  } else if (state.phase === "open") {
    const p = state.players[open.winner];
    const isHuman = open.winner === human;
    const emo = isHuman
      ? (open.profit >= 0 ? t.emoHumanWin : t.emoHumanLose)
      : emotionText(p.personaId, open.profit >= 0 ? "win" : "lose", locale);
    const winClass = open.profit >= 0 ? "profit" : "loss";
    stageInner = `<div class="open-board ${winClass}">
      <div class="open-flash ${winClass}"></div>
      <div class="open-crate-revealed">
        <div class="crate-box open">
          <div class="crate-lid open"></div>
          <div class="crate-body open"></div>
          <div class="open-item">${open.category === "antique" ? "🏺" : open.category === "art" ? "🖼️" : open.category === "metal" ? "⚙️" : open.category === "toy" ? "🧸" : "📦"}</div>
        </div>
      </div>
      <div class="open-title">${esc(t.openTitle)}</div>
      <div class="open-stats">
        <div class="os-cell"><span>${esc(t.crateValue)}</span><b>${coin(open.trueValue)}</b></div>
        <div class="os-cell"><span>${esc(t.marketCoef)}</span><b>${open.coef.toFixed(2)}x</b></div>
        <div class="os-cell"><span>${esc(t.actualValue)}</span><b>${coin(open.value)}</b></div>
        <div class="os-cell ${winClass}"><span>${esc(t.profitLabel)}</span><b>${open.profit >= 0 ? "+" : ""}${coin(open.profit)}</b></div>
      </div>
      <div class="open-emo">${esc(emo)}</div>
    </div>`;
  } else {
    stageInner = `<div class="done-placeholder">${esc(t.resultTitle)}</div>`;
  }
  return `<main class="stage">
    <div class="round-badge">${format(t.roundOf, { n: rnd })}</div>
    <div class="stage-inner" id="stage-inner">${stageInner}</div>
  </main>`;
}

function renderIntel(data) {
  const { state, t } = data;
  const crate = currentCrate(state);
  const market = currentMarket(state);
  const human = humanIndex(state);
  const me = state.players[human];
  const publicHints = crate.publicHints || [];
  const privateHints = visiblePrivateHints(state, human);
  const range = estimateRange(crate, [...publicHints, ...privateHints], me.estimateNarrow);
  const marketRows = [];
  for (const r of market.publicReport.hot) marketRows.push(`<div class="mkt-row hot"><span>🔥 ${esc(t.hot)}</span><b>${format(t.coefRange, { cat: catName(r.cat, t), lo: r.lo.toFixed(2), hi: r.hi.toFixed(2) })}</b></div>`);
  for (const r of market.publicReport.cold) marketRows.push(`<div class="mkt-row cold"><span>❄️ ${esc(t.cold)}</span><b>${format(t.coefRange, { cat: catName(r.cat, t), lo: r.lo.toFixed(2), hi: r.hi.toFixed(2) })}</b></div>`);
  for (const r of market.publicReport.flat) marketRows.push(`<div class="mkt-row flat"><span>— ${esc(t.flat)}</span><b>${format(t.coefRange, { cat: catName(r.cat, t), lo: r.lo.toFixed(2), hi: r.hi.toFixed(2) })}</b></div>`);
  marketRows.push(`<div class="mkt-row hidden"><span>❓ ${esc(t.hidden)}</span><b>${catName(market.publicReport.hidden, t)}</b></div>`);

  const gossipTip = me.gossipTarget != null ? gossipTipHtml(data, me.gossipTarget) : "";
  const skillBtn = me.character === "hoarder"
    ? `<div class="skill-box passive">${esc(t.charHoarderDesc)}</div>`
    : `<button class="skill-btn${me.skillUsed ? " used" : ""}" data-action="use-skill" ${me.skillUsed ? "disabled" : ""}>${esc(t.skillBtn)}</button>`;

  return `<aside class="panel intel-panel">
    <div class="panel-title">${esc(t.marketTitle)}</div>
    <div class="market-list">${marketRows.join("")}</div>

    <div class="panel-title">${esc(t.publicHints)}</div>
    <ul class="hint-list">
      ${publicHints.map((h) => `<li>${esc(hintText(h, t))}</li>`).join("")}
    </ul>

    <div class="panel-title">${esc(t.privateHints)}</div>
    <ul class="hint-list private">
      ${privateHints.length ? privateHints.map((h) => `<li>🔒 ${esc(hintText(h, t))}</li>`).join("") : `<li class="dim">—</li>`}
    </ul>

    <div class="est-range"><span>${esc(t.hintCategory)}</span><b>${coin(range.lo)} ~ ${coin(range.hi)}</b></div>
    ${gossipTip}

    <div class="cash-box"><span>${esc(t.myCash)}</span><b id="my-cash">${coin(me.cash)}</b></div>

    <div class="bid-console">
      <div class="bid-slider-row">
        <input id="bid-slider" type="range" min="0" max="${me.cash}" step="100" value="0" ${state.phase === "bid" ? "" : "disabled"}>
        <span class="bid-step" data-action="bid-add" data-amount="100">+100</span>
        <span class="bid-step" data-action="bid-add" data-amount="500">+500</span>
      </div>
      <div class="bid-value"><b id="bid-value">$0</b><span class="bid-hint">${esc(t.bidHint)}</span></div>
      <div class="bid-actions">
        <button class="hammer-btn" data-action="resolve" ${state.phase === "bid" ? "" : "disabled"}>🔨 ${esc(t.confirmBid)}</button>
        ${skillBtn}
      </div>
      <div class="timer-row"><span id="timer" class="timer">${format(t.timeLeft, { s: 20 })}</span></div>
    </div>
  </aside>`;
}

function gossipTipHtml(data, targetIndex) {
  const { state, t, locale } = data;
  const target = state.players[targetIndex];
  if (!target || target.kind !== "ai") return "";
  const range = estimateAiBidRange(state, targetIndex);
  if (!range) return "";
  const persona = PERSONAS[target.personaId];
  return `<div class="gossip-tip">${esc(format(t.gossipRange, { name: locale === "en" ? persona.nameEn : persona.nameZh, lo: coin(range.lo), hi: coin(range.hi) }))}</div>`;
}

function renderOverlay(data) {
  const { state, t } = data;
  if (state.phase === "bid") return "";
  if (state.phase === "reveal") {
    return `<div class="phase-bar"><button class="big-btn" data-action="open-crate">${esc(t.openTitle)}</button></div>`;
  }
  if (state.phase === "open") {
    const last = state.roundIndex >= 4;
    return `<div class="phase-bar"><button class="big-btn" data-action="next-round">${esc(last ? t.resultTitle : t.nextRound)}</button></div>`;
  }
  return "";
}

// ---------------------------------------------------------------- 终局

function renderResult({ state, t, locale, saved }) {
  const human = humanIndex(state);
  const me = state.players[human];
  const result = state.result;
  const rating = computeRating(state);
  const badges = computeBadges(state);
  const badgeName = (id) => (id === "snip" ? t.badgeSnip : id === "bag" ? t.badgeBag : id === "tight" ? t.badgeTight : t.badgeSedan);
  const rankPos = result.rank.indexOf(human);
  const rankKey = "rank" + (rankPos + 1);
  const rows = result.assets.map((a) => {
    const p = state.players[a.i];
    const isHuman = a.i === human;
    const label = isHuman ? t.title : (locale === "en" ? PERSONAS[p.personaId].nameEn : PERSONAS[p.personaId].nameZh);
    return `<div class="rank-row${isHuman ? " me" : ""}">
      <span class="rank-no">${result.rank.indexOf(a.i) + 1}</span>
      <span class="rank-name">${esc(label)}</span>
      <span class="rank-asset">${coin(a.asset)}</span>
    </div>`;
  }).join("");
  return `
  <section class="result-panel">
    <div class="result-title">${esc(t.resultTitle)}</div>
    <div class="rank-list">${rows}</div>
    <div class="result-cards">
      <div class="res-card"><span>${esc(t.yourRank)}</span><b>${esc(t[rankKey])}</b></div>
      <div class="res-card"><span>${esc(t.assetLabel)}</span><b>${coin(me.cash)}</b></div>
      <div class="res-card"><span>${esc(t.ratingLabel)}</span><b class="rating-${rating}">${esc(t["rating" + rating])}</b></div>
    </div>
    ${badges.length ? `<div class="badge-row">${badges.map((b) => `<span class="badge">🎖 ${esc(badgeName(b))}</span>`).join("")}</div>` : ""}
    <div class="menu-actions">
      <button class="big-btn" data-action="play-again">${esc(t.confirmNew)}</button>
      <button class="big-btn alt" data-action="back-menu">${esc(t.back)}</button>
    </div>
  </section>`;
}
