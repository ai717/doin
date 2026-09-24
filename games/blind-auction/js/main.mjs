// 盲盒竞拍 · 装配入口：绑定事件、视图路由、回合倒计时、终局落账。
// 规则与计分唯一权威在 engine.mjs / score.mjs；本层只做调度与 DOM 绑定。

import { strings, format, loadLocale, saveLocale, htmlLang, LOCALE_EN } from "./i18n.mjs";
import * as storage from "./storage.mjs";
import { buildGame } from "./game.mjs";
import { renderApp } from "./render.mjs";
import { computeRating, computeBadges, applyOutcome } from "./score.mjs";
import { humanIndex, forceBidZero } from "./engine.mjs";
import { getChallenge, challengeStars, CHALLENGES } from "./challenge.mjs";
import * as audio from "./audio.mjs";

const ROUND_SECONDS = 20;
const app = document.getElementById("game-app");

let locale = loadLocale();
let saved = storage.load();
let view = "menu"; // menu | challenge | game | result
let game = null;
let activeChallengeId = null;
let gossipArmed = false;
let timerId = null;
let timeLeft = ROUND_SECONDS;

document.documentElement.lang = htmlLang(locale);
audio.setMuted(saved.prefs.muted);

function paint() {
  const t = strings(locale);
  const challengeCleared = saved.challenges && Object.keys(saved.challenges.stars).length > 0;
  if (view === "menu") {
    renderApp(app, "menu", { t, locale, saved, challengeCleared });
  } else if (view === "challenge") {
    renderApp(app, "challenge", { t, locale, saved });
  } else if (view === "game") {
    renderApp(app, "game", { t, locale, state: game.state });
    syncBidUI();
    startTimerIfNeeded();
  } else {
    renderApp(app, "result", { t, locale, state: game.state, saved });
  }
}

// ---------------------------------------------------------------- 对局生命周期

function startGame(challengeId) {
  activeChallengeId = challengeId ?? null;
  let opts = {};
  if (challengeId != null) {
    const chal = getChallenge(challengeId);
    if (!chal) return;
    opts = { seed: chal.seed, difficulty: chal.difficulty, character: chal.character, personas: chal.personas, mode: "challenge", challengeId };
  } else {
    const seed = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
    opts = { seed, difficulty: saved.prefs.difficulty, character: saved.prefs.character, mode: "free" };
  }
  game = buildGame(opts.seed, opts);
  view = "game";
  gossipArmed = false;
  paint();
}

function finishGame() {
  if (!game || game.state.phase !== "done") return;
  const state = game.state;
  const human = humanIndex(state);
  const rating = computeRating(state);
  const badges = computeBadges(state);
  const asset = state.result.assets.find((a) => a.i === human)?.asset ?? 0;
  // 自由局与挑战局都累计战绩；挑战局额外记星级与解锁。
  saved.stats = applyOutcome(saved.stats, { asset, rating, badges });
  if (activeChallengeId != null) {
    const pos = state.result.rank.indexOf(human);
    const stars = challengeStars(pos);
    if ((saved.challenges.stars[activeChallengeId] || 0) < stars) {
      saved.challenges.stars[activeChallengeId] = stars;
    }
    if (activeChallengeId < CHALLENGES.length && !saved.challenges.unlocked.includes(activeChallengeId + 1)) {
      saved.challenges.unlocked.push(activeChallengeId + 1);
      saved.challenges.unlocked.sort((a, b) => a - b);
    }
  }
  storage.save(saved);
  view = "result";
  paint();
}

// ---------------------------------------------------------------- 回合节奏

function startTimerIfNeeded() {
  stopTimer();
  if (view !== "game" || !game || game.state.phase !== "bid") return;
  const el = document.getElementById("timer");
  if (!el) return;
  timeLeft = ROUND_SECONDS;
  el.textContent = format(strings(locale).timeLeft, { s: timeLeft });
  timerId = setInterval(() => {
    timeLeft -= 1;
    if (timeLeft <= 3 && timeLeft > 0) audio.play("tick");
    const node = document.getElementById("timer");
    if (node) node.textContent = format(strings(locale).timeLeft, { s: Math.max(0, timeLeft) });
    if (timeLeft <= 0) {
      stopTimer();
      autoTimeoutResolve();
    }
  }, 1000);
}

function stopTimer() {
  if (timerId != null) {
    clearInterval(timerId);
    timerId = null;
  }
}

function autoTimeoutResolve() {
  if (!game || game.state.phase !== "bid") return;
  if (game.state.bids[0] == null) game.timeoutBid();
  resolveRoundNow();
}

// ---------------------------------------------------------------- 交互路由

function resolveRoundNow() {
  if (!game || game.state.phase !== "bid") return;
  stopTimer();
  const slider = document.getElementById("bid-slider");
  const amount = slider ? Number(slider.value) || 0 : 0;
  game.bid(amount);
  const ok = game.resolve();
  if (ok) {
    audio.play(game.state.reveal.snipe ? "snipe" : "hammer");
    paint();
  }
}

function openCrateNow() {
  if (!game || game.state.phase !== "reveal") return;
  game.open();
  const open = game.state.open;
  audio.play(open.profit >= 0 ? "openWin" : "openLose");
  paint();
}

function nextRoundNow() {
  if (!game || game.state.phase !== "open") return;
  game.next();
  if (game.state.phase === "done") {
    audio.play("done");
    finishGame();
  } else {
    paint();
  }
}

function useSkillNow() {
  if (!game || game.state.phase !== "bid") return;
  const me = game.state.players[humanIndex(game.state)];
  if (me.skillUsed) {
    toast(strings(locale).toastSkillDone);
    return;
  }
  if (me.character === "gossip") {
    gossipArmed = true;
    toast(strings(locale).gossipHint);
    return;
  }
  const ok = game.useSkill(null);
  if (ok) {
    audio.play("skill");
    paint();
  }
}

function skillTargetNow(target) {
  if (!gossipArmed) return;
  gossipArmed = false;
  const ok = game.useSkill(target);
  if (ok) {
    audio.play("skill");
    paint();
  }
}

function bidAddNow(amount) {
  if (!game || game.state.phase !== "bid") return;
  const slider = document.getElementById("bid-slider");
  if (!slider) return;
  const cash = game.state.players[humanIndex(game.state)].cash;
  const next = Math.min(cash, Math.max(0, (Number(slider.value) || 0) + amount));
  slider.value = next;
  const value = document.getElementById("bid-value");
  if (value) value.textContent = "$" + next.toLocaleString("en-US");
  audio.play("bid");
}

function syncBidUI() {
  const slider = document.getElementById("bid-slider");
  const value = document.getElementById("bid-value");
  if (slider && value) {
    slider.addEventListener("input", () => {
      value.textContent = "$" + (Number(slider.value) || 0).toLocaleString("en-US");
      audio.play("bid");
    });
  }
  const cash = document.getElementById("my-cash");
  if (cash && game) cash.textContent = "$" + game.state.players[humanIndex(game.state)].cash.toLocaleString("en-US");
}

function toast(message) {
  const old = document.getElementById("toast");
  if (old) old.remove();
  const div = document.createElement("div");
  div.id = "toast";
  div.className = "toast";
  div.textContent = message;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 1800);
}

// ---------------------------------------------------------------- 事件绑定

app.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  audio.init();
  const action = el.dataset.action;
  if (action === "pick-char") {
    saved.prefs.character = el.dataset.char;
    storage.savePrefs(saved.prefs);
    paint();
  } else if (action === "pick-diff") {
    saved.prefs.difficulty = el.dataset.diff;
    storage.savePrefs(saved.prefs);
    paint();
  } else if (action === "start-free") {
    startGame(null);
  } else if (action === "open-challenge") {
    view = "challenge";
    paint();
  } else if (action === "start-challenge") {
    startGame(Number(el.dataset.id));
  } else if (action === "back-menu") {
    view = "menu";
    game = null;
    paint();
  } else if (action === "play-again") {
    startGame(activeChallengeId);
  } else if (action === "use-skill") {
    useSkillNow();
  } else if (action === "skill-target") {
    skillTargetNow(Number(el.dataset.target));
  } else if (action === "resolve") {
    resolveRoundNow();
  } else if (action === "open-crate") {
    openCrateNow();
  } else if (action === "next-round") {
    nextRoundNow();
  } else if (action === "bid-add") {
    bidAddNow(Number(el.dataset.amount));
  }
});

function toggleLang() {
  const next = locale === LOCALE_EN ? "zh" : "en";
  saveLocale(next);
  location.reload();
}

function toggleSound() {
  saved.prefs.muted = !saved.prefs.muted;
  storage.savePrefs(saved.prefs);
  audio.setMuted(saved.prefs.muted);
  paint();
  const btn = document.getElementById("btn-sound");
  if (btn) btn.textContent = saved.prefs.muted ? "🔇" : "🔊";
}

function showRules() {
  const t = strings(locale);
  const overlay = document.createElement("div");
  overlay.id = "rules-modal";
  overlay.className = "modal";
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-title">${esc(t.rules)}</div>
      <pre class="modal-text">${esc(t.rulesText)}</pre>
      <button class="big-btn" data-action="close-rules">${esc(t.rulesClose || "OK")}</button>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay || e.target.closest("[data-action='close-rules']")) overlay.remove();
  });
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------------------------------------------------------------- 顶栏

const btnLang = document.getElementById("btn-lang");
if (btnLang) btnLang.textContent = locale === "en" ? "中文" : "EN";
btnLang?.addEventListener("click", toggleLang);

const btnSound = document.getElementById("btn-sound");
if (btnSound) btnSound.textContent = saved.prefs.muted ? "🔇" : "🔊";
btnSound?.addEventListener("click", toggleSound);

document.getElementById("btn-help")?.addEventListener("click", showRules);

// 首次交互解锁音频
document.addEventListener(
  "pointerdown",
  () => {
    audio.init();
  },
  { once: true }
);

paint();
