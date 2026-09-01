import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("game markup has one page heading and accessible controls", async () => {
  const markup = await readFile(new URL("index.html", root), "utf8");
  assert.equal((markup.match(/<h1>/g) ?? []).length, 1);
  assert.match(markup, /id="game-board"/);
  assert.match(markup, /aria-live="polite"/);
  assert.match(markup, /class="status-bar"/);
  assert.match(markup, /aria-label="撤销"/);
  assert.match(markup, /aria-label="重置"/);
  assert.match(markup, /id="hint-button"/);
  assert.match(markup, /id="constellation-label"/);
  assert.match(markup, /id="daily-button"/);
  assert.match(markup, /id="continue-daily-button"/);
  assert.match(markup, /id="reset-layer"/);
  assert.doesNotMatch(markup, /stuck-layer|stuck-undo-button|stuck-close-button/);
  assert.match(markup, /id="sound-button"/);
  assert.match(markup, /aria-pressed="true"/);
  for (const layer of ["background", "tracks", "track-effects", "orbs", "core", "overlay-effects"]) {
    assert.match(markup, new RegExp(`data-layer="${layer}"`));
  }
});

test("renderer keeps the required keyed SVG layers and focusable controls", async () => {
  const [main, bootstrap, game, renderer] = await Promise.all([
    readFile(new URL("js/main.mjs", root), "utf8"),
    readFile(new URL("js/bootstrap.mjs", root), "utf8"),
    readFile(new URL("js/game.mjs", root), "utf8"),
    readFile(new URL("js/renderer.mjs", root), "utf8"),
  ]);
  for (const layer of ["background", "tracks", "orbs", "core"]) {
    assert.match(renderer, new RegExp(layer));
  }
  assert.match(renderer, /orbNodes/);
  assert.match(renderer, /tabindex: 0/);
  assert.match(renderer, /showCompletion/);
  assert.match(renderer, /showUnfreeze/);
  assert.match(renderer, /flashTrack/);
  assert.match(renderer, /clearHint/);
  assert.match(renderer, /dataset\.selected/);
  assert.match(renderer, /board\.dataset\.phase/);
  assert.match(renderer, /showTransfer/);
  assert.match(renderer, /star-dust/);
  assert.match(renderer, /orb-aura/);
  assert.match(renderer, /orb-ring/);
  assert.match(renderer, /planet-gradient/);
  assert.match(renderer, /orb-cloud/);
  assert.doesNotMatch(renderer, /orb-symbol/);
  assert.doesNotMatch(renderer, /SYMBOLS/);
  assert.match(renderer, /track-mouth/);
  assert.match(renderer, /core-orbit/);
  assert.match(renderer, /nebula-cloud/);
  assert.match(renderer, /track-glow/);
  assert.match(renderer, /nebula-wisp/);
  assert.match(renderer, /bright-star/);
  assert.doesNotMatch(renderer, /insertBefore\(layers\.core, layers\.orbs\)/);
  const markup = await readFile(new URL("index.html", root), "utf8");
  assert.ok(markup.indexOf('data-layer="core"') < markup.indexOf('data-layer="orbs"'));
  assert.match(renderer, /pointAt\(record\.angle, 178 \+ \(track\.orbs\.length - 1 - index\) \* gap\)/);
  assert.doesNotMatch(renderer, /pointAt\(record\.angle, 430 - index \* gap\)/);
  assert.match(main, /from "\.\.\/engine\.mjs\?v=dev"/);
  assert.match(main, /from "\.\.\/levels\.mjs\?v=dev"/);
  assert.match(main, /new Worker\("\.\/solver-worker\.mjs\?v=dev", \{ type: "module" \}\)/);
  assert.match(main, /hint && hint\.targetTrackId !== null/);
  assert.match(main, /const CHAPTERS = \[/);
  assert.match(main, /createDailyLevel/);
  assert.match(main, /recordDailyCompletion/);
  assert.match(main, /openDialog/);
  assert.match(main, /event\.key === "Escape"/);
  assert.match(main, /renderer\.showGuide/);
  assert.match(main, /createGame/);
  assert.match(main, /export function bootstrap\(\)/);
  assert.match(bootstrap, /import \{ bootstrap \} from "\.\/main\.mjs\?v=dev"/);
  assert.match(bootstrap, /bootstrap\(\);/);
  assert.match(main, /game\.dispatch\(\{ target: "track", id: trackId \}\)/);
  assert.match(main, /game\.dispatch\(\{ target: "dock", id: dockId \}\)/);
  assert.doesNotMatch(main, /legalActions\(/);
  assert.doesNotMatch(main, /next\.status === "stuck" &&/);
  assert.match(main, /Deadlock is a post-move state/);
  assert.doesNotMatch(main, /stuckLayer|stuckUndoButton|stuckCloseButton/);
  assert.doesNotMatch(main, /const action = state\.selectedDockId/);
  assert.match(game, /import \{ applyIntent, legalActions, reset, undo \}/);
  assert.match(game, /const result = applyIntent\(state, intent\)/);
  assert.match(main, /当前无后续调度/);
  assert.match(main, /刚才的移动符合规则/);
  assert.match(renderer, /空，可点击后继续调入/);
  assert.match(main, /item\.chapter === chapter\.id/);
  assert.match(main, /chapter-map/);
  assert.match(main, /dataset\.current/);
  assert.match(renderer, /from "\.\.\/engine\.mjs\?v=dev"/);
  assert.doesNotMatch(renderer, /innerHTML/);
  assert.match(
    await readFile(new URL("css/style.css", root), "utf8"),
    /\.track:focus, \.dock:focus \{ outline: none; \}/,
  );
});

test("every relative client import carries the build version placeholder", async () => {
  const files = readdirSync(new URL("js/", root)).filter((name) => name.endsWith(".mjs"));
  assert.ok(files.length >= 6, `expected the client module set, saw ${files.length}`);
  for (const name of files) {
    const source = await readFile(new URL(`js/${name}`, root), "utf8");
    for (const match of source.matchAll(/from "(\.[^"]+)"/g)) {
      assert.match(match[1], /\?v=dev$/, `${name} imports ${match[1]} without ?v=dev`);
    }
  }
});

test("hint worker uses the deterministic solver without a random fallback", async () => {
  const worker = await readFile(new URL("js/solver-worker.mjs", root), "utf8");
  assert.match(worker, /import \{ solve \} from "\.\.\/solver\.mjs\?v=dev"/);
  assert.match(worker, /nodeLimit: 250_000/);
  assert.doesNotMatch(worker, /Math\.random/);
  assert.match(worker, /data\.kind === "solvability"/);
  assert.match(worker, /nodeLimit: 2_000_000/);
  assert.match(worker, /kind: data\.kind/);
  assert.match(await readFile(new URL("js/main.mjs", root), "utf8"), /当前局面无法通关，建议撤销最近一步重新规划/);
  assert.match(await readFile(new URL("js/main.mjs", root), "utf8"), /requestSolvabilityCheck\(next\)/);
});

test("feedback uses synthesized audio and respects reduced motion", async () => {
  const [audio, stylesheet] = await Promise.all([
    readFile(new URL("js/audio.mjs", root), "utf8"),
    readFile(new URL("css/style.css", root), "utf8"),
  ]);
  assert.match(audio, /AudioContext/);
  assert.match(audio, /createOscillator/);
  assert.doesNotMatch(audio, /https?:\/\//);
  assert.match(stylesheet, /prefers-reduced-motion: reduce/);
  assert.match(stylesheet, /completion-burst/);
  assert.match(stylesheet, /reject-rail/);
  assert.match(stylesheet, /chapter-map/);
  assert.match(stylesheet, /@media \(max-width: 700px\)/);
  assert.match(stylesheet, /chapter-path \{ grid-template-columns: repeat\(4/);
  assert.match(stylesheet, /daily-button/);
  assert.match(stylesheet, /guide-rail/);
  assert.match(stylesheet, /unlock-node/);
  assert.match(stylesheet, /landing-rail/);
  assert.match(stylesheet, /data-current/);
  assert.match(stylesheet, /transfer-trail/);
  assert.match(stylesheet, /energy-flow/);
  assert.match(stylesheet, /core-spin/);
  assert.match(stylesheet, /orb-pulse/);
  assert.match(stylesheet, /status-bar/);
});
