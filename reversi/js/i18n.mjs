// i18n：中英双语字符串表 + 全站共享语言偏好。
//
// 硬性铁律（AGENTS.md §5.2.4）：
//   · 全站共享 key 是 localStorage["doin.lang"]，严禁私有语言 key；
//   · strings.en 绝无汉字（仅语言切换按钮的"中文"字样例外，check-game 白名单放行）；
//   · 任何模块都不得裸写展示文案 —— 章节名、档位名、题面文案一律经此查表；
//   · 语言切换必须原地热更新，严禁 location.reload()，更不许重置正在进行的对局。
//
// 默认语言规则：doin.lang 有合法值 → 用它；否则浏览器语言 zh* → 中文，其余 → 英文。

export const LOCALES = Object.freeze(["zh", "en"]);
export const LOCALE_ZH = "zh";
export const LOCALE_EN = "en";
export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = LOCALE_ZH;

const STRINGS = {
  zh: {
    // ── 页面与机台 ────────────────────────────────────────────────
    docTitle: "黑白翻转 · DOIN 在线小游戏",
    metaDesc:
      "黑白棋（奥赛罗 / 翻转棋）在线对弈：8×8 夹击翻转，见习 / 棋手 / 名手 / 无谬四档 AI，60 道求解器校验残局，空位 ≤ 14 时显示精确终局预报，无需下载即点即玩。",
    title: "黑白翻转",
    subtitle: "奥赛罗 · 夹击反转棋",
    backHome: "返回门户",
    noscript: "需要启用 JavaScript 才能游玩黑白翻转。",
    sound: "音效",
    ariaSound: "音效开关",
    ariaLang: "切换语言",
    ariaHelp: "玩法说明",
    langLabel: "Switch to English",
    langShort: "EN",

    // ── 模式（PRD §3.7 数据键名规划）──────────────────────────────
    mode_play: "对弈",
    mode_puzzle: "残局破题",
    mode_rush: "翻转冲刺",
    mode_setup: "摆盘求助",

    // ── AI 档位 ───────────────────────────────────────────────────
    ai_novice: "见习",
    ai_duelist: "棋手",
    ai_virtuoso: "名手",
    ai_infallible: "无谬",
    tierLabel: "档位",

    // ── 开局 ──────────────────────────────────────────────────────
    open_standard: "标准",
    open_diagonal: "对角",
    open_perp: "垂直",
    open_parallel: "平行",
    open_random: "随机前二",
    openingLabel: "开局",

    // ── 章节 ──────────────────────────────────────────────────────
    ch_corner: "得角",
    ch_trap: "避坑",
    ch_starve: "断机动",
    ch_cascade: "连环翻",
    ch_comeback: "绝地逆转",
    ch_endgame: "终局精算",
    ch_corner_desc: "角是永久锚点，一旦拿下永不丢失。",
    ch_trap_desc: "角旁的诱惑：X 位与 C 位，谁先落谁送角。",
    ch_starve_desc: "让对手无路可走，比多吃几子重要得多。",
    ch_cascade_desc: "一子八向，把整条线一次翻透。",
    ch_comeback_desc: "暂时少子是资产，不是劣势。",
    ch_endgame_desc: "空位少时，一切都可以算清。",
    chapterLabel: "章",
    ach_flip_eye: "翻转之眼",

    // ── 棋子与棋格 ────────────────────────────────────────────────
    disc_black: "黑子",
    disc_white: "白子",
    disc: "双面圆片",
    sq_corner: "角",
    sq_x: "X 位",
    sq_c: "C 位",
    sq_edge: "边",
    sq_inner: "内圈",

    // ── 状态 ──────────────────────────────────────────────────────
    st_pass: "无路可走 · 让位",
    st_end: "终局",
    st_draw: "平局",
    st_perfect: "完美局",
    st_thinking: "读局中",
    st_yourTurn: "你的回合",
    st_aiTurn: "对手回合",
    st_p2Turn: "轮到{side}",
    st_blackTurn: "黑方落子",
    st_whiteTurn: "白方落子",
    st_readingEndgame: "读到了终局",
    st_mustPass: "无路可走 · 让位",
    st_opponentPass: "对手无路可走",
    st_youPass: "你无路可走 · 已让位",

    // ── 指标与按钮 ────────────────────────────────────────────────
    stat_maxflip: "最大单步翻转",
    stat_swing: "最大反转幅度",
    stat_combo: "连击",
    stat_multiplier: "倍率",
    stat_score: "得分",
    stat_time: "剩余",
    stat_moves: "手数",
    stat_final: "终局比分",
    stat_best: "本机最高",
    stat_bestCombo: "最高连击",
    moveNo: "第 {n} 手",
    recordLabel: "战绩",
    recordLine: "胜 {w} · 和 {d} · 负 {l}",
    clearRecords: "清空战绩",
    confirmClear: "确定清空全部战绩与残局进度？",
    cancel: "取消",
    confirm: "确定",
    close: "关闭",
    undo: "悔棋",
    hint: "提示",
    resign: "认输",
    restart: "重开",
    again: "再来一局",
    next: "下一题",
    prev: "上一题",
    retry: "重试",
    settings: "设置",
    levels: "选关",
    undoLeft: "悔棋 {n}/{total}",
    hintLeft: "提示 {n}/{total}",
    undoEmpty: "没有可悔的棋",
    undoUsed: "本局悔棋次数已用完",
    hintUsed: "本局提示次数已用完",
    hintNoMove: "当前没有可用提示",

    // ── 设置项 ────────────────────────────────────────────────────
    sideLabel: "执子",
    pvpLabel: "本地双人",
    volume: "音量",
    blitz: "闪电战（每手 10 秒）",
    classicRule: "经典口径（终局空位不计）",
    showMobility: "对手落点提示",
    showPreview: "落子前预览翻转线",
    pvpOnly: "仅本地双人可用",

    // ── 终局预报（PRD §3.4 定案 2A）───────────────────────────────
    forecastLabel: "终局预报",
    forecastReady: "终局已可算清 · {side} +{n}",
    forecastDraw: "终局已可算清 · 平局",
    forecastTap: "点按查看最优首手",
    forecastLocked: "空位 {n} 个，尚不可算",
    forecastNotFound: "本题无最优解",

    // ── 残局 ──────────────────────────────────────────────────────
    pz_target: "黑先 · 达成终局 +{n}",
    pz_unique: "唯一解",
    pz_optimalCount: "最优首手 {n} 个",
    pz_wrong: "此手终局 {n} 子",
    pz_wrongBetter: "此手不如正解，可重选",
    pz_solved: "正解",
    pz_stars: "{n} 星",
    pz_starTotal: "总星数 {n} / {total}",
    pz_progress: "第 {c} 章 · 已解 {done}/{total}",
    pz_locked: "需在本章解出 {n} 题才能进入下一章",
    pz_solution: "正解回放",
    pz_solutionExit: "退出回放",
    pz_again: "再解一次",
    pz_hintFree: "提示不影响星级",
    pz_allDone: "60 题全三星 · 翻转之眼已点亮",
    pz_backToLevels: "回到选关",

    // ── 翻转冲刺 ──────────────────────────────────────────────────
    rush_intro: "90 秒，把翻转数变成分数。翻 2 子以上才续连击。",
    rush_start: "开始冲刺",
    rush_over: "时间到",
    rush_timeUp: "本次得分 {n}",
    rush_broken: "连击断",
    rush_bonus: "终局红利 +{n}",
    rush_best: "本机最高分 {n}",
    rush_newRecord: "新纪录",

    // ── 结算 ──────────────────────────────────────────────────────
    res_win: "你赢了",
    res_lose: "你输了",
    res_draw: "平局",
    res_blackWins: "黑方胜",
    res_whiteWins: "白方胜",
    res_yourScore: "终局比分 {b} : {w}",
    res_report: "对局档案",
    res_perfect: "完美局 64 : 0",
    res_none: "—",

    // ── 规则与无障碍 ──────────────────────────────────────────────
    ariaBoard: "黑白棋棋盘",
    ariaScale: "子数天平",
    ariaCell: "第 {r} 行第 {c} 列",
    ariaGraph: "子数曲线",
    rulesText:
      "在空格落子，若某个方向上「己方—对手若干枚—己方」形成一段连续夹击，被夹住的对手棋子全部翻面成为你的颜色。\n"
      + "八个方向同时判定；一步可以翻很多枚。\n"
      + "若轮到你却没有任何可落之子，必须让位（Pass）由对手连下。\n"
      + "双方都无处可落，或棋盘落满，即为终局。\n"
      + "终局时仍有空位则全部归子多的一方，因此终局总子数为 64，子多者胜、子数相同为平局。\n"
      + "四个角一经占下永不丢失，角旁的 X 位与 C 位是最危险的陷阱；中局领先子数往往是负担。",
  },
  en: {
    // ── Page & cabinet ───────────────────────────────────────────
    docTitle: "Reversi · DOIN games",
    metaDesc:
      "Play Reversi (Othello, the flip game) online: 8×8 sandwich flips, four AI tiers from Novice to Infallible, 60 solver-verified endgame puzzles and an exact endgame forecast with 14 squares left. No download, instant play.",
    title: "Reversi",
    subtitle: "The Flip Game",
    backHome: "Back to portal",
    noscript: "JavaScript is required to play Reversi.",
    sound: "Sound",
    ariaSound: "Toggle sound",
    ariaLang: "Switch language",
    ariaHelp: "How to play",
    langLabel: "切换到中文",
    langShort: "中文",

    // ── Modes ────────────────────────────────────────────────────
    mode_play: "Play",
    mode_puzzle: "Puzzles",
    mode_rush: "Flip Rush",
    mode_setup: "Setup",

    // ── AI tiers ─────────────────────────────────────────────────
    ai_novice: "Novice",
    ai_duelist: "Duelist",
    ai_virtuoso: "Virtuoso",
    ai_infallible: "Infallible",
    tierLabel: "Tier",

    // ── Openings ─────────────────────────────────────────────────
    open_standard: "Standard",
    open_diagonal: "Diagonal",
    open_perp: "Perpendicular",
    open_parallel: "Parallel",
    open_random: "Randomized",
    openingLabel: "Opening",

    // ── Chapters ─────────────────────────────────────────────────
    ch_corner: "Cornerstone",
    ch_trap: "Edge Trap",
    ch_starve: "Starve",
    ch_cascade: "Cascade",
    ch_comeback: "Comeback",
    ch_endgame: "Perfect Endgame",
    ch_corner_desc: "A corner is an anchor — claimed once, never lost.",
    ch_trap_desc: "The bait beside every corner: play the X or C square and you hand it over.",
    ch_starve_desc: "Cutting off your opponent's replies matters far more than eating discs.",
    ch_cascade_desc: "One disc, eight directions, an entire line turned at once.",
    ch_comeback_desc: "Being behind on discs can be an asset, not a weakness.",
    ch_endgame_desc: "With few squares left, everything can be counted out.",
    chapterLabel: "Chapter",
    ach_flip_eye: "The Flip Eye",

    // ── Discs & squares ──────────────────────────────────────────
    disc_black: "Black",
    disc_white: "White",
    disc: "Disc",
    sq_corner: "Corner",
    sq_x: "X-Square",
    sq_c: "C-Square",
    sq_edge: "Edge",
    sq_inner: "Inner",

    // ── Status ───────────────────────────────────────────────────
    st_pass: "No moves · Pass",
    st_end: "Endgame",
    st_draw: "Draw",
    st_perfect: "Perfect Game",
    st_thinking: "Reading",
    st_yourTurn: "Your turn",
    st_aiTurn: "Opponent's turn",
    st_p2Turn: "{side} to play",
    st_blackTurn: "Black to play",
    st_whiteTurn: "White to play",
    st_readingEndgame: "Endgame read",
    st_mustPass: "No moves · Pass",
    st_opponentPass: "Opponent has no move",
    st_youPass: "No moves for you · passed",

    // ── Metrics & buttons ────────────────────────────────────────
    stat_maxflip: "Max Flip",
    stat_swing: "Biggest Swing",
    stat_combo: "Combo",
    stat_multiplier: "Multiplier",
    stat_score: "Score",
    stat_time: "Time",
    stat_moves: "Moves",
    stat_final: "Final score",
    stat_best: "Best",
    stat_bestCombo: "Best combo",
    moveNo: "Move {n}",
    recordLabel: "Record",
    recordLine: "{w} W · {d} D · {l} L",
    clearRecords: "Clear record",
    confirmClear: "Erase all records and puzzle progress?",
    cancel: "Cancel",
    confirm: "Confirm",
    close: "Close",
    undo: "Undo",
    hint: "Hint",
    resign: "Resign",
    restart: "Restart",
    again: "Play again",
    next: "Next",
    prev: "Previous",
    retry: "Retry",
    settings: "Settings",
    levels: "Levels",
    undoLeft: "Undo {n}/{total}",
    hintLeft: "Hint {n}/{total}",
    undoEmpty: "Nothing to undo",
    undoUsed: "No undos left this game",
    hintUsed: "No hints left this game",
    hintNoMove: "No hint available here",

    // ── Settings ─────────────────────────────────────────────────
    sideLabel: "Side",
    pvpLabel: "Local 2P",
    volume: "Volume",
    blitz: "Blitz (10s per move)",
    classicRule: "Classic scoring (empties not awarded)",
    showMobility: "Show opponent's replies",
    showPreview: "Preview flipped line",
    pvpOnly: "Local 2P only",

    // ── Endgame forecast ─────────────────────────────────────────
    forecastLabel: "Endgame forecast",
    forecastReady: "Endgame solved · {side} +{n}",
    forecastDraw: "Endgame solved · Draw",
    forecastTap: "Tap for the optimal move",
    forecastLocked: "{n} squares left — not yet solvable",
    forecastNotFound: "No optimal line found",

    // ── Puzzles ──────────────────────────────────────────────────
    pz_target: "Black to play · reach +{n}",
    pz_unique: "Unique solution",
    pz_optimalCount: "{n} optimal moves",
    pz_wrong: "That move ends at {n}",
    pz_wrongBetter: "Not the best line — pick again",
    pz_solved: "Solved",
    pz_stars: "{n} stars",
    pz_starTotal: "Total stars {n} / {total}",
    pz_progress: "Chapter {c} · {done}/{total} solved",
    pz_locked: "Solve {n} puzzles in this chapter to unlock the next",
    pz_solution: "Solution replay",
    pz_solutionExit: "Exit replay",
    pz_again: "Play again",
    pz_hintFree: "Hints never cost stars",
    pz_allDone: "All 60 puzzles at three stars · The Flip Eye is lit",
    pz_backToLevels: "Back to levels",

    // ── Flip Rush ────────────────────────────────────────────────
    rush_intro: "90 seconds. Turn flips into points. Flip 2+ discs to keep the combo alive.",
    rush_start: "Start rush",
    rush_over: "Time's up",
    rush_timeUp: "Score {n}",
    rush_broken: "Combo broken",
    rush_bonus: "Win bonus +{n}",
    rush_best: "Best {n}",
    rush_newRecord: "New record",

    // ── Results ──────────────────────────────────────────────────
    res_win: "You win",
    res_lose: "You lose",
    res_draw: "Draw",
    res_blackWins: "Black wins",
    res_whiteWins: "White wins",
    res_yourScore: "Final score {b} : {w}",
    res_report: "Game report",
    res_perfect: "Perfect game 64 : 0",
    res_none: "—",

    // ── Rules & a11y ─────────────────────────────────────────────
    ariaBoard: "Reversi board",
    ariaScale: "Disc scale",
    ariaCell: "Row {r}, column {c}",
    ariaGraph: "Disc count graph",
    rulesText:
      "Play on an empty square. If a line runs your disc — one or more opponent discs — your disc, "
      + "every opponent disc caught in between flips to your colour.\n"
      + "All eight directions count at once, so a single move can flip many discs.\n"
      + "If you have no legal move, you must pass and your opponent plays twice in a row.\n"
      + "The game ends when the board is full or neither side can move.\n"
      + "Any squares left over go to whoever holds more discs, so the final total is always 64. "
      + "More discs wins; equal discs is a draw.\n"
      + "Corners can never be recaptured, the X and C squares beside them are the deadliest traps, "
      + "and leading on disc count in the midgame is usually a burden.",
  },
};

// 题库的 chapterKey（cornerstone / edge-trap / …）→ 展示文案 key 的桥接表。
// 放在文案层而不是数据层：puzzles.mjs 只允许出现英文 key 与盘面串，
// 而"哪个 key 对应哪句话"本身就是翻译关系。tests/i18n.test.mjs 会逐章校验这张表不缺项。
export const CHAPTER_I18N = Object.freeze({
  cornerstone: "ch_corner",
  "edge-trap": "ch_trap",
  starve: "ch_starve",
  cascade: "ch_cascade",
  comeback: "ch_comeback",
  "perfect-endgame": "ch_endgame",
});

export function chapterTitleKey(dataKey) {
  return CHAPTER_I18N[dataKey] ?? null;
}

export function chapterDescKey(dataKey) {
  const title = CHAPTER_I18N[dataKey];
  return title ? `${title}_desc` : null;
}

export function isLocale(value) {
  return typeof value === "string" && LOCALES.includes(value);
}

export function strings(locale) {
  return STRINGS[isLocale(locale) ? locale : DEFAULT_LOCALE];
}

// 命名占位符插值：format("第 {n} 手", { n: 3 }) → "第 3 手"。缺参退空串（绝不留 undefined）。
export function format(template, vars = {}) {
  return String(template).replace(/\{(\w+)\}/g, (match, key) => (vars[key] != null ? String(vars[key]) : ""));
}

// 浏览器语言 → locale：任何 zh 开头 → 中文，其余 → 英文。
export function detectLocale() {
  const languages = globalThis.navigator?.languages ?? [];
  const single = globalThis.navigator?.language ?? "";
  for (const tag of [...languages, single]) {
    if (typeof tag === "string" && tag.toLowerCase().startsWith("zh")) return LOCALE_ZH;
  }
  return LOCALE_EN;
}

function readStore() {
  try {
    return globalThis.localStorage ?? null;
  } catch (e) {
    return null;
  }
}

// 第一步：全站共享偏好优先；没有才看浏览器语言。
export function loadLocale() {
  const saved = readStore()?.getItem(LANG_KEY);
  if (isLocale(saved)) return saved;
  return detectLocale();
}

// 第二步：切换即写入全站共享偏好。非法值拒绝写入并返回 false。
export function saveLocale(locale) {
  if (!isLocale(locale)) return false;
  try {
    readStore()?.setItem(LANG_KEY, locale);
    return true;
  } catch (e) {
    return false;
  }
}

export function htmlLang(locale) {
  return locale === LOCALE_ZH ? "zh-CN" : "en";
}
