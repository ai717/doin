import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../js/engine.mjs';
import { LEVELS } from '../js/levels.mjs';
import { CLASSIC_HARDS } from '../js/classics.mjs';

describe('engine · 常量与工具', () => {
  it('OPERATORS 有 4 种', () => { assert.equal(engine.OPERATORS.length, 4); });
  it('TARGET = 24', () => { assert.equal(engine.TARGET, 24); });
  it('cardLabel 数字 1-9 直接返回字符串', () => {
    assert.equal(engine.cardLabel(1), '1');
    assert.equal(engine.cardLabel(7), '7');
    assert.equal(engine.cardLabel(9), '9');
  });
  it('formatResult 整数显示整数', () => {
    assert.equal(engine.formatResult(5), '5');
    assert.equal(engine.formatResult(24), '24');
  });
  it('formatResult 小数去尾 0', () => {
    assert.equal(engine.formatResult(0.5), '0.5');
    assert.equal(engine.formatResult(2.5), '2.5');
  });
});

describe('engine · 状态创建', () => {
  it('createState 生成 4 张牌', () => {
    const s = engine.createState({ cards: [3,3,8,8] });
    assert.equal(s.cards.length, 4);
    assert.equal(s.status, 'playing');
    assert.equal(s.selectedIds.length, 0);
    assert.equal(s.steps, 0);
  });
  it('createFromLevel 正常工作', () => {
    const s = engine.createFromLevel(0, 0);
    assert.equal(s.cards.length, 4);
    assert.equal(s.mode, 'chapter');
  });
  it('createFromClassic 正常工作', () => {
    const s = engine.createFromClassic(0);
    assert.equal(s.mode, 'classic');
  });
});

describe('engine · toggleSelect', () => {
  it('选中一张 → 一张', () => {
    let s = engine.createState({ cards: [1,2,3,4] });
    s = engine.toggleSelect(s, 'c0-0');
    assert.equal(s.selectedIds.length, 1);
  });
  it('选中两张 → 两张', () => {
    let s = engine.createState({ cards: [1,2,3,4] });
    s = engine.toggleSelect(s, 'c0-0');
    s = engine.toggleSelect(s, 'c0-1');
    assert.equal(s.selectedIds.length, 2);
  });
  it('选中三张时替换第一张', () => {
    let s = engine.createState({ cards: [1,2,3,4] });
    s = engine.toggleSelect(s, 'c0-0');
    s = engine.toggleSelect(s, 'c0-1');
    s = engine.toggleSelect(s, 'c0-2');
    assert.deepEqual(s.selectedIds, ['c0-1', 'c0-2']);
  });
  it('再次点击已选中 → 取消', () => {
    let s = engine.createState({ cards: [1,2,3,4] });
    s = engine.toggleSelect(s, 'c0-0');
    s = engine.toggleSelect(s, 'c0-0');
    assert.equal(s.selectedIds.length, 0);
  });
});

// 辅助：精确选两张牌（按 card.value 找 id）
function pickTwo(s, va, vb) {
  const a = s.cards.find(c => c.value === va && !s.selectedIds.includes(c.id));
  const b = s.cards.find(c => c.value === vb && c.id !== a.id && !s.selectedIds.includes(c.id));
  return engine.toggleSelect(engine.toggleSelect(s, a.id), b.id);
}

describe('engine · applyOperator', () => {
  it('合法合并 +：2+3', () => {
    let s = engine.createState({ cards: [2,3,4,5] });
    s = engine.toggleSelect(s, 'c0-0');
    s = engine.toggleSelect(s, 'c0-1');
    const r = engine.applyOperator(s, '+');
    assert.equal(r.action, 'ok');
    assert.equal(r.state.cards.length, 3);
    assert.ok(r.state.cards.some(c => Math.abs(c.value - 5) < engine.EPSILON));
  });
  it('合并清空选中', () => {
    let s = engine.createState({ cards: [2,3,4,5] });
    s = engine.toggleSelect(s, 'c0-0');
    s = engine.toggleSelect(s, 'c0-1');
    const r = engine.applyOperator(s, '*');
    assert.deepEqual(r.state.selectedIds, []);
  });
  it('只有 1 张牌选 → invalid', () => {
    let s = engine.createState({ cards: [2,3,4,5] });
    s = engine.toggleSelect(s, 'c0-0');
    const r = engine.applyOperator(s, '+');
    assert.equal(r.action, 'invalid');
  });

  // 注：3,3,8,8 需要精确顺序，用 solve 求解器测试已覆盖
  // 下面用一个更简单可手算的胜利路径
  it('终局赢：(6*(5+(2-3))) = 24', () => {
    // 来源：levels.mjs Ch1 L5
    let st = engine.createState({ cards: [2,3,5,6] });
    // 2-3 = -1
    st = engine.toggleSelect(st, 'c0-0'); st = engine.toggleSelect(st, 'c0-1');
    let r = engine.applyOperator(st, '-');
    assert.equal(r.action, 'ok');
    // 5 + (-1) = 4
    st = r.state;
    const three = st.cards.find(c => c.value === 5);
    const neg = st.cards.find(c => Math.abs(c.value - (-1)) < 0.001);
    st = engine.toggleSelect(st, three.id);
    st = engine.toggleSelect(st, neg.id);
    r = engine.applyOperator(st, '+');
    assert.equal(r.action, 'ok');
    // 6 * 4 = 24
    st = r.state;
    const six = st.cards.find(c => c.value === 6);
    const four = st.cards.find(c => Math.abs(c.value - 4) < 0.001);
    st = engine.toggleSelect(st, six.id);
    st = engine.toggleSelect(st, four.id);
    r = engine.applyOperator(st, '*');
    assert.equal(r.action, 'won');
    assert.equal(r.state.status, 'won');
    assert.ok(Math.abs(r.result - 24) < 0.01);
  });

  it('终局输：(1+1+1+1)', () => {
    let st = engine.createState({ cards: [1,1,1,1] });
    st = engine.toggleSelect(st, 'c0-0'); st = engine.toggleSelect(st, 'c0-1');
    let r = engine.applyOperator(st, '+');
    st = r.state;
    const a = st.cards[0]; const b = st.cards[1];
    st = engine.toggleSelect(st, a.id); st = engine.toggleSelect(st, b.id);
    r = engine.applyOperator(st, '+');
    st = r.state;
    const c = st.cards[0]; const d = st.cards[1];
    st = engine.toggleSelect(st, c.id); st = engine.toggleSelect(st, d.id);
    r = engine.applyOperator(st, '+');
    assert.equal(r.action, 'lost');
    assert.equal(r.state.status, 'lost');
  });
});

describe('engine · undo', () => {
  it('空历史 → undone false', () => {
    let s = engine.createState({ cards: [2,3,4,5] });
    const r = engine.undo(s);
    assert.equal(r.undone, false);
  });
  it('一次 undo 精确还原', () => {
    let st = engine.createState({ cards: [2,3,4,5] });
    st = engine.toggleSelect(st, 'c0-0'); st = engine.toggleSelect(st, 'c0-1');
    const after = engine.applyOperator(st, '+').state;
    assert.equal(after.cards.length, 3);
    const u = engine.undo(after);
    assert.equal(u.undone, true);
    assert.equal(u.state.cards.length, 4);
    assert.equal(u.state.steps, 0);
    assert.equal(u.state.status, 'playing');
  });
  it('连撤两步', () => {
    let st = engine.createState({ cards: [2,3,4,5] });
    st = engine.toggleSelect(st, 'c0-0'); st = engine.toggleSelect(st, 'c0-1');
    st = engine.applyOperator(st, '+').state;
    assert.equal(st.cards.length, 3);
    const ids1 = st.cards.map(c => c.id);
    st = engine.toggleSelect(st, ids1[0]); st = engine.toggleSelect(st, ids1[1]);
    st = engine.applyOperator(st, '*').state;
    assert.equal(st.cards.length, 2);
    const u1 = engine.undo(st);
    assert.equal(u1.state.cards.length, 3);
    const u2 = engine.undo(u1.state);
    assert.equal(u2.state.cards.length, 4);
    assert.equal(u2.undone, true);
  });
});

describe('engine · solve 求解器', () => {
  it('经典 3,3,8,8 可解', () => {
    const s = engine.solve([3,3,8,8]);
    assert.ok(s);
    assert.ok(Math.abs(eval(s) - 24) < 0.01);
  });
  it('经典 1,5,5,5 可解', () => {
    const s = engine.solve([1,5,5,5]);
    assert.ok(s);
    assert.ok(Math.abs(eval(s) - 24) < 0.01);
  });
  it('经典 4,4,10,10 可解', () => {
    const s = engine.solve([4,4,10,10]);
    assert.ok(s);
    assert.ok(Math.abs(eval(s) - 24) < 0.01);
  });
  it('经典 2,2,13,13 可解', () => {
    const s = engine.solve([2,2,13,13]);
    assert.ok(s);
    assert.ok(Math.abs(eval(s) - 24) < 0.01);
  });
  it('不可解 1,1,1,5 → null', () => {
    const s = engine.solve([1,1,1,5]);
    assert.equal(s, null);
  });
  it('所有 LEVELS 中牌组都可解', () => {
    for (const ch of LEVELS.chapters) {
      for (const lv of ch.levels) {
        const s = engine.solve(lv.cards);
        assert.ok(s, `不可解: ${lv.cards.join(',')}`);
      }
    }
  });
  it('所有 CLASSIC_HARDS 都可解', () => {
    for (const c of CLASSIC_HARDS) {
      const s = engine.solve(c);
      assert.ok(s, `不可解: ${c.join(',')}`);
    }
  });
});

describe('engine · generateHint', () => {
  it('返回两张牌 + 运算符', () => {
    const h = engine.generateHint([3,3,8,8]);
    assert.ok(h);
    assert.ok(['+', '-', '*', '/'].includes(h.op));
    assert.ok([3,8].includes(h.cardA) && [3,8].includes(h.cardB));
  });
  it('经典 2,2,13,13 有 hint', () => {
    const h = engine.generateHint([2,2,13,13]);
    assert.ok(h);
  });
});

describe('engine · calcStars', () => {
  it('3 步 + 0 提示 → 3 星', () => {
    assert.equal(engine.calcStars({ steps: 3, hintsUsed: 0 }), 3);
  });
  it('4 步 + 0 提示 → 3 星', () => {
    assert.equal(engine.calcStars({ steps: 4, hintsUsed: 0 }), 3);
  });
  it('6 步 + 0 提示 → 2 星', () => {
    assert.equal(engine.calcStars({ steps: 6, hintsUsed: 0 }), 2);
  });
  it('8 步 + 0 提示 → 1 星', () => {
    assert.equal(engine.calcStars({ steps: 8, hintsUsed: 0 }), 1);
  });
  it('3 步 + 1 提示 → 2 星', () => {
    assert.equal(engine.calcStars({ steps: 3, hintsUsed: 1 }), 2);
  });
});
