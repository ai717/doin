import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

test('markup: index.html contract verification', () => {
  const htmlPath = join(process.cwd(), 'games', 'hanzi', 'index.html');
  assert.ok(existsSync(htmlPath), 'index.html must exist');

  const html = readFileSync(htmlPath, 'utf-8');

  // Must have home link with href="/" and id="back-home"
  assert.ok(html.includes('id="back-home"'), 'must have #back-home element');
  assert.ok(html.includes('href="/"'), 'must link to root home /');

  // Must have noscript
  assert.ok(html.includes('<noscript>'), 'must include <noscript>');

  // Must have ?v=dev on local assets
  assert.ok(html.includes('css/style.css?v=dev'), 'css must have ?v=dev');
  assert.ok(html.includes('js/main.mjs?v=dev'), 'main.mjs must have ?v=dev');
  assert.ok(html.includes('favicon.svg?v=dev'), 'favicon.svg must have ?v=dev');

  // Dialogs presence
  assert.ok(html.includes('id="rules-dialog"'), 'must have #rules-dialog');
  assert.ok(html.includes('id="levels-dialog"'), 'must have #levels-dialog');
  assert.ok(html.includes('id="codex-dialog"'), 'must have #codex-dialog');
  assert.ok(html.includes('id="won-dialog"'), 'must have #won-dialog');
  assert.ok(html.includes('id="pause-dialog"'), 'must have #pause-dialog');
});
