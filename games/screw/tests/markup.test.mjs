import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const htmlPath = path.resolve('games/screw/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const mainSource = fs.readFileSync(path.resolve('games/screw/js/main.mjs'), 'utf8');

test('markup: portal bridge, noscript, favicon and meta description exist', () => {
  assert.match(html, /<a[^>]+href="\/"[^>]*id="back-home"|<a[^>]+id="back-home"[^>]+href="\/"/);
  assert.ok(html.includes('<noscript>'));
  assert.ok(html.includes('rel="icon"'));
  assert.ok(html.includes('name="description"'));
  assert.ok(html.includes('lang="zh-CN"'));
});

test('markup: local assets carry ?v=dev and the entry is an ES module', () => {
  assert.ok(html.includes('css/style.css?v=dev'));
  assert.ok(html.includes('js/main.mjs?v=dev'));
  assert.match(html, /<script[^>]+type="module"/);
});

test('markup: no analytics or ad tags are hardcoded in the source shell', () => {
  assert.ok(!html.includes('googletagmanager'));
  assert.ok(!html.includes('adsbygoogle'));
  assert.ok(!html.includes('pagead2.googlesyndication'));
});

test('markup: canvas and all interactive dialogs referenced by main.mjs exist', () => {
  const ids = [
    'stage-canvas',
    'btn-levels',
    'btn-undo',
    'btn-magnet',
    'btn-restart',
    'btn-pause',
    'btn-sound',
    'btn-help',
    'btn-lang',
    'hud-chapter',
    'hud-remain',
    'hud-plates',
    'hud-moves',
    'hud-undos',
    'hud-time',
    'hud-queue',
    'hud-buffer',
    'hud-magnet',
    'pause-veil',
    'btn-resume',
    'dialog-rules',
    'dialog-levels',
    'levels-content',
    'dialog-won',
    'dialog-lost',
    'toast',
  ];
  for (const id of ids) {
    assert.ok(html.includes(`id="${id}"`), `index.html missing #${id}`);
    if (id !== 'stage-canvas') {
      assert.ok(mainSource.includes(`'${id}'`) || mainSource.includes(`"${id}"`), `main.mjs does not reference #${id}`);
    }
  }
  assert.match(html, /<canvas[^>]+id="stage-canvas"[^>]+width="900"[^>]+height="1200"/);
  assert.ok(html.includes('data-i18n-aria="boardAria"'));
});

test('markup: every static Chinese text node is declared with data-i18n', () => {
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');

  const tagMatches = [...cleaned.matchAll(/<([a-zA-Z0-9-]+)([^>]*)>([^<]*[\u4e00-\u9fa5]+[^<]*)<\/\1>/g)];
  const missing = [];
  for (const match of tagMatches) {
    const tag = match[1].toLowerCase();
    if (tag === 'title') continue;
    if (!match[2].includes('data-i18n')) missing.push(`<${tag}> ${match[3].trim().slice(0, 12)}`);
  }
  assert.deepEqual(missing, []);
});
