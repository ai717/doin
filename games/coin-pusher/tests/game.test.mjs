// game.test.mjs — DOM-free 控制器：意图调度 / 固定步长累加 / 暂停与重开 / 监听层隔离
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CoinPusherGame } from "../js/game.mjs";
import {
  FIXED_DT, MODE, STATUS, FIELD_W, FIELD_H, SETTLE_TIME, CHUTE_X, DEFAULT_CREDITS, CREDIT_OPTIONS
} from "../js/engine.mjs";

describe("game: 构造与初始态", () => {
  it("默认进入无尽机台且处于 READY", () => {
    const game = new CoinPusherGame();
    assert.equal(game.state.mode, MODE.ENDLESS);
    assert.equal(game.state.status, STATUS.READY);
    assert.equal(game.state.credits, DEFAULT_CREDITS);
    assert.equal(game.isPaused, false);
    assert.equal(game.state.score, 0);
    assert.ok(game.state.coins.length > 60, "开局应有铺币");
  });

  it("可指定初始币数与种子", () => {
    const game = new CoinPusherGame({ credits: 20, seed: 12345 });
    assert.equal(game.state.credits, 20);
    assert.equal(game.state.seed, 12345);
  });

  it("控制器不再暴露瞄准 / 力度 / 蓄力接口（落点不可指定）", () => {
    const game = new CoinPusherGame();
    for (const gone of ["setAim", "nudgeAim", "setPower", "nudgePower", "startCharge", "chargeStep", "releaseCharge", "repeat", "loadLevel", "loadArcade", "loadDuel"]) {
      assert.equal(typeof game[gone], "undefined", `不应再有 ${gone}()`);
    }
    assert.equal(game.charging, undefined);
    assert.equal(game.aimX, undefined);
    assert.equal(game.power, undefined);
  });
});

describe("game: 输入意图", () => {
  it("fire() 不接收任何参数，投币成功即进入 PLAYING 并扣 1 枚账户币", () => {
    const game = new CoinPusherGame({ credits: 20 });
    assert.equal(game.fire.length, 0, "fire 的形参表必须为空");
    assert.equal(game.canFire(), true);
    assert.equal(game.fire(4.2, 0.8), true);
    assert.equal(game.state.status, STATUS.PLAYING);
    assert.equal(game.state.credits, 19);
    assert.equal(game.state.inserted, 1);
    // 多传参数不得影响落点
    const a = new CoinPusherGame({ credits: 20 });
    a.fire();
    const b = new CoinPusherGame({ credits: 20 });
    b.fire(11.9, 0.0);
    const last = (g) => g.state.coins[g.state.coins.length - 1];
    assert.equal(last(a).x, last(b).x);
    assert.ok(Math.abs(last(a).x - CHUTE_X) <= 0.35);
  });

  it("账户见底后投币一律失败且不抛错", () => {
    const game = new CoinPusherGame({ credits: 1 });
    assert.equal(game.fire(), true);
    assert.equal(game.state.credits, 0);
    assert.equal(game.canFire(), false);
    assert.equal(game.fire(), false);
    assert.doesNotThrow(() => game.fire());
    assert.doesNotThrow(() => game.fire(6.5, 0.5));
  });

  it("暂停时不得投币，恢复后可以", () => {
    const game = new CoinPusherGame({ credits: 20 });
    game.togglePause();
    assert.equal(game.canFire(), false);
    assert.equal(game.fire(), false);
    game.togglePause();
    assert.equal(game.canFire(), true);
    assert.equal(game.fire(), true);
  });
});

describe("game: 固定步长累加", () => {
  it("1/60 秒真实时间恰好推进 2 个 1/120 固定步", () => {
    const game = new CoinPusherGame({ credits: 50, seed: 5 });
    game.fire();
    const t0 = game.state.time;
    game.step(1 / 60);
    assert.ok(Math.abs(game.state.time - t0 - 2 * FIXED_DT) < 1e-9,
      `时间推进应为 2 个固定步，实际 ${game.state.time - t0}`);
    assert.ok(Math.abs(game.accumulator) < 1e-9);
  });

  it("单帧过长时被夹到 0.1 秒上限（防掉帧后瞬移）", () => {
    const game = new CoinPusherGame({ credits: 50, seed: 5 });
    game.fire();
    const t0 = game.state.time;
    game.step(5);
    assert.ok(game.state.time - t0 <= 0.1 + 1e-9, `单帧推进不得超过 0.1s，实际 ${game.state.time - t0}`);
  });

  it("未开局（READY）时推进不改变台面", () => {
    const game = new CoinPusherGame({ credits: 50 });
    const snapshot = JSON.stringify(game.state.coins);
    for (let i = 0; i < 60; i++) game.step(1 / 60);
    assert.equal(JSON.stringify(game.state.coins), snapshot);
    assert.equal(game.state.time, 0);
  });

  it("step 返回本帧产生的事件，投币派发 insert 事件", () => {
    const game = new CoinPusherGame({ credits: 50, seed: 5 });
    game.fire();
    assert.ok(Array.isArray(game.step(1 / 60)));
    const fired = [];
    const off = game.subscribe((ev) => fired.push(ev));
    game.fire();
    off();
    assert.ok(fired.some((e) => e.type === "insert"), "投币应派发 insert 事件");
  });
});

describe("game: 暂停与重开", () => {
  it("暂停后不再推进，恢复后继续", () => {
    const game = new CoinPusherGame({ credits: 50, seed: 5 });
    game.fire();
    game.step(1 / 60);
    const t = game.state.time;
    assert.equal(game.togglePause(), true);
    assert.deepEqual(game.step(1 / 60), []);
    assert.equal(game.state.time, t);
    game.togglePause();
    assert.equal(game.isPaused, false);
    game.step(1 / 60);
    assert.ok(game.state.time > t);
  });

  it("终局后 togglePause 不生效", () => {
    const game = new CoinPusherGame({ credits: 50, seed: 5 });
    game.fire();
    game.state.status = STATUS.LOST;
    assert.equal(game.togglePause(), false);
    assert.equal(game.isPaused, false);
  });

  it("restart 回到同种子同账户的初始态并清空暂停", () => {
    const game = new CoinPusherGame({ credits: 37, seed: 99 });
    game.fire();
    game.step(1 / 60);
    game.isPaused = true;
    game.restart();
    assert.equal(game.state.credits, 37);
    assert.equal(game.state.score, 0);
    assert.equal(game.state.inserted, 0);
    assert.equal(game.isPaused, false);
    assert.equal(game.state.time, 0);
    assert.equal(game.state.seed, 99);
  });

  it("start(credits) 换一局：账户换成新的初始币数，成绩清零", () => {
    const game = new CoinPusherGame({ credits: 20, seed: 7 });
    game.fire();
    for (let i = 0; i < 240; i++) game.step(1 / 60);
    game.state.score = 4321;
    game.start(100, 7);
    assert.equal(game.state.credits, 100);
    assert.equal(game.state.score, 0);
    assert.equal(game.state.status, STATUS.READY);
    assert.equal(game.accumulator, 0);
  });

  it("start 的初始币数非法时回落到默认值", () => {
    const game = new CoinPusherGame();
    game.start(undefined, 1);
    assert.equal(game.state.credits, DEFAULT_CREDITS);
    game.start(NaN, 1);
    assert.equal(game.state.credits, DEFAULT_CREDITS);
  });
});

describe("game: 监听层隔离", () => {
  it("订阅者抛错不影响对局推进", () => {
    const game = new CoinPusherGame({ credits: 50, seed: 5 });
    game.subscribe(() => { throw new Error("listener boom"); });
    const seen = [];
    game.subscribe((ev) => seen.push(ev.type));
    assert.doesNotThrow(() => game.fire());
    assert.doesNotThrow(() => { for (let i = 0; i < 60; i++) game.step(1 / 60); });
    assert.ok(seen.includes("insert"));
  });

  it("取消订阅后不再收到事件", () => {
    const game = new CoinPusherGame({ credits: 50, seed: 5 });
    let count = 0;
    const off = game.subscribe(() => { count += 1; });
    game.fire();
    assert.ok(count > 0);
    const after = count;
    off();
    game.fire();
    assert.equal(count, after);
  });
});

describe("game: 端到端一局", () => {
  it("持续投币 → 落袋 → 账户回币，不抛错且坐标合法", () => {
    const game = new CoinPusherGame({ credits: 120, seed: 20261008 });
    let guard = 0;
    while (game.state.drops < 20 && guard < 12000) {
      if (game.canFire() && guard % 60 === 0) game.fire();
      game.step(1 / 60);
      guard += 1;
    }
    assert.ok(game.state.drops >= 20, `200 秒内应至少落袋 20 枚，实际 ${game.state.drops}`);
    assert.ok(game.state.score > 0);
    assert.ok(game.state.time > SETTLE_TIME);
    assert.ok(game.state.credits > 0, "落袋应持续回币");
    for (const coin of game.state.coins) {
      assert.ok(coin.x >= -0.6 && coin.x <= FIELD_W + 0.6);
      assert.ok(coin.y <= FIELD_H + 1.5);
    }
  });

  it("账户见底后静置 → 收工（LOST），且终局后 step 不再推进", () => {
    const game = new CoinPusherGame({ credits: 20, seed: 3 });
    game.fire();
    game.state.credits = 0;
    game.state.coins = [];
    game.state.tokens = [];
    let guard = 0;
    while (game.state.status === STATUS.PLAYING && guard < 1200) {
      game.step(1 / 60);
      guard += 1;
    }
    assert.equal(game.state.status, STATUS.LOST);
    const t = game.state.time;
    game.step(1 / 60);
    assert.equal(game.state.time, t);
  });
});

describe("game: 初始币数白名单", () => {
  it("CREDIT_OPTIONS 是可选档位", () => {
    assert.deepEqual(CREDIT_OPTIONS, [20, 50, 100]);
  });
});
