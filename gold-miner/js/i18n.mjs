// i18n：中英双语字符串表 + 统一语言检测。
// 全站共享偏好 key：localStorage["doin.lang"]（首页与所有子游戏读写同一个）。
// 默认显示语言规则：doin.lang 有合法值 → 用它；否则浏览器语言 zh* → 中文，其余 → 英文。

export const LOCALES = Object.freeze(["zh", "en"]);
export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";

const STRINGS = {
  zh: {
    docTitle: "黄金矿工 · DOIN 在线小游戏",
    metaDesc:
      "黄金矿工在线玩：摆动钢爪抓金块、钻石与神秘袋，60 秒内凑够目标金额，炸药碎石、生力水加速、钻石亮油升值，关卡逐层加深。",
    title: "黄金矿工 ⚡ Pro",
    backHome: "返回首页",
    soundOn: "音效: 开",
    soundOff: "音效: 关",
    resetBtn: "重置",
    resetConfirm: "确认清空本地所有进度与最高纪录并重新开始吗？",
    target: "目标:",
    money: "金钱:",
    record: "最高:",
    dynamite: "炸药:",
    level: "关卡:",
    time: "时间:",
    levelValue: "第 {0} 关",
    dynamiteValue: "💣 x{0}",
    secondsValue: "{0}s",
    moneyValue: "${0}",
    buffDrink: "⚡ 力量药水",
    buffPolish: "💎 钻石强化",
    tipClaw: '点击画面或按 <span class="key-tag">↓</span>/<span class="key-tag">S</span> 释放钢爪',
    tipBomb: '空格键暂停 | 按 <span class="key-tag">↑</span>/<span class="key-tag">W</span> 引爆炸药',
    pauseTitle: "⏸️ 游戏已暂停",
    pauseDesc: "按空格键或点击下方按钮继续挖掘",
    resumeBtn: "继续游戏",
    winTitle: "🎉 关卡大捷！",
    winDesc: "开采达成金钱 ${0}（目标配额 ${1}）！",
    winBtn: "前往矿工补给站",
    loseTitle: "💀 矿脉破产...",
    loseDesc: "资金积累仅 ${0}，未达到本关最低 ${1} 的开采配额。",
    loseBtn: "重新挑战第 1 关",
    shopTitle: "🛒 矿工补给站",
    shopDesc: "用挖到的金子强化装备，迎接更深的未知！",
    walletLabel: "当前持有金钱:",
    nextLevelTip: "（准备进入第 {0} 关）",
    itemDynaName: "开山炸药",
    itemDynaDesc: "拉拽时按 W 或 ↑ 碎裂废石",
    itemPotionName: "生力水",
    itemPotionDesc: "下一关拉拽速度提升 3 倍",
    itemPolishName: "钻石亮油",
    itemPolishDesc: "下一关钻石升值 50%",
    buyBtn: "购买",
    boughtBtn: "已生效",
    noMoney: "资金不足！",
    startNextLevel: "出发，进入下一关！",
    noscript: "需要启用 JavaScript 才能游玩黄金矿工。",
    langLabel: "Switch to English",
    langShort: "EN",
    ariaLang: "切换语言",
    ariaSound: "切换音效",
    ariaReset: "清空进度并重来",
  },
  en: {
    docTitle: "Gold Miner · DOIN games",
    metaDesc:
      "Play Gold Miner online: swing the claw to grab gold, diamonds and mystery bags, beat the quota within 60 seconds, blast rock with dynamite, speed up with potion and boost diamonds with polish.",
    title: "Gold Miner ⚡ Pro",
    backHome: "Home",
    soundOn: "Sound: ON",
    soundOff: "Sound: OFF",
    resetBtn: "Reset",
    resetConfirm: "Are you sure you want to reset all progress and high score?",
    target: "Goal:",
    money: "Money:",
    record: "High:",
    dynamite: "TNT:",
    level: "Level:",
    time: "Time:",
    levelValue: "Level {0}",
    dynamiteValue: "💣 x{0}",
    secondsValue: "{0}s",
    moneyValue: "${0}",
    buffDrink: "⚡ Strength Potion",
    buffPolish: "💎 Polish Buff",
    tipClaw: 'Click Canvas or Press <span class="key-tag">↓</span>/<span class="key-tag">S</span> to Drop Claw',
    tipBomb: 'Space: Pause | Press <span class="key-tag">↑</span>/<span class="key-tag">W</span> for Dynamite',
    pauseTitle: "⏸️ Game Paused",
    pauseDesc: "Press Space or click below to resume",
    resumeBtn: "Resume",
    winTitle: "🎉 Round Complete!",
    winDesc: "Earned ${0} (target quota ${1})!",
    winBtn: "Go to Miner Shop",
    loseTitle: "💀 Out of Business...",
    loseDesc: "Total funds ${0} failed to meet the ${1} threshold.",
    loseBtn: "Restart from Level 1",
    shopTitle: "🛒 Miner General Store",
    shopDesc: "Invest in gear before delving into deeper mines!",
    walletLabel: "Available Balance:",
    nextLevelTip: "(Entering Level {0})",
    itemDynaName: "Dynamite",
    itemDynaDesc: "Press W or ↑ to shatter junk while reeling",
    itemPotionName: "Strength Potion",
    itemPotionDesc: "Reel-in speed triples for next round",
    itemPolishName: "Diamond Polish",
    itemPolishDesc: "Diamonds yield 50% more value next round",
    buyBtn: "Buy",
    boughtBtn: "Active",
    noMoney: "Insufficient funds!",
    startNextLevel: "Start Next Level!",
    noscript: "JavaScript is required to play Gold Miner.",
    langLabel: "切换到中文",
    langShort: "中文",
    ariaLang: "Switch language",
    ariaSound: "Toggle sound",
    ariaReset: "Clear progress and restart",
  },
};

export function isLocale(value) {
  return LOCALES.includes(value);
}

export function strings(locale) {
  return STRINGS[locale] ?? STRINGS[DEFAULT_LOCALE];
}

// 简单插值："第 {0} 关" + format(t, 3) → "第 3 关"
export function format(template, ...args) {
  return String(template).replace(/\{(\d+)\}/g, (match, index) => {
    const value = args[Number(index)];
    return value === undefined ? match : String(value);
  });
}

// 浏览器语言 → locale：任何 zh 开头 → 中文，否则英文。
export function detectLocale() {
  const languages = globalThis.navigator?.languages ?? [];
  const single = globalThis.navigator?.language ?? "";
  for (const tag of [...languages, single]) {
    if (typeof tag === "string" && tag.toLowerCase().startsWith("zh")) return "zh";
  }
  return "en";
}

function readStore() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

// 统一规则第一步：全站共享偏好优先。
export function loadLocale() {
  const store = readStore();
  const saved = store?.getItem(LANG_KEY);
  if (isLocale(saved)) return saved;
  return detectLocale();
}

// 统一规则第二步：切换即写入全站共享偏好。
export function saveLocale(locale) {
  if (!isLocale(locale)) return false;
  try {
    readStore()?.setItem(LANG_KEY, locale);
    return true;
  } catch {
    return false;
  }
}

export function htmlLang(locale) {
  return locale === "zh" ? "zh-CN" : "en";
}
