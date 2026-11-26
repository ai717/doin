// 割绳子国际化模块：统一读写全站共享偏好 localStorage["doin.lang"]
// 中英双表严格对齐非空，严禁使用私有语言 key

const SHARED_LANG_KEY = "doin.lang";
let memLangFallback = "zh";

export const DICTS = {
  zh: {
    gameTitle: "割绳子",
    subtitle: "微缩纸盒玩具工坊",
    backHome: "返回门户",
    soundToggle: "声音开关",
    langSwitch: "English",
    helpTitle: "物理法则与玩法说明",
    helpBtn: "规则说明",
    levelSelect: "选关",
    restart: "重试",
    chapter: "章节",
    level: "关卡",
    stars: "收集之星",
    modeOdyssey: "纸盒奇遇",
    modeMaster: "一刀大师",
    cutsRemaining: "剩余刀数",
    unlimitedCuts: "无限制",
    victoryTitle: "喂饱萌宠！",
    victorySub: "Nommy 幸福地吧唧嘴，糖果太甜啦！",
    nextLevel: "下一关",
    replay: "再玩一次",
    levelList: "关卡列表",
    locked: "未解锁",
    starCount: "总星数",
    rulesTitle: "《割绳子》怎么玩？",
    rule1: "【利刃割绳】：用鼠标或手指划过绳索，精准切断张力，让糖果摆动飞出。",
    rule2: "【浮空气泡】：糖果落入气泡会反重力上升，轻点气泡即可戳破恢复下落。",
    rule3: "【吹气皮囊】：点击皮囊向喷口喷射强风，推动晃动中的糖果或气泡偏转航向。",
    rule4: "【避开尖刺】：绝对不能让糖果触碰尖刺，否则糖果会瞬间碎裂！",
    rule5: "【一刀大师】：特殊残局挑战中，你只能划出一刀，靠精密物理连锁三星喂食！",
    ruleShortcut: "【快捷键】：按【R】秒速重开，按【Space】打开选关抽屉。",
    close: "我知道了",
    failTitle: "挑战失败",
    failRetry: "↺ 重试本关",
    failHint: "点击任意处或按 [R] 立即重试",
    failSpike: "小心尖刺！糖果碎裂了！",
    failOutOfBounds: "糖果飞出纸盒啦！",
    failTimeout: "一刀大师：刀数耗尽且糖果静止！",
    failGeneric: "差一点点！调整切绳时机",
    docTitle: "割绳子 · DOIN 在线小游戏",
    metaDesc: "割绳子 (Cut the Rope)：指尖或鼠标划断绳索，利用重力摆动、浮空气泡与吹气皮囊，收集三星喂饱呆萌小怪兽！40 关确定性精美关卡。",
    labelChapter: "当前章节",
    labelLevel: "关卡",
    labelStars: "本关收集",
    labelTotalStars: "总星数",
    labelHint: "关卡秘诀",
    labelShortcuts: "快捷键指引",
    valShortcuts: "[R] 秒速重开<br>[Space] 选关抽屉",
    modalLevelsTitle: "关卡选择",
    closeLevels: "关闭",
    soundTitle: "声音开关",
    langTitle: "切换语言",
    levelsTitle: "关卡列表",
    restartTitle: "重试本关",
    helpModalTitle: "玩法规则",
    arenaAria: "微缩瓦楞纸盒：划断绳索喂饱小怪兽",
    canvasAria: "割绳子游戏画布"
  },
  en: {
    gameTitle: "Cut the Rope",
    subtitle: "Cardboard Toy Workshop",
    backHome: "Back to Hub",
    soundToggle: "Toggle Sound",
    langSwitch: "中文",
    helpTitle: "Physics & Rules Guide",
    helpBtn: "How to Play",
    levelSelect: "Levels",
    restart: "Reset",
    chapter: "Chapter",
    level: "Level",
    stars: "Stars",
    modeOdyssey: "Cardboard Odyssey",
    modeMaster: "One-Cut Master",
    cutsRemaining: "Cuts Left",
    unlimitedCuts: "Unlimited",
    victoryTitle: "Nommy is Full!",
    victorySub: "Nommy happily munches on the delicious candy!",
    nextLevel: "Next Stage",
    replay: "Play Again",
    levelList: "Level Select",
    locked: "Locked",
    starCount: "Total Stars",
    rulesTitle: "How to Play Cut the Rope",
    rule1: "[Slice Rope]: Drag mouse or swipe across ropes to cut tension and let candy swing free.",
    rule2: "[Bubble Lift]: Candy inside a bubble floats upward. Tap bubble to pop it anytime.",
    rule3: "[Air Bellows]: Tap bellows to puff a gust of wind, steering candy or floating bubbles.",
    rule4: "[Avoid Spikes]: Candy instantly shatters upon hitting deadly spikes!",
    rule5: "[One-Cut Master]: Special puzzles allow ONLY ONE cut! Chain physics for 3 stars!",
    ruleShortcut: "[Shortcuts]: Press [R] to instant reset, [Space] to toggle level drawer.",
    close: "Got It",
    failTitle: "Level Failed",
    failRetry: "↺ Try Again",
    failHint: "Tap anywhere or press [R] to retry",
    failSpike: "Watch out for spikes! Candy shattered!",
    failOutOfBounds: "Candy flew out of the arena!",
    failTimeout: "One-Cut Master: Out of cuts & candy stopped!",
    failGeneric: "Almost! Adjust your cut timing",
    docTitle: "Cut the Rope · DOIN Web Games",
    metaDesc: "Cut the Rope: Swipe to slice ropes, swing on physics, float in bubbles and blow air gusts to gather 3 stars and feed hungry Nommy! 40 deterministic puzzles.",
    labelChapter: "Chapter",
    labelLevel: "Stage",
    labelStars: "Stage Stars",
    labelTotalStars: "Total Stars",
    labelHint: "Stage Hint",
    labelShortcuts: "Shortcuts",
    valShortcuts: "[R] Quick Reset<br>[Space] Level Select",
    modalLevelsTitle: "Level Select",
    closeLevels: "Close",
    soundTitle: "Sound Toggle",
    langTitle: "Switch Language",
    levelsTitle: "Level Select",
    restartTitle: "Restart Level",
    helpModalTitle: "How to Play",
    arenaAria: "Cardboard Arena: Cut ropes to feed hungry monster",
    canvasAria: "Cut the Rope Game Canvas"
  }
};

export function getLang() {
  try {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem(SHARED_LANG_KEY);
      if (saved === "en" || saved === "zh") return saved;
    }
  } catch (err) {
    // 静默降级
  }
  return memLangFallback || "zh";
}

export function setLang(lang) {
  const target = lang === "en" ? "en" : "zh";
  memLangFallback = target;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(SHARED_LANG_KEY, target);
    }
  } catch (err) {
    // 静默降级
  }
  return target;
}

export function t(key, lang = getLang()) {
  const dict = DICTS[lang] || DICTS.zh;
  return dict[key] ?? DICTS.zh[key] ?? key;
}
