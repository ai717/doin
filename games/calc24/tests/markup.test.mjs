import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const html = fs.readFileSync(path.resolve('games/calc24/index.html'), 'utf8');

describe('markup · 关键元素', () => {
  it('有 DOCTYPE 和 html 根', () => {
    assert.ok(html.includes('<!doctype html>'));
    assert.ok(html.includes('<html'));
  });
  it('有 back-home 链接', () => {
    assert.ok(html.includes('id="back-home"'));
    assert.ok(html.includes('href="/"'));
  });
  it('有 noscript', () => {
    assert.ok(html.includes('<noscript>'));
  });
  it('加载 main.mjs', () => {
    assert.ok(html.includes('js/main.mjs'));
  });
  it('script 带 ?v=dev', () => {
    assert.ok(html.includes('?v=dev'));
  });
  it('rel 路径不用 /games/calc24', () => {
    assert.ok(!html.includes('/games/calc24/'));
  });
  it('含核心区域 id', () => {
    ['board', 'op-panel', 'btn-start', 'btn-undo', 'btn-hint', 'btn-reset'].forEach(id => {
      assert.ok(html.includes(`id="${id}"`), `缺少 #${id}`);
    });
  });
});
