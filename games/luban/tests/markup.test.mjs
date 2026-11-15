import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

test('index.html fulfills DOIN platform markup requirements', () => {
  const htmlPath = resolve('games/luban/index.html');
  assert.ok(existsSync(htmlPath), 'index.html exists');

  const content = readFileSync(htmlPath, 'utf8');

  // Must have back home anchor
  assert.ok(content.includes('<a href="/" id="back-home"'));

  // Must have noscript
  assert.ok(content.includes('<noscript>'));

  // Must have ?v=dev for dev cache busting
  assert.ok(content.includes('href="favicon.svg?v=dev"'));
  assert.ok(content.includes('href="css/style.css?v=dev"'));
  assert.ok(content.includes('src="js/main.mjs?v=dev"'));

  // Must have lang="zh"
  assert.ok(content.includes('<html lang="zh">'));

  // Must have meta description
  assert.ok(content.includes('<meta name="description"'));
});
