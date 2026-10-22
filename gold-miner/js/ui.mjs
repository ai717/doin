// ui：唯一的 DOM 拥有者。只把 state 渲染成界面，不判断规则、不改引擎数据。

import { format } from "./i18n.mjs";
import { STATUS } from "./engine.mjs";

// 商店三件货：按钮 ref、名称/描述文案 ref 与 i18n 键一一对应。
const SHOP_CARDS = Object.freeze([
  Object.freeze({ type: "dynamite", button: "btnBuyDyna", name: "itemDynaName", desc: "itemDynaDesc" }),
  Object.freeze({ type: "potion", button: "btnBuyPotion", name: "itemPotionName", desc: "itemPotionDesc" }),
  Object.freeze({ type: "polish", button: "btnBuyPolish", name: "itemPolishName", desc: "itemPolishDesc" }),
]);

export function mountUI(refs, t) {
  let toastTimer = null;
  let urgentTimer = null;

  const money = (value) => format(t.moneyValue, value);

  function owned(state, type) {
    if (type === "potion") return state.potion;
    if (type === "polish") return state.polish;
    return false;
  }

  function renderHud(state, record) {
    refs.hudTarget.textContent = money(state.target);
    refs.hudScore.textContent = money(state.money);
    refs.hudRecord.textContent = money(record);
    refs.hudDynamite.textContent = format(t.dynamiteValue, state.dynamite);
    refs.hudLevel.textContent = format(t.levelValue, state.level);
    refs.hudTime.textContent = format(t.secondsValue, state.timeLeft);
    refs.buffDrink.style.display = state.potion ? "inline-block" : "none";
    refs.buffPolish.style.display = state.polish ? "inline-block" : "none";
  }

  function renderShop(state) {
    refs.shopCurrentMoney.textContent = money(state.money);
    refs.shopNextLevelTip.textContent = format(t.nextLevelTip, state.level + 1);
    for (const card of SHOP_CARDS) {
      const button = refs[card.button];
      const isOwned = owned(state, card.type);
      button.disabled = isOwned;
      button.textContent = isOwned ? t.boughtBtn : t.buyBtn;
    }
  }

  function setSoundLabel(muted) {
    refs.soundLabel.textContent = muted ? t.soundOff : t.soundOn;
    refs.soundButton.setAttribute("aria-pressed", String(muted));
  }

  // HTML 里保留中文默认值做 SEO 兜底，运行时按当前语言整体刷一遍。
  function applyTexts(state, { record, muted }) {
    refs.titleText.textContent = t.title;
    refs.backLabel.textContent = t.backHome;
    refs.resetLabel.textContent = t.resetBtn;
    refs.langLabel.textContent = t.langShort;
    refs.langButton.setAttribute("aria-label", t.ariaLang);
    refs.langButton.setAttribute("title", t.ariaLang);
    refs.soundButton.setAttribute("aria-label", t.ariaSound);
    refs.resetButton.setAttribute("aria-label", t.ariaReset);

    refs.labelTarget.textContent = t.target;
    refs.labelMoney.textContent = t.money;
    refs.labelRecord.textContent = t.record;
    refs.labelDynamite.textContent = t.dynamite;
    refs.labelLevel.textContent = t.level;
    refs.labelTime.textContent = t.time;
    refs.buffDrink.textContent = t.buffDrink;
    refs.buffPolish.textContent = t.buffPolish;

    refs.tipClaw.innerHTML = t.tipClaw;
    refs.tipBomb.innerHTML = t.tipBomb;

    refs.pauseTitle.textContent = t.pauseTitle;
    refs.pauseDesc.textContent = t.pauseDesc;
    refs.resumeBtn.textContent = t.resumeBtn;

    refs.shopTitle.textContent = t.shopTitle;
    refs.shopDesc.textContent = t.shopDesc;
    refs.shopWalletLabel.textContent = t.walletLabel;
    refs.nextLevelBtn.textContent = t.startNextLevel;
    for (const card of SHOP_CARDS) {
      refs[card.name].textContent = t[card.name];
      refs[card.desc].textContent = t[card.desc];
    }

    setSoundLabel(muted);
    renderHud(state, record);
    renderShop(state);
  }

  function showResult(state) {
    const won = state.status === STATUS.won;
    refs.resultTitle.textContent = won ? t.winTitle : t.loseTitle;
    refs.resultTitle.className = won ? "modal-title title-win" : "modal-title title-lose";
    refs.resultDesc.textContent = won
      ? format(t.winDesc, state.money, state.target)
      : format(t.loseDesc, state.money, state.target);
    refs.resultBtn.textContent = won ? t.winBtn : t.loseBtn;
    refs.resultModal.style.display = "flex";
  }

  function showShop(state) {
    renderShop(state);
    refs.shopModal.style.display = "flex";
  }

  function showPause(visible) {
    refs.pauseModal.style.display = visible ? "flex" : "none";
  }

  function hideModals() {
    refs.pauseModal.style.display = "none";
    refs.resultModal.style.display = "none";
    refs.shopModal.style.display = "none";
  }

  // 轻提示替代 alert：不阻塞主循环，1.6s 自动消失。
  function toast(text) {
    refs.toast.textContent = text;
    refs.toast.classList.add("is-visible");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => refs.toast.classList.remove("is-visible"), 1600);
  }

  // 最后 10 秒的时间跳动告警。
  function pulseTime() {
    refs.hudTime.classList.add("is-urgent");
    if (urgentTimer) clearTimeout(urgentTimer);
    urgentTimer = setTimeout(() => refs.hudTime.classList.remove("is-urgent"), 150);
  }

  function vibrate(pattern) {
    try {
      globalThis.navigator?.vibrate?.(pattern);
    } catch (error) {
      // 不支持触感就静默
    }
  }

  return {
    applyTexts,
    renderHud,
    renderShop,
    setSoundLabel,
    showResult,
    showShop,
    showPause,
    hideModals,
    toast,
    pulseTime,
    vibrate,
  };
}
