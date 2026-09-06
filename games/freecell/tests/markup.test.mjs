import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const baseDir = resolve(__dirname, '..');

test('Markup and Static Resource Guardrails', () => {
  const indexPath = resolve(baseDir, 'index.html');
  const stylePath = resolve(baseDir, 'css/style.css');
  const mainPath = resolve(baseDir, 'js/main.mjs');
  const faviconPath = resolve(baseDir, 'favicon.svg');

  assert.ok(existsSync(indexPath), 'index.html must exist');
  assert.ok(existsSync(stylePath), 'css/style.css must exist');
  assert.ok(existsSync(mainPath), 'js/main.mjs must exist');
  assert.ok(existsSync(faviconPath), 'favicon.svg must exist');

  const indexHtml = readFileSync(indexPath, 'utf-8');
  const styleCss = readFileSync(stylePath, 'utf-8');
  const mainJs = readFileSync(mainPath, 'utf-8');

  assert.match(indexHtml, /<a id="portal-home-link" href="\/"/, 'Root portal link href="/" must be present');
  assert.match(indexHtml, /href="css\/style\.css\?v=dev"/, 'CSS reference must include ?v=dev query string');
  assert.match(indexHtml, /src="js\/main\.mjs\?v=dev"/, 'JS reference must include ?v=dev query string');
  assert.match(indexHtml, /<noscript>/, 'Noscript fallback must exist');
  assert.match(indexHtml, /id="game-canvas"/, 'Canvas element must be present');

  assert.doesNotMatch(indexHtml, /https?:\/\//i, 'index.html must not contain external links/CDNs');
  assert.doesNotMatch(styleCss, /https?:\/\//i, 'style.css must not contain remote fonts or external links');
  assert.doesNotMatch(mainJs, /\balert\s*\(/, 'main.mjs must not invoke window.alert');

  assert.match(styleCss, /prefers-reduced-motion:\s*reduce/, 'style.css must support prefers-reduced-motion');
  assert.match(styleCss, /system-ui/, 'style.css must use system UI fonts');

  const requiredIds = [
    'game-canvas',
    'deal-number',
    'score-display',
    'timer-display',
    'moves-display',
    'btn-new-game',
    'btn-restart',
    'btn-undo',
    'btn-hint',
    'btn-pause',
    'btn-sound',
    'btn-lang',
    'btn-rules',
    'modal-overlay',
    'modal-rules',
    'modal-pause',
    'modal-gameover',
    'btn-rules-close',
    'btn-resume',
    'btn-play-again'
  ];

  for (const id of requiredIds) {
    assert.ok(indexHtml.includes(`id="${id}"`), `index.html must contain element with id="${id}"`);
  }
});
