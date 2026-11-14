// 中英双语表 + 全站共享语言偏好 doin.lang。切换只做原地热更新，绝不重置对局。

export const LOCALES = Object.freeze(["zh", "en"]);
export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";

const STRINGS = {
  zh: {
    docTitle: "挖掘者 · DOIN 在线小游戏",
    metaDesc: "在自然博物馆的地层剖面中自由开凿隧道，用气泵把红怪与喷火绿龙充气爆破，挖空巨石下方诱敌砸落。20 关五大考古地层、3 枚隐藏化石与零广告即开即玩。",
    title: "挖掘者",
    subtitle: "自然历史博物馆 · 地层发掘现场",
    backHome: "返回门户",
    soundOn: "音效开",
    soundOff: "音效关",
    ariaSound: "音效开关",
    ariaLang: "切换语言",
    ariaHelp: "玩法说明",
    langLabel: "切换到英文",
    langShort: "EN",
    eraLabel: "地质年代",
    monstersLabel: "地底生物",
    pookaLabel: "红怪",
    fygarLabel: "绿龙",
    livesLabel: "探险帽",
    scoreLabel: "发掘分",
    bestLabel: "最高",
    fossilsLabel: "化石",
    fossilSlot: "化石 {0}",
    levels: "选关",
    restart: "重开",
    pump: "打气",
    pause: "暂停",
    resume: "继续",
    close: "关闭",
    next: "下一关",
    again: "再来一次",
    levelsTitle: "地层发掘档案",
    levelsTotal: "已得 {0} / {1} 星",
    chapter_ch1: "第一卷 · 浅层近现代遗迹",
    chapter_ch2: "第二卷 · 青铜与陶片地层",
    chapter_ch3: "第三卷 · 侏罗纪骨骼页岩",
    chapter_ch4: "第四卷 · 寒武纪三叶虫层",
    chapter_ch5: "第五卷 · 太古紫晶地幔",
    era_ch1: "ERA I · MODERN",
    era_ch2: "ERA II · BRONZE",
    era_ch3: "ERA III · JURASSIC",
    era_ch4: "ERA IV · CAMBRIAN",
    era_ch5: "ERA V · PRECAMBRIAN",
    levelName: "第 {0} 关",
    levelStars: "{0} 星",
    levelCleared: "已通关",
    resultClear: "地层清理完毕",
    resultFail: "探险队撤离",
    resultScore: "本关发掘分",
    resultFossils: "化石标本",
    resultBest: "历史最高",
    resultNewBest: "新纪录",
    pauseTitle: "已暂停",
    pausedHint: "剖面与怪物已冻结，随时回来继续发掘。",
    continueLabel: "继续游戏",
    pauseRestart: "重新开始",
    pauseLevels: "返回选关",
    helpTitle: "玩法说明",
    helpBody:
      "1. 方向键 / WASD 或下方十字键移动，走进泥土会自动开凿隧道。\n2. 空格或 PUMP 键朝面朝方向射出气泵，连打三次把怪物充气爆破。\n3. 停止打气后怪物会缓慢漏气；趁它还没恢复，绕到另一侧继续打气。\n4. 挖空巨石正下方的泥土，巨石晃动一秒后坠落，可砸死成串怪物并得到三倍积分。\n5. 绿色喷火龙会蓄力喷出三格烈焰，看到蓄力光就横向闪开。\n6. 清除全部怪物即可过关；顺路挖出三枚化石可得三星。生命耗尽则撤离。",
    helpKeys: "快捷键：方向键 / WASD 移动 · 空格打气 · P / Esc 暂停 · R 重开",
    helpMonsters: "红怪会周期性幽灵化穿土；绿龙会停下蓄力喷火。被碰到或烧到都会损失一顶探险帽。",
    helpRocks: "悬空巨石：挖掉支撑后晃动 1 秒坠落，砸中怪物得 3 倍分数，也会砸中你自己。",
    helpFossils: "每关埋着 3 枚化石，挖开泥土即可收集；通关时化石数量决定星评。",
    fossilToast: "化石 +1",
    crushedToast: "巨石碾压！",
    burstToast: "充气爆破！",
    deathToast: "损失一顶探险帽",
    clearToast: "地层清理完毕！",
    lostToast: "探险队撤离了",
    ghostToast: "有怪物幽灵化了！",
    statusDig: "开凿隧道，寻找地底生物",
    statusDanger: "小心！怪物就在附近",
    statusClear: "地层清理完毕",
    statusFail: "探险队已撤离",
    pumpHint: "靠近怪物，朝它连打三次气",
    moveHint: "走进泥土自动开凿",
    saved: "进度、星评与最高分保存在本机浏览器，可离线游玩。",
    noscript: "需要启用 JavaScript 才能游玩挖掘者。",
    boardAria: "挖掘者地层剖面",
    ariaHud: "发掘仪表",
    ariaCanvas: "挖掘者游戏画面：移动开凿隧道，打气爆破怪物",
    ariaLevels: "地层选关",
    ariaPause: "暂停菜单",
    ariaResult: "发掘结算",
    dpadLabel: "方向十字键",
  },
  en: {
    docTitle: "Digger · DOIN games",
    metaDesc: "Carve your own tunnels through a natural-history strata cabinet, inflate red Pookas and fire-breathing Fygars with a hand pump, and drop suspended boulders on the chase. 20 stages across five strata, 3 hidden fossils and instant ad-free play.",
    title: "Digger",
    subtitle: "Natural History Museum · Strata Excavation",
    backHome: "Home",
    soundOn: "Sound on",
    soundOff: "Sound off",
    ariaSound: "Toggle sound",
    ariaLang: "Switch language",
    ariaHelp: "How to play",
    langLabel: "切换到中文",
    langShort: "中文",
    eraLabel: "Era",
    monstersLabel: "Creatures",
    pookaLabel: "Pooka",
    fygarLabel: "Fygar",
    livesLabel: "Helmets",
    scoreLabel: "Score",
    bestLabel: "Best",
    fossilsLabel: "Fossils",
    fossilSlot: "Fossil {0}",
    levels: "Levels",
    restart: "Restart",
    pump: "PUMP",
    pause: "Pause",
    resume: "Resume",
    close: "Close",
    next: "Next stage",
    again: "Try again",
    levelsTitle: "Strata excavation archive",
    levelsTotal: "{0} / {1} stars earned",
    chapter_ch1: "Volume 1 · Shallow Modern Strata",
    chapter_ch2: "Volume 2 · Bronze and Pottery",
    chapter_ch3: "Volume 3 · Jurassic Bone Shale",
    chapter_ch4: "Volume 4 · Cambrian Trilobite Bed",
    chapter_ch5: "Volume 5 · Precambrian Crystal Core",
    era_ch1: "ERA I · MODERN",
    era_ch2: "ERA II · BRONZE",
    era_ch3: "ERA III · JURASSIC",
    era_ch4: "ERA IV · CAMBRIAN",
    era_ch5: "ERA V · PRECAMBRIAN",
    levelName: "Stage {0}",
    levelStars: "{0} stars",
    levelCleared: "Cleared",
    resultClear: "Strata cleared",
    resultFail: "Expedition withdrawn",
    resultScore: "Stage score",
    resultFossils: "Fossils found",
    resultBest: "Personal best",
    resultNewBest: "New record",
    pauseTitle: "Paused",
    pausedHint: "The strata and its creatures are frozen. Come back whenever you like.",
    continueLabel: "Resume",
    pauseRestart: "Restart",
    pauseLevels: "Back to levels",
    helpTitle: "How to play",
    helpBody:
      "1. Move with the arrow keys / WASD or the on-screen pad; walking into dirt carves a tunnel.\n2. Press Space or PUMP to fire the air hose in the direction you face. Three pumps burst a creature.\n3. Stop pumping and the creature slowly deflates. Circle around while it recovers and pump again.\n4. Dig out the dirt under a suspended boulder; it shakes for a second, then falls and can crush a whole line of creatures for triple score.\n5. A green Fygar stops and charges, then breathes three cells of flame. Sidestep when you see the glow.\n6. Clear every creature to finish the stage. Dig up all three fossils for three stars. Run out of helmets and the expedition withdraws.",
    helpKeys: "Keys: arrows / WASD move · Space pumps · P / Esc pauses · R restarts",
    helpMonsters: "Pookas periodically turn ghostly and drift through dirt; Fygars stop to charge a flame. A touch or a flame costs one helmet.",
    helpRocks: "Suspended boulders: remove the support and the boulder shakes for 1 second, then falls. Crushed creatures pay triple, but it can crush you too.",
    helpFossils: "Each stage hides 3 fossils in the dirt. Dig them up for stars when you clear the stage.",
    fossilToast: "Fossil +1",
    crushedToast: "Boulder crush!",
    burstToast: "Popped!",
    deathToast: "Lost a helmet",
    clearToast: "Strata cleared!",
    lostToast: "The expedition withdrew",
    ghostToast: "A creature turned ghostly!",
    statusDig: "Carve a tunnel and track the creatures",
    statusDanger: "Careful! A creature is nearby",
    statusClear: "Strata cleared",
    statusFail: "Expedition withdrawn",
    pumpHint: "Get close and pump three times",
    moveHint: "Walk into dirt to dig",
    saved: "Progress, stars and best scores are saved in your browser. Works offline.",
    noscript: "JavaScript is required to play Digger.",
    boardAria: "Digger strata cross-section",
    ariaHud: "Excavation dashboard",
    ariaCanvas: "Digger game view: move to carve tunnels and pump creatures",
    ariaLevels: "Stage selection",
    ariaPause: "Pause menu",
    ariaResult: "Excavation result",
    dpadLabel: "Direction pad",
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
  const store = readStore();
  const saved = store?.getItem(LANG_KEY);
  if (isLocale(saved)) return saved;
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
