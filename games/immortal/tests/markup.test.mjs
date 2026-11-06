import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

test('markup: index.html contract verification', () => {
  const htmlPath = join(process.cwd(), 'games', 'immortal', 'index.html');
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
  assert.ok(html.includes('id="rules-modal"'), 'must have #rules-modal');
  assert.ok(html.includes('id="tribulation-modal"'), 'must have #tribulation-modal');
  assert.ok(html.includes('id="abyss-modal"'), 'must have #abyss-modal');
  assert.ok(html.includes('id="cauldron-modal"'), 'must have #cauldron-modal');
  assert.ok(html.includes('id="offline-modal"'), 'must have #offline-modal');
  assert.ok(html.includes('id="auto-modal"'), 'must have #auto-modal');
});
