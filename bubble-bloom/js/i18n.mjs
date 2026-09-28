// filepath: games/bubble-bloom/js/i18n.mjs

// 全站共享语言偏好：localStorage["doin.lang"]

export const LOCALES = ["zh", "en"];
export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "en";

export const strings = {
  zh: {
    "app.backHome": "← DOIN",
    "app.nameZh": "合成泡泡",
    "app.nameEn": "Bubble Bloom",
    "app.langOther": "EN",
    "app.soundOn": "音效开",
    "app.soundOff": "音效关",

    "mode.standard": "标准舱",
    "mode.daily": "每日试验",
    "mode.dailyNote": "每日种子 {date} · 全世界同一序列",

    "stat.score": "总分",
    "stat.best": "纪录",
    "stat.tier": "最高阶",
    "stat.chain": "最长连锁",
    "stat.drops": "投放次数",

    "label.current": "当前",
    "label.next": "下一颗",

    "tool.pulse": "潮汐脉冲",
    "tool.pause": "暂停",
    "tool.resume": "继续",
    "tool.restart": "重开",
    "tool.help": "玩法",

    "overlay.readyTitle": "合成泡泡",
    "overlay.readyText": "把同阶彩泡投进玻璃合成舱，它们一碰就膨胀合成。堆出连锁，别让泡堆越过警戒线。",
    "overlay.readyBtn": "开始实验",
    "overlay.pauseTitle": "实验暂停",
    "overlay.pauseText": "合成舱已静止。准备好后继续。",
    "overlay.pauseBtn": "继续实验",

    "hint.aim": "移动选择落点，松手投放 · ←/→ 微调 · 空格投放 · T 脉冲 · P 暂停 · R 重开",

    "codex.title": "图鉴",

    "tier.1": "微粒泡",
    "tier.2": "露珠泡",
    "tier.3": "珠光泡",
    "tier.4": "彩糖泡",
    "tier.5": "月晕泡",
    "tier.6": "星屑泡",
    "tier.7": "云团泡",
    "tier.8": "虹膜泡",
    "tier.9": "极光泡",
    "tier.10": "极光王泡",

    "rank.1": "试管学徒",
    "rank.2": "折光大师",
    "rank.3": "极光炼金师",

    "result.title": "实验结算",
    "result.score": "总分",
    "result.tier": "最高阶",
    "result.chain": "最长连锁",
    "result.drops": "投放次数",
    "result.record": "新纪录",
    "result.again": "再来一局",
    "result.close": "关闭",

    "help.title": "玩法说明",
    "help.intro": "向深海玻璃合成舱投入炼金彩泡，同阶相碰即膨胀合成，一路升到极光王泡。",
    "help.r1": "在轨道上选择落点，松手投放；键盘用 ← → 微调、空格投放。",
    "help.r2": "入舱的泡受重力与碰撞影响，会滚动、挤压、堆叠。",
    "help.r3": "同一次投放引发的连续合成计入压力连锁，倍率 1.25 / 1.6 / 2.0 递增后封顶。",
    "help.r4": "每局 2 次潮汐脉冲（T），轻微扰动静止泡堆，用来分离卡缝或促成接触。",
    "help.r5": "任意泡持续越过警戒线超过缓冲时间即结算；两枚极光王泡相撞触发彩虹绽放，清除低阶泡并给出高额奖励。",
    "help.keysTitle": "键位",
    "help.kMove": "左右微调落点",
    "help.kDrop": "投放当前泡",
    "help.kPulse": "潮汐脉冲",
    "help.kPause": "暂停 / 继续",
    "help.kRestart": "重开一局",
    "help.close": "开始实验",

    "toast.pulseOk": "潮汐脉冲 · 剩余 {left} 次",
    "toast.pulseEmpty": "本局脉冲已用完",
    "toast.pulseCd": "脉冲充能中 · {s} 秒",
    "toast.paused": "已暂停",
    "toast.resumed": "继续实验",

    "chain.pop": "压力连锁 ×{n}",

    "aria.board": "玻璃合成舱",
    "aria.sound": "音效开关",
    "aria.lang": "切换语言",

    "over.notice": "泡堆越过警戒线，实验结束"
  },

  en: {
    "app.backHome": "← DOIN",
    "app.nameZh": "Bubble Bloom",
    "app.nameEn": "Bubble Bloom",
    "app.langOther": "中文",
    "app.soundOn": "Sound on",
    "app.soundOff": "Sound off",

    "mode.standard": "Standard",
    "mode.daily": "Daily Trial",
    "mode.dailyNote": "Seed {date} · same sequence for everyone",

    "stat.score": "Score",
    "stat.best": "Best",
    "stat.tier": "Top Tier",
    "stat.chain": "Longest Chain",
    "stat.drops": "Drops",

    "label.current": "Current",
    "label.next": "Next",

    "tool.pulse": "Tide Pulse",
    "tool.pause": "Pause",
    "tool.resume": "Resume",
    "tool.restart": "Restart",
    "tool.help": "How to",

    "overlay.readyTitle": "Bubble Bloom",
    "overlay.readyText": "Drop matching alchemy bubbles into the glass chamber — they swell and merge on contact. Build chains, keep the stack below the warning line.",
    "overlay.readyBtn": "Start",
    "overlay.pauseTitle": "Paused",
    "overlay.pauseText": "The chamber is still. Resume whenever you are ready.",
    "overlay.pauseBtn": "Resume",

    "hint.aim": "Move to aim, release to drop · ←/→ nudge · Space drops · T pulse · P pause · R restart",

    "codex.title": "Codex",

    "tier.1": "Mote",
    "tier.2": "Dewdrop",
    "tier.3": "Pearl",
    "tier.4": "Praline",
    "tier.5": "Halo",
    "tier.6": "Stardust",
    "tier.7": "Nimbus",
    "tier.8": "Iris",
    "tier.9": "Aurora",
    "tier.10": "Aurora King",

    "rank.1": "Test Tube Apprentice",
    "rank.2": "Refraction Master",
    "rank.3": "Aurora Alchemist",

    "result.title": "Run Complete",
    "result.score": "Score",
    "result.tier": "Top Tier",
    "result.chain": "Longest Chain",
    "result.drops": "Drops",
    "result.record": "New Record",
    "result.again": "Play Again",
    "result.close": "Close",

    "help.title": "How to Play",
    "help.intro": "Drop alchemy bubbles into a deep-sea glass chamber. Matching tiers swell and merge on contact, all the way up to the Aurora King.",
    "help.r1": "Pick a drop point on the rail and release; on keyboard use ← → to nudge and Space to drop.",
    "help.r2": "Bubbles obey gravity and collisions — they roll, squeeze and stack.",
    "help.r3": "Consecutive merges from one drop count as a Pressure Chain: ×1.25 / ×1.6 / ×2.0, then capped.",
    "help.r4": "Two Tide Pulses per run (T) gently disturb a settled stack to unstick gaps or force contact.",
    "help.r5": "The run ends when any bubble stays above the warning line past the grace period. Two Aurora Kings colliding trigger a Rainbow Bloom: low tiers clear out and a large bonus lands.",
    "help.keysTitle": "Keys",
    "help.kMove": "Nudge drop point",
    "help.kDrop": "Drop current bubble",
    "help.kPulse": "Tide Pulse",
    "help.kPause": "Pause / resume",
    "help.kRestart": "Restart run",
    "help.close": "Start",

    "toast.pulseOk": "Tide Pulse · {left} left",
    "toast.pulseEmpty": "No pulses left this run",
    "toast.pulseCd": "Pulse charging · {s}s",
    "toast.paused": "Paused",
    "toast.resumed": "Resumed",

    "chain.pop": "Pressure Chain ×{n}",

    "aria.board": "Glass merge chamber",
    "aria.sound": "Toggle sound",
    "aria.lang": "Switch language",

    "over.notice": "The stack crossed the warning line — run over"
  }
};

export function isLocale(value) {
  return typeof value === "string" && LOCALES.indexOf(value) !== -1;
}

export function format(template, vars) {
  const text = typeof template === "string" ? template : "";
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));
}

export function loadLocale() {
  try {
    const store = typeof localStorage === "undefined" ? null : localStorage;
    if (!store) return null;
    const value = store.getItem(LANG_KEY);
    return isLocale(value) ? value : null;
  } catch (error) {
    return null;
  }
}

export function saveLocale(locale) {
  if (!isLocale(locale)) return;
  try {
    const store = typeof localStorage === "undefined" ? null : localStorage;
    if (store) store.setItem(LANG_KEY, locale);
  } catch (error) {
    /* 存储不可用时静默降级 */
  }
}

export function detectLocale() {
  const saved = loadLocale();
  if (isLocale(saved)) return saved;
  try {
    const nav = typeof navigator === "undefined" ? null : navigator;
    const lang = nav && typeof nav.language === "string" ? nav.language.toLowerCase() : "";
    if (lang.indexOf("zh") === 0) return "zh";
    if (lang.indexOf("en") === 0) return "en";
  } catch (error) {
    /* 环境无 navigator 时继续走默认值 */
  }
  return DEFAULT_LOCALE;
}

export function htmlLang(locale) {
  return locale === "zh" ? "zh-CN" : "en";
}

export function t(locale, key, vars) {
  const table = strings[isLocale(locale) ? locale : DEFAULT_LOCALE];
  const value = table[key];
  if (typeof value !== "string") return String(key);
  return format(value, vars);
}
