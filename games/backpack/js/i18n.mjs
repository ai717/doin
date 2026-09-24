// i18n.mjs — 背包竞技场：中英双语字符串表 + 统一语言检测
// 全站共享偏好 key：localStorage["doin.lang"]（首页与所有子游戏读写同一个）。
// 规则：doin.lang 有合法值 → 用它；否则浏览器语言 zh* → 中文，其余 → 英文。

export const LOCALES = Object.freeze(["zh", "en"]);
export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";

const STRINGS = {
  zh: {
    docTitle: "背包竞技场 · DOIN 在线小游戏",
    metaDesc:
      "背包竞技场在线玩：像俄罗斯方块一样把战利品塞进背包，摆出联动羁绊，自动战斗按布局结算。3 职业 × 2 初始背包，远征天梯 18 回合、布局残局 30 关三星挑战、镜像斗技场，支持种子码复现远征。",
    appTitle: "背包竞技场",
    kicker: "BACKPACK ARENA",
    back: "返回门户",
    sound: "音效",
    soundOn: "音效已开",
    soundOff: "音效已关",
    langSwitch: "EN",
    help: "玩法",
    resetBtn: "清空存档",
    resetConfirm: "确认清空全部段位、残局星级与镜像纪录？",
    resetConfirmBtn: "再点一次确认清空",
    // 顶栏状态
    hudClass: "职业",
    hudRound: "回合",
    hudGold: "金币",
    hudWins: "胜场",
    hudLosses: "败场",
    hudSeed: "种子码",
    // 开局
    readyTitle: "背包竞技场",
    readyDesc:
      "把战利品像俄罗斯方块一样塞进背包——武器挨着磨刀石变利，油瓶傍着火杖点燃，越空的右侧让弓箭射得更远。摆好阵型，自动开打，布局就是战力。",
    btnStart: "进入长桌",
    btnContinue: "继续上次远征",
    btnPuzzles: "布局残局",
    btnMirror: "镜像斗技场",
    seedLabel: "种子码（可留空随机）",
    seedPlaceholder: "例如 BACKPACK-7F3A",
    btnSeedGo: "以此种子开局",
    classPickTitle: "选择你的冒险者",
    classDescBerserker: "受击积攒怒气，怒气化为攻速。越挨打越凶。",
    classDescRanger: "天生高暴击高命中，远程放箭，右侧越空越强。",
    classDescPyromancer: "魔力代替耐力，点燃叠烧，越烧越痛。",
    bagPickTitle: "选择初始背包",
    bagA: "背包 A",
    bagB: "背包 B",
    btnClassConfirm: "确认出征",
    // 远征主界面
    shopTitle: "商队柜台",
    shopHint: "前两格优先给联动好物",
    incomeText: "回合收入 +{0}",
    expansionBtn: "扩容背包 (+{0} 格)",
    expansionFull: "背包已满",
    sellBtn: "出售 +{0}",
    rotateHint: "点击物品旋转，拖拽移动，拖到另一件上交换",
    roundEnemy: "对手",
    btnBattle: "开战",
    btnNextRound: "下一回合",
    btnSettle: "结算战利品",
    battleTitle: "自动对战",
    battleFatigue: "疲劳！",
    battleHardCap: "平局终局",
    battleWin: "胜利",
    battleLose: "落败",
    battleMutual: "同归于尽",
    resultWin: "远征胜利！",
    resultLose: "远征结束",
    resultWinDesc: "你在第 {0} 回合登顶天梯，共 {1} 胜 {2} 负。",
    resultLoseDesc: "第 {0} 回合止步，共 {1} 胜 {2} 负。段位结算：{3}",
    resultGold: "金币",
    resultItems: "背包物品",
    resultRank: "段位",
    resultRankDelta: "段位进度",
    rankNames: ["青铜", "白银", "黄金", "白金", "大师"],
    rankProgress: "{0} → {1}",
    btnRetryExpedition: "再战一次",
    btnCopySeed: "复制种子码",
    seedCopied: "种子码已复制",
    newBestBadge: "新纪录！",
    // 残局
    puzzlesTitle: "布局残局",
    puzzlesChapter: "第 {0} 章",
    chapterNames: ["启蒙", "进阶", "大师"],
    puzzleStars: "星级 {0} / {1}",
    puzzleStarHp: "胜利时剩余生命 ≥50%",
    puzzleStarTime: "{0} 秒内结束战斗",
    btnHint: "提示摆法",
    btnSubmit: "开战",
    btnRetry: "重摆",
    puzzleSolved: "已解",
    puzzleLocked: "需通关上一关",
    hintTitle: "参考摆法",
    hintClose: "照着摆",
    puzzleVictory: "残局破解！",
    puzzleVictoryDesc: "剩余生命 {0}% · 用时 {1} 秒",
    puzzleStarsGot: "获得 {0} 星",
    // 镜像
    mirrorTitle: "镜像斗技场",
    mirrorDesc:
      "没有对手，只有另一个自己。你的背包每胜一局都更强一分——连胜能走多远？",
    mirrorRound: "第 {0} 层",
    mirrorBest: "最高层 {0}",
    btnMirrorFight: "迎战镜像",
    mirrorVictory: "击败镜像！",
    mirrorDefeat: "镜像更胜一筹",
    mirrorResult: "抵达第 {0} 层",
    // 战斗通用
    hpLabel: "生命",
    resLabel: "耐力",
    manaLabel: "魔力",
    fatigueTip: "战斗超过 30 秒进入疲劳，双方每秒受递增伤害",
    // 帮助
    helpTitle: "玩法说明",
    helpItems: [
      "背包就是棋盘：把战利品像俄罗斯方块一样摆进格子里，战斗按你的布局自动结算。",
      "点击物品可旋转（R 或右键），拖到空格移动，拖到另一件物品上交换位置，拖出棋盘或点卖出按钮出售。",
      "联动是核心：磨刀石挨着武器 +1 伤害，油瓶傍着火系武器点燃+1，毒箭傍着弓 +2 中毒，宝石同色同阶相邻自动升阶。",
      "远程武器右侧空出的格子越多打得越疼（空位加成）；瞄准镜放在顶行加暴击伤害；铁砧/轻羽符影响同列上下物品。",
      "战斗自动进行：命中、暴击、格挡、点燃、中毒都由种子决定。30 秒后进入疲劳，双方持续掉血，必分胜负。",
      "远征每回合先买再打：5 格商店前两格保证与背包联动，收入随回合增长，金币可扩容背包。10 胜或 5 负结束。",
      "残局模式给定物品与对手，考验布局。胜利得 1 星，剩余生命 ≥50% 得 2 星，限时内结束得 3 星。",
      "镜像斗技场里你每赢一层，镜像会复制你的布局并变得更强，直到你倒下。",
      "种子码让整场远征完全确定：商店、对手、战斗全部可复现，方便分享与复盘。",
      "三个职业手感完全不同：狂战士怒转攻速、游侠高暴击远程、火法师魔力点燃——每个职业都有两套初始背包。",
    ],
    // 引导
    toastBuy: "购入 {0}",
    toastSell: "售出 {0} +{1}",
    toastGoldShort: "金币不足",
    toastCraft: "合成 {0}！",
    toastGem: "宝石升阶：{0}",
    toastExpanded: "背包扩容！",
    toastFull: "没有空位",
    toastPlaced: "已摆放 {0}",
    toastBattleStart: "第 {0} 回合 · 对阵 {1}",
    toastFatigue: "30 秒已到，疲劳开始！",
    toastRankUp: "段位晋升：{0}！",
    toastMirrorStronger: "镜像变强了（{0} 层）",
    toastSeedInvalid: "种子码无效，已随机",
    // 可读性
    ariaBoard: "背包棋盘：摆放物品，自动结算战斗",
    ariaShop: "商队柜台：购买物品",
    ariaSound: "切换音效",
    ariaLang: "切换语言",
    ariaHelp: "打开玩法说明",
    ariaHint: "查看参考摆法",
    noscript: "需要启用 JavaScript 才能游玩背包竞技场。",
    langLabel: "Switch to English",
    itemTooltip: "{0} · {1} 金币",
  },
  en: {
    docTitle: "Backpack Arena · DOIN games",
    metaDesc:
      "Play Backpack Arena online: pack loot into your bag Tetris-style, build adjacency synergies, and let the battle resolve automatically from your layout. 3 classes x 2 starting bags, an 18-round expedition ladder, 30 layout puzzles with star ratings, a mirror arena, and seed-code reproducible runs.",
    appTitle: "Backpack Arena",
    kicker: "BACKPACK ARENA",
    back: "Portal",
    sound: "Sound",
    soundOn: "Sound ON",
    soundOff: "Sound OFF",
    langSwitch: "中文",
    help: "How to play",
    resetBtn: "Reset save",
    resetConfirm: "Erase every rank, puzzle star and mirror record and start over?",
    resetConfirmBtn: "Click again to wipe",
    hudClass: "Class",
    hudRound: "Round",
    hudGold: "Gold",
    hudWins: "Wins",
    hudLosses: "Losses",
    hudSeed: "Seed",
    readyTitle: "Backpack Arena",
    readyDesc:
      "Pack loot into your bag like Tetris — a weapon beside a whetstone cuts deeper, an oil flask next to a fire staff ignites, and open space to the right makes bows bite harder. Arrange, then let the battle resolve itself. Layout is power.",
    btnStart: "Enter the table",
    btnContinue: "Resume expedition",
    btnPuzzles: "Layout puzzles",
    btnMirror: "Mirror arena",
    seedLabel: "Seed code (blank = random)",
    seedPlaceholder: "e.g. BACKPACK-7F3A",
    btnSeedGo: "Start with this seed",
    classPickTitle: "Choose your adventurer",
    classDescBerserker: "Taking hits builds rage that becomes attack speed. The harder you get hit, the harder you hit back.",
    classDescRanger: "Innate crit and accuracy; loose arrows from range, stronger with open space to the right.",
    classDescPyromancer: "Mana replaces stamina; stack burn and watch them cook.",
    bagPickTitle: "Choose your starting bag",
    bagA: "Bag A",
    bagB: "Bag B",
    btnClassConfirm: "Depart",
    shopTitle: "Merchant's counter",
    shopHint: "The first two slots favor synergy with your bag",
    incomeText: "Round income +{0}",
    expansionBtn: "Expand bag (+{0} cells)",
    expansionFull: "Bag is full",
    sellBtn: "Sell +{0}",
    rotateHint: "Click to rotate, drag to move, drag onto another item to swap",
    roundEnemy: "Opponent",
    btnBattle: "Fight",
    btnNextRound: "Next round",
    btnSettle: "Settle loot",
    battleTitle: "Auto battle",
    battleFatigue: "Fatigue!",
    battleHardCap: "Time-out draw",
    battleWin: "Victory",
    battleLose: "Defeat",
    battleMutual: "Mutual destruction",
    resultWin: "Expedition cleared!",
    resultLose: "Expedition over",
    resultWinDesc: "You topped the ladder at round {0}: {1} wins, {2} losses.",
    resultLoseDesc: "Stopped at round {0}: {1} wins, {2} losses. Rank settled: {3}",
    resultGold: "Gold",
    resultItems: "Bag items",
    resultRank: "Rank",
    resultRankDelta: "Rank progress",
    rankNames: ["Bronze", "Silver", "Gold", "Platinum", "Master"],
    rankProgress: "{0} → {1}",
    btnRetryExpedition: "Run again",
    btnCopySeed: "Copy seed code",
    seedCopied: "Seed code copied",
    newBestBadge: "New record!",
    puzzlesTitle: "Layout puzzles",
    puzzlesChapter: "Chapter {0}",
    chapterNames: ["Beginner", "Advanced", "Master"],
    puzzleStars: "Stars {0} / {1}",
    puzzleStarHp: "Finish with 50%+ health",
    puzzleStarTime: "End the battle within {0}s",
    btnHint: "Show layout",
    btnSubmit: "Fight",
    btnRetry: "Rearrange",
    puzzleSolved: "Solved",
    puzzleLocked: "Clear the previous one",
    hintTitle: "Reference layout",
    hintClose: "Arrange like this",
    puzzleVictory: "Puzzle cracked!",
    puzzleVictoryDesc: "{0}% health left · {1}s",
    puzzleStarsGot: "{0} stars earned",
    mirrorTitle: "Mirror Arena",
    mirrorDesc:
      "No rival but yourself. Every win makes your mirror tougher. How far can your win streak go?",
    mirrorRound: "Floor {0}",
    mirrorBest: "Best {0}",
    btnMirrorFight: "Face the mirror",
    mirrorVictory: "Mirror defeated!",
    mirrorDefeat: "The mirror won this time",
    mirrorResult: "Reached floor {0}",
    hpLabel: "HP",
    resLabel: "Stamina",
    manaLabel: "Mana",
    fatigueTip: "After 30s the fight turns to fatigue and both sides bleed increasing damage",
    helpTitle: "How to play",
    helpItems: [
      "The bag is your board: pack loot Tetris-style and the battle resolves itself from your layout.",
      "Click an item to rotate (R or right-click), drag to move it, drag onto another item to swap, and drag it out or use the sell button to sell it.",
      "Synergy is everything: a whetstone beside a weapon grants +1 damage, an oil flask beside a fire weapon adds +1 burn stack and burn damage, a venom arrow beside a bow adds poison, and matching gems of the same color and tier merge when adjacent.",
      "Ranged weapons hit harder the more open cells sit to their right; a scope on the top row boosts crit damage; anvils and feather charms affect the item directly above or below in the same column.",
      "Battles run on their own: hits, crits, blocks, burn and poison are all seeded. After 30s fatigue sets in and both sides bleed increasing damage, so a fight can never stall forever.",
      "Each expedition round you shop first, then fight: the five-slot stall favors synergy with your bag, income grows each round, and gold can expand your bag. The run ends at 10 wins or 5 losses.",
      "Puzzle mode hands you items and an opponent; it is all about the layout. Win for 1 star, finish above 50% health for 2, and finish within the time limit for 3.",
      "In the Mirror Arena every win makes your copy stronger; it keeps mirroring your own build until you fall.",
      "A seed code makes an entire run deterministic — shops, opponents and battles all reproducible, perfect for sharing and post-mortems.",
      "The three classes play completely differently: Berserker turns rage into attack speed, Ranger crits at range, Pyromancer spends mana on burn. Each class has two starting bags.",
    ],
    toastBuy: "Bought {0}",
    toastSell: "Sold {0} +{1}",
    toastGoldShort: "Not enough gold",
    toastCraft: "Crafted {0}!",
    toastGem: "Gem upgraded: {0}",
    toastExpanded: "Bag expanded!",
    toastFull: "No room",
    toastPlaced: "Placed {0}",
    toastBattleStart: "Round {0} · vs {1}",
    toastFatigue: "30s reached — fatigue kicks in!",
    toastRankUp: "Rank up: {0}!",
    toastMirrorStronger: "The mirror grows stronger (floor {0})",
    toastSeedInvalid: "Invalid seed — rolled a random one",
    ariaBoard: "Backpack board: arrange items, battle resolves automatically",
    ariaShop: "Merchant's counter: buy items",
    ariaSound: "Toggle sound",
    ariaLang: "Switch language",
    ariaHelp: "Open the how-to-play panel",
    ariaHint: "Show the reference layout",
    noscript: "JavaScript is required to play Backpack Arena.",
    langLabel: "切换到中文",
    itemTooltip: "{0} · {1} gold",
  },
};

export function isLocale(value) {
  return LOCALES.includes(value);
}

export function strings(locale) {
  return STRINGS[locale] ?? STRINGS[DEFAULT_LOCALE];
}

export function format(template, ...args) {
  return String(template).replace(/\{(\d+)\}/g, (match, index) => {
    const value = args[Number(index)];
    return value === undefined ? match : String(value);
  });
}

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

export function loadLocale() {
  try {
    const saved = readStore()?.getItem(LANG_KEY);
    if (isLocale(saved)) return saved;
  } catch (error) {
    // 存储不可读 → 退回浏览器语言判定
  }
  return detectLocale();
}

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

export function pickLocalized(entry, locale, fallback = "") {
  if (!entry) return fallback;
  return entry[locale] ?? entry[DEFAULT_LOCALE] ?? fallback;
}
