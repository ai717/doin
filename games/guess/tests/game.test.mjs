// game.test.mjs —— 控制器：≥1000 步随机游走不抛错、不卡死、不变量不破；非法意图静默返回原因

import test from "node:test";
import assert from "node:assert/strict";

import { createGame, REASON } from "../js/game.mjs";
import { LEVELS } from "../js/levels.mjs";
import { mulberry32 } from "../js/rng.mjs";
import { STATUS } from "../js/engine.mjs";

function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

test("随机游走 1200 步：任意合法/非法操作序列都不抛错、不越界", () => {
  const game = createGame();
  const rng = mulberry32(20260923);
  const events = [];
  game.on((type) => events.push(type));
  game.start(1, 12345);

  for (let step = 0; step < 1200; step += 1) {
    const view = game.view();
    assert.ok(view, "视图不得为空");
    assert.ok(view.used <= view.budget, "投掷数不得超预算");
    assert.ok(view.remaining >= 0);

    const roll = rng();
    if (view.status !== STATUS.PLAYING) {
      game.start(pick(LEVELS, rng).id, Math.floor(rng() * 1e9));
      continue;
    }
    if (roll < 0.72) {
      const value = 1 + Math.floor(rng() * (view.max + 4)) - 2; // 故意越界
      const res = game.fire(value);
      if (!res.ok) assert.ok(Object.values(REASON).includes(res.reason), `未知失败原因 ${res.reason}`);
    } else if (roll < 0.85) {
      game.gear(pick(["probe", "scan", "recall"], rng));
    } else if (roll < 0.92) {
      game.undo();
    } else {
      game.restart();
    }
  }
  assert.ok(events.length > 0, "随机游走应产生事件");
});

test("非法意图给出明确原因，且不消耗鱼雷", () => {
  const game = createGame();
  game.start(4, 777);
  const before = game.view().remaining;
  assert.equal(game.fire(0).reason, REASON.OUT);
  assert.equal(game.fire(999).reason, REASON.OUT);
  assert.equal(game.fire("abc").reason, REASON.EMPTY, "非数字输入按空投处理");
  assert.equal(game.fire(NaN).reason, REASON.EMPTY);
  assert.equal(game.view().remaining, before, "非法意图不得消耗鱼雷");

  assert.equal(game.fire(50).ok, true);
  assert.equal(game.fire(50).reason, REASON.REPEAT, "重复投掷必须被拒绝");
  assert.equal(game.view().remaining, before - 1);
});

test("命中即终局，此后一切操作 no-op；未命中耗尽即判负", () => {
  const game = createGame();
  game.start(4, 4242);
  const target = game.diagnose().target;
  const res = game.fire(target);
  assert.equal(res.ok, true);
  assert.equal(game.view().status, STATUS.WON);
  assert.equal(game.fire(target).ok, false);
  assert.equal(game.gear("probe").ok, false);
  assert.equal(game.undo().ok, false);
  const result = game.result();
  assert.equal(result.won, true);
  assert.ok(result.stars >= 1 && result.stars <= 3);
});

test("判负后不记录星级", () => {
  const game = createGame();
  game.start(1, 99);
  for (let v = 1; v <= game.view().max && game.view().status === STATUS.PLAYING; v += 1) {
    if (v === game.diagnose().target) continue; // 专门避开目标，测耗尽
    game.fire(v);
  }
  assert.equal(game.view().status, STATUS.LOST);
  const result = game.result();
  assert.equal(result.won, false);
  assert.equal(result.stars, 0);
});

test("诊断出口与视图一致（验收脚本读真值的唯一通道）", () => {
  const game = createGame();
  game.start(14, 555);
  const d = game.diagnose();
  assert.ok(d.target >= 1 && d.target <= game.view().max);
  game.fire(Math.min(game.view().max, d.target === 1 ? 2 : 1));
  assert.equal(game.diagnose().used, game.view().used);
});

test("回溯与道具在控制器层不出错", () => {
  const game = createGame();
  game.start(25, 31337);
  game.fire(60);
  const used = game.view().used;
  const ok = game.undo();
  assert.equal(ok.ok, true);
  assert.equal(game.view().used, used - 1);
  assert.equal(game.undo().ok, false, "每关只允许回溯一次");
  assert.ok(["ok", "noTool", "noRoom"].includes(String(game.gear("probe").ok ? "ok" : game.gear("probe").reason)));
});
