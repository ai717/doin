// 森林冰火人 · 装配入口
import { FireIceGame, CONTROL_MODES } from "./game.mjs";
import { FireIceUI } from "./ui.mjs";
import { audio } from "./audio.mjs";

const game = new FireIceGame({
  levelIndex: 0,
  controlMode: CONTROL_MODES.DUAL
});

const ui = new FireIceUI(game);

// 首次任意交互手势解锁音频
const unlockAudio = () => {
  audio.init();
  audio.resume();
};
window.addEventListener("pointerdown", unlockAudio, { once: true });
window.addEventListener("keydown", unlockAudio, { once: true });

ui.start();
