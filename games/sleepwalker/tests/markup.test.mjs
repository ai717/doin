/**
 * @file games/sleepwalker/tests/markup.test.mjs
 * HTML 结构、SEO 与资源版本号门禁测试。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('markup: index.html contract verification', () => {
  const htmlPath = resolve(import.meta.dirname, '..', 'index.html');
  const html = readFileSync(htmlPath, 'utf8');

  // 1. 返回首页链接
  assert.ok(/<a[^>]+href="\/"[^>]*id="back-home"/.test(html) || /<a[^>]+id="back-home"[^>]*href="\/"/.test(html), 'Missing <a href="/" id="back-home">');

  // 2. noscript
  assert.ok(/<noscript/.test(html), 'Missing <noscript>');

  // 3. meta description
  assert.ok(/<meta[^>]+name="description"/.test(html), 'Missing meta description');

  // 4. favicon
  assert.ok(/rel="icon"/.test(html), 'Missing favicon link');

  // 5. html lang
  assert.ok(/<html[^>]+lang="/.test(html), 'Missing html lang');

  // 6. 本地资源必须带 ?v=dev
  const localAssets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((v) => !/^(https?:)?\/\//.test(v) && !v.startsWith('data:') && /\.(mjs|js|css)(\?|$)/.test(v));

  assert.ok(localAssets.length >= 2, 'Expected local js/css assets');
  for (const asset of localAssets) {
    assert.ok(asset.includes('?v=dev'), `Asset ${asset} missing ?v=dev`);
  }

  // 7. 脚本为 module
  assert.ok(/<script[^>]+type="module"/.test(html), 'Script must be type="module"');
});
