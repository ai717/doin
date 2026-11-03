import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('markup: index.html contract verification', () => {
  const htmlPath = path.join(__dirname, '../index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  // 1. back-home 链接必须指向根目录
  assert.match(html, /<a\s+[^>]*href=["']\/["'][^>]*id=["']back-home["']|<a\s+[^>]*id=["']back-home["'][^>]*href=["']\/["']/);

  // 2. noscript 标签兜底
  assert.match(html, /<noscript>[\s\S]*?<\/noscript>/i);

  // 3. 所有本地 link 和 script 必须带 ?v=dev
  const linkMatches = html.matchAll(/<link\s+[^>]*href=["']([^"']+)["']/gi);
  for (const m of linkMatches) {
    const href = m[1];
    if (!href.startsWith('http') && !href.startsWith('data:') && !href.startsWith('//')) {
      assert.ok(href.includes('?v=dev'), `Local link ${href} must include ?v=dev`);
    }
  }

  const scriptMatches = html.matchAll(/<script\s+[^>]*src=["']([^"']+)["']/gi);
  for (const m of scriptMatches) {
    const src = m[1];
    if (!src.startsWith('http') && !src.startsWith('data:') && !src.startsWith('//')) {
      assert.ok(src.includes('?v=dev'), `Local script ${src} must include ?v=dev`);
    }
  }

  // 4. 必须包含暂停键 #btn-pause
  assert.ok(html.includes('id="btn-pause"'), 'Must include #btn-pause button');

  // 5. 必须声明 lang="zh-CN"
  assert.match(html, /<html\s+[^>]*lang=["']zh-CN["']/i);
});
