// i18n.mjs - bilingual tables for the instruction-programming robot puzzle.
// The locale preference is owned by the portal-wide key "doin.lang".
// strings.en must stay free of Chinese characters except the language button.
//
// Level and chapter names live here (not in levels.mjs) so the generated level
// data stays free of bare Chinese strings, matching the站内 i18n contract.

export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";

const zh = {
  langBtn: "EN",
  docTitle: "微缩指令机器人 · DOIN 在线小游戏",
  appTitle: "指令机器人",
  back: "← 门户",
  sound: "音效",
  soundOn: "🔊",
  soundOff: "🔇",
  help: "玩法",
  langName: "语言",
  close: "关闭",

  levelLabel: "关卡",
  chapterLabel: "卷",
  parLabel: "最优",
  linesLabel: "行数",
  stepsLabel: "步数",
  starsLabel: "星",
  bestLabel: "最佳",
  missionLabel: "任务",

  programLabel: "指令序列",
  paletteLabel: "磁贴盒",
  mainName: "MAIN",
  procName: "PROC1",
  blankSlot: "空槽",
  slotAria: "{proc} 第 {n} 槽",
  paletteAria: "{name} 磁贴",

  run: "运行",
  pause: "暂停",
  stepOnce: "单步",
  reset: "复位",
  clear: "清空",
  speedLabel: "速度",
  speedSlow: "慢",
  speedFast: "快",
  lineCount: "{n} 行",
  overPar: "超出最优 {n} 行",
  onPar: "已是最优行数",

  statusIdle: "待命",
  statusRunning: "执行中",
  statusPaused: "已暂停",
  statusWon: "通关",
  statusError: "出错",
  statusHalted: "已停机",

  traceTitle: "执行轨迹",
  traceEmpty: "尚无执行记录",
  traceFrame: "第 {n} 帧",

  winTitle: "通关",
  winOptimal: "完美 · 最优行数",
  failTitle: "未通关",
  failBlockedHint: "机器人撞上了墙或坑，检查前进路线。",
  failShortHint: "程序跑完了，还有灯没点亮。",
  resultLines: "{lines} 行 · 最优 {par} 行",
  resultStars: "{stars} 星",
  newBest: "新纪录",
  nextLevel: "下一关",
  retryLevel: "重试本关",
  levelSelect: "选关",
  closeLevels: "收起关卡谱",

  levelsTitle: "关卡谱",
  levelsIntro: "五卷共二十一关。点灯、跳跃、子程序、色块与推箱，逐层加深。",
  progress: "已通 {n}/{total} 关 · 共 {stars} 星",
  lockedLevel: "未解锁",
  chapterStars: "{stars}/{max} 星",

  toastPlaced: "已填入磁贴",
  toastRemoved: "已取回磁贴",
  toastCleared: "已清空本关程序",
  toastRunFirst: "先按运行看一遍",
  toastLocked: "通关上一关才会解锁",

  helpTitle: "玩法说明",
  helpGoal: "点亮盘面上所有灯砖。灯砖被踩上去即点亮，全部点亮立刻通关。",
  helpSlot: "点选下方磁贴填入空槽；点已填的槽取回，拖动可重排。",
  helpRun: "按运行逐帧执行；可暂停、单步、调速，随时复位重来。",
  helpJump: "跳跃越过一格台阶，落差必须正好一层。",
  helpAct: "动作负责点亮灯砖、推动箱子，原地生效不前进。",
  helpColor: "带色磁贴只在同色地砖上生效，其余时候自动跳过。",
  helpProc: "PROC1 是子程序：调用磁贴跳进去执行，执行完自动返回。",
  helpStar: "三星 = 最优行数，二星 = 最优 +2 行以内，一星 = 通关即可。",
  helpCrate: "把箱子推到开关上，闸门才会降下放行。",
  helpSave: "进度与草稿保存在本机浏览器，换设备不会同步。",

  ariaBoard: "机器人棋盘",
  ariaTile: "第 {x} 列第 {y} 行的地块",
  ariaRun: "执行当前程序",

  op: {
    f: "前进",
    l: "左转",
    r: "右转",
    j: "跳跃",
    a: "动作",
    p: "调用",
  },
  opHint: {
    f: "朝当前方向走一格",
    l: "原地左转九十度",
    r: "原地右转九十度",
    j: "越一格台阶跳到同高落点",
    a: "点亮灯砖或推动箱子",
    p: "跳进 PROC1 执行并返回",
  },
  color: {
    r: "红格",
    b: "蓝格",
    g: "绿格",
  },
  err: {
    blocked: "第 {n} 行撞墙或踩空，执行中断。",
    loop: "第 {n} 行检测到递归死循环，执行中断。",
    stack: "第 {n} 行调用层数过深，执行中断。",
    limit: "执行步数超出上限，已强制停机。",
  },

  chapter: {
    1: "初识伺服",
    2: "飞跃台阶",
    3: "子程序",
    4: "色块分流",
    5: "推箱机关",
  },
  lesson: {
    1: "用前进与转向把机器人送上灯砖。",
    2: "跳跃能越过一层台阶，落点必须与起点同高。",
    3: "把重复动作写进 PROC1，再用调用磁贴复用。",
    4: "带色指令只在对应颜色的地砖上生效。",
    5: "推箱压住开关，闸门才会降下。",
  },
  level: {
    1: "点亮第一灯",
    2: "转角台阶",
    3: "双灯回廊",
    4: "三灯之字",
    5: "越级而上",
    6: "双灯飞跃",
    7: "三灯连跳",
    8: "转体跳台",
    9: "长阶四灯",
    10: "递归点灯",
    11: "三灯循环",
    12: "四灯回环",
    13: "跳跃子程序",
    14: "蓝格指令",
    15: "红蓝分流",
    16: "绿阶规程",
    17: "跳跃红格",
    18: "六灯合奏",
    19: "推箱开门",
    20: "双灯长廊",
    21: "蓝格长廊",
  },
};

const en = {
  langBtn: "中文",
  docTitle: "Pocket Instruction Robot · DOIN Online Games",
  appTitle: "Instruction Robot",
  back: "← Portal",
  sound: "Sound",
  soundOn: "🔊",
  soundOff: "🔇",
  help: "How to play",
  langName: "Language",
  close: "Close",

  levelLabel: "Stage",
  chapterLabel: "Volume",
  parLabel: "Par",
  linesLabel: "Lines",
  stepsLabel: "Steps",
  starsLabel: "Stars",
  bestLabel: "Best",
  missionLabel: "Mission",

  programLabel: "Program",
  paletteLabel: "Tile box",
  mainName: "MAIN",
  procName: "PROC1",
  blankSlot: "Empty slot",
  slotAria: "{proc} slot {n}",
  paletteAria: "{name} tile",

  run: "Run",
  pause: "Pause",
  stepOnce: "Step",
  reset: "Reset",
  clear: "Clear",
  speedLabel: "Speed",
  speedSlow: "Slow",
  speedFast: "Fast",
  lineCount: "{n} lines",
  overPar: "{n} lines over par",
  onPar: "Par achieved",

  statusIdle: "Standby",
  statusRunning: "Running",
  statusPaused: "Paused",
  statusWon: "Cleared",
  statusError: "Fault",
  statusHalted: "Halted",

  traceTitle: "Execution trace",
  traceEmpty: "Nothing executed yet",
  traceFrame: "Frame {n}",

  winTitle: "Cleared",
  winOptimal: "Perfect · par achieved",
  failTitle: "Not cleared",
  failBlockedHint: "The bot hit a wall or a pit. Check the forward path.",
  failShortHint: "The program finished with lamps still dark.",
  resultLines: "{lines} lines · par {par}",
  resultStars: "{stars} stars",
  newBest: "New record",
  nextLevel: "Next stage",
  retryLevel: "Retry stage",
  levelSelect: "Stages",
  closeLevels: "Close the stage list",

  levelsTitle: "Stage Book",
  levelsIntro: "Five volumes, twenty-one stages. Lamps, jumps, subroutines, color gates and crates.",
  progress: "{n}/{total} cleared · {stars} stars",
  lockedLevel: "Locked",
  chapterStars: "{stars}/{max} stars",

  toastPlaced: "Tile placed",
  toastRemoved: "Tile removed",
  toastCleared: "Program cleared",
  toastRunFirst: "Run it once first",
  toastLocked: "Clear the previous stage to unlock",

  helpTitle: "How to play",
  helpGoal: "Light every lamp on the board. Stepping onto a lamp lights it; light them all to clear the stage.",
  helpSlot: "Tap a tile below to fill a slot; tap a filled slot to take it back.",
  helpRun: "Run executes frame by frame. Pause, single-step, change speed, or reset at any time.",
  helpJump: "Jump clears one step of height and must land exactly one level up or down.",
  helpAct: "Act lights lamps and pushes crates where you stand-it never moves you.",
  helpColor: "A colored tile only fires on a floor of that color; otherwise it is skipped.",
  helpProc: "PROC1 is a subroutine: the call tile jumps in, runs it, then returns.",
  helpStar: "Three stars means par lines, two stars within par +2, one star for any clear.",
  helpCrate: "Push a crate onto a switch and the gate drops open.",
  helpSave: "Progress and drafts stay in this browser only — they do not sync across devices.",

  ariaBoard: "Robot board",
  ariaTile: "Tile at column {x}, row {y}",
  ariaRun: "Run the current program",

  op: {
    f: "Forward",
    l: "Turn left",
    r: "Turn right",
    j: "Jump",
    a: "Act",
    p: "Call",
  },
  opHint: {
    f: "Move one cell forward",
    l: "Turn ninety degrees left",
    r: "Turn ninety degrees right",
    j: "Leap one step of height",
    a: "Light a lamp or push a crate",
    p: "Jump into PROC1 and return",
  },
  color: {
    r: "Red",
    b: "Blue",
    g: "Green",
  },
  err: {
    blocked: "Line {n} hit a wall or a pit. Execution stopped.",
    loop: "Line {n} detected a recursive loop. Execution stopped.",
    stack: "Line {n} nested too deep. Execution stopped.",
    limit: "Step limit reached, execution halted.",
  },

  chapter: {
    1: "First Servo",
    2: "Leap and Climb",
    3: "Subroutine",
    4: "Color Gates",
    5: "Crate Works",
  },
  lesson: {
    1: "Walk the bot onto the lamp with forward and turns.",
    2: "Jump clears one step of height and must land level.",
    3: "Move repeated moves into PROC1 and reuse them with calls.",
    4: "Colored instructions only fire on matching floor colors.",
    5: "Push a crate onto the switch to drop the gate.",
  },
  level: {
    1: "First Light",
    2: "Corner Step",
    3: "Twin Lamps",
    4: "Zigzag Trio",
    5: "Hop Up",
    6: "Twin Leap",
    7: "Triple Hop",
    8: "Pivot Leap",
    9: "Long Stair",
    10: "Recursive Light",
    11: "Loop of Three",
    12: "Four-Lamp Loop",
    13: "Jump Routine",
    14: "Blue Command",
    15: "Two-Tone Split",
    16: "Green Protocol",
    17: "Red Hopper",
    18: "Six-Lamp Chorus",
    19: "Crate and Gate",
    20: "Long Gallery",
    21: "Blue Gallery",
  },
};

export const strings = { zh, en };
export const LOCALES = ["zh", "en"];

export function normalizeLocale(value) {
  return value === "en" ? "en" : "zh";
}

export function htmlLang(locale) {
  return normalizeLocale(locale) === "en" ? "en" : "zh-CN";
}

export function translate(locale, key, vars) {
  const table = strings[normalizeLocale(locale)] || zh;
  let text = table[key];
  if (text === undefined) text = zh[key];
  if (text === undefined || typeof text !== "string") return key;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) => (vars[name] !== undefined ? String(vars[name]) : match));
}

// Nested tables (op / color / chapter / level / lesson / err) share one lookup
// so callers never hard-code a label from the wrong locale.
export function lookup(locale, group, id) {
  const table = strings[normalizeLocale(locale)] || zh;
  const groupTable = table[group];
  if (!groupTable || typeof groupTable !== "object") return String(id);
  const value = groupTable[id];
  if (value !== undefined) return value;
  const fallback = zh[group];
  return fallback && fallback[id] !== undefined ? fallback[id] : String(id);
}

export const chapterName = (locale, id) => lookup(locale, "chapter", id);
export const levelName = (locale, id) => lookup(locale, "level", id);
export const lessonText = (locale, id) => lookup(locale, "lesson", id);
export const colorName = (locale, id) => lookup(locale, "color", id);

// "F:r" -> "前进·红格" / "Forward · Red". A plain code resolves to the bare op.
// Unknown codes are returned untouched so a typo shows up verbatim in the UI
// instead of silently turning into a lowercase label.
export function instructionName(locale, code) {
  if (typeof code !== "string" || code === "") return "";
  const [rawOp, rawColor] = code.split(":");
  const opKey = String(rawOp || "").toLowerCase();
  if (!strings.zh.op[opKey]) return code;
  const op = lookup(locale, "op", opKey);
  if (!rawColor) return op;
  const sep = normalizeLocale(locale) === "en" ? " · " : "·";
  return `${op}${sep}${colorName(locale, rawColor.toLowerCase())}`;
}

// Error text needs the offending slot line, which lives in meta.at.ip.
// The err group is nested, so it resolves through lookup() and substitutes here.
export function errorText(locale, error) {
  const code = error && typeof error === "object" ? error.code : null;
  const ip = error && error.at && Number.isInteger(error.at.ip) ? error.at.ip + 1 : 0;
  const key = code && strings.zh.err[code] ? code : "blocked";
  return lookup(locale, "err", key).replace(/\{(\w+)\}/g, (match, name) => (
    name === "n" ? String(ip || "?") : match
  ));
}
