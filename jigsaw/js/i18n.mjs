// filepath: games/jigsaw/js/i18n.mjs
// 中英双语字典与语言切换。语言偏好读写全站共享 key：doin.lang（与其它 DOIN 游戏一致）。
// 检测优先级：已保存的 doin.lang > navigator.language（zh* → zh，其余 → en）。

export const LOCALES = ["zh", "en"];
export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";

export function isLocale(value) {
  return typeof value === "string" && LOCALES.indexOf(value) >= 0;
}

const ZH = {
  "app.title": "拼图",
  "app.subtitle": "Jigsaw · 交换碎片复原图案",
  "home": "返回门户",

  "aria.lang": "切换语言",
  "aria.sound": "音效开关",
  "aria.board": "拼图棋盘，拖动碎片到另一块上交换位置",
  "aria.levelCard": "第 {n} 关：{name}",
  "aria.levelLocked": "第 {n} 关：未解锁",
  "aria.daily": "今日拼图：{name}",

  "hud.level": "关卡",
  "hud.moves": "步数",
  "hud.par": "标准",
  "hud.score": "得分",
  "hud.time": "时间",

  "btn.preview": "原图",
  "btn.reshuffle": "重排",
  "btn.restart": "重玩",
  "btn.levels": "选关",
  "btn.help": "玩法",
  "btn.close": "返回",

  "start.title": "拼图",
  "start.desc": "拖动一块碎片放到另一块上，两块交换位置。拼到正确位置的碎片会自动锁定，全部归位即完成。",
  "start.cta": "开始拼图",
  "start.levels": "选择关卡",
  "start.help": "玩法说明",
  "start.daily": "今日拼图",

  "win.title": "拼好了！",
  "win.newbest": "新纪录！",
  "win.moves": "步数",
  "win.par": "标准",
  "win.time": "用时",
  "win.score": "得分",
  "win.next": "下一关",
  "win.replay": "再拼一次",
  "win.allClear": "全部 50 关已拼完，恭喜！",
  "win.bestLine": "本关最佳：{score} 分 · {moves} 步 · {time}",
  "win.dailyBest": "今日最佳：{score} 分",

  "levels.title": "选择关卡",
  "levels.total": "已拼完 {done}/{total} · 总积分 {score}",
  "levels.locked": "未解锁",
  "levels.daily": "今日拼图",
  "levels.dailyHint": "每天一张，全服同图",
  "levels.chapter": "第 {n} 章 · {name}",

  "chapter.1": "初窥",
  "chapter.2": "几何",
  "chapter.3": "进阶",
  "chapter.4": "层次",
  "chapter.5": "大师",

  "help.title": "玩法说明",
  "help.goalTitle": "目标",
  "help.goal": "每关一张被打乱的图案，把它拼回完整的样子。碎片全部回到正确位置即完成。没有时间限制，也不会卡死。",
  "help.rulesTitle": "规则",
  "help.rulesList": [
    "拖动一块碎片放到另一块上，两块交换位置。",
    "碎片只有落在正确位置才会锁定，放错了会留在原地等下一次交换。",
    "已锁定的碎片不能再拖动，也不会被交换走。",
    "每关有 3 次「重排」：把所有还没锁定的碎片重新打乱，重排不计步数。",
  ],
  "help.ctrlTitle": "操作",
  "help.ctrlList": [
    "鼠标 / 手指：按住一块碎片拖到目标格松手，两块交换。",
    "也可以先点一块选中，再点另一块交换。",
    "长按「原图」按钮看完整图案，松手回到游戏。",
    "键盘：方向键移动光标，回车 / 空格拿起或放下。",
  ],
  "help.scoreTitle": "计分",
  "help.score": "基础分 200 + 步数分 500 + 时间分 100。交换次数不超过标准步数得满分，每多一步扣 5 分；用时越短时间分越高。",
  "help.keysTitle": "快捷键",
  "help.keysList": [
    "方向键：移动光标",
    "回车 / 空格：拿起或放下碎片",
    "R：重玩本关",
    "S：重排一次",
    "V：按住查看原图",
    "L：打开选关",
    "H：打开玩法说明",
  ],

  "toast.locked": "先拼完前面的关卡",
  "toast.lockedPiece": "这块已经锁定了",
  "toast.noShuffle": "重排次数已用完",
  "toast.shuffled": "已重排，还剩 {n} 次",
  "toast.noPersist": "无法写入本地存档，进度只在本次游戏内有效",
  "toast.daily": "今日拼图：{name}",
  "toast.preview": "按住查看完整图案",

  "sr.picked": "已拿起第 {r} 行第 {c} 列的碎片",
  "sr.swapped": "交换完成，当前 {moves} 步",
  "sr.locked": "已锁定 {n} 块",
  "sr.reshuffled": "已重排，还剩 {n} 次",
  "sr.win": "拼好了，用了 {moves} 步，得分 {score}",

  "level.l1": "晨曦",
  "level.l2": "薄雾",
  "level.l3": "潮汐",
  "level.l4": "沙丘",
  "level.l5": "极光",
  "level.l6": "烛火",
  "level.l7": "湖心",
  "level.l8": "晴空",
  "level.l9": "花海",
  "level.l10": "晚霞",
  "level.l11": "折线",
  "level.l12": "螺旋",
  "level.l13": "网格",
  "level.l14": "棱镜",
  "level.l15": "星环",
  "level.l16": "方块",
  "level.l17": "波纹",
  "level.l18": "交织",
  "level.l19": "碎片",
  "level.l20": "万象",
  "level.l21": "柔光",
  "level.l22": "云雾",
  "level.l23": "温泉",
  "level.l24": "绸缎",
  "level.l25": "春溪",
  "level.l26": "果冻",
  "level.l27": "棉花",
  "level.l28": "奶油",
  "level.l29": "薄荷",
  "level.l30": "蜜桃",
  "level.l31": "叠翠",
  "level.l32": "层峦",
  "level.l33": "涟漪",
  "level.l34": "织锦",
  "level.l35": "琉璃",
  "level.l36": "孔雀",
  "level.l37": "深海",
  "level.l38": "星尘",
  "level.l39": "熔岩",
  "level.l40": "极夜",
  "level.l41": "微尘",
  "level.l42": "苔痕",
  "level.l43": "琥珀",
  "level.l44": "霜花",
  "level.l45": "流沙",
  "level.l46": "织羽",
  "level.l47": "虹膜",
  "level.l48": "晶簇",
  "level.l49": "幻境",
  "level.l50": "无尽",
};

const EN = {
  "app.title": "Jigsaw",
  "app.subtitle": "Swap the pieces to rebuild the picture",
  "home": "Back to portal",

  "aria.lang": "Switch language",
  "aria.sound": "Toggle sound",
  "aria.board": "Jigsaw board. Drag a piece onto another piece to swap them",
  "aria.levelCard": "Level {n}: {name}",
  "aria.levelLocked": "Level {n}: locked",
  "aria.daily": "Daily jigsaw: {name}",

  "hud.level": "Level",
  "hud.moves": "Moves",
  "hud.par": "Par",
  "hud.score": "Score",
  "hud.time": "Time",

  "btn.preview": "Preview",
  "btn.reshuffle": "Shuffle",
  "btn.restart": "Restart",
  "btn.levels": "Levels",
  "btn.help": "How to",
  "btn.close": "Back",

  "start.title": "Jigsaw",
  "start.desc": "Drag one piece onto another to swap them. Any piece that lands in the right spot locks in place. Put every piece home to finish.",
  "start.cta": "Start Puzzle",
  "start.levels": "Choose Level",
  "start.help": "How to Play",
  "start.daily": "Daily Puzzle",

  "win.title": "Solved!",
  "win.newbest": "New record!",
  "win.moves": "Moves",
  "win.par": "Par",
  "win.time": "Time",
  "win.score": "Score",
  "win.next": "Next Level",
  "win.replay": "Play Again",
  "win.allClear": "All 50 puzzles solved. Congratulations!",
  "win.bestLine": "Best: {score} pts, {moves} moves, {time}",
  "win.dailyBest": "Today's best: {score} pts",

  "levels.title": "Choose Level",
  "levels.total": "Solved {done}/{total}, total score {score}",
  "levels.locked": "Locked",
  "levels.daily": "Daily Puzzle",
  "levels.dailyHint": "One picture a day, same for everyone",
  "levels.chapter": "Chapter {n} - {name}",

  "chapter.1": "First Look",
  "chapter.2": "Geometry",
  "chapter.3": "Ascent",
  "chapter.4": "Layers",
  "chapter.5": "Mastery",

  "help.title": "How to Play",
  "help.goalTitle": "Goal",
  "help.goal": "Each level is a shuffled picture. Rebuild it: when every piece is back in its own spot the level is solved. There is no time limit and no dead end.",
  "help.rulesTitle": "Rules",
  "help.rulesList": [
    "Drag one piece onto another piece and the two swap places.",
    "A piece locks only when it lands in its correct spot; a wrong swap simply stays on the board.",
    "Locked pieces can never be dragged or swapped again.",
    "Every level gives you 3 shuffles: re-scatter all unlocked pieces. Shuffling never costs a move.",
  ],
  "help.ctrlTitle": "Controls",
  "help.ctrlList": [
    "Mouse / touch: press a piece, drag it onto the target cell and release to swap.",
    "You can also tap one piece to select it, then tap another to swap.",
    "Hold the Preview button to see the whole picture, release to go back.",
    "Keyboard: arrow keys move the cursor, Enter or Space picks up and drops.",
  ],
  "help.scoreTitle": "Scoring",
  "help.score": "Base 200 + move score 500 + time score 100. Meeting par gives full move points; each extra swap costs 5. The faster you finish, the higher the time score.",
  "help.keysTitle": "Shortcuts",
  "help.keysList": [
    "Arrow keys: move the cursor",
    "Enter / Space: pick up or drop a piece",
    "R: restart the level",
    "S: shuffle once",
    "V: hold to preview the picture",
    "L: open the level list",
    "H: open or close the how-to panel",
  ],

  "toast.locked": "Clear the previous level first",
  "toast.lockedPiece": "That piece is already locked",
  "toast.noShuffle": "No shuffles left",
  "toast.shuffled": "Shuffled, {n} left",
  "toast.noPersist": "Local storage is unavailable, progress lasts for this session only",
  "toast.daily": "Daily puzzle: {name}",
  "toast.preview": "Hold to see the full picture",

  "sr.picked": "Picked up the piece at row {r}, column {c}",
  "sr.swapped": "Swapped, {moves} moves so far",
  "sr.locked": "{n} pieces locked",
  "sr.reshuffled": "Shuffled, {n} left",
  "sr.win": "Solved in {moves} moves, score {score}",

  "level.l1": "Dawn",
  "level.l2": "Mist",
  "level.l3": "Tide",
  "level.l4": "Dune",
  "level.l5": "Aurora",
  "level.l6": "Candlelight",
  "level.l7": "Lake",
  "level.l8": "Clear Sky",
  "level.l9": "Blossom",
  "level.l10": "Sunset",
  "level.l11": "Zigzag",
  "level.l12": "Spiral",
  "level.l13": "Grid",
  "level.l14": "Prism",
  "level.l15": "Star Ring",
  "level.l16": "Blocks",
  "level.l17": "Ripple",
  "level.l18": "Interlace",
  "level.l19": "Shards",
  "level.l20": "Myriad",
  "level.l21": "Soft Light",
  "level.l22": "Cloud",
  "level.l23": "Hot Spring",
  "level.l24": "Silk",
  "level.l25": "Spring Creek",
  "level.l26": "Jelly",
  "level.l27": "Cotton",
  "level.l28": "Cream",
  "level.l29": "Mint",
  "level.l30": "Peach",
  "level.l31": "Verdure",
  "level.l32": "Ridges",
  "level.l33": "Ripples",
  "level.l34": "Brocade",
  "level.l35": "Glaze",
  "level.l36": "Peacock",
  "level.l37": "Deep Sea",
  "level.l38": "Stardust",
  "level.l39": "Lava",
  "level.l40": "Polar Night",
  "level.l41": "Motes",
  "level.l42": "Moss",
  "level.l43": "Amber",
  "level.l44": "Frost",
  "level.l45": "Quicksand",
  "level.l46": "Plume",
  "level.l47": "Iris",
  "level.l48": "Crystal",
  "level.l49": "Mirage",
  "level.l50": "Endless",
};

export const strings = { zh: ZH, en: EN };

let active = DEFAULT_LOCALE;

/** 简单模板替换：{name} -> params[name] */
export function format(template, params) {
  if (typeof template !== "string") return "";
  if (!params || typeof params !== "object") return template;
  return template.replace(/\{(\w+)\}/g, (match, name) => {
    const value = params[name];
    return value === undefined || value === null ? match : String(value);
  });
}

function readStored() {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(LANG_KEY);
  } catch {
    return null;
  }
}

/**
 * 语言检测：已保存的 doin.lang > navigator.language。
 * 形如 zh / zh-CN / zh-Hans 都归为中文，其余归为英文。
 */
export function detectLocale() {
  const stored = readStored();
  if (isLocale(stored)) return stored;
  try {
    const nav = typeof navigator !== "undefined" ? navigator.language || navigator.languages?.[0] : "";
    if (typeof nav === "string" && nav.toLowerCase().startsWith("zh")) return "zh";
  } catch {
    /* 环境无 navigator 时按默认处理 */
  }
  return DEFAULT_LOCALE;
}

export function loadLocale() {
  active = detectLocale();
  return active;
}

export function saveLocale(locale) {
  if (!isLocale(locale)) return active;
  active = locale;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(LANG_KEY, locale);
    }
  } catch {
    /* 隐私模式等写入失败时只保留内存态 */
  }
  return active;
}

export function getLocale() {
  return active;
}

export function toggleLocale() {
  return saveLocale(active === "zh" ? "en" : "zh");
}

/** <html lang> 取值 */
export function htmlLang(locale = active) {
  return locale === "en" ? "en" : "zh-CN";
}

/** 取一条文案；数组型（如 help.rulesList）原样返回，由调用方渲染成列表 */
export function t(key, params) {
  const table = strings[active] || strings[DEFAULT_LOCALE];
  const fallback = strings[DEFAULT_LOCALE];
  const raw = table[key] !== undefined ? table[key] : fallback[key];
  if (Array.isArray(raw)) return raw.map((item) => format(item, params));
  return format(raw, params);
}

/** 语言按钮上的短标签（zh 时显示 EN，提示"可切到英文"） */
export function altLabel() {
  return active === "zh" ? "EN" : "中";
}

/** 把当前语言的文案刷到 DOM 上 */
export function applyI18n(root = document) {
  if (!root || typeof root.querySelectorAll !== "function") return;

  root.querySelectorAll("[data-i18n]").forEach((node) => {
    const value = t(node.getAttribute("data-i18n"));
    if (Array.isArray(value)) return;
    if (typeof value === "string") node.textContent = value;
  });

  root.querySelectorAll("[data-i18n-aria]").forEach((node) => {
    const value = t(node.getAttribute("data-i18n-aria"));
    if (typeof value === "string") node.setAttribute("aria-label", value);
  });

  root.querySelectorAll("[data-i18n-list]").forEach((node) => {
    const items = t(node.getAttribute("data-i18n-list"));
    if (!Array.isArray(items)) return;
    node.textContent = "";
    for (const item of items) {
      const li = document.createElement("li");
      li.textContent = item;
      node.appendChild(li);
    }
  });
}
