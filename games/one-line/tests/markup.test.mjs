import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const baseDir = path.resolve(__dirname, '..');

function readFile(relPath) {
  return fs.readFileSync(path.join(baseDir, relPath), 'utf-8');
}

test('Markup: 静态结构与规范守卫断言', () => {
  const html = readFile('index.html');
  const css = readFile('css/style.css');
  const mainJs = readFile('js/main.mjs');
  const uiJs = readFile('js/ui.mjs');

  // 1. 门户根路径返回规范
  assert.match(html, /<a[^>]+href="\/"[^>]*>/, '必须提供 href="/" 的首页返回链接');

  // 2. 本地资源带 ?v=dev 版本参数
  assert.match(html, /href="favicon\.svg\?v=dev"/, 'favicon 必须带 ?v=dev');
  assert.match(html, /href="css\/style\.css\?v=dev"/, 'CSS 引用必须带 ?v=dev');
  assert.match(html, /src="js\/main\.mjs\?v=dev"/, 'JS 引用必须带 ?v=dev');

  // 3. 严禁外部外链、CDN、alert 拦截
  assert.doesNotMatch(html, /https?:\/\//, 'HTML 中不得含有外部外链资源');
  assert.doesNotMatch(mainJs, /\balert\s*\(/, '代码中严禁使用 alert()');
  assert.doesNotMatch(uiJs, /\balert\s*\(/, '代码中严禁使用 alert()');

  // 4. CSS 无障碍动效规范适配
  assert.match(css, /prefers-reduced-motion/, 'CSS 必须包含 prefers-reduced-motion 规则');

  // 5. DOM 元素 ID 闭合检查（HTML 与 UI 脚本完全对齐）
  const requiredIds = [
    'game-canvas',
    'stage-wrapper',
    'txt-title',
    'btn-home',
    'btn-how-to-play',
    'btn-audio-toggle',
    'btn-lang-toggle',
    'lbl-level',
    'val-level',
    'lbl-progress',
    'val-progress-bar',
    'val-progress-text',
    'lbl-time',
    'val-time',
    'status-hint',
    'btn-undo',
    'txt-undo',
    'btn-reset',
    'txt-reset',
    'btn-select-level',
    'txt-levels',
    'modal-help',
    'modal-levels',
    'modal-victory'
  ];

  for (const id of requiredIds) {
    const idRegex = new RegExp(`id=["']${id}["']`);
    assert.match(html, idRegex, `index.html 中必须包含 ID 为 "${id}" 的节点`);
  }
});
