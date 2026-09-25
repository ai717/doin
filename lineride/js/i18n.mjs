// i18n：中英双语字符串表 + 统一语言检测。
// 全站共享偏好 key：localStorage["doin.lang"]（首页与所有子游戏读写同一个）。

export const LOCALES = Object.freeze(["zh", "en"]);
export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";

const STRINGS = {
  zh: {
    docTitle: "线之骑士 · DOIN 在线小游戏",
    metaDesc: "拿起蜡笔画出轨道，看雪橇小人在你画的山谷与回环上飞驰——每一笔都是自己的过山车。自由画布创意无限，拼图挑战 50 关解谜。",
    title: "线之骑士",
    subtitle: "Line Ride",
    backHome: "← 门户",
    soundOn: "音效: 开",
    soundOff: "音效: 关",
    langLabel: "English",
    langShort: "EN",
    ariaLang: "切换语言",
    ariaSound: "切换音效",
    helpTitle: "玩法说明",
    helpText: "选择画笔，在画布上拖动鼠标画出轨道线。点击播放按钮，看小人沿着轨道滑行！四种线型：普通（蓝）、加速（橙）、减速（绿）、布景（白，仅装饰）。空格键播放/暂停，Ctrl+Z 撤销，滚轮缩放。",
    modeFreestyle: "自由画布",
    modePuzzle: "拼图挑战",
    brushLabel: "画笔:",
    puzzleLevel: "第 {0} 关",
    puzzleStars: "⭐ {0}/3",
    inkLeft: "墨水: {0}",
    exportLabel: "导出",
    importLabel: "导入",
    clearLabel: "清空",
    resetLabel: "重置小人",
    undoLabel: "撤销",
    lineNormal: "普通",
    lineBoost: "加速",
    lineSlow: "减速",
    lineScenery: "布景",
    copySuccess: "已复制到剪贴板",
    importSuccess: "导入成功",
    importError: "导入失败：格式不正确",
    puzzleComplete: "通关！",
    puzzleStarsEarned: "获得 {0} 颗星",
    allClear: "画布已清空",
    noscript: "需要启用 JavaScript 才能游玩线之骑士。",
    tipPlay: "点击播放或按空格键开始",
    tipDraw: "拖动画笔开始创作",
    tipPuzzle: "补全轨道让小人安全到达终点",
    saveCanvas: "保存画布",
    loadCanvas: "读取画布",
    canvasSlot: "画布 {0}",
    emptySlot: "空",
    confirmClear: "确认清空画布吗？",
    chapter: "第 {0} 章",
    inkOut: "墨水不足，这一笔没画上",
    importPrompt: "粘贴画布 JSON：",
    crashToast: "摔了一跤，回到最近的安全点",
  },
  en: {
    docTitle: "Line Ride · DOIN games",
    metaDesc: "Draw tracks and watch a sledder ride your creation — every stroke is your own roller coaster. Freestyle canvas and 50 puzzle challenges.",
    title: "Line Ride",
    subtitle: "Draw & Ride",
    backHome: "← Home",
    soundOn: "Sound: ON",
    soundOff: "Sound: OFF",
    langLabel: "中文",
    langShort: "中文",
    ariaLang: "Switch language",
    ariaSound: "Toggle sound",
    helpTitle: "How to Play",
    helpText: "Pick a line type and draw on the canvas. Press Play to watch the sledder ride! Four line types: Normal (blue), Boost (orange), Slow (green), Scenery (white, decorative only). Space to Play/Pause, Ctrl+Z to Undo, scroll to Zoom.",
    modeFreestyle: "Freestyle",
    modePuzzle: "Puzzle",
    brushLabel: "Brush:",
    puzzleLevel: "Level {0}",
    puzzleStars: "⭐ {0}/3",
    inkLeft: "Ink: {0}",
    exportLabel: "Export",
    importLabel: "Import",
    clearLabel: "Clear",
    resetLabel: "Reset Rider",
    undoLabel: "Undo",
    lineNormal: "Normal",
    lineBoost: "Boost",
    lineSlow: "Slow",
    lineScenery: "Scenery",
    copySuccess: "Copied to clipboard",
    importSuccess: "Imported successfully",
    importError: "Import failed: invalid format",
    puzzleComplete: "Complete!",
    puzzleStarsEarned: "{0} stars earned",
    allClear: "Canvas cleared",
    noscript: "JavaScript is required to play Line Ride.",
    tipPlay: "Click Play or press Space to start",
    tipDraw: "Drag to start drawing",
    tipPuzzle: "Complete the track to guide the rider to the finish",
    saveCanvas: "Save Canvas",
    loadCanvas: "Load Canvas",
    canvasSlot: "Canvas {0}",
    emptySlot: "Empty",
    confirmClear: "Clear the canvas?",
    chapter: "Chapter {0}",
    inkOut: "Out of ink — stroke discarded",
    importPrompt: "Paste canvas JSON:",
    crashToast: "Oops — back to the last safe spot",
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