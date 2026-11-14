import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const HTML_PATH = path.resolve('games/tilestack/index.html');

test('index.html conforms to portal markup standards', () => {
  assert.ok(fs.existsSync(HTML_PATH), 'index.html must exist');
  const html = fs.readFileSync(HTML_PATH, 'utf-8');

  // Doctype and lang
  assert.match(html, /<!DOCTYPE html>/i);
  assert.match(html, /<html\s+lang=["']zh["']/i);

  // Metadata
  assert.match(html, /<meta\s+name=["']description["']/i);
  assert.match(html, /<link\s+rel=["']icon["'][^>]*href=["']favicon\.svg\?v=dev["']/i);

  // CSS link with ?v=dev
  assert.match(html, /<link\s+rel=["']stylesheet["'][^>]*href=["']css\/style\.css\?v=dev["']/i);

  // Back home link
  assert.match(html, /<a\s+href=["']\/["']\s+id=["']back-home["']/i);

  // Noscript
  assert.match(html, /<noscript>/i);

  // Module script with ?v=dev
  assert.match(html, /<script\s+type=["']module["']\s+src=["']js\/main\.mjs\?v=dev["']>/i);

  // Structural containers
  assert.match(html, /id=["']tower-board["']/);
  assert.match(html, /id=["']tray-slots["']/);
  assert.match(html, /id=["']effects-canvas["']/);
});
