// 魔塔：勇者登顶 · 装配入口
//
// 只做接线：读偏好 → 建局 → 建视图 → 订阅存档与结算，不承载任何玩法规则。

import { LEVELS } from "./levels.mjs";
import { createGame } from "./game.mjs";
import { createUi } from "./ui.mjs";
import { DEFAULT_LOCALE, htmlLang, normalizeLocale, translate } from "./i18n.mjs";
import { setMuted, sfx } from "./audio.mjs";
import {
  clearRun,
  loadLocale,
  loadMeta,
  loadRun,
  loadSound,
  recordClear,
  recordDefeat,
  saveLocale,
  saveRun,
  saveSound,
} from "./storage.mjs";
import { summarize } from "./score.mjs";

const PORTAL_META_KEY = "doin.meta.v1";

function reportSession(state, summary) {
  try {
    const payload = {
      slug: "magic-tower",
      outcome: summary.won ? "WON" : "LOST",
      score: summary.score || 0,
      stars: summary.won ? (summary.ending === "true" ? 3 : 2) : 0,
      timestamp: Date.now(),
    };
    const raw = localStorage.getItem(PORTAL_META_KEY);
    const meta = raw ? JSON.parse(raw) : {};
    meta.recentlyPlayed = [payload.slug, ...(Array.isArray(meta.recentlyPlayed) ? meta.recentlyPlayed.filter((s) => s !== payload.slug) : [])].slice(0, 8);
    meta.totalStars = (Number(meta.totalStars) || 0) + payload.stars;
    localStorage.setItem(PORTAL_META_KEY, JSON.stringify(meta));
  } catch {
    /* 门户元数据写入失败不影响游戏 */
  }
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "DOIN_GAME_EVENT", payload: { slug: "magic-tower", won: summary.won } }, "*");
    }
  } catch {
    /* 跨域沙箱忽略 */
  }
}

function boot() {
  let locale = normalizeLocale(loadLocale() || DEFAULT_LOCALE);
  let soundOn = loadSound();
  setMuted(!soundOn);

  const savedRun = loadRun(LEVELS);
  const game = createGame(LEVELS, savedRun ? { state: savedRun } : {});

  let resultShown = false;

  const ui = createUi({
    doc: document,
    game,
    translate,
    onSfx(name) {
      const fn = sfx[name];
      if (typeof fn === "function") fn();
    },
    onPersist() {
      const state = game.getState();
      if (state.status === "playing") saveRun(state);
    },
    onRestart() {
      resultShown = false;
      clearRun();
      game.restart();
      ui.render(game.getState());
    },
    onLang() {
      locale = locale === "en" ? "zh" : "en";
      saveLocale(locale);
      document.documentElement.lang = htmlLang(locale);
      ui.applyLocale(locale);
    },
    onSoundToggle() {
      soundOn = !soundOn;
      setMuted(!soundOn);
      saveSound(soundOn);
      ui.syncSound(soundOn);
      if (soundOn) sfx.coin();
    },
  });

  function settle(state) {
    if (state.status === "playing") return;
    if (resultShown) return;
    resultShown = true;
    const summary = summarize(state);
    let best = { improved: false };
    if (state.status === "victory") {
      best = recordClear(state);
      clearRun();
    } else {
      recordDefeat(state);
    }
    ui.renderRecords(loadMeta());
    ui.showResult(state, { improved: best.improved });
    reportSession(state, summary);
  }

  game.subscribe((state) => {
    if (state.status !== "playing") settle(state);
  });

  ui.applyLocale(locale);
  ui.syncSound(soundOn);
  ui.renderRecords(loadMeta());
  ui.start();

  const state = game.getState();
  if (state.status !== "playing") settle(state);

  // 调试句柄（门户约定：window.__<slug>，排查与自动化冒烟用；slug 含连字符走下标）
  window["__magic-tower"] = {
    game,
    ui,
    state: () => game.getState(),
    view: () => {
      const s = game.getState();
      return {
        floor: s.floor,
        status: s.status,
        ending: s.ending || null,
        x: s.x,
        y: s.y,
        steps: s.stats.steps,
        hp: s.hp,
        hpMax: s.hpMax,
        atk: s.atk,
        def: s.def,
        gold: s.gold,
        keys: { ...s.keys },
        flags: { ...s.flags },
      };
    },
    restart: () => game.restart(),
  };
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
