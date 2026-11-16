// Pong Neo 入口装配模块

import { PongGame } from "./game.mjs";
import { PongUI } from "./ui.mjs";

document.addEventListener("DOMContentLoaded", () => {
  const game = new PongGame();
  const ui = new PongUI(game);
  ui.start();
});