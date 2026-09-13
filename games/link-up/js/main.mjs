// 连连看 link-up · 装配入口：绑定事件、初始化 i18n/storage/audio/game/render/ui

import { loadLocale, htmlLang } from "./i18n.mjs?v=dev";
import * as storage from "./storage.mjs?v=dev";
import * as audio from "./audio.mjs?v=dev";
import { Game } from "./game.mjs?v=dev";
import * as ui from "./ui.mjs?v=dev";
import * as render from "./render.mjs?v=dev";

function main() {
  const locale = loadLocale();
  document.documentElement.lang = htmlLang(locale);

  const save = storage.load();
  audio.setEnabled(save.sound);

  const game = new Game({ storage, audio });
  ui.init({ game, storage, audio, locale });

  const fx = document.getElementById("fx-layer");
  if (fx) render.init(fx);

  game.on("start", (snap) => {
    render.setGrid(snap.rows, snap.cols);
    render.clear();
    ui.onStart(snap);
  });
  game.on("state", (snap) => ui.onState(snap));
  game.on("path", (p) => render.drawPath(p.path, () => game.confirmPathDone()));
  game.on("burst", (d) => {
    render.burstCell(d.a);
    render.burstCell(d.b);
  });
  game.on("reject", (cell) => ui.onReject(cell));
  game.on("hint", (pair) => ui.onHint(pair));
  game.on("shuffle", () => ui.onShuffle());
  game.on("noMove", () => ui.onNoMove());
  game.on("toast", (m) => ui.onToast(m));
  game.on("win", (result) => {
    ui.onWin(result);
    render.winEffect();
  });
  game.on("paused", () => ui.onPaused());
  game.on("resumed", () => ui.onResumed());

  // 首次手势解锁 Web Audio
  const unlockOnce = () => {
    audio.unlock();
    window.removeEventListener("pointerdown", unlockOnce);
  };
  window.addEventListener("pointerdown", unlockOnce);

  ui.showLevels();
}

main();
