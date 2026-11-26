// 中英双语表 + 全站共享语言偏好 doin.lang。切换只做原地热更新，绝不重置魔方状态。

export const LOCALES = Object.freeze(["zh", "en"]);
export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";

const STRINGS = {
  zh: {
    docTitle: "魔方工坊 · DOIN 在线小游戏",
    metaDesc: "在暗调极客工坊里丝滑转动三维魔方：2×2 口袋速拧、3×3 经典竞速与 19 关魔方学院残局。拖动贴片转层、WCA 计时、一步提示与每日同题，零广告即开即玩。",
    title: "魔方工坊",
    subtitle: "磁吸速拧 · 三维空间工作台",
    backHome: "返回门户",
    mode2: "2×2",
    mode3: "3×3",
    academy: "学院",
    levels: "选关",
    hint: "提示",
    scramble: "打乱",
    reset: "重置",
    undo: "撤销",
    close: "关闭",
    next: "下一关",
    again: "再来一次",
    timerLabel: "计时",
    movesLabel: "步数",
    tpsLabel: "TPS",
    pbLabel: "最佳",
    ao5Label: "Ao5",
    readyHint: "滑动魔方开始",
    runningHint: "计时中",
    solvedHint: "复原完成",
    pausedHint: "计时已暂停",
    dragHint: "拖动贴片转层 · 拖动空白转视角",
    keyboardHint: "U/D/L/R/F/B 转层 · Shift 逆时针 · Z 撤销 · Esc 收起弹层",
    scrambleLabel: "打乱公式",
    scrambleEmpty: "点击「打乱」生成新公式",
    dailyTag: "每日同题",
    dailyHint: "今日同题 · 种子 {0}",
    dailyDone: "今日已通关 {0}",
    resultTitle: "复原完成",
    resultTime: "用时",
    resultMoves: "步数",
    resultTps: "TPS",
    resultScore: "得分",
    resultNewRecord: "新纪录",
    resultBest: "个人最佳",
    resultStars: "星评",
    resultLevel: "第 {0} 关",
    levelsTitle: "选择玩法",
    levelsFree: "自由练习",
    levelsAcademy: "魔方学院",
    levelsTotal: "学院星评 {0} / 57",
    levelCard: "第 {0} 关",
    levelMeta: "打乱 {0} 步 · 参考 {1} 步内",
    levelCleared: "已通关",
    chapter1: "第一章 · 白十字起手",
    chapter2: "第二章 · 底角归位",
    chapter3: "第三章 · 中层腰带",
    chapter4: "第四章 · 顶面黄光",
    chapter5: "第五章 · 六面归一",
    goal1: "练习白十字棱块归位",
    goal2: "补齐底层四角，完成第一层",
    goal3: "把中层四条棱送回腰带",
    goal4: "顶面拼出黄色十字与同色面",
    goal5: "顶角顶棱全部归位",
    tip1: "口诀：R U R' U'　先找白色棱块，再对准中心色。",
    tip2: "口诀：R U R'　角块转到目标位正下方，再重复右手公式。",
    tip3: "口诀：U R U' R' U' F' U F　棱块对准后从中层缺口送入。",
    tip4: "口诀：F R U R' U' F'　顶面只剩两角时用小鱼公式。",
    tip5: "口诀：R U' R' U' R U R' F' R U R' U' R' F R　顶层归位收尾。",
    academyBanner: "魔方学院 · 19 关残局阶梯",
    academyGoalLabel: "目标",
    helpTitle: "玩法说明",
    helpBody: "1. 在魔方贴片上按住并滑动，对应层会跟随手指转动，松手自动磁吸到 90°。\n2. 在魔方外空白处拖动可以旋转观察视角；右键或 Alt + 左键始终旋转视角。\n3. 桌面端可用 U/D/L/R/F/B 键转层，按住 Shift 为逆时针；Z 撤销，Esc 关闭弹层。\n4. 第一下转动自动开始计时，六面归位瞬间停表；切到后台或打开弹层会自动暂停计时。\n5. 2×2 口袋魔方适合 1 分钟破冰；3×3 每日同题使用日期种子，全球同一套打乱。\n6. 「提示」给出当前局面的一步推荐；「重置」回到本局打乱，成绩保存在本机。",
    helpKeys: "快捷键：U/D/L/R/F/B 转层 · Shift 逆时针 · Z 撤销 · Esc 关闭弹层",
    helpDrag: "拖动贴片转层，拖动空白转视角；中层也可以转。",
    helpTimer: "计时会在切后台、打开选关或说明时自动暂停。",
    helpSaved: "成绩与学院星评保存在本机浏览器，可离线游玩。",
    saved: "成绩保存在本机浏览器，可离线游玩。",
    seedLabel: "种子 {0}",
    hashLabel: "打乱 {0} 步",
    tag2: "2×2 POCKET CUBE",
    tag3: "3×3 CLASSIC CUBE",
    tagDaily: "3×3 DAILY SEED",
    tagAcademy: "ACADEMY · STAGE {0}",
    statusScramble: "已生成新打乱",
    statusReset: "已回到本局打乱",
    statusUndo: "已撤销一步",
    statusHint: "推荐：{0}",
    statusHintSolved: "已经复原，无需提示",
    statusHintEmpty: "先转动魔方再求提示",
    statusSolvedToast: "六面归位！",
    statusNoUndo: "暂无可撤销的转动",
    statusLocked: "动画未结束",
    soundOn: "音效开",
    soundOff: "音效关",
    ariaSound: "音效开关",
    ariaLang: "切换语言",
    ariaHelp: "玩法说明",
    ariaLevels: "选择玩法与关卡",
    ariaCanvas: "三维魔方舞台：拖动贴片转层，拖动空白旋转视角",
    modeAria: "切换魔方阶数",
    langLabel: "切换到英文",
    langShort: "EN",
    noscript: "需要启用 JavaScript 才能游玩魔方工坊。",
    resultClose: "继续观察",
  },
  en: {
    docTitle: "Cube Workshop · DOIN games",
    metaDesc: "Twist a true 3D cube in a dark geek workshop: 2x2 pocket speedsolve, 3x3 classic racing and a 19-stage academy ladder. Drag stickers to turn layers, WCA timer, one-tap hint and a daily seeded scramble. Instant ad-free play.",
    title: "Cube Workshop",
    subtitle: "Magnetic speedsolve · 3D bench",
    backHome: "Home",
    mode2: "2×2",
    mode3: "3×3",
    academy: "Academy",
    levels: "Levels",
    hint: "Hint",
    scramble: "Scramble",
    reset: "Reset",
    undo: "Undo",
    close: "Close",
    next: "Next stage",
    again: "Again",
    timerLabel: "Timer",
    movesLabel: "Moves",
    tpsLabel: "TPS",
    pbLabel: "Best",
    ao5Label: "Ao5",
    readyHint: "Drag the cube to start",
    runningHint: "Solving",
    solvedHint: "Solved",
    pausedHint: "Timer paused",
    dragHint: "Drag a sticker to turn a layer · drag empty space to orbit",
    keyboardHint: "U/D/L/R/F/B turn layers · Shift reverses · Z undo · Esc closes overlays",
    scrambleLabel: "Scramble",
    scrambleEmpty: "Press Scramble to generate one",
    dailyTag: "Daily",
    dailyHint: "Daily scramble · seed {0}",
    dailyDone: "Today cleared in {0}",
    resultTitle: "Cube solved",
    resultTime: "Time",
    resultMoves: "Moves",
    resultTps: "TPS",
    resultScore: "Score",
    resultNewRecord: "New record",
    resultBest: "Personal best",
    resultStars: "Stars",
    resultLevel: "Stage {0}",
    levelsTitle: "Choose a mode",
    levelsFree: "Free solve",
    levelsAcademy: "Cube academy",
    levelsTotal: "Academy stars {0} / 57",
    levelCard: "Stage {0}",
    levelMeta: "Scramble {0} · par {1}",
    levelCleared: "Cleared",
    chapter1: "Chapter 1 · White cross",
    chapter2: "Chapter 2 · First-layer corners",
    chapter3: "Chapter 3 · Middle belt",
    chapter4: "Chapter 4 · Yellow top",
    chapter5: "Chapter 5 · Six faces home",
    goal1: "Train white cross edge placement",
    goal2: "Seat the four bottom corners",
    goal3: "Send the four middle edges home",
    goal4: "Build the yellow cross and face",
    goal5: "Permute the last corners and edges",
    tip1: "Sequence: R U R' U' — find a white edge, then match its side colour.",
    tip2: "Sequence: R U R' — park the corner under its slot, repeat the right-hand trigger.",
    tip3: "Sequence: U R U' R' U' F' U F — align the edge, then slot it from the gap.",
    tip4: "Sequence: F R U R' U' F' — with two top corners left, use the fish pattern.",
    tip5: "Sequence: R U' R' U' R U R' F' R U R' U' R' F R — finish the last layer.",
    academyBanner: "Cube academy · 19-stage ladder",
    academyGoalLabel: "Goal",
    helpTitle: "How to play",
    helpBody: "1. Press and drag across a sticker: its layer follows your finger and snaps to 90° on release.\n2. Drag empty space outside the cube to orbit; right-drag or Alt + drag always orbits.\n3. Desktop keys U/D/L/R/F/B turn layers, hold Shift for counter-clockwise. Z undoes, Esc closes overlays.\n4. The timer starts on your first turn and stops the instant all six faces are solid. Switching tabs or opening overlays pauses it.\n5. The 2x2 pocket cube is a one-minute entry; the 3x3 daily scramble is seeded by today's date so everyone shares it.\n6. Hint suggests one move for the current position. Reset returns to this scramble; results are saved on this device.",
    helpKeys: "Keys: U/D/L/R/F/B turn · Shift reverse · Z undo · Esc close",
    helpDrag: "Drag a sticker to turn a layer, drag empty space to orbit. Middle slices turn too.",
    helpTimer: "The timer auto-pauses when you switch tabs or open the level or help overlay.",
    helpSaved: "Results and academy stars are stored in your browser. Works offline.",
    saved: "Results are stored in your browser. Works offline.",
    seedLabel: "Seed {0}",
    hashLabel: "Scramble {0}",
    tag2: "2×2 POCKET CUBE",
    tag3: "3×3 CLASSIC CUBE",
    tagDaily: "3×3 DAILY SEED",
    tagAcademy: "ACADEMY · STAGE {0}",
    statusScramble: "New scramble ready",
    statusReset: "Back to this scramble",
    statusUndo: "Move undone",
    statusHint: "Suggested: {0}",
    statusHintSolved: "Already solved, no hint needed",
    statusHintEmpty: "Turn the cube before asking for a hint",
    statusSolvedToast: "Six faces home!",
    statusNoUndo: "Nothing to undo yet",
    statusLocked: "Animation in progress",
    soundOn: "Sound on",
    soundOff: "Sound off",
    ariaSound: "Toggle sound",
    ariaLang: "Switch language",
    ariaHelp: "How to play",
    ariaLevels: "Choose mode and stage",
    ariaCanvas: "3D cube stage: drag stickers to turn layers, drag empty space to orbit",
    modeAria: "Switch cube size",
    langLabel: "切换到中文",
    langShort: "中文",
    noscript: "JavaScript is required to play Cube Workshop.",
    resultClose: "Keep looking",
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
