// 推币机 · 全站共享中英双语表（语言偏好统一读写 localStorage["doin.lang"]）
//
// 铁律：strings.en 绝无汉字（白名单：langBtn 的语言标识）；源码零裸写中文。

export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";

const LOCALES = {
  zh: {
    langName: "中文",
    docTitle: "推币机 · DOIN 在线小游戏",
    appTitle: "推币机",
    back: "← 门户",
    sound: "音效",
    help: "玩法说明",
    soundOn: "🔊",
    soundOff: "🔇",
    langBtn: "EN",

    credits: "账户",
    creditsUnit: "{n} 枚",
    score: "得分",
    mult: "倍率",
    chainNow: "本波连锁",
    jackpot: "金卡",
    jackpotFull: "2¹⁸ 金卡",
    bestScore: "最高分",
    bestCascade: "最高连锁",
    bestDrops: "最多落袋",
    runs: "总局数 {n}",
    modeEndless: "无尽机台",
    runStats: "投入 {i} 枚 · 落袋 {d} 枚 · 侧沟丢 {l} 枚",

    startSub: "投币推落 · 挡杆随机落点 · 边缘连锁翻倍",
    creditPick: "选择带多少币进场",
    creditDesc: "投 1 枚 −1；掉进托盘 +1 回到账户；滑进两侧沟槽则丢失。账户清空即收工。",
    start: "开始",
    saveReset: "重置存档",
    saveResetConfirm: "确定清空本地纪录？",
    saveCleared: "存档已重置",

    insert: "投币",
    restart: "收工重开",
    keyTip: "空格投币 · R 连续投币 · P 暂停",
    touchTip: "点「投币」把金币送进投币口，落点由挡杆决定，不可瞄准",
    chuteLabel: "投币口",
    chuteDesc: "机顶固定投币口 · 挡杆阵决定落点",
    canvasLabel: "推币机玻璃观察窗",
    gutterLabel: "两侧沟槽",
    gutterDesc: "被挤出台面的币掉进侧仓，不计分也不回账户",

    prizeCase: "奖品陈列柜",
    coinNorm: "普通币",
    coinGold: "黄金币",
    coinGem: "宝石币",
    tokenCard: "奖励卡",
    objLauncher: "弹射器",
    objMagnet: "磁吸金块",
    objTower: "金塔",
    coinNormValue: "基础 10 分",
    coinGoldValue: "基础 50 分",
    coinGemValue: "基础 100 分",
    tokenCardValue: "跨越触发 3 秒增益",
    objLauncherValue: "碰触即弹射入空",
    objMagnetValue: "吸住金币成大堆",
    objTowerValue: "推落即大奖 + 回币 15 枚",

    dropLog: "掉落记录",
    dropLogEmpty: "还没有币掉进托盘",

    endTitle: "收工结算",
    endLine: "得分 {s} · 落袋 {d} 枚 · 侧沟丢 {l} 枚 · 最高连锁 {c}",
    again: "再来一局",
    backMenu: "返回主菜单",
    pauseTitle: "已暂停",
    pauseResume: "继续",
    pauseRestart: "重开本局",
    pauseMenu: "返回主菜单",
    paused: "已暂停",

    helpTitle: "玩法说明",
    help1: "投币口固定在机顶中央，你只能决定「什么时候投」——金币落下后会穿过三排挡杆随机弹跳，落点由物理决定，谁也瞄不准。",
    help2: "推板往复把整台金币推向边缘；球心越过边缘线就掉进你的托盘。踩着推板回程投币，金币更容易落到深处。",
    help3: "掉进托盘的币会回到你的账户，可以继续投。被推板挤到两侧、滑出台面的币会掉进侧仓——不计分，也不回账户，这才是机台真正的赢面。",
    help4: "边缘连锁翻倍：同一波内每多掉 1 枚，倍率 ×2。第 4 枚 ×8、第 8 枚 ×128，极限第 19 枚触达 2¹⁸ = 262144 倍金卡，机箱爆响。",
    help5: "每投满 14 枚，台面后段会随机补一个机关：奖励卡（跨越触发 3 秒增益）、弹射器（把币抛向随机落点）、磁吸金块（吸币成堆）、金塔（推落即大奖，并回一笔账户币）。台面最多同时存在 10 个机关，超出的会挤掉最早的。",
    helpClose: "知道了",

    toastBlocked: "账户没有币了",
    toastPaused: "对局已暂停",
    toastJackpot: "2¹⁸ 金卡！",
    toastTower: "金塔落袋！大奖 +15 枚",
    toastCardDouble: "双倍掉落 ×2",
    toastCardSpeed: "推板加速",
    toastCardMagnet: "磁吸聚拢",
    toastLaunch: "弹射入空",
    toastCascade: "{n} 连连锁 ×{m}",
    toastTokenSpawn: "机台补投了新的机关",
    toastLostCoin: "侧沟吞掉了一枚币",
    newRecord: "新纪录",
    noscript: "需要启用 JavaScript 才能游玩推币机。",
    effDouble: "双倍",
    effSpeed: "加速",
    effMagnet: "磁吸",
    effIdle: "无增益",
    jackpotLabel: "金卡极限",
    tier1: "4 连档",
    tier2: "8 连档",
    tier3: "12 连档",
    tier4: "16 连档",
    tierMad: "疯狂翻倍"
  },
  en: {
    langName: "English",
    docTitle: "Coin Pusher · DOIN Arcade",
    appTitle: "Coin Pusher",
    back: "← Portal",
    sound: "Sound",
    help: "How to Play",
    soundOn: "🔊",
    soundOff: "🔇",
    langBtn: "中",

    credits: "Credits",
    creditsUnit: "{n}",
    score: "Score",
    mult: "Multiplier",
    chainNow: "This Wave",
    jackpot: "Jackpot",
    jackpotFull: "2¹⁸ Jackpot",
    bestScore: "Best Score",
    bestCascade: "Best Cascade",
    bestDrops: "Most Dropped",
    runs: "Runs {n}",
    modeEndless: "Endless Cabinet",
    runStats: "{i} inserted · {d} dropped · {l} lost to gutters",

    startSub: "Insert · pegs decide where it lands · cascades double",
    creditPick: "Choose your starting credits",
    creditDesc: "Each insert costs 1. Coins that fall into the tray pay 1 back. Coins that slip into the side gutters are gone. Run ends when credits hit zero.",
    start: "Start",
    saveReset: "Reset Save",
    saveResetConfirm: "Erase local records?",
    saveCleared: "Save cleared",

    insert: "Insert",
    restart: "Cash Out & Restart",
    keyTip: "Space to insert · R to keep inserting · P to pause",
    touchTip: "Tap Insert to send a coin into the chute. The pegs decide where it lands — you cannot aim.",
    chuteLabel: "Coin Chute",
    chuteDesc: "One fixed slot on top · the peg board decides the landing",
    canvasLabel: "Coin Pusher glass viewport",
    gutterLabel: "Side Gutters",
    gutterDesc: "Coins squeezed off the sides drop into the side bin — no score, no refund",

    prizeCase: "Prize Case",
    coinNorm: "Coin",
    coinGold: "Gold Coin",
    coinGem: "Gem Coin",
    tokenCard: "Prize Card",
    objLauncher: "Launcher",
    objMagnet: "Magnet",
    objTower: "Gold Tower",
    coinNormValue: "10 base",
    coinGoldValue: "50 base",
    coinGemValue: "100 base",
    tokenCardValue: "Cross it for a 3s buff",
    objLauncherValue: "Flicks coins into the air",
    objMagnetValue: "Pulls coins into a pile",
    objTowerValue: "Topple it for a big bonus plus 15 credits",

    dropLog: "Drop Log",
    dropLogEmpty: "No coin has reached the tray yet",

    endTitle: "Run Over",
    endLine: "Score {s} · {d} dropped · {l} lost to gutters · best cascade {c}",
    again: "Play Again",
    backMenu: "Main Menu",
    pauseTitle: "Paused",
    pauseResume: "Resume",
    pauseRestart: "Restart",
    pauseMenu: "Main Menu",
    paused: "Paused",

    helpTitle: "How to Play",
    help1: "The slot is fixed at the top of the cabinet. All you decide is when to insert — the coin then falls through three rows of pegs and bounces wherever physics takes it. Nobody can aim.",
    help2: "The pusher sweeps the whole table toward the edge; any coin whose centre crosses the line drops into your tray. Inserting on the retract helps the coin settle deeper.",
    help3: "Coins that reach the tray pay back into your credits, so you can keep playing. Coins squeezed off the sides fall into the side bin — no score, no refund. That is the machine's real edge.",
    help4: "Edge Cascade Doubling: every extra coin in the same wave doubles the multiplier — 4th is ×8, 8th is ×128, and the 19th caps at the 2¹⁸ = 262144 jackpot.",
    help5: "Every 14 inserts the machine drops a random mechanism onto the back of the table: prize cards (3s buff when crossed), launchers (flick coins to a random spot), magnet blocks (gather coins into a pile) and gold towers (topple one for a big bonus plus a payout of credits). At most 10 mechanisms stay on the table; the oldest is squeezed out.",
    helpClose: "Got it",

    toastBlocked: "No credits left",
    toastPaused: "Run paused",
    toastJackpot: "2¹⁸ JACKPOT!",
    toastTower: "Gold tower down! Big bonus + 15 credits",
    toastCardDouble: "Double Drop ×2",
    toastCardSpeed: "Pusher Boost",
    toastCardMagnet: "Magnet Pull",
    toastLaunch: "Launched",
    toastCascade: "{n} cascade ×{m}",
    toastTokenSpawn: "The machine dropped a new mechanism",
    toastLostCoin: "A coin slipped into the side gutter",
    newRecord: "New record",
    noscript: "JavaScript is required to play Coin Pusher.",
    effDouble: "Double",
    effSpeed: "Speed",
    effMagnet: "Magnet",
    effIdle: "No buff",
    jackpotLabel: "Jackpot cap",
    tier1: "4-chain",
    tier2: "8-chain",
    tier3: "12-chain",
    tier4: "16-chain",
    tierMad: "Mad doubling"
  }
};

export function isLocale(value) {
  return value === "zh" || value === "en";
}

export function detectLocale() {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    /* 存储不可用时回默认 */
  }
  const navLang = (typeof navigator !== "undefined" && navigator.language) || "";
  return navLang.toLowerCase().startsWith("en") ? "en" : DEFAULT_LOCALE;
}

export function loadLocale() {
  return detectLocale();
}

export function saveLocale(locale) {
  if (!isLocale(locale)) return;
  try {
    localStorage.setItem(LANG_KEY, locale);
  } catch {
    /* 存储不可用时静默 */
  }
}

export function htmlLang() {
  return loadLocale() === "en" ? "en" : "zh-CN";
}

export function strings(locale) {
  return LOCALES[isLocale(locale) ? locale : DEFAULT_LOCALE];
}

// {n} {s} {c} {m} {d} {p} {l} 等任意字母占位符格式化
export function format(locale, key, values = {}) {
  const text = strings(locale)[key] ?? String(key);
  return text.replace(/\{([a-zA-Z]+)\}/g, (_, name) => String(values[name] ?? ""));
}

export { LOCALES };
