// i18n.mjs: 跳一跳全站共享语言偏好 doin.lang（zh/en 键值严格对齐、非空）

export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";
export const LOCALES = ["zh", "en"];

const DICT = {
  zh: {
    docTitle: "跳一跳 · DOIN 在线小游戏",
    metaDesc:
      "跳一跳：按住蓄力、松手起跳，划出抛物线落向下一座浮岛。正中靶心触发连击暴击，跳床腾空、黑胶打碟、漂移浮岛与极窄薄块轮番登场。旅途关卡 25 关 + 经典无尽跳 + 靶心试炼三模式。",
    appTitle: "跳一跳",
    appSubtitle: "微缩软胶跳台",
    back: "返回门户",
    sound: "音效开关",
    soundOn: "音效已开",
    soundOff: "音效已关",
    langSwitch: "EN",
    help: "玩法说明",
    stageAria: "跳一跳微缩机台舞台",
    canvasAria: "等轴测微缩跳台：棋子在各浮岛平台间蓄力跳跃",

    modeOdyssey: "旅途关卡",
    modeEndless: "经典无尽跳",
    modeSniper: "靶心试炼",
    modeAria: "选择玩法模式",

    hudScore: "得分",
    hudCombo: "靶心连击",
    hudBest: "最高分",
    hudLongest: "最远一跳",
    hudStage: "关卡",
    hudAccuracy: "靶心率",
    hudStars: "累计星星",
    hudLevelValue: "第 {n} 关",
    hudDistanceUnit: "{n} 米",
    hudComboValue: "×{n}",
    hudRank: "精准评级",
    hudShot: "第 {n} / {total} 靶",

    gaugeTitle: "蓄力仪表",
    gaugeHint: "长按蓄力 · 松手起跳",
    nextTitle: "下一平台",
    keyHint: "【空格】或鼠标长按蓄力，松手起跳",
    touchHint: "按住屏幕任意处蓄力，松手起跳",

    platStart: "起跳台",
    platPlain: "基础台",
    platTrampoline: "弹性跳床",
    platVinyl: "旋转黑胶",
    platMoving: "漂移浮岛",
    platThin: "极窄薄块",
    platGoal: "终点旗台",

    landPerfect: "正中靶心！+{n}",
    landSafe: "安全着陆 +{n}",
    landWobble: "险些滑落… +{n}",
    landMiss: "失足坠落！",
    landTrampoline: "跳床腾空！+{n}",
    vinylToast: "🎵 黑胶打碟 +{n}",
    comboToast: "{n} 连靶心！",

    levelsTitle: "选择关卡",
    levelsLocked: "通关前一关解锁",
    levelsAria: "关卡选择",
    chapter1: "新手木阶",
    chapter2: "弹簧乐园",
    chapter3: "漂移浮岛",
    chapter4: "微缩都市",
    chapter5: "云端挑战",
    chapterLabel: "第 {n} 章",
    levelLabel: "第 {n} 关",
    starCount: "{n} / 3 星",

    readyKicker: "JUMP JUMP",
    readyTitle: "跳一跳",
    readyDesc:
      "按住蓄力，松手让软胶小人划出抛物线跳向下一座浮岛。正中平台靶心触发递增连击（+2、+4、+6、+8…）；跳床带你跨越超远深渊，黑胶台停留片刻还有打碟彩蛋。",
    btnStart: "开始跳跃",
    btnResume: "继续本关",
    btnLevels: "选择关卡",

    resultWinTitle: "抵达终点旗台！",
    resultLoseTitle: "跌落虚空…",
    resultEndlessTitle: "本局结算",
    resultSniperTitle: "靶心试炼成绩",
    resultScore: "最终得分",
    resultStars: "本关星级",
    resultCombo: "最长连击",
    resultAccuracy: "靶心率",
    resultJumps: "跳跃次数",
    resultLongest: "最远一跳",
    resultRank: "精准评级",
    newBest: "🏆 新纪录！",
    starHint1: "★ 通关",
    starHint2: "★★ 靶心率 ≥ 60%",
    starHint3: "★★★ 3 连靶心或零摇晃",
    btnRetry: "再挑战一次",
    btnNext: "下一关",
    btnAgain: "再来一局",
    btnBackLevels: "返回关卡",

    rankS: "毫米大师",
    rankA: "巡航制导",
    rankB: "预判神射手",
    rankC: "见习投手",
    sniperPerfect: "正中 100",
    sniperMiss: "脱靶",

    helpTitle: "玩法说明",
    help1: "1. 按住空格键 / 鼠标左键 / 屏幕任意处开始蓄力，小棋子会被压扁、蓄力音阶不断爬升；松手即起跳。",
    help2: "2. 蓄力时间越长跳得越远（严格线性）。落点在平台中心 25% 半径内即「正中靶心」，触发连击暴击（+2、+4、+6、+8…）。",
    help3: "3. 落点偏出平台即失足坠落，本局结束；贴边落地会先滑稽摇晃再站稳。",
    help4: "4. 弹性跳床：落上后自动二次腾空，跨越超远深渊直达下一平台。",
    help5: "5. 旋转黑胶：在台上静止 1.5 秒触发打碟彩蛋，额外 +5 分。",
    help6: "6. 漂移浮岛会沿跳跃方向来回漂移，出手时机与距离都要预判；极窄薄块接触面积减半，高风险高回报。",
    helpClose: "我知道了",
    toastModeLocked: "本局进行中，结算后方可切换模式",
  },
  en: {
    docTitle: "Jump Jump · DOIN Web Games",
    metaDesc:
      "Jump Jump: hold to charge, release to leap along a parabola onto the next floating island. Bullseye the center for escalating combos, and master trampolines, vinyl decks, drifting isles and razor-thin blocks across 25 odyssey stages, classic endless and a sniper range.",
    appTitle: "Jump Jump",
    appSubtitle: "Miniature Clay Stage",
    back: "Portal",
    sound: "Sound toggle",
    soundOn: "Sound on",
    soundOff: "Sound off",
    langSwitch: "中文",
    help: "How to Play",
    stageAria: "Jump Jump miniature arcade stage",
    canvasAria: "Isometric diorama where the pawn charges and hops between floating platforms",

    modeOdyssey: "Odyssey",
    modeEndless: "Endless",
    modeSniper: "Sniper Range",
    modeAria: "Select game mode",

    hudScore: "Score",
    hudCombo: "Bullseye Combo",
    hudBest: "Best",
    hudLongest: "Longest Hop",
    hudStage: "Stage",
    hudAccuracy: "Accuracy",
    hudStars: "Stars",
    hudLevelValue: "Stage {n}",
    hudDistanceUnit: "{n} m",
    hudComboValue: "×{n}",
    hudRank: "Precision",
    hudShot: "Shot {n} / {total}",

    gaugeTitle: "Charge Gauge",
    gaugeHint: "Hold to charge · release to leap",
    nextTitle: "Next Platform",
    keyHint: "Hold [Space] or left mouse button, release to jump",
    touchHint: "Hold anywhere on screen to charge, release to jump",

    platStart: "Start Pad",
    platPlain: "Basic Block",
    platTrampoline: "Trampoline",
    platVinyl: "Vinyl Deck",
    platMoving: "Drifting Isle",
    platThin: "Thin Domino",
    platGoal: "Goal Flag",

    landPerfect: "Bullseye! +{n}",
    landSafe: "Safe landing +{n}",
    landWobble: "Barely held on… +{n}",
    landMiss: "Fell into the void!",
    landTrampoline: "Trampoline boost! +{n}",
    vinylToast: "🎵 Vinyl spin +{n}",
    comboToast: "{n} bullseye streak!",

    levelsTitle: "Select Stage",
    levelsLocked: "Clear the previous stage to unlock",
    levelsAria: "Stage select",
    chapter1: "Timber Steps",
    chapter2: "Spring Park",
    chapter3: "Drifting Isles",
    chapter4: "Mini Metropolis",
    chapter5: "Cloud Heights",
    chapterLabel: "Chapter {n}",
    levelLabel: "Stage {n}",
    starCount: "{n} / 3 stars",

    readyKicker: "JUMP JUMP",
    readyTitle: "Jump Jump",
    readyDesc:
      "Hold to charge, release to send the clay pawn flying onto the next floating island. Land inside the center 25% for a bullseye and escalating combos (+2, +4, +6, +8…). Trampolines hurl you across unjumpable chasms, and vinyl decks pay a bonus if you linger.",
    btnStart: "Start Jumping",
    btnResume: "Resume",
    btnLevels: "Select Stage",

    resultWinTitle: "Goal Flag Reached!",
    resultLoseTitle: "Lost to the Void…",
    resultEndlessTitle: "Round Summary",
    resultSniperTitle: "Sniper Range Result",
    resultScore: "Final Score",
    resultStars: "Stars Earned",
    resultCombo: "Longest Streak",
    resultAccuracy: "Accuracy",
    resultJumps: "Jumps",
    resultLongest: "Longest Hop",
    resultRank: "Precision",
    newBest: "🏆 New Record!",
    starHint1: "★ Clear the stage",
    starHint2: "★★ Bullseye rate ≥ 60%",
    starHint3: "★★★ 3-bullseye streak or zero wobbles",
    btnRetry: "Retry Stage",
    btnNext: "Next Stage",
    btnAgain: "Play Again",
    btnBackLevels: "Back to Stages",

    rankS: "Millimetre Master",
    rankA: "Cruise Guidance",
    rankB: "Sharpshooter",
    rankC: "Rookie Tosser",
    sniperPerfect: "Bullseye 100",
    sniperMiss: "Missed",

    helpTitle: "How to Play",
    help1: "1. Hold Space / left mouse button / anywhere on screen to charge. The pawn squashes down while the charge tone climbs; release to leap.",
    help2: "2. Longer charge means a longer jump (strictly linear). Landing within the center 25% is a bullseye, triggering escalating combos (+2, +4, +6, +8…).",
    help3: "3. Landing outside the platform means falling into the void and ending the run. Landing right on the rim makes the pawn wobble before steadying.",
    help4: "4. Trampoline: landing on it triggers an automatic second launch that carries you across an unjumpable chasm.",
    help5: "5. Vinyl Deck: stand still for 1.5s to trigger a spin bonus worth +5 points.",
    help6: "6. Drifting Isles slide back and forth along your jump line — time your release. Thin Dominoes halve the landing area for high risk and high reward.",
    helpClose: "Got It",
    toastModeLocked: "Round in progress — switch mode after it ends",
  },
};

export function isLocale(locale) {
  return typeof locale === "string" && LOCALES.includes(locale);
}

export function strings(locale) {
  return DICT[isLocale(locale) ? locale : DEFAULT_LOCALE];
}

export function detectLocale() {
  try {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem(LANG_KEY);
      if (isLocale(saved)) return saved;
    }
  } catch {
    // 存储不可用则走浏览器语言
  }
  try {
    if (typeof navigator !== "undefined" && navigator.language) {
      return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
    }
  } catch {
    // 降级
  }
  return DEFAULT_LOCALE;
}

export function loadLocale() {
  return detectLocale();
}

export function saveLocale(locale) {
  if (!isLocale(locale)) return;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(LANG_KEY, locale);
    }
  } catch {
    // 写入异常静默
  }
}

export function htmlLang(locale) {
  return isLocale(locale) && locale === "en" ? "en" : "zh-CN";
}

export function format(str, params) {
  if (typeof str !== "string") return "";
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match
  );
}
