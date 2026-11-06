// filepath: games/sokoban/js/i18n.mjs
// 中英双语字典与语言切换。语言偏好读写全站共享 key：doin.lang（与其它 DOIN 游戏一致）。
// 检测优先级：已保存的 doin.lang > navigator.language（zh* → zh，其余 → en）。

export const LOCALES = ["zh", "en"];
export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";

export function isLocale(value) {
  return typeof value === "string" && LOCALES.indexOf(value) >= 0;
}

const ZH = {
  "app.title": "推箱子",
  "app.subtitle": "Sokoban · 归位木箱",
  "home": "返回门户",

  "aria.lang": "切换语言",
  "aria.sound": "音效开关",
  "aria.board": "推箱子货场，使用方向键、WASD 或滑动移动",
  "aria.levelCard": "第 {n} 关：{name}",
  "aria.levelLocked": "第 {n} 关：未解锁",

  "hud.level": "关卡",
  "hud.moves": "步数",
  "hud.par": "目标推数",
  "hud.time": "时间",

  "btn.undo": "撤销",
  "btn.hint": "提示",
  "btn.restart": "重玩",
  "btn.pause": "暂停",
  "btn.levels": "关卡",
  "btn.help": "玩法",
  "btn.resume": "继续",
  "btn.close": "返回",

  "start.title": "推箱子",
  "start.desc": "把货场里的每一只木箱都推进发光的星点。人只能推、不能拉；推错的箱子可能再也回不来。",
  "start.cta": "开始游戏",
  "start.levels": "选择关卡",

  "pause.title": "已暂停",
  "pause.desc": "计时已停止，随时可以继续。",

  "win.title": "归位！",
  "win.newbest": "新纪录！",
  "win.pushes": "推数",
  "win.par": "目标",
  "win.time": "用时",
  "win.score": "得分",
  "win.next": "下一关",
  "win.replay": "再来一次",
  "win.allClear": "全部 50 关已通关，恭喜！",
  "win.bestLine": "本关最佳：{score} 分 · {pushes} 推 · {time}",

  "levels.title": "选择关卡",
  "levels.totals": "共 {total} 关 · 通关 {cleared} 关",
  "levels.unlocked": "第 {n} 关",
  "levels.locked": "🔒",

  "help.title": "玩法说明",
  "help.goalTitle": "目标",
  "help.goal": "把货场里每一只木箱都推到发光的星点上，全部就位即过关。没有时间限制，但推错的箱子可能永远推不回来。",
  "help.rulesTitle": "规则",
  "help.rulesList": [
    "人只能推箱子，不能拉：站在箱子的一侧，朝对面推一格。",
    "一次只能推一只箱子，箱前必须是空地或目标点。",
    "箱子推进角落（两个正交方向都被墙封死）且不在目标上，就永远推不出来了——尽量避开。",
    "目标点可以站人、可以放箱；全部箱子就位即过关。",
  ],
  "help.ctrlTitle": "操作",
  "help.ctrlList": [
    "方向键 / WASD：移动与推箱",
    "触屏：在货场上滑动即可朝滑动方向移动",
    "Z：撤销一步 · R：重玩 · P：暂停",
  ],
  "help.scoreTitle": "计分",
  "help.score": "基础分 + 推数分 + 时间分，满分 1000。推数不超过本关目标推数得满分，每多推一次扣 9 分；用时越短分越高。三星 = 达到满分的 90%。",
  "help.keysTitle": "快捷键",
  "help.keysList": [
    "方向键 / WASD：移动与推箱",
    "Z / Backspace：撤销一步",
    "R：重玩本关",
    "H：玩法说明 · P：暂停",
    "Esc：关闭弹层",
  ],

  "toast.locked": "先通关前面的关卡",
  "toast.noUndo": "没有可撤销的步骤",
  "toast.blocked": "推不动",
  "toast.paused": "已暂停",
  "toast.resumed": "继续",
  "toast.noPersist": "浏览器存储不可用，进度不会保存",
  "toast.hint": "朝这个方向推",
  "toast.hintNone": "暂时算不出提示",
  "toast.cleared": "通关！",

  "dir.up": "上",
  "dir.down": "下",
  "dir.left": "左",
  "dir.right": "右",

  "sr.moved": "第 {level} 关：走了 {moves} 步，推了 {pushes} 次",
  "sr.undone": "已撤销，当前 {moves} 步",
  "sr.win": "过关！推了 {pushes} 次，用时 {time}，得分 {score}",
  "sr.progress": "收箱进度 {done}/{total}",
};

const EN = {
  "app.title": "Sokoban",
  "app.subtitle": "Push the crates home",
  "home": "Portal",

  "aria.lang": "Switch language",
  "aria.sound": "Toggle sound",
  "aria.board": "Sokoban yard, move with arrow keys, WASD or swipe",
  "aria.levelCard": "Level {n}: {name}",
  "aria.levelLocked": "Level {n}: locked",

  "hud.level": "Level",
  "hud.moves": "Moves",
  "hud.par": "Par pushes",
  "hud.time": "Time",

  "btn.undo": "Undo",
  "btn.hint": "Hint",
  "btn.restart": "Restart",
  "btn.pause": "Pause",
  "btn.levels": "Levels",
  "btn.help": "Help",
  "btn.resume": "Resume",
  "btn.close": "Back",

  "start.title": "Sokoban",
  "start.desc": "Push every crate onto a glowing star. You can push but never pull — a crate pushed into a corner may be lost forever.",
  "start.cta": "Start",
  "start.levels": "Pick a level",

  "pause.title": "Paused",
  "pause.desc": "The clock is stopped. Resume whenever you like.",

  "win.title": "All set!",
  "win.newbest": "New record!",
  "win.pushes": "Pushes",
  "win.par": "Par",
  "win.time": "Time",
  "win.score": "Score",
  "win.next": "Next level",
  "win.replay": "Replay",
  "win.allClear": "All 50 levels cleared. Bravo!",
  "win.bestLine": "Best: {score} pts · {pushes} pushes · {time}",

  "levels.title": "Choose a level",
  "levels.totals": "{total} levels · {cleared} cleared",
  "levels.unlocked": "Level {n}",
  "levels.locked": "\u{1F512}",

  "help.title": "How to play",
  "help.goalTitle": "Goal",
  "help.goal": "Push every crate in the yard onto a glowing star. There is no time limit, but a crate pushed into the wrong corner can never be recovered.",
  "help.rulesTitle": "Rules",
  "help.rulesList": [
    "You can only push, never pull: stand on one side and shove the crate one tile.",
    "One crate at a time; the tile ahead must be empty floor or a goal.",
    "A crate in a corner (blocked in two orthogonal directions) that is not on a goal can never be pushed out — avoid it.",
    "Goals may hold you or a crate; the level ends when every crate is on a goal.",
  ],
  "help.ctrlTitle": "Controls",
  "help.ctrlList": [
    "Arrow keys / WASD: walk and push",
    "Touch: swipe on the yard to move that way",
    "Z: undo · R: restart · P: pause",
  ],
  "help.scoreTitle": "Scoring",
  "help.score": "Base + push bonus + time bonus, out of 1000. Pushes at or under the par push count score full marks; each extra push costs 9 points. Faster finishes score higher. 3 stars = 90% of the max.",
  "help.keysTitle": "Shortcuts",
  "help.keysList": [
    "Arrow keys / WASD: walk and push",
    "Z / Backspace: undo one step",
    "R: restart the level",
    "H: help · P: pause",
    "Esc: close dialogs",
  ],

  "toast.locked": "Clear earlier levels first",
  "toast.noUndo": "Nothing to undo",
  "toast.blocked": "Can't push",
  "toast.paused": "Paused",
  "toast.resumed": "Resumed",
  "toast.noPersist": "Storage unavailable; progress won't be saved",
  "toast.hint": "Push that way",
  "toast.hintNone": "No hint available right now",
  "toast.cleared": "Cleared!",

  "dir.up": "up",
  "dir.down": "down",
  "dir.left": "left",
  "dir.right": "right",

  "sr.moved": "Level {level}: {moves} moves, {pushes} pushes",
  "sr.undone": "Undone; {moves} moves now",
  "sr.win": "Cleared! {pushes} pushes, {time}, score {score}",
  "sr.progress": "Crates {done}/{total}",
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
