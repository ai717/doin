// 装配层：把引擎、计分、存档、音效、渲染与 UI 接到一起。规则一律不在这里判断。

import { STATUS } from "./engine.mjs";
import { advanceFrame, createGame, currentRun, dispatch } from "./game.mjs";
import { createRenderer } from "./render.mjs";
import { createAudio } from "./audio.mjs";
import { mountUI } from "./ui.mjs";
import * as storage from "./storage.mjs";
import { htmlLang, loadLocale, saveLocale, strings } from "./i18n.mjs";

const byId = (id) => document.getElementById(id);

const refs = {
  canvas: byId("gameCanvas"),
  toast: byId("toast"),
  titleText: byId("title-text"),
  backLabel: byId("back-label"),
  soundButton: byId("sound-btn"),
  soundLabel: byId("sound-label"),
  langButton: byId("lang-btn"),
  langLabel: byId("lang-label"),
  resetButton: byId("reset-btn"),
  resetLabel: byId("reset-label"),
  labelTarget: byId("label-target"),
  labelMoney: byId("label-money"),
  labelRecord: byId("label-record"),
  labelDynamite: byId("label-dynamite"),
  labelLevel: byId("label-level"),
  labelTime: byId("label-time"),
  hudTarget: byId("hud-target"),
  hudScore: byId("hud-score"),
  hudRecord: byId("hud-record"),
  hudDynamite: byId("hud-dynamite"),
  hudLevel: byId("hud-level"),
  hudTime: byId("hud-time"),
  buffDrink: byId("buff-drink"),
  buffPolish: byId("buff-polish"),
  pauseModal: byId("pause-modal"),
  pauseTitle: byId("pause-title"),
  pauseDesc: byId("pause-desc"),
  resumeBtn: byId("resume-btn"),
  resultModal: byId("result-modal"),
  resultTitle: byId("result-title"),
  resultDesc: byId("result-desc"),
  resultBtn: byId("result-btn"),
  shopModal: byId("shop-modal"),
  shopTitle: byId("shop-title"),
  shopDesc: byId("shop-desc"),
  shopWalletLabel: byId("shop-wallet-label"),
  shopCurrentMoney: byId("shop-current-money"),
  shopNextLevelTip: byId("shop-next-level-tip"),
  itemDynaName: byId("item-dyna-name"),
  itemDynaDesc: byId("item-dyna-desc"),
  btnBuyDyna: byId("btn-buy-dyna"),
  itemPotionName: byId("item-potion-name"),
  itemPotionDesc: byId("item-potion-desc"),
  btnBuyPotion: byId("btn-buy-potion"),
  itemPolishName: byId("item-polish-name"),
  itemPolishDesc: byId("item-polish-desc"),
  btnBuyPolish: byId("btn-buy-polish"),
  nextLevelBtn: byId("next-level-btn"),
  tipClaw: byId("tip-claw"),
  tipBomb: byId("tip-bomb"),
};

// —— i18n：统一语言规则（全站共享 doin.lang > 浏览器语言）——
const locale = loadLocale();
const t = strings(locale);
document.documentElement.lang = htmlLang(locale);
document.title = t.docTitle;
const metaDesc = document.querySelector('meta[name="description"]');
if (metaDesc) metaDesc.setAttribute("content", t.metaDesc);

// —— 存档与音效 ——
let persist = storage.load();
const audio = createAudio({ muted: persist.prefs.muted });
const renderer = createRenderer(refs.canvas.getContext("2d"));
const ui = mountUI(refs, t);

function runFromPersist() {
  const { level, money, dynamite, potion, polish } = persist.progress;
  return { level, money, dynamite, potion, polish };
}

let game = createGame(runFromPersist());
let record = persist.progress.record;
let celebrating = false;
let celebrateTimer = null;
let endTimer = null;

// 落盘统一走 storage：现金/关卡/道具写入 progress，最高纪录只增不减。
function persistRun() {
  const run = currentRun(game);
  const { state: next } = storage.recordRound(
    { ...persist, progress: { ...persist.progress, ...run } },
    { money: run.money },
  );
  persist = next;
  record = persist.progress.record;
  storage.save(persist);
}

function celebrate() {
  celebrating = true;
  if (celebrateTimer) clearTimeout(celebrateTimer);
  celebrateTimer = setTimeout(() => {
    celebrating = false;
  }, 900);
}

function syncHud() {
  ui.renderHud(game.state, record);
}

function onRoundEnd() {
  audio.stopReel();
  const won = game.state.status === STATUS.won;
  if (won) {
    audio.win();
    ui.vibrate([30, 60, 30]);
    persistRun();
  }
  // 结算弹窗延后 500ms，让最后一爪的庆祝动画先播完。
  if (endTimer) clearTimeout(endTimer);
  endTimer = setTimeout(() => ui.showResult(game.state), 500);
}

function handleEvents(events) {
  for (const event of events) {
    switch (event.type) {
      case "shoot":
        audio.shoot();
        break;
      case "grab":
        if (event.precious) audio.gold();
        else audio.rock();
        ui.vibrate(15);
        break;
      case "reelStart":
        audio.startReel();
        break;
      case "reelStop":
        audio.stopReel();
        break;
      case "reelDirt":
        renderer.reelDirt(event.x, event.y, event.boosted);
        break;
      case "explosion":
        audio.explosion();
        renderer.explode(event.x, event.y, event.power);
        ui.vibrate(40);
        break;
      case "score":
      case "bag":
        if (event.type === "bag") audio.buy();
        celebrate();
        persistRun();
        syncHud();
        break;
      case "celebrate":
        celebrate();
        break;
      case "blast":
        persistRun();
        syncHud();
        break;
      case "buy":
        audio.buy();
        persistRun();
        syncHud();
        ui.renderShop(game.state);
        break;
      case "deny":
        if (event.reason === "noMoney") ui.toast(t.noMoney);
        break;
      case "tick":
        syncHud();
        break;
      case "heartbeat":
        audio.heartbeat();
        ui.pulseTime();
        break;
      case "paused":
        audio.stopReel();
        ui.showPause(true);
        break;
      case "resumed":
        ui.showPause(false);
        break;
      case "levelStart":
        if (endTimer) clearTimeout(endTimer);
        ui.hideModals();
        persistRun();
        syncHud();
        break;
      case "roundEnd":
        onRoundEnd();
        break;
      default:
        break;
    }
  }
}

function send(intent) {
  const result = dispatch(game, intent);
  handleEvents(result.events);
  return result;
}

// —— 控制绑定 ——
refs.canvas.addEventListener("click", () => send({ type: "drop" }));

window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    send({ type: "togglePause" });
    return;
  }
  if (event.code === "ArrowDown" || event.code === "KeyS") {
    event.preventDefault();
    send({ type: "drop" });
    return;
  }
  if (event.code === "ArrowUp" || event.code === "KeyW") {
    event.preventDefault();
    send({ type: "blast" });
  }
});

refs.resumeBtn.addEventListener("click", () => send({ type: "resume" }));

refs.resultBtn.addEventListener("click", () => {
  if (game.state.status === STATUS.won) {
    refs.resultModal.style.display = "none";
    ui.showShop(game.state);
    return;
  }
  // 破产：清掉本局资产，保留最高纪录，从第 1 关重开。
  persist = storage.clearRun(persist);
  storage.save(persist);
  record = persist.progress.record;
  send({ type: "restart" });
  ui.hideModals();
  persistRun();
  syncHud();
});

refs.nextLevelBtn.addEventListener("click", () => send({ type: "nextLevel" }));

for (const button of document.querySelectorAll(".shop-buy-btn")) {
  button.addEventListener("click", () => send({ type: "buy", item: button.dataset.type }));
}

refs.soundButton.addEventListener("click", () => {
  const muted = !audio.isMuted();
  audio.setMuted(muted);
  persist.prefs.muted = muted;
  storage.save(persist);
  ui.setSoundLabel(muted);
  if (!muted) audio.buy();
});

refs.resetButton.addEventListener("click", () => {
  if (!window.confirm(t.resetConfirm)) return;
  persist = storage.resetAll();
  record = persist.progress.record;
  game = createGame(runFromPersist());
  if (endTimer) clearTimeout(endTimer);
  celebrating = false;
  audio.stopReel();
  ui.hideModals();
  ui.applyTexts(game.state, { record, muted: audio.isMuted() });
});

// 语言切换：写入全站共享偏好后刷新，保持所有模块状态一致。
refs.langButton.addEventListener("click", () => {
  saveLocale(locale === "zh" ? "en" : "zh");
  window.location.reload();
});

// —— 主循环 ——
function frame() {
  const result = advanceFrame(game);
  handleEvents(result.events);
  renderer.draw(game.state, { celebrating });
  requestAnimationFrame(frame);
}

ui.applyTexts(game.state, { record, muted: audio.isMuted() });
syncHud();
requestAnimationFrame(frame);
window.setInterval(() => send({ type: "tickSecond" }), 1000);

// 端到端测试钩子：仅当 URL 带 ?e2e 时暴露，生产路径完全不受影响。
if (typeof location !== "undefined" && new URLSearchParams(location.search).has("e2e")) {
  window.__gm = {
    state: () => game.state,
    intent: (intent) => send(intent),
    record: () => record,
  };
}
