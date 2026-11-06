import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('markup: index.html contract verification', () => {
  const htmlPath = path.resolve('games/mtower/index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  // 1. back-home 链接必须是指向 "/"
  assert.ok(
    html.includes('id="back-home"') && html.includes('href="/"'),
    'index.html must contain <a href="/" id="back-home">'
  );

  // 2. 包含 noscript
  assert.ok(html.includes('<noscript>'), 'index.html must contain <noscript>');

  // 3. 本地 link 和 script 必须带有 ?v=dev
  assert.ok(
    html.includes('style.css?v=dev'),
    'Local stylesheet link must contain ?v=dev'
  );
  assert.ok(
    html.includes('main.mjs?v=dev'),
    'Local script must contain ?v=dev'
  );

  // 4. 不得硬编码 GA 或 Ads 统计标签
  assert.ok(!html.includes('googletagmanager'), 'Source index.html must not contain GA tags');
  assert.ok(!html.includes('adsbygoogle'), 'Source index.html must not contain AdSense tags');
});
