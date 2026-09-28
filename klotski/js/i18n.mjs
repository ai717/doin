// filepath: games/klotski/js/i18n.mjs
// 中英双语字典与语言切换。语言偏好读写全站共享 key：doin.lang（与其它 DOIN 游戏一致）。
// 检测优先级：已保存的 doin.lang > navigator.language（zh* → zh，其余 → en）。

export const LOCALES = ["zh", "en"];
export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";

export function isLocale(value) {
  return typeof value === "string" && LOCALES.indexOf(value) >= 0;
}

const ZH = {
  "app.title": "华容道",
  "app.subtitle": "Klotski · 挪方块",
  "home": "返回门户",

  "aria.lang": "切换语言",
  "aria.sound": "音效开关",
  "aria.board": "华容道棋盘，使用方向键或拖拽移动方块",
  "aria.levelCard": "第 {n} 关：{name}",
  "aria.levelLocked": "第 {n} 关：未解锁",

  // 棋子上的刻字（按 KIND 取值，render.mjs 用）
  "piece.caocao": "曹操",
  "piece.guanyu": "关羽",
  "piece.general": "将",
  "piece.soldier": "兵",

  "hud.level": "关卡",
  "hud.moves": "步数",
  "hud.par": "目标",
  "hud.time": "时间",

  "btn.undo": "撤销",
  "btn.restart": "重玩",
  "btn.pause": "暂停",
  "btn.levels": "关卡",
  "btn.help": "玩法",
  "btn.resume": "继续",
  "btn.close": "返回",

  "start.title": "华容道",
  "start.desc": "挪动方块，把曹操从下方出口送出。横块只能左右移，竖块只能上下移。",
  "start.cta": "开始游戏",
  "start.levels": "选择关卡",

  "pause.title": "已暂停",
  "pause.desc": "计时已停止，随时可以继续。",

  "win.title": "过关！",
  "win.newbest": "新纪录！",
  "win.moves": "步数",
  "win.par": "目标",
  "win.time": "用时",
  "win.score": "得分",
  "win.next": "下一关",
  "win.replay": "再来一次",
  "win.allClear": "全部 12 关已通关，恭喜！",
  "win.bestLine": "本关最佳：{score} 分 · {moves} 步 · {time}",

  "levels.title": "选择关卡",
  "levels.total": "已通关 {done}/{total} · 总积分 {score}",
  "levels.locked": "未解锁",

  "diff.easy": "轻松",
  "diff.normal": "普通",
  "diff.hard": "困难",
  "diff.expert": "大师",

  "help.title": "玩法说明",
  "help.goalTitle": "目标",
  "help.goal": "把最大的朱红方块（曹操）移到棋盘底部中央的出口并送出，即为过关。没有时间限制，也没有死局。",
  "help.rulesTitle": "规则",
  "help.rulesList": [
    "每块只能沿自己的朝向滑动：横块左右移，竖块上下移，小兵四向皆可。",
    "一次只能移动一块，不能跨越其它方块，也不能旋转。",
    "棋盘共 4 列 5 行，留有两个空格用来腾挪。",
    "所有关卡都经过最优解验证，一定可解，不存在走不出去的死局。",
  ],
  "help.ctrlTitle": "操作",
  "help.ctrlList": [
    "鼠标 / 手指：按住方块朝目标方向拖动，松手即落子。",
    "点击方块后按方向键：朝该方向滑动一格。",
    "键盘玩家用 [ 与 ] 切换选中的方块，再按方向键移动。",
    "Tab 键可在棋盘与按钮之间切换焦点，回车或空格确认。",
  ],
  "help.scoreTitle": "计分",
  "help.score": "基础分 + 步数分 + 时间分。步数不超过目标步数得满分，多走一步扣 5 分；用时越短分越高。三星 = 达到满分的 90%。",
  "help.keysTitle": "快捷键",
  "help.keysList": [
    "方向键 / WASD：移动选中的方块",
    "Z：撤销一步",
    "R：重玩本关",
    "空格 / P：暂停或继续",
    "H：打开或关闭玩法说明",
  ],

  "toast.noUndo": "没有可撤销的步骤",
  "toast.blocked": "这个方向走不通",
  "toast.paused": "已暂停",
  "toast.resumed": "继续游戏",
  "toast.reset": "已重新开始",
  "toast.locked": "先通关前面的关卡",
  "toast.unlocked": "解锁第 {n} 关",
  "toast.saved": "进度已保存到本机",
  "toast.noPersist": "无法写入本地存档，进度只在本次游戏内有效",

  "sr.moved": "第 {id} 块向 {dir} 移动，当前 {moves} 步",
  "sr.selected": "已选中方块 {id}",
  "sr.undone": "已撤销，当前 {moves} 步",
  "sr.win": "过关，用了 {moves} 步，得分 {score}",
  "dir.up": "上",
  "dir.down": "下",
  "dir.left": "左",
  "dir.right": "右",

  "level.l1": "初出茅庐",
  "level.l2": "小试锋芒",
  "level.l3": "循序渐进",
  "level.l4": "双将并立",
  "level.l5": "横江拦截",
  "level.l6": "铁桶合围",
  "level.l7": "峰回路转",
  "level.l8": "渐入佳境",
  "level.l9": "五关斩将",
  "level.l10": "十面埋伏",
  "level.l11": "运筹帷幄",
  "level.l12": "长驱直入",
  "level.l13": "兵临城下",
  "level.l14": "步步为营",
  "level.l15": "按甲寝兵",
  "level.l16": "声东击西",
  "level.l17": "背水一战",
  "level.l18": "暗度陈仓",
  "level.l19": "以逸待劳",
  "level.l20": "欲擒故纵",
  "level.l21": "围魏救赵",
  "level.l22": "釜底抽薪",
  "level.l23": "调虎离山",
  "level.l24": "金蝉脱壳",
  "level.l25": "关门捉贼",
  "level.l26": "远交近攻",
  "level.l27": "连环妙计",
  "level.l28": "排兵布阵",
  "level.l29": "调兵遣将",
  "level.l30": "星罗棋布",
  "level.l31": "纵横交错",
  "level.l32": "犬牙交错",
  "level.l33": "错综复杂",
  "level.l34": "盘根错节",
  "level.l35": "峰峦叠嶂",
  "level.l36": "曲径通幽",
  "level.l37": "柳暗花明",
  "level.l38": "抽丝剥茧",
  "level.l39": "迎刃而解",
  "level.l40": "势如破竹",
  "level.l41": "锲而不舍",
  "level.l42": "绳锯木断",
  "level.l43": "铁杵成针",
  "level.l44": "举棋若定",
  "level.l45": "胸有成竹",
  "level.l46": "游刃有余",
  "level.l47": "出神入化",
  "level.l48": "登堂入室",
  "level.l49": "炉火纯青",
  "level.l50": "横刀立马",
};

const EN = {
  "app.title": "Klotski",
  "app.subtitle": "Huarong Dao · Sliding Blocks",
  "home": "Back to portal",

  "aria.lang": "Switch language",
  "aria.sound": "Toggle sound",
  "aria.board": "Klotski board. Use arrow keys or drag blocks to move them",
  "aria.levelCard": "Level {n}: {name}",
  "aria.levelLocked": "Level {n}: locked",

  // 棋子上的刻字（按 KIND 取值，render.mjs 用）
  "piece.caocao": "Cao Cao",
  "piece.guanyu": "Guan Yu",
  "piece.general": "Gen",
  "piece.soldier": "Pawn",

  "hud.level": "Level",
  "hud.moves": "Moves",
  "hud.par": "Par",
  "hud.time": "Time",

  "btn.undo": "Undo",
  "btn.restart": "Restart",
  "btn.pause": "Pause",
  "btn.levels": "Levels",
  "btn.help": "How to",
  "btn.resume": "Resume",
  "btn.close": "Back",

  "start.title": "Klotski",
  "start.desc": "Slide the blocks and guide Cao Cao out through the bottom exit. Any block can slide up, down, left or right into an empty cell.",
  "start.cta": "Start Game",
  "start.levels": "Choose Level",

  "pause.title": "Paused",
  "pause.desc": "The timer is stopped. Resume whenever you are ready.",

  "win.title": "Cleared!",
  "win.newbest": "New record!",
  "win.moves": "Moves",
  "win.par": "Par",
  "win.time": "Time",
  "win.score": "Score",
  "win.next": "Next Level",
  "win.replay": "Play Again",
  "win.allClear": "All 12 levels cleared. Congratulations!",
  "win.bestLine": "Best: {score} pts · {moves} moves · {time}",

  "levels.title": "Choose Level",
  "levels.total": "Cleared {done}/{total} · Total score {score}",
  "levels.locked": "Locked",

  "diff.easy": "Easy",
  "diff.normal": "Normal",
  "diff.hard": "Hard",
  "diff.expert": "Master",

  "help.title": "How to Play",
  "help.goalTitle": "Goal",
  "help.goal": "Move the big vermilion block (Cao Cao) to the bottom center exit and send it out. There is no time limit and no dead end.",
  "help.rulesTitle": "Rules",
  "help.rulesList": [
    "Any block can slide up, down, left or right into an empty cell, one cell at a time or several in a row.",
    "One block at a time. Blocks can never jump over each other or rotate.",
    "The board is 4 columns by 5 rows with exactly two empty cells to shuffle with.",
    "Every level is verified by an optimal solver, so all of them are solvable and none can dead-end.",
  ],
  "help.ctrlTitle": "Controls",
  "help.ctrlList": [
    "Mouse / touch: press a block and drag it toward your target, release to drop.",
    "Click a block then press an arrow key to slide it one cell.",
    "Tab moves focus between the board and the buttons, Enter or Space confirms.",
  ],
  "help.scoreTitle": "Scoring",
  "help.score": "Base + move score + time score. Meeting par gives full move points; each extra move costs 5. The faster you finish, the higher the time score. Three stars = 90% of the maximum.",
  "help.keysTitle": "Shortcuts",
  "help.keysList": [
    "Arrow keys / WASD: move the selected block",
    "[ or ]: cycle the selected block (use with arrows to reach any piece)",
    "Z: undo one move",
    "R: restart the level",
    "Space / P: pause or resume",
    "H: open or close the how-to panel",
  ],

  "toast.noUndo": "Nothing to undo",
  "toast.blocked": "That way is blocked",
  "toast.paused": "Paused",
  "toast.resumed": "Resumed",
  "toast.reset": "Level restarted",
  "toast.locked": "Clear the previous level first",
  "toast.unlocked": "Level {n} unlocked",
  "toast.saved": "Progress saved on this device",
  "toast.noPersist": "Local storage is unavailable, progress lasts for this session only",

  "sr.moved": "Block {id} moved {dir}, {moves} moves so far",
  "sr.selected": "Block {id} selected",
  "sr.undone": "Undone, {moves} moves now",
  "sr.win": "Cleared in {moves} moves, score {score}",
  "dir.up": "up",
  "dir.down": "down",
  "dir.left": "left",
  "dir.right": "right",

  "level.l1": "First Steps",
  "level.l2": "Trial Run",
  "level.l3": "Steady Progress",
  "level.l4": "Twin Guards",
  "level.l5": "River Blockade",
  "level.l6": "Iron Ring",
  "level.l7": "Winding Path",
  "level.l8": "Getting the Hang",
  "level.l9": "Five Passes",
  "level.l10": "Ambush",
  "level.l11": "War Room",
  "level.l12": "Long Drive",
  "level.l13": "Siege",
  "level.l14": "Camp by Camp",
  "level.l15": "Swords at Rest",
  "level.l16": "Feint East",
  "level.l17": "Last Stand",
  "level.l18": "Secret Passage",
  "level.l19": "Rest and Wait",
  "level.l20": "Let Them Run",
  "level.l21": "Besiege Wei",
  "level.l22": "Cut the Supply",
  "level.l23": "Lure the Tiger",
  "level.l24": "Cicada Escape",
  "level.l25": "Shut the Door",
  "level.l26": "Ally Afar, Strike Near",
  "level.l27": "Chain of Tricks",
  "level.l28": "Rank and File",
  "level.l29": "Deploy the Generals",
  "level.l30": "Scattered Stars",
  "level.l31": "Crossed Lines",
  "level.l32": "Jagged Edges",
  "level.l33": "Tangled Web",
  "level.l34": "Deep Roots",
  "level.l35": "Layered Peaks",
  "level.l36": "Winding Trail",
  "level.l37": "Willow and Bloom",
  "level.l38": "Unwind the Thread",
  "level.l39": "Split with a Blade",
  "level.l40": "Unstoppable",
  "level.l41": "Never Give Up",
  "level.l42": "Patience Cuts",
  "level.l43": "Iron to Needle",
  "level.l44": "Calm Command",
  "level.l45": "Bamboo in Mind",
  "level.l46": "Room to Spare",
  "level.l47": "Transcendent",
  "level.l48": "Into the Hall",
  "level.l49": "Perfect Temper",
  "level.l50": "Heng Dao Li Ma",
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
    if (Array.isArray(value)) {
      node.textContent = "";
      for (const item of value) {
        const li = document.createElement("li");
        li.textContent = item;
        node.appendChild(li);
      }
      return;
    }
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
