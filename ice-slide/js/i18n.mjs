// filepath: games/ice-slide/js/i18n.mjs
// 中英双语字典与语言切换。语言偏好读写全站共享 key：doin.lang（与其它 DOIN 游戏一致）。
// 检测优先级：已保存的 doin.lang > navigator.language（zh* → zh，其余 -> en）。
// 数据层铁律：关卡 key（level_1..level_60）与章名 key（chapter_1..chapter_5）只做查表，
// 本文件是唯一允许出现中文的运行源码（i18n 纯净性例外，check-game 白名单）。

export const LOCALES = ["zh", "en"];
export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";

export function isLocale(value) {
  return typeof value === "string" && LOCALES.indexOf(value) >= 0;
}

const ZH = {
  "app.title": "滑冰推箱",
  "app.subtitle": "Ice Slide · 撞墙才停",
  "home": "返回门户",

  "aria.lang": "切换语言",
  "aria.sound": "音效开关",
  "aria.board": "冰封湖面棋盘，使用方向键、WASD 或滑动滑行",
  "aria.levelCard": "第 {n} 关：{name}",
  "aria.levelLocked": "第 {n} 关：未解锁",

  "hud.moves": "步数",
  "hud.par": "最优",
  "hud.beacons": "灯标",
  "hud.time": "时间",

  "mode.campaign": "章节",
  "mode.daily": "每日",
  "mode.practice": "练习",

  "btn.undo": "撤销",
  "btn.hint": "提示",
  "btn.restart": "重开",
  "btn.pause": "暂停",
  "btn.levels": "选关",
  "btn.help": "玩法",
  "btn.resume": "继续",
  "btn.close": "返回",

  "daily.badge": "每日一局",
  "daily.todayDone": "今日已完成 · 明天再来",
  "daily.intro": "日期种子选定，全站同日同题。当天只此一局，错过不补。",

  "pause.title": "已暂停",
  "pause.desc": "计时已停止，随时可以继续。",

  "win.title": "全部入标！",
  "win.perfect": "完美通关！",
  "win.newbest": "新纪录！",
  "win.moves": "步数",
  "win.par": "最优",
  "win.time": "用时",
  "win.next": "下一关",
  "win.replay": "再来一次",
  "win.allClear": "全部 60 关已通关，恭喜！",
  "win.dailyDone": "今日每日一局已完成",
  "win.bestLine": "本关最佳：{moves} 步 · {stars} 星",

  "levels.title": "选择关卡",
  "levels.totals": "共 {total} 关 · 通关 {cleared} 关",

  "help.title": "玩法说明",
  "help.goalTitle": "目标",
  "help.goal": "把冰封湖面上的每一只补给箱都推上科考站灯标，全部点亮即过关。没有时间限制，但箱子一旦滑进死角，可能再也推不回来。",
  "help.rulesTitle": "规则",
  "help.rulesList": [
    "人和箱子都会沿选定方向一路滑行，撞墙或撞箱才停——中途无法刹车。",
    "顶到箱子时，箱子前方通畅则人箱同步滑行，人停在箱子最终位置的后一格；箱子前方堵死则人滑到箱子旁边停住，这一步照常计数。",
    "墙是刹车点：把箱子规划到正确的墙边停住，是本题的核心语法。",
    "箱子滑进非灯标的死角就推不出来了——用无限撤销和提示兜底，不必重开。",
  ],
  "help.ctrlTitle": "操作",
  "help.ctrlList": [
    "方向键 / WASD：沿该方向滑行",
    "鼠标：在湖面上按住并朝目标方向拖拽",
    "触屏：在湖面上朝目标方向滑动",
    "雪橇托盘方向键：点选方向滑行",
  ],
  "help.starTitle": "星级",
  "help.star": "★★★ 用步数等于本关最优 par；★★ 用步数不超过二星门槛；★ 通关。par 由求解器实算，每关零无解。",
  "help.keysTitle": "快捷键",
  "help.keysList": [
    "方向键 / WASD：滑行",
    "Z / U / Backspace：撤销一步",
    "R：重开本关",
    "H：玩法说明 · Esc：暂停",
    "?：提示最优方向",
  ],

  "toast.locked": "先通关前面的关卡",
  "toast.noUndo": "没有可撤销的步骤",
  "toast.paused": "已暂停",
  "toast.resumed": "继续",
  "toast.noPersist": "浏览器存储不可用，进度不会保存",
  "toast.hint": "朝这个方向滑",
  "toast.hintNone": "此局已无解，撤销或重开",
  "toast.dailyLocked": "每日一局当天只此一局",
  "toast.modeDaily": "每日一局：同题同卷，错过不补",
  "toast.modePractice": "练习场：已解锁关卡无限次重试",

  "dir.up": "上",
  "dir.down": "下",
  "dir.left": "左",
  "dir.right": "右",

  "sr.moved": "第 {level} 关：滑了 {moves} 步，推箱 {pushes} 次",
  "sr.undone": "已撤销，当前 {moves} 步",
  "sr.win": "过关！{moves} 步，最优 {par}，{stars} 星",
  "sr.progress": "灯标进度 {done}/{total}",

  "chapter_1": "第 1 章 · 初踏冰面",
  "chapter_2": "第 2 章 · 转角库",
  "chapter_3": "第 3 章 · 双箱协作",
  "chapter_4": "第 4 章 · 极地迷宫",
  "chapter_5": "第 5 章 · 永夜冰原",

  "level_1": "稳站冰面",
  "level_2": "贴墙而停",
  "level_3": "顺势一推",
  "level_4": "绕到箱后",
  "level_5": "笔直冰道",
  "level_6": "转角抬头",
  "level_7": "刚刚好",
  "level_8": "反向思维",
  "level_9": "冰面转角",
  "level_10": "细冰廊",
  "level_11": "双箱分流",
  "level_12": "碎冰廊",
  "level_13": "库房入口",
  "level_14": "双箱对角",
  "level_15": "长廊尽头",
  "level_16": "两箱一标",
  "level_17": "回廊灯标",
  "level_18": "箱阵缺口",
  "level_19": "并排双推",
  "level_20": "上下求索",
  "level_21": "冰窟岔路",
  "level_22": "灯标在望",
  "level_23": "深角回推",
  "level_24": "转角库收官",
  "level_25": "协作出场",
  "level_26": "左右开弓",
  "level_27": "灯标驿站",
  "level_28": "双箱同轨",
  "level_29": "错位双推",
  "level_30": "十字箱阵",
  "level_31": "厢间灯语",
  "level_32": "长廊双灯",
  "level_33": "夹缝灯标",
  "level_34": "冰原三箱",
  "level_35": "先后之别",
  "level_36": "协作终章",
  "level_37": "迷宫门户",
  "level_38": "箱锁回廊",
  "level_39": "冰镜广场",
  "level_40": "双塔灯影",
  "level_41": "极光入口",
  "level_42": "补给中继",
  "level_43": "灯阵迷径",
  "level_44": "深冰回廊",
  "level_45": "箱群迷宫",
  "level_46": "冰原夜行",
  "level_47": "极光迷阵",
  "level_48": "迷宫收官",
  "level_49": "永夜深冰",
  "level_50": "双灯哨站",
  "level_51": "极夜长廊",
  "level_52": "冰原星图",
  "level_53": "残冰断柱",
  "level_54": "灯标营地",
  "level_55": "极夜岔口",
  "level_56": "箱海灯舟",
  "level_57": "冰结晶界",
  "level_58": "永夜核心",
  "level_59": "冰原王冠",
  "level_60": "冰封传说",
};

const EN = {
  "app.title": "Ice Slide",
  "app.subtitle": "Slide till you hit a wall",
  "home": "Portal",

  "aria.lang": "Switch language",
  "aria.sound": "Toggle sound",
  "aria.board": "Frozen lake board, slide with arrow keys, WASD or swipe",
  "aria.levelCard": "Level {n}: {name}",
  "aria.levelLocked": "Level {n}: locked",

  "hud.moves": "Moves",
  "hud.par": "Par",
  "hud.beacons": "Beacons",
  "hud.time": "Time",

  "mode.campaign": "Campaign",
  "mode.daily": "Daily",
  "mode.practice": "Practice",

  "btn.undo": "Undo",
  "btn.hint": "Hint",
  "btn.restart": "Restart",
  "btn.pause": "Pause",
  "btn.levels": "Levels",
  "btn.help": "How to",
  "btn.resume": "Resume",
  "btn.close": "Back",

  "daily.badge": "Daily Slide",
  "daily.todayDone": "Done today - back tomorrow",
  "daily.intro": "Picked by a date seed, same rink for everyone. One run per day, no make-ups.",

  "pause.title": "Paused",
  "pause.desc": "The clock is stopped. Resume whenever you like.",

  "win.title": "All beacons lit!",
  "win.perfect": "Perfect clear!",
  "win.newbest": "New record!",
  "win.moves": "Moves",
  "win.par": "Par",
  "win.time": "Time",
  "win.next": "Next level",
  "win.replay": "Replay",
  "win.allClear": "All 60 levels cleared. Bravo!",
  "win.dailyDone": "Today's Daily Slide is complete",
  "win.bestLine": "Best: {moves} moves - {stars} stars",

  "levels.title": "Choose a level",
  "levels.totals": "{total} levels - {cleared} cleared",

  "help.title": "How to play",
  "help.goalTitle": "Goal",
  "help.goal": "Push every supply crate in the frozen lake onto a station beacon. There is no time limit, but a crate that slides into a dead corner may be lost for good.",
  "help.rulesTitle": "Rules",
  "help.rulesList": [
    "You and the crates slide until something stops you: a wall or another crate. There is no braking mid-slide.",
    "If you run into a crate with open ice ahead, you both slide together and you stop one tile behind the crate's final spot. If the crate is wedged, you stop beside it and the move still counts.",
    "Walls are brakes: planning which wall stops which crate is the whole game.",
    "A crate in a non-goal dead corner is stuck for good - lean on unlimited undo and hints instead of restarting.",
  ],
  "help.ctrlTitle": "Controls",
  "help.ctrlList": [
    "Arrow keys / WASD: slide that way",
    "Mouse: press and drag on the lake toward your heading",
    "Touch: swipe on the lake toward your heading",
    "Sled tray pad: tap a direction to slide",
  ],
  "help.starTitle": "Stars",
  "help.star": "3 stars for matching the solver's optimal par, 2 stars within the two-star threshold, 1 star for clearing. Par is computed per level; every level is solvable.",
  "help.keysTitle": "Shortcuts",
  "help.keysList": [
    "Arrow keys / WASD: slide",
    "Z / U / Backspace: undo one slide",
    "R: restart the level",
    "H: help - Esc: pause",
    "?: hint the optimal direction",
  ],

  "toast.locked": "Clear earlier levels first",
  "toast.noUndo": "Nothing to undo",
  "toast.paused": "Paused",
  "toast.resumed": "Resumed",
  "toast.noPersist": "Storage unavailable; progress won't be saved",
  "toast.hint": "Slide this way",
  "toast.hintNone": "No way out - undo or restart",
  "toast.dailyLocked": "One Daily Slide per day",
  "toast.modeDaily": "Daily Slide: same rink for everyone, one run a day",
  "toast.modePractice": "Practice: unlocked levels, unlimited retries",

  "dir.up": "up",
  "dir.down": "down",
  "dir.left": "left",
  "dir.right": "right",

  "sr.moved": "Level {level}: {moves} moves, {pushes} pushes",
  "sr.undone": "Undone; {moves} moves now",
  "sr.win": "Cleared! {moves} moves, par {par}, {stars} stars",
  "sr.progress": "Beacons {done}/{total}",

  "chapter_1": "Chapter 1 - First Slide",
  "chapter_2": "Chapter 2 - Corner Barn",
  "chapter_3": "Chapter 3 - Twin Crates",
  "chapter_4": "Chapter 4 - Polar Maze",
  "chapter_5": "Chapter 5 - Deepnight Ice",

  "level_1": "First Steps",
  "level_2": "Hug the Wall",
  "level_3": "Momentum",
  "level_4": "Flank It",
  "level_5": "Straightaway",
  "level_6": "Turn and Rise",
  "level_7": "Just Right",
  "level_8": "Reverse Push",
  "level_9": "Ice Corner",
  "level_10": "Thin Corridor",
  "level_11": "Split Lanes",
  "level_12": "Crumble Hall",
  "level_13": "Barn Gate",
  "level_14": "Diagonal Pair",
  "level_15": "Long Haul",
  "level_16": "Two Crates One Lamp",
  "level_17": "Gallery Lamp",
  "level_18": "Crate Gap",
  "level_19": "Side by Side",
  "level_20": "Up and Down",
  "level_21": "Grotto Fork",
  "level_22": "Lamp in Sight",
  "level_23": "Deep Corner",
  "level_24": "Barn Finale",
  "level_25": "First Duo",
  "level_26": "Both Hands",
  "level_27": "Waystation",
  "level_28": "Shared Track",
  "level_29": "Staggered",
  "level_30": "Cross Jam",
  "level_31": "Between Crates",
  "level_32": "Twin Halls",
  "level_33": "Pinched Lamp",
  "level_34": "Three on Ice",
  "level_35": "Order Matters",
  "level_36": "Duo Finale",
  "level_37": "Maze Gate",
  "level_38": "Locked Hall",
  "level_39": "Mirror Plaza",
  "level_40": "Twin Towers",
  "level_41": "Aurora Gate",
  "level_42": "Supply Relay",
  "level_43": "Lamp Array",
  "level_44": "Deep Gallery",
  "level_45": "Crate Labyrinth",
  "level_46": "Night Field",
  "level_47": "Aurora Web",
  "level_48": "Maze Finale",
  "level_49": "Deepnight Ice",
  "level_50": "Twin Outpost",
  "level_51": "Polar Gallery",
  "level_52": "Star Map",
  "level_53": "Broken Pillars",
  "level_54": "Beacon Camp",
  "level_55": "Night Fork",
  "level_56": "Crate Sea",
  "level_57": "Crystal Bounds",
  "level_58": "Night Core",
  "level_59": "Polar Crown",
  "level_60": "Frozen Legend",
};

const DICTS = { zh: ZH, en: EN };

export function detectLocale() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    /* 忽略 */
  }
  try {
    const nav = navigator.language || "";
    return nav.toLowerCase().startsWith("zh") ? "zh" : "en";
  } catch {
    return DEFAULT_LOCALE;
  }
}

let locale = DEFAULT_LOCALE;

export function getLocale() {
  return locale;
}

export function loadLocale() {
  locale = isLocale(locale) ? locale : detectLocale();
  if (!isLocale(locale)) locale = DEFAULT_LOCALE;
  return locale;
}

export function saveLocale(value) {
  locale = isLocale(value) ? value : DEFAULT_LOCALE;
  try {
    localStorage.setItem(LANG_KEY, locale);
  } catch {
    /* 忽略 */
  }
  return locale;
}

export function toggleLocale() {
  const next = locale === "zh" ? "en" : "zh";
  return saveLocale(next);
}

export function t(key, params) {
  const dict = DICTS[locale] || ZH;
  let text = dict[key];
  if (text === undefined) text = ZH[key] ?? key;
  if (params && typeof text === "string") {
    for (const k of Object.keys(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(params[k]));
    }
  }
  return text;
}

/** 列表型文案（如规则列表） */
export function tList(key) {
  const list = (DICTS[locale] || ZH)[key];
  if (Array.isArray(list)) return list;
  const zh = ZH[key];
  return Array.isArray(zh) ? zh : [];
}

/** 章名 / 关名查表（levels.mjs 只放 key，不裸写文本） */
export function chapterName(id) {
  return t(`chapter_${id}`);
}

export function levelName(id) {
  return t(`level_${id}`);
}

export function applyI18n(root) {
  if (!root) return;
  root.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.getAttribute("data-i18n");
    node.textContent = t(key);
  });
  root.querySelectorAll("[data-i18n-aria]").forEach((node) => {
    const key = node.getAttribute("data-i18n-aria");
    node.setAttribute("aria-label", t(key));
  });
  root.querySelectorAll("[data-i18n-list]").forEach((node) => {
    const key = node.getAttribute("data-i18n-list");
    const items = tList(key);
    node.textContent = "";
    for (const item of items) {
      const li = document.createElement("li");
      li.textContent = item;
      node.appendChild(li);
    }
  });
}
