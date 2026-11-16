// i18n：中英双语字符串表 + 全站统一语言 API。
// 全站共享偏好 key：localStorage["doin.lang"]（首页与所有子游戏读写同一个）。
// 默认显示语言规则：doin.lang 有合法值 → 用它；否则浏览器语言 zh* → 中文，其余 → 英文。

export const LOCALES = Object.freeze(["zh", "en"]);
export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";

const STRINGS = {
  zh: {
    docTitle: "Tetris Neo | 经典俄罗斯方块在线游玩",
    titleStart: "TETRIS NEO",
    titleOver: "序列终止",
    titleResume: "重返矩阵",
    titlePause: "时空冻结",
    msgStart: "空间折叠，秩序重建",
    msgResume: "检测到未竟的对局记忆",
    msgOver: "终局得分: {0}",
    msgPause: "对局已挂起，静候指令",
    btnStart: "启动核心",
    btnResume: "继续对局",
    btnRestart: "重构序列",
    btnConfirm: "确认",
    cfgDifficulty: "难度",
    cfgBoard: "尺寸",
    diffCasual: "休闲",
    diffNormal: "标准",
    diffMaster: "大师",
    helpTitle: "控制中枢协议",
    next: "NEXT",
    highScore: "TOP",
    score: "SCORE",
    level: "LVL",
    lines: "LINES",
    backHome: "返回首页",
    noscript: "需要启用 JavaScript 才能游玩 Tetris Neo。",
    helpContent: `
                <div class="help-row"><span>左右平移</span><span>◀ ▶ / 滑动 / 鼠标拖拽</span></div>
                <div class="help-row"><span>方块旋转</span><span>▲ / W / ↻ / 上划 / 单击</span></div>
                <div class="help-row"><span>加速下落</span><span>▼ / S / 下拉 (防连落锁定)</span></div>
                <div class="help-row"><span>即刻触底</span><span>空格 / ⚡ / 双击屏幕</span></div>
                <div class="help-row"><span>时空冻结</span><span>P 键 / Esc / ⏸ 按钮</span></div>
            `,
  },
  en: {
    docTitle: "Tetris Neo | Cyber Block Arcade",
    titleStart: "TETRIS NEO",
    titleOver: "GAME OVER",
    titleResume: "RESUME RUN",
    titlePause: "PAUSED",
    msgStart: "Collapse Space, Rebuild Order",
    msgResume: "Previous incomplete run detected",
    msgOver: "Final Score: {0}",
    msgPause: "Operation suspended",
    btnStart: "START",
    btnResume: "RESUME",
    btnRestart: "REPLAY",
    btnConfirm: "GOT IT",
    cfgDifficulty: "DIFF",
    cfgBoard: "SIZE",
    diffCasual: "CASUAL",
    diffNormal: "NORMAL",
    diffMaster: "MASTER",
    helpTitle: "CONTROLS & GESTURES",
    next: "NEXT",
    highScore: "TOP",
    score: "SCORE",
    level: "LVL",
    lines: "LINES",
    backHome: "Home",
    noscript: "JavaScript is required to play Tetris Neo.",
    helpContent: `
                <div class="help-row"><span>Move Left/Right</span><span>◀ ▶ / Drag / Mouse Swipe</span></div>
                <div class="help-row"><span>Rotate</span><span>▲ / W / ↻ / Swipe Up / Click</span></div>
                <div class="help-row"><span>Soft Drop</span><span>▼ / S / Drag Down (Safe Lock)</span></div>
                <div class="help-row"><span>Hard Drop</span><span>Space / ⚡ / Double Click</span></div>
                <div class="help-row"><span>Pause</span><span>P / Esc / ⏸ Icon</span></div>
            `,
  },
};

export function isLocale(value) {
  return LOCALES.includes(value);
}

export function strings(locale) {
  return STRINGS[locale] ?? STRINGS[DEFAULT_LOCALE];
}

// 简单插值："终局得分: {0}" + format(t, 1200) → "终局得分: 1200"
export function format(template, ...args) {
  return String(template).replace(/\{(\d+)\}/g, (match, index) => {
    const value = args[Number(index)];
    return value === undefined ? match : String(value);
  });
}

// 浏览器语言 → locale：任何 zh 开头 → 中文，否则英文。
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

// 统一规则第一步：全站共享偏好优先。
export function loadLocale() {
  const store = readStore();
  const saved = store?.getItem(LANG_KEY);
  if (isLocale(saved)) return saved;
  return detectLocale();
}

// 统一规则第二步：切换即写入全站共享偏好。
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
