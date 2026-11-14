// 中英双语表 + 全站共享语言偏好 doin.lang。切换只做原地热更新，绝不重置测试舱。

export const LOCALES = Object.freeze(["zh", "en"]);
export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";

const STRINGS = {
  zh: {
    docTitle: "传送门推箱 · DOIN 在线小游戏",
    metaDesc: "在光圈科技实验室里推动能量箱，让蓝橙与紫绿传送门折叠空间，把箱子隔空送进绿色核心槽。20 关非欧拓扑谜题、BFS 验证最优步数与无限撤销，零广告即开即玩。",
    title: "传送门推箱",
    subtitle: "光圈科技 · 空间折叠测试舱",
    backHome: "返回门户",
    soundOn: "音效开",
    soundOff: "音效关",
    ariaSound: "音效开关",
    ariaLang: "切换语言",
    ariaHelp: "玩法说明",
    langLabel: "切换到英文",
    langShort: "EN",
    chamberLabel: "测试舱",
    chapter_ch1: "第一卷 · 单对虫洞",
    chapter_ch2: "第二卷 · 方向扭曲",
    chapter_ch3: "第三卷 · 双色交织",
    chapter_ch4: "第四卷 · 隔空换位",
    chapter_ch5: "第五卷 · 莫比乌斯环",
    tag_ch1: "CHAMBER 01 · SINGLE WORMHOLE",
    tag_ch2: "CHAMBER 05 · VECTOR TWIST",
    tag_ch3: "CHAMBER 09 · DUAL CONJUGATION",
    tag_ch4: "CHAMBER 13 · TRANSLOCATION VAULT",
    tag_ch5: "CHAMBER 17 · MOBIUS INFINITY",
    levelName: "第 {0} 关",
    levelStars: "{0} 星",
    levelOptimal: "最佳 {0} 步",
    stepsLabel: "步数",
    bestStepsLabel: "最少步数",
    coresLabel: "能量核心",
    scoreLabel: "得分",
    bestLabel: "最高",
    undo: "撤销",
    reset: "重置",
    levels: "选关",
    close: "关闭",
    next: "下一关",
    again: "再来一次",
    levelsTitle: "测试舱档案",
    levelsTotal: "已得 {0} / {1} 星",
    portalTitle: "传送门网络",
    pairA: "蓝 ⇄ 橙",
    pairB: "紫 ⇄ 绿",
    pairActive: "连通",
    pairIdle: "未部署",
    portalHint: "走入光圈即穿越；推箱入门只送走箱子",
    hintMove: "方向键 / WASD 移动与推箱",
    hintUndo: "Z 或下方撤销键无限回退",
    hintReset: "R 秒级复位当前测试舱",
    saved: "星评与最少步数保存在本机浏览器，可离线游玩。",
    resultClear: "测试完成",
    resultSteps: "实际步数",
    resultOptimal: "官方最优",
    resultScore: "本关得分",
    resultBest: "历史最佳",
    resultNewRecord: "新纪录",
    resultStars: "星评",
    helpTitle: "玩法说明",
    helpBody:
      "1. 方向键 / WASD 或十字键移动；朝箱子走会把它向前推一格，不能拉箱。\n2. 走入墙上的传送门会从同色配对门穿出，朝向按配对门的墙面自动扭转。\n3. 把箱子推向传送门时，箱子会穿门，人留在原地；这样可以把箱子送进上锁的密室。\n4. 若配对门正前方被箱子或墙壁挡住，入口门会硬化，本次移动无效。\n5. 把所有能量箱推进绿色核心槽即可通关；Z 无限撤销，R 重置。\n6. 三星需要在官方最优步数 +3 步内完成。",
    helpKeys: "快捷键：方向键 / WASD 移动 · Z 撤销 · R 重置 · Esc 关闭弹层",
    helpPortals: "蓝门与橙门互通，紫门与绿门互通；两套网络互不干扰。",
    helpUndo: "随时撤销不会扣分，放心试错。",
    statusReady: "规划路线，把能量箱送进核心槽",
    statusPortal: "空间折叠！",
    statusBlocked: "出口受阻，门体硬化",
    statusSolved: "全部能量核心归位",
    undoToast: "已撤销一步",
    resetToast: "测试舱已复位",
    clearToast: "测试完成！",
    coreToast: "核心归位",
    blockedToast: "出口被挡住",
    noscript: "需要启用 JavaScript 才能游玩传送门推箱。",
    boardAria: "传送门推箱测试舱",
    ariaHud: "拓扑仪表",
    ariaCanvas: "传送门推箱游戏画面：方向键移动推箱，传送门折叠空间",
    ariaLevels: "测试舱选关",
    ariaResult: "测试结算",
    dpadLabel: "方向十字键",
    portalBlue: "蓝门",
    portalOrange: "橙门",
    portalPurple: "紫门",
    portalGreen: "绿门",
  },
  en: {
    docTitle: "Portal Box · DOIN games",
    metaDesc: "Push energy crates through blue-orange and purple-green portals in an Aperture-style lab, folding space to drop every core into its green socket. 20 non-Euclidean puzzles with BFS-proven optimal steps, unlimited undo and instant ad-free play.",
    title: "Portal Box",
    subtitle: "Aperture Science · Spatial Folding Chamber",
    backHome: "Home",
    soundOn: "Sound on",
    soundOff: "Sound off",
    ariaSound: "Toggle sound",
    ariaLang: "Switch language",
    ariaHelp: "How to play",
    langLabel: "切换到中文",
    langShort: "中文",
    chamberLabel: "Chamber",
    chapter_ch1: "Volume 1 · Single Wormhole",
    chapter_ch2: "Volume 2 · Vector Twist",
    chapter_ch3: "Volume 3 · Dual Conjugation",
    chapter_ch4: "Volume 4 · Translocation Vault",
    chapter_ch5: "Volume 5 · Mobius Infinity",
    tag_ch1: "CHAMBER 01 · SINGLE WORMHOLE",
    tag_ch2: "CHAMBER 05 · VECTOR TWIST",
    tag_ch3: "CHAMBER 09 · DUAL CONJUGATION",
    tag_ch4: "CHAMBER 13 · TRANSLOCATION VAULT",
    tag_ch5: "CHAMBER 17 · MOBIUS INFINITY",
    levelName: "Stage {0}",
    levelStars: "{0} stars",
    levelOptimal: "Best {0} steps",
    stepsLabel: "Steps",
    bestStepsLabel: "Best",
    coresLabel: "Cores",
    scoreLabel: "Score",
    bestLabel: "High",
    undo: "Undo",
    reset: "Reset",
    levels: "Levels",
    close: "Close",
    next: "Next stage",
    again: "Try again",
    levelsTitle: "Chamber archive",
    levelsTotal: "{0} / {1} stars earned",
    portalTitle: "Portal network",
    pairA: "Blue ⇄ Orange",
    pairB: "Purple ⇄ Green",
    pairActive: "Linked",
    pairIdle: "Offline",
    portalHint: "Step into the ring to travel; push a crate in and only the crate travels",
    hintMove: "Arrows / WASD to move and push",
    hintUndo: "Z or the Undo key rewinds without limit",
    hintReset: "R instantly resets the chamber",
    saved: "Stars and best step counts are saved in your browser. Works offline.",
    resultClear: "Test complete",
    resultSteps: "Steps taken",
    resultOptimal: "Official best",
    resultScore: "Stage score",
    resultBest: "Personal best",
    resultNewRecord: "New record",
    resultStars: "Stars",
    helpTitle: "How to play",
    helpBody:
      "1. Move with the arrow keys / WASD or the on-screen pad. Walking into a crate pushes it one cell; you cannot pull.\n2. Walking into a wall portal sends you out of its colour partner, with your facing direction rotated by the partner wall.\n3. Pushing a crate into a portal sends only the crate through; you stay put. Use this to deliver crates into sealed vaults.\n4. If the partner portal's cell is blocked by a crate or wall, the entrance hardens and the move is refused.\n5. Push every energy crate into a green core socket to finish. Z rewinds without limit; R resets.\n6. Three stars require finishing within the official best + 3 steps.",
    helpKeys: "Keys: arrows / WASD move · Z undo · R reset · Esc closes overlays",
    helpPortals: "Blue links to Orange; Purple links to Green. The two networks never mix.",
    helpUndo: "Undo never costs points, so experiment freely.",
    statusReady: "Plan the route and deliver every core",
    statusPortal: "Spatial fold!",
    statusBlocked: "Exit blocked, portal hardened",
    statusSolved: "All energy cores seated",
    undoToast: "Step undone",
    resetToast: "Chamber reset",
    clearToast: "Test complete!",
    coreToast: "Core seated",
    blockedToast: "Exit blocked",
    noscript: "JavaScript is required to play Portal Box.",
    boardAria: "Portal Box test chamber",
    ariaHud: "Topology dashboard",
    ariaCanvas: "Portal Box game view: move, push crates and fold space through portals",
    ariaLevels: "Chamber selection",
    ariaResult: "Test result",
    dpadLabel: "Direction pad",
    portalBlue: "Blue portal",
    portalOrange: "Orange portal",
    portalPurple: "Purple portal",
    portalGreen: "Green portal",
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
