import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// 不直接 mock localStorage，测试 storage 的 normalize 逻辑
import { load } from '../js/storage.mjs';

describe('storage · 加载降级', () => {
  it('无 localStorage 时返回默认结构', () => {
    // 用 fresh mock
    const orig = globalThis.localStorage;
    globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
    const data = load();
    assert.ok(data.chapters);
    assert.ok(data.classic);
    assert.ok(data.current);
    globalThis.localStorage = orig;
  });
});
