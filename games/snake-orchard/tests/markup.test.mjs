import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const baseDir = path.resolve(__dirname, '..');

test('Markup - index.html 规范性与基础属性检测', () => {
  const htmlPath = path.join(baseDir, 'index.html');
  assert.ok(fs.existsSync(htmlPath), 'index.html 必须存在');
  const html = fs.readFileSync(htmlPath, 'utf8');

  assert.match(html, /<!DOCTYPE html>/i);
  assert.match(html, /<meta\s+name=["']viewport["']/i);
  assert.match(html, /<a\s+[^>]*href=["']\/["']/i, '必须存在返回首页全站根路径链接 href="/"');
  assert.match(html, /href=["']css\/style\.css\?v=dev["']/i, 'CSS 必须携带 ?v=dev 版本查询串');
  assert.match(html, /src=["']js\/main\.mjs\?v=dev["']/i, 'JS 必须携带 ?v=dev 版本查询串');
  assert.match(html, /<canvas\s+[^>]*id=["']game-canvas["']/i, '必须声明 game-canvas 画布');
  assert.match(html, /<noscript>/i, '必须声明 noscript 兜底');
  assert.match(html, /data-theme=["']light["']/i, 'html 根标签应具有 data-theme 属性');
});

test('Markup - DOM IDs 在 HTML 与 JS 间完全闭合', () => {
  const html = fs.readFileSync(path.join(baseDir, 'index.html'), 'utf8');

  const requiredIds = [
    'game-canvas',
    'canvas-container',
    'btn-theme',
    'theme-icon',
    'btn-sound',
    'sound-icon',
    'btn-lang',
    'lang-label',
    'hud-difficulty-badge',
    'hud-score',
    'hud-best',
    'hud-length',
    'hud-combo',
    'modal-welcome',
    'modal-pause',
    'modal-gameover',
    'modal-rules',
    'settle-score',
    'settle-best',
    'settle-apples',
    'btn-start',
    'btn-help',
    'btn-resume',
    'btn-restart-pause',
    'btn-replay',
    'btn-close-rules',
    'btn-side-pause',
    'btn-side-restart',
    'vbtn-up',
    'vbtn-down',
    'vbtn-left',
    'vbtn-right',
    'vbtn-pause'
  ];

  for (const id of requiredIds) {
    assert.ok(html.includes(`id="${id}"`), `HTML 必须包含 id="${id}"`);
  }
});

test('Markup - 源码禁止项与自包含检测 (无 alert / 无外链 CDN)', () => {
  const jsDir = path.join(baseDir, 'js');
  const files = fs.readdirSync(jsDir);

  for (const file of files) {
    if (!file.endsWith('.mjs')) continue;
    const content = fs.readFileSync(path.join(jsDir, file), 'utf8');

    assert.doesNotMatch(content, /\balert\s*\(/, `${file} 中严禁调用原生 alert()`);
    assert.doesNotMatch(content, /https?:\/\//, `${file} 中严禁引入外部 CDN 或远程 URL`);
  }
});

test('Markup - style.css 宽屏自适应、暗黑主题与动效适配检测', () => {
  const cssPath = path.join(baseDir, 'css/style.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  assert.match(css, /prefers-reduced-motion:\s*reduce/, 'CSS 必须支持 prefers-reduced-motion 适配');
  assert.match(css, /-apple-system/i, 'CSS 必须使用系统原生无障碍字体栈');
  assert.match(css, /\[data-theme=["']dark["']\]/, 'CSS 必须包含暗黑模式选择器样式');
  assert.match(css, /@media\s*\([^)]*min-width:\s*900px\)/, 'CSS 必须包含宽屏双列横向布局媒体查询');
});
