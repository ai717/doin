// engine.test.mjs — 无尽机台的确定性物理 / 账户守恒 / 投币口不可指定落点 / 挡杆阵散布 / 侧沟丢失
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createInitialState, startEndless, stepFrame, insertCoin, canInsert, cloneState, restartStage,
  nextRandom, mulberry32, trapezoid, plateFrontAt, clamp, outOfCredits,
  FIXED_DT, COIN_R, FIELD_W, FIELD_H, MAX_SPEED, MAX_COINS,
  PUSHER_RETRACT, PUSHER_EXTEND, PUSH_CYCLE, TOWER_R, TOWER_CREDITS,
  GUTTER, TIP_ZONE, PACK_FACTOR,
  CHUTE_X, CHUTE_Y0, DROP_MAX_AIR, MAX_TOKENS, TOKEN_INTERVAL,
  PEG_Y0, PEG_ROW_GAP, PEG_R, PEG_ROWS, PEG_JITTER,
  LAUNCH_SPEED, LAUNCH_AIR, DROP_GRAVITY,
  CREDIT_OPTIONS, DEFAULT_CREDITS, MAX_CREDITS,
  MODE, STATUS
} from "../js/engine.mjs";
import { ENDLESS_LAYOUT, TOKEN_TABLE, TOKEN_AREA } from "../js/levels.mjs";
import { cascadeMult } from "../js/score.mjs";

// 台面币的最小合法形状（chute/air/pegFree 必须显式给出数值，引擎按 chute>0 判定通道状态）
function mkCoin(id, x, y, extra = {}) {
  return { id, x, y, vx: 0, vy: 0, r: COIN_R, mass: 1, kind: "norm", air: 0, chute: 0, chuteTimer: 0, pegFree: false, ...extra };
}

function positions(state) {
  return state.coins.map((c) => [c.id, Number(c.x.toFixed(9)), Number(c.y.toFixed(9))]);
}

// 跑一局，返回落在台面上的 x 序列（用于散布统计）
function landings(seed, n, { keepPegs = true } = {}) {
  let state = startEndless(999, seed);
  state.status = STATUS.PLAYING;
  state.tokens = [];
  state.coins = [];
  if (!keepPegs) state.pegs = [];
  const xs = [];
  for (let i = 0; i < n; i++) {
    const res = insertCoin(state);
    if (res.state === state) break;
    state = res.state;
    const newest = state.coins.reduce((acc, c) => (c.kind === "norm" && (!acc || c.id > acc.id) ? c : acc), null);
    if (!newest) continue;
    const id = newest.id;
    for (let k = 0; k < 900; k++) {
      state = stepFrame(state, FIXED_DT, {}).state;
      const c = state.coins.find((x) => x.id === id);
      if (!c) break;
      if (!(c.chute > 0)) { xs.push(c.x); break; }
    }
  }
  return xs;
}

function spread(xs) {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const varr = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
  return { n: xs.length, std: Math.sqrt(varr), mean, distinct: new Set(xs.map((x) => x.toFixed(1))).size };
}

describe("engine: 确定性契约", () => {
  it("固定步长恒为 1/120", () => {
    assert.equal(FIXED_DT, 1 / 120);
    assert.equal(1 / FIXED_DT, 120);
  });

  it("mulberry32 同种子给出同序列，异种子给出异序列", () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const c = mulberry32(12346);
    const seqA = Array.from({ length: 16 }, () => a());
    const seqB = Array.from({ length: 16 }, () => b());
    const seqC = Array.from({ length: 16 }, () => c());
    assert.deepEqual(seqA, seqB);
    assert.notDeepEqual(seqA, seqC);
    for (const v of seqA) assert.ok(v >= 0 && v < 1);
  });

  it("nextRandom 推进的是 state.rngState（可随存档重放）", () => {
    const state = { rngState: 999 };
    const holder = { rngState: 999 };
    const first = nextRandom(state);
    assert.equal(first, nextRandom(holder));
    assert.equal(state.rngState, holder.rngState);
    assert.notEqual(first, nextRandom(state));
  });

  it("同种子同脚本逐帧一致，异种子台面不同", () => {
    function replay(seed) {
      let state = startEndless(60, seed);
      state.status = STATUS.PLAYING;
      const frames = [];
      for (let i = 0; i < 900; i++) {
        if (i % 9 === 0) state = insertCoin(state).state;
        state = stepFrame(state, FIXED_DT, {}).state;
        frames.push(positions(state));
      }
      return { state, frames };
    }
    const a = replay(4242);
    const b = replay(4242);
    const c = replay(4243);
    assert.deepEqual(a.frames, b.frames, "同种子重放必须逐帧一致");
    assert.equal(a.state.score, b.state.score);
    assert.notDeepEqual(a.frames[a.frames.length - 1], c.frames[c.frames.length - 1], "异种子应产生不同台面");
  });
});

describe("engine: 纯函数性", () => {
  it("insertCoin / stepFrame 都不修改入参 state", () => {
    const base = createInitialState({ seed: 2026 });
    const before = JSON.stringify(base);
    const res = insertCoin(base);
    assert.equal(JSON.stringify(base), before, "insertCoin 不得污染原 state");
    const state = res.state;
    const snapshot = positions(state);
    const score = state.score;
    stepFrame(state, FIXED_DT, {});
    stepFrame(state, FIXED_DT, {});
    assert.deepEqual(positions(state), snapshot, "stepFrame 不得就地改写金币");
    assert.equal(state.score, score);
  });

  it("insertCoin 返回全新 state 对象，并产生 insert 事件", () => {
    const base = createInitialState({ seed: 3 });
    const res = insertCoin(base);
    assert.notEqual(res.state, base);
    assert.ok(res.events.some((e) => e.type === "insert"));
  });

  it("cloneState 深拷贝金币与增益，避免共享引用", () => {
    const state = createInitialState({ seed: 5 });
    const copy = cloneState(state);
    copy.coins[0].x = 999;
    copy.effects.double = 9;
    assert.notEqual(state.coins[0].x, 999);
    assert.equal(state.effects.double, 0);
  });
});

describe("engine: 投币口固定 · 落点不可被玩家指定", () => {
  it("insertCoin 不接受任何落点/力度参数，多传的参数被忽略", () => {
    assert.equal(insertCoin.length, 1, "insertCoin 只应接收 state，不得有落点/力度形参");
    const base = startEndless(999, 5);
    base.status = STATUS.PLAYING;
    base.tokens = [];
    base.coins = [];
    const a = insertCoin(base).state;
    const b = insertCoin(base, 0.5, 1.0).state;
    const c = insertCoin(base, 12.9, 0.0).state;
    const last = (s) => s.coins[s.coins.length - 1];
    assert.equal(last(a).x, last(b).x, "落点不得随参数变化");
    assert.equal(last(a).x, last(c).x, "落点不得随参数变化");
    assert.equal(last(a).vx, last(c).vx, "初速不得随参数变化");
  });

  it("币只从固定投币口进入，且初始处于通道状态", () => {
    const state = startEndless(999, 77);
    state.status = STATUS.PLAYING;
    const res = insertCoin(state);
    const coin = res.state.coins[res.state.coins.length - 1];
    assert.ok(coin.chute > 0, "刚投出的币应在通道内");
    assert.ok(Math.abs(coin.x - CHUTE_X) <= 0.34 + 1e-9, `币的出口 x 必须落在投币口抖动范围内，实际 ${coin.x}`);
    assert.ok(Math.abs(coin.y - CHUTE_Y0) < 1e-9);
    assert.ok(coin.vy > 0, "出口初速必须沿 +y 向下");
  });
});

describe("engine: 挡杆阵是落点散布的唯一来源", () => {
  it("空台面连投 40 枚，落点明显散开（不是投币口抖动）", () => {
    for (const seed of [20261008, 777, 4242]) {
      const xs = landings(seed, 40);
      const s = spread(xs);
      assert.equal(s.n, 40, `应有 40 个落点，实际 ${s.n}`);
      // 只靠投币口抖动时 std ≈ 0.34/√3 ≈ 0.196；挡杆阵必须把它显著放大
      assert.ok(s.std > 0.7, `种子 ${seed} 落点标准差过小 ${s.std.toFixed(3)}（挡杆阵没起作用）`);
      // 挡杆梯架把币分流进若干条离散弹道，落点天然是"若干档"而不是连续均匀分布。
      // 判据取 10 档（旧横向阻尼 0.25/s 时为 21 档，但落点会横漂到 3.89 单位外）。
      // 「不许横漂过远」由专门的落点收敛断言负责，不在这里重复。
      assert.ok(s.distinct >= 10, `种子 ${seed} 落点种类过少 ${s.distinct}`);
    }
  });

  it("去掉挡杆阵后落点立刻退化成投币口抖动（证明散布确实来自挡杆）", () => {
    const withPegs = spread(landings(20261008, 40, { keepPegs: true }));
    const noPegs = spread(landings(20261008, 40, { keepPegs: false }));
    assert.ok(noPegs.std < 0.4, `无挡杆时落点本应收窄，实际 std=${noPegs.std.toFixed(3)}`);
    assert.ok(withPegs.std > noPegs.std * 2, `挡杆必须显著放大散布：有杆 ${withPegs.std.toFixed(3)} vs 无杆 ${noPegs.std.toFixed(3)}`);
  });

  it("挡杆几何自检：相邻两排净空大于碰撞距离，币不会被两排杆同时顶住", () => {
    const state = startEndless(1, 20261008);
    // 6 列 × 3 排，逐排错位后有 3 根落到台面边界外被裁掉
    assert.equal(state.pegs.length, 16, `挡杆数量应为 16，实际 ${state.pegs.length}`);
    // 行号由引擎显式给出（peg.row），测试不再自己反推 —— 反推等于复刻被测逻辑
    const rows = new Map();
    for (const peg of state.pegs) {
      assert.ok(Number.isInteger(peg.row) && peg.row >= 0 && peg.row < PEG_ROWS, `peg.row 非法：${peg.row}`);
      assert.ok(Math.abs(peg.y - (PEG_Y0 + peg.row * PEG_ROW_GAP)) <= PEG_JITTER, `第 ${peg.row} 排 y 偏离基准线：${peg.y}`);
      if (!rows.has(peg.row)) rows.set(peg.row, []);
      rows.get(peg.row).push(peg);
    }
    assert.equal(rows.size, 3, "应有 3 排挡杆");
    // 同排内相邻两杆的净空必须容得下币（否则币会被卡死）
    for (const [, row] of rows) {
      const xs = row.map((p) => p.x).sort((a, b) => a - b);
      for (let i = 1; i < xs.length; i++) {
        assert.ok(xs[i] - xs[i - 1] > 2 * (COIN_R + PEG_R), `同排杆距过窄 ${xs[i] - xs[i - 1]}`);
      }
    }
    for (const peg of state.pegs) {
      for (const other of state.pegs) {
        if (other === peg) continue;
        const d = Math.hypot(peg.x - other.x, peg.y - other.y);
        assert.ok(d > 0.2, `两根杆不得重叠：${d}`);
      }
    }
  });

  it("币不会永久悬在通道里：限时内必落到台面", () => {
    for (const seed of [11, 222, 3333]) {
      let state = startEndless(999, seed);
      state.status = STATUS.PLAYING;
      state.coins = [];
      state.tokens = [];
      state = insertCoin(state).state;
      const id = state.coins[state.coins.length - 1].id;
      let landedAt = -1;
      for (let k = 0; k < 1200; k++) {
        state = stepFrame(state, FIXED_DT, {}).state;
        const c = state.coins.find((x) => x.id === id);
        if (!c) break;
        if (!(c.chute > 0)) { landedAt = k; break; }
      }
      assert.ok(landedAt >= 0, `种子 ${seed} 的币没有落地`);
      assert.ok(landedAt * FIXED_DT <= DROP_MAX_AIR + 0.5, `种子 ${seed} 落地耗时 ${(landedAt * FIXED_DT).toFixed(2)}s 过长`);
    }
  });
});

describe("engine: 账户制（投币 −1 / 落袋 +1 / 侧沟 0）", () => {
  it("每次投币扣 1 枚账户币，账户见底后 canInsert 为假", () => {
    let state = startEndless(3, 555);
    assert.equal(state.credits, 3);
    for (let i = 0; i < 3; i++) {
      const res = insertCoin(state);
      assert.notEqual(res.state, state, `第 ${i + 1} 次投币应成功`);
      state = res.state;
    }
    assert.equal(state.credits, 0);
    assert.equal(canInsert(state), false);
    const refused = insertCoin(state);
    assert.equal(refused.state, state, "账户见底后不得再投");
    assert.deepEqual(refused.events, []);
  });

  it("掉进托盘的币回到账户 +1（而不是只加分）", () => {
    const state = startEndless(0, 12);
    state.status = STATUS.PLAYING;
    state.credits = 0;
    state.tokens = [];
    state.coins = [mkCoin(1, 6, FIELD_H - 0.1, { vy: 4 })];
    let cur = state;
    for (let i = 0; i < 240; i++) cur = stepFrame(cur, FIXED_DT, {}).state;
    assert.equal(cur.drops, 1);
    assert.equal(cur.credits, 1, "落袋必须回 1 枚账户币");
  });

  it("账户上限被 clamp 在 MAX_CREDITS", () => {
    const state = startEndless(0, 13);
    state.status = STATUS.PLAYING;
    state.credits = MAX_CREDITS;
    state.tokens = [];
    state.coins = [mkCoin(1, 6, FIELD_H - 0.1, { vy: 4 })];
    let cur = state;
    for (let i = 0; i < 240; i++) cur = stepFrame(cur, FIXED_DT, {}).state;
    assert.equal(cur.credits, MAX_CREDITS);
  });

  it("球心越出左右边界的币掉进侧沟：不计分、不回账户", () => {
    for (const x of [-0.01, FIELD_W + 0.01]) {
      const state = startEndless(9, 14);
      state.status = STATUS.PLAYING;
      state.tokens = [];
      state.coins = [mkCoin(1, x, 6, {})];
      const out = stepFrame(state, FIXED_DT, {});
      assert.equal(out.state.coins.length, 0, "出界币应从台面移除");
      assert.equal(out.state.lostCoins, 1);
      assert.equal(out.state.drops, 0, "侧沟丢币不得计入落袋");
      assert.equal(out.state.credits, 9, "侧沟丢币不得回账户");
      assert.equal(out.state.score, 0, "侧沟丢币不得计分");
      assert.ok(out.events.some((e) => e.type === "lost_coin"));
    }
  });

  it("通道内的币即使飞出左右边界也不会被误判为侧沟丢币", () => {
    const state = startEndless(9, 15);
    state.status = STATUS.PLAYING;
    state.tokens = [];
    state.coins = [mkCoin(1, FIELD_W + 0.4, 1.0, { chute: 1, vy: 2 })];
    const out = stepFrame(state, FIXED_DT, {});
    assert.equal(out.state.lostCoins, 0, "通道内的币不属于侧沟丢币");
    assert.equal(out.state.coins.length, 1);
  });
});

describe("engine: 收工判定（无尽机台）", () => {
  it("账户归零且台面静置 → LOST，并结算统计", () => {
    const state = startEndless(1, 20261008);
    state.status = STATUS.PLAYING;
    state.credits = 0;
    state.coins = [];
    state.tokens = [];
    state.idleTimer = 0;
    let cur = state;
    let lost = null;
    for (let i = 0; i < 600; i++) {
      const out = stepFrame(cur, FIXED_DT, {});
      cur = out.state;
      lost = out.events.find((e) => e.type === "lost") ?? lost;
    }
    assert.equal(cur.status, STATUS.LOST);
    assert.ok(lost, "必须发出 lost 事件");
    assert.ok(outOfCredits(cur));
    const frozen = stepFrame(cur, FIXED_DT, {});
    assert.equal(frozen.state.time, cur.time, "终局后不得再推进时间");
  });

  it("账户归零但台面仍在动（有币会落袋）时不收工", () => {
    const state = startEndless(1, 20261008);
    state.status = STATUS.PLAYING;
    state.credits = 0;
    state.tokens = [];
    state.coins = [mkCoin(1, 6, FIELD_H - 0.1, { vy: 4 })];
    let cur = state;
    for (let i = 0; i < 60; i++) cur = stepFrame(cur, FIXED_DT, {}).state;
    assert.equal(cur.status, STATUS.PLAYING, "台面还在出货就不该收工");
  });

  it("READY 状态不推进物理，投币即转 PLAYING", () => {
    let state = startEndless(50, 7);
    assert.equal(state.status, STATUS.READY);
    assert.equal(state.mode, MODE.ENDLESS);
    const t0 = state.time;
    state = stepFrame(state, FIXED_DT, {}).state;
    assert.equal(state.time, t0, "READY 不该推进时间");
    state = insertCoin(state).state;
    assert.equal(state.status, STATUS.PLAYING);
  });

  it("READY 且账户为空 → 立刻收工（状态机不存在插不进也等不到结算的死局）", () => {
    const state = { ...startEndless(50, 11), status: STATUS.READY, credits: 0 };
    assert.equal(canInsert(state), false, "账户为 0 时插不进币");
    const res = stepFrame(state, FIXED_DT, {});
    assert.equal(res.state.status, STATUS.LOST);
    assert.equal(res.events.length, 1);
    assert.equal(res.events[0].type, "lost");
    assert.equal(res.events[0].score, state.score);
    assert.equal(res.events[0].dropped, state.dropped);
    assert.equal(res.events[0].lostCoins, state.lostCoins);
    assert.equal(res.events[0].inserted, state.inserted);
    assert.equal(res.events[0].jammed, false);
    // 幂等：再推进不会重复抛事件，也不会回到 READY
    const again = stepFrame(res.state, FIXED_DT, {});
    assert.equal(again.state.status, STATUS.LOST);
    assert.equal(again.events.length, 0);
  });

  it("READY 且账户非空 → 依旧不动（正常开局不该被误判收工）", () => {
    const state = startEndless(50, 12);
    const res = stepFrame(state, FIXED_DT, {});
    assert.equal(res.state.status, STATUS.READY);
    assert.equal(res.events.length, 0);
  });
});

describe("engine: 1000 步随机游走（不抛错 / 不卡死 / 守恒式恒成立）", () => {
  it("任意合法分支下 1000 步推进均保持有限数值与物理边界", () => {
    let state = startEndless(200, 20260917);
    state.status = STATUS.PLAYING;
    const initial = state.coins.length;
    let inserted = 0;
    let dropped = 0;

    for (let i = 0; i < 1000; i++) {
      if (i % 6 === 0) {
        const res = insertCoin(state);
        if (res.state !== state) {
          state = res.state;
          inserted += 1;
        }
      }
      const out = stepFrame(state, FIXED_DT, {});
      state = out.state;
      for (const ev of out.events) if (ev.type === "drop") dropped += 1;

      assert.ok(Number.isFinite(state.score), `第 ${i} 步 score 非有限值`);
      assert.ok(state.score >= 0, `第 ${i} 步 score 为负`);
      assert.ok(state.credits >= 0 && state.credits <= MAX_CREDITS, `第 ${i} 步账户越界 ${state.credits}`);
      assert.ok(state.coins.length <= MAX_COINS + 200, `第 ${i} 步金币数失控`);
      assert.ok(Number.isFinite(state.plateFront));
      assert.ok(state.plateFront >= PUSHER_RETRACT - 1e-6 && state.plateFront <= PUSHER_EXTEND + 1e-6);
      assert.ok(state.tokens.length <= MAX_TOKENS, `第 ${i} 步机关数越界 ${state.tokens.length}`);

      for (const coin of state.coins) {
        assert.ok(Number.isFinite(coin.x) && Number.isFinite(coin.y), `第 ${i} 步金币坐标 NaN`);
        assert.ok(coin.x >= -0.6 && coin.x <= FIELD_W + 0.6, `第 ${i} 步金币越界 x=${coin.x}`);
        assert.ok(coin.y <= FIELD_H + 1.5, `第 ${i} 步金币未落袋 y=${coin.y}`);
        assert.ok(Number.isFinite(coin.chute) && coin.chute >= 0);
        const speed = Math.hypot(coin.vx, coin.vy);
        assert.ok(speed <= MAX_SPEED + 1e-6, `第 ${i} 步超速 ${speed}`);
      }
    }

    assert.ok(inserted > 100, `投币次数过少：${inserted}`);
    assert.ok(dropped > 0, "1000 步随机游走应至少产生一次落袋");
    assert.equal(dropped, state.drops);
    // 账户守恒式：台面 + 落袋 + 侧沟 + 被机关挤掉 === 初始铺币 + 投币数 + 投放的金塔数
    assert.equal(
      state.coins.length + state.drops + state.lostCoins + state.cleared,
      initial + state.inserted + state.towers,
      "金币数量守恒被破坏"
    );
  });

  it("随机游走全程账户收支自洽：credits = 起始 − 投币 + 落袋 + 金塔回币", () => {
    let state = startEndless(80, 909);
    state.status = STATUS.PLAYING;
    const start = state.credits;
    let towerCredits = 0;
    for (let i = 0; i < 4000; i++) {
      if (i % 8 === 0) state = insertCoin(state).state;
      const out = stepFrame(state, FIXED_DT, {});
      state = out.state;
      for (const ev of out.events) if (ev.type === "tower_down") towerCredits += 1;
    }
    // 每次金塔落袋固定回 TOWER_CREDITS 枚；若中途触顶则只断言"不小于"
    const expectMin = start - state.inserted + state.drops;
    if (expectMin + towerCredits * TOWER_CREDITS <= MAX_CREDITS) {
      assert.equal(state.credits, expectMin + towerCredits * TOWER_CREDITS, "账户收支口径不自洽");
    } else {
      assert.ok(state.credits >= expectMin, "账户收支口径不自洽");
    }
  });
});

// ---------------------------------------------------------------- 台面静置不变量
//
// 用户口径：「金币的掉落、推动是否符合物理规律，不要出现不合理的自动浮动移动！」
// 下面五条把"物理自洽"钉成回归断言。每条都是"断言状态 = 受力的函数"，
// 且每条都能被对应的缺陷注入打红（注入方式写在断言里）。

describe("engine: 台面静置不变量（无人推动绝不自行移动）", () => {
  it("推板够不着的币在 2.5 个推板周期内零位移", () => {
    const state = startEndless(50, 5);
    state.status = STATUS.PLAYING;
    state.tokens = [];
    state.pegs = [];
    // 全部落在推板最远前缘（PUSHER_EXTEND + r）之后、悬垂带与沟槽带之外。
    // 坐标硬编码，绝不跟着常量走——否则注入缺陷时常量一变、位置一起漂移，断言恒真。
    const seeds = [
      mkCoin(1, 6.5, 5.40),
      mkCoin(2, 4.0, 7.60),
      mkCoin(3, 9.2, 8.40)
    ];
    const before = new Map(seeds.map((c) => [c.id, { x: c.x, y: c.y }]));
    state.coins = seeds.map((c) => ({ ...c }));
    let cur = state;
    const frames = Math.ceil((PUSH_CYCLE * 2.5) / FIXED_DT);
    for (let i = 0; i < frames; i++) cur = stepFrame(cur, FIXED_DT, {}).state;
    assert.equal(cur.coins.length, seeds.length, "无人区静置的币不得落袋或丢失");
    for (const coin of cur.coins) {
      const b = before.get(coin.id);
      const d = Math.hypot(coin.x - b.x, coin.y - b.y);
      assert.ok(d < 1e-9, `币 #${coin.id} 无人推动却自行移动了 ${d}`);
    }
  });

  it("开局台面即静力平衡：铺币零速度且零重叠", () => {
    const state = createInitialState({ credits: 999, seed: 20261008 });
    assert.ok(state.coins.every((c) => c.vx === 0 && c.vy === 0), "开局铺币速度必须全零");
    // 注入方式：去掉 populate 里的 settleField 调用 → 重叠 0.03 量级 → 打红
    const minD = 2 * COIN_R * PACK_FACTOR;
    let worst = 0;
    for (let i = 0; i < state.coins.length; i++) {
      for (let j = i + 1; j < state.coins.length; j++) {
        const a = state.coins[i];
        const b = state.coins[j];
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        if (minD - d > worst) worst = minD - d;
      }
    }
    assert.ok(worst < 1e-3, `开局铺币不得重叠（最大重叠 ${worst}），否则求解器会把整片币网推开`);
  });

  it("悬垂带之外与沟槽带之外的静止币零位移（带外必须严格零力）", () => {
    // 悬垂带必须足够窄：币心距边缘还有大半个币（> 0.25）就被持续外推，等于让币自己爬出去。
    // 注入方式：TIP_ZONE 放回 0.5 → 10.76 落进带内 → 该币自行移动 → 打红
    assert.ok(TIP_ZONE <= 0.25, `悬垂带过宽（${TIP_ZONE}）：币心距边缘还有 ${TIP_ZONE} 就开始外推`);
    // 坐标硬编码，绝不跟着 TIP_ZONE / GUTTER 走——否则注入缺陷时位置一起漂移，断言恒真。
    const seeds = [
      { id: 1, x: 6.5, y: 10.76 },
      { id: 2, x: 0.87, y: 7.0 }
    ];
    const before = new Map(seeds.map((c) => [c.id, { x: c.x, y: c.y }]));
    let cur = startEndless(50, 6);
    cur.status = STATUS.PLAYING;
    cur.tokens = [];
    cur.pegs = [];
    cur.coins = seeds.map((c) => mkCoin(c.id, c.x, c.y));
    for (let i = 0; i < 600; i++) cur = stepFrame(cur, FIXED_DT, {}).state;
    assert.equal(cur.coins.length, seeds.length);
    for (const coin of cur.coins) {
      const b = before.get(coin.id);
      const d = Math.hypot(coin.x - b.x, coin.y - b.y);
      assert.ok(d < 1e-9, `带外的静止币 #${coin.id} 自行移动了 ${d}`);
    }
  });

  it("挡边是接触式墙：静止边缘币零自移，撞挡边的币被拦住且不过冲", () => {
    // 用户反馈「边缘的金币莫名其妙自动往中间弹回来」。
    // 旧实现是无条件弹簧回推：静止贴边币自行获得 vx、整列边缘币一起滑向台面中央。
    // 注入方式 1：删掉 applyGutter 的 vx 门控（恢复无条件弹簧）→ A 组位移 → 打红
    // 注入方式 2：右分支阻尼符号改回减号（负阻尼）→ 右缘币被加速甩出 FIELD_W 掉侧仓 → C 组打红
    // 注入方式 3：GUTTER_DAMP 设 0 → 回弹穿透/过冲 → B 组打红

    // A. 静止币零自移（左右两缘 + 前缘角落；推板碰不到的 y 段）
    //    位置 bit-exact：无接触、无受力 ⇒ 积分步进 x += 0·h。
    //    坐标硬编码，绝不跟着 GUTTER / FIELD_W / TIP_ZONE 走——否则注入缺陷时位置一起漂移，断言恒真。
    const cases = [
      { id: 1, x: 0.30, y: 7.0 },
      { id: 2, x: 0.62, y: 9.3 },
      { id: 3, x: 12.65, y: 7.0 },
      { id: 4, x: 12.30, y: 9.3 },
      { id: 5, x: 0.40, y: 10.70 }
    ];
    let cur = startEndless(50, 7);
    cur.status = STATUS.PLAYING;
    cur.tokens = [];
    cur.pegs = [];
    cur.coins = cases.map((c) => mkCoin(c.id, c.x, c.y));
    for (let i = 0; i < 1200; i++) cur = stepFrame(cur, FIXED_DT, {}).state; // 10s：覆盖多个推板周期
    assert.equal(cur.coins.length, cases.length, "静止边缘币不该消失");
    for (const c of cases) {
      const now = cur.coins.find((q) => q.id === c.id);
      assert.equal(now.x, c.x, `静止边缘币 #${c.id} 横向自移（x=${now.x}）`);
      assert.equal(now.y, c.y, `静止边缘币 #${c.id} 纵向自移（y=${now.y}）`);
    }

    // B. 撞左挡边（vx=-4 ≈ 推板量级）：不许穿透 x=0 掉侧仓，回推不许过冲越界
    cur = startEndless(50, 7);
    cur.status = STATUS.PLAYING;
    cur.tokens = [];
    cur.pegs = [];
    cur.coins = [mkCoin(11, 0.60, 7.0, { vx: -4 })];
    let minX = 0.60;
    let maxX = 0.60;
    for (let i = 0; i < 600; i++) {
      cur = stepFrame(cur, FIXED_DT, {}).state;
      if (cur.coins.length === 0) break;
      minX = Math.min(minX, cur.coins[0].x);
      maxX = Math.max(maxX, cur.coins[0].x);
    }
    assert.equal(cur.coins.length, 1, "撞左挡边的币被穿透甩出台面（minX=" + minX + "）");
    // rail 硬度：vx=-4（推板量级）的币心最多探入 0.30（= 30% 币径，硬编码常量，绝不从 GUTTER 派生）。
    // 注入方式 3（GUTTER_DAMP=0）下实测探到 0.174 —— 挡边变软、币几乎贴到墙根，此断言即为其捕获位。
    assert.ok(minX >= 0.30, `挡边必须硬：撞击下探入过深，minX=${minX}（下限 0.30）`);
    assert.ok(maxX <= GUTTER + 1e-3, `挡边回推不得过冲越界，实际冲到 x=${maxX}（边界 ${GUTTER}）`);

    // C. 撞右挡边（vx=+4）：负阻尼 bug 的捕获位——旧代码每帧给币加速往墙外推
    cur = startEndless(50, 7);
    cur.status = STATUS.PLAYING;
    cur.tokens = [];
    cur.pegs = [];
    cur.coins = [mkCoin(12, 12.40, 7.0, { vx: 4 })];
    let rMaxX = 12.40;
    for (let i = 0; i < 600; i++) {
      cur = stepFrame(cur, FIXED_DT, {}).state;
      if (cur.coins.length === 0) break;
      rMaxX = Math.max(rMaxX, cur.coins[0].x);
    }
    assert.equal(cur.coins.length, 1, `撞右挡边的币被甩出右墙掉侧仓（maxX=${rMaxX}）`);
    // rail 硬度（右侧对称，同一条硬编码下限 0.30）
    assert.ok(rMaxX <= FIELD_W - 0.30, `挡边必须硬：右向撞击探入过深，maxX=${rMaxX}（上限 ${FIELD_W - 0.30}）`);
  });

  it("推板推进必须真正推动币堆（行程最远端须越过首行铺币球心）", () => {
    // 注入方式：PUSHER_EXTEND 放回 3.65 → 最远 minY = 4.15 = 首行球心 → 一枚都推不动 → 打红
    const state = createInitialState({ credits: 999, seed: 20261008 });
    state.status = STATUS.PLAYING;
    const firstY = ENDLESS_LAYOUT.startY;
    const head = state.coins.filter((c) => c.y < firstY + 0.4);
    assert.ok(head.length > 0, "首行铺币必须存在");
    const before = new Map(head.map((c) => [c.id, c.y]));
    let cur = state;
    for (let i = 0; i < Math.ceil(PUSH_CYCLE / FIXED_DT); i++) cur = stepFrame(cur, FIXED_DT, {}).state;
    let moved = 0;
    let maxPush = 0;
    for (const coin of cur.coins) {
      if (!before.has(coin.id)) continue;
      const d = coin.y - before.get(coin.id);
      if (d > 1e-6) moved += 1;
      if (d > maxPush) maxPush = d;
    }
    assert.ok(moved > 0, "推板走完一个周期却一枚币都没推动——推动机制静默失效");
    assert.ok(maxPush > COIN_R * 0.4, `推板推进量过小（${maxPush}），不足以推动币堆`);
  });
});

describe("engine: 物理量守恒与落袋", () => {
  it("等质量圆盘碰撞守恒动量（用无碰撞对照组消掉摩擦耗散）", () => {
    const makePair = (collide) => {
      const state = startEndless(50, 88);
      state.status = STATUS.PLAYING;
      state.tokens = [];
      state.coins = [
        mkCoin(1, 4.0, 8.0, { vx: 6 }),
        mkCoin(2, collide ? 5.2 : 11.5, collide ? 8.0 : 9.5)
      ];
      return state;
    };
    const momentum = (state) => state.coins.reduce((sum, c) => sum + c.vx * c.mass, 0);
    let withCollision = makePair(true);
    let control = makePair(false);
    for (let i = 0; i < 40; i++) {
      withCollision = stepFrame(withCollision, FIXED_DT, {}).state;
      control = stepFrame(control, FIXED_DT, {}).state;
    }
    assert.ok(Math.abs(momentum(withCollision) - momentum(control)) < 1e-9, "碰撞必须守恒动量");
    assert.ok(withCollision.coins[1].vx > 0, "被撞金币应获得正向速度");
    assert.ok(withCollision.coins[0].vx < 6, "碰撞后主动币应减速");
  });

  it("摩擦阻尼使台面速度单调衰减至零", () => {
    let state = startEndless(50, 11);
    state.status = STATUS.PLAYING;
    state.tokens = [];
    state.coins = [mkCoin(1, 6, 6, { vx: 5 })];
    for (let i = 0; i < 240; i++) state = stepFrame(state, FIXED_DT, {}).state;
    assert.ok(Math.abs(state.coins[0].vx) < 0.05, `2 秒后应基本停住，实际 vx=${state.coins[0].vx}`);
  });

  it("球心越过边缘线即落袋，落袋后不再留在台面", () => {
    let state = startEndless(0, 12);
    state.status = STATUS.PLAYING;
    state.tokens = [];
    state.coins = [mkCoin(1, 6, FIELD_H - 0.1, { vy: 4 })];
    let dropped = 0;
    for (let i = 0; i < 240; i++) {
      const out = stepFrame(state, FIXED_DT, {});
      state = out.state;
      dropped += out.events.filter((e) => e.type === "drop").length;
    }
    assert.equal(dropped, 1);
    assert.equal(state.coins.length, 0);
    assert.equal(state.drops, 1);
    assert.equal(state.score, 10);
  });
});

describe("engine: 边缘连锁翻倍", () => {
  it("同一波内第 m 枚得 base × 2^(m-1)，逐档断言", () => {
    const state = startEndless(50, 7);
    state.status = STATUS.PLAYING;
    state.tokens = [];
    state.coins = Array.from({ length: 12 }, (_, i) => mkCoin(i + 1, 1.2 + i * 0.9, FIELD_H - 0.25, { vy: 3.2 }));

    let cur = state;
    const drops = [];
    for (let i = 0; i < 400 && drops.length < 12; i++) {
      const out = stepFrame(cur, FIXED_DT, {});
      cur = out.state;
      for (const ev of out.events) if (ev.type === "drop") drops.push(ev);
    }

    assert.equal(drops.length, 12, `应整波落袋 12 枚，实际 ${drops.length}`);
    for (let i = 0; i < drops.length; i++) {
      assert.equal(drops[i].cascade, i + 1, `第 ${i + 1} 枚的波内序号错误`);
      assert.equal(drops[i].mult, 2 ** i, `第 ${i + 1} 枚倍率应为 2^${i}`);
      assert.equal(drops[i].gained, 10 * 2 ** i);
    }
    assert.equal(cur.bestCascade, 12);
    assert.equal(cur.maxMult, 2 ** 11);
    assert.equal(cur.score, 10 * (2 ** 12 - 1));
    assert.equal(cur.drops, 12);
  });

  it("连锁倍率封顶 2^18（金卡），不会无限增长", () => {
    const state = startEndless(50, 21);
    state.status = STATUS.PLAYING;
    state.tokens = [];
    // 直接把波内序号顶到封顶之上，验证引擎确实按 2^18 截断（而不是照抄级数无限涨）
    state.cascadeCount = 30;
    state.coins = [mkCoin(1, 6, FIELD_H - 0.1, { vy: 4 })];
    let cur = state;
    let drop = null;
    for (let i = 0; i < 240 && !drop; i++) {
      const out = stepFrame(cur, FIXED_DT, {});
      cur = out.state;
      drop = out.events.find((e) => e.type === "drop") ?? null;
    }
    assert.ok(drop, "应产生一次落袋");
    assert.equal(drop.mult, 2 ** 18, "第 31 枚仍应被封顶在 2^18");
    assert.equal(drop.gained, 10 * 2 ** 18);
    assert.ok(cur.maxMult <= 2 ** 18);
    // 未触顶时倍率严格是 2^(m-1)
    assert.equal(cascadeMult(1), 1);
    assert.equal(cascadeMult(12), 2 ** 11);
    assert.equal(cascadeMult(19), 2 ** 18);
    assert.equal(cascadeMult(40), 2 ** 18);
  });

  it("连锁窗口超时后波次归零，倍率回到 ×1", () => {
    const state = startEndless(50, 31);
    state.status = STATUS.PLAYING;
    state.tokens = [];
    state.coins = [mkCoin(1, 6, FIELD_H - 0.2, { vy: 4 })];
    let cur = state;
    for (let i = 0; i < 400; i++) cur = stepFrame(cur, FIXED_DT, {}).state;
    assert.equal(cur.cascadeCount, 0);
    assert.equal(cur.cascadeMult, 1);
    assert.ok(cur.drops >= 1);
  });
});

describe("engine: 机关与金塔", () => {
  it("奖励卡被跨越后触发 3 秒增益并消失", () => {
    const state = startEndless(50, 20261008);
    state.status = STATUS.PLAYING;
    const card = { id: 1, type: "card", effect: "double", x: 6, y: 8, w: 1.7, h: 0.7, r: 0, used: false, cooldown: 0, pulse: 0 };
    state.tokens = [card];
    state.coins = [mkCoin(9001, card.x, card.y, { vy: 0.5 })];
    const out = stepFrame(state, FIXED_DT, {});
    const cardEvent = out.events.find((e) => e.type === "card");
    assert.ok(cardEvent, "跨越奖励卡应产生 card 事件");
    assert.equal(cardEvent.effect, "double");
    assert.equal(out.state.cardsCollected, 1);
    assert.equal(out.state.tokens.length, 0, "已触发的奖励卡应从台面移除");
    assert.ok(out.state.effects.double > 0, "增益未生效");
  });

  it("弹射器把金币抛入空中（air > 0）且飞行期间不与台面碰撞", () => {
    const state = startEndless(50, 20261008);
    state.status = STATUS.PLAYING;
    state.tokens = [{ id: 1, type: "launcher", effect: "", x: 6, y: 8, w: 0, h: 0, r: 0.85, used: false, cooldown: 0, pulse: 0 }];
    state.coins = [mkCoin(9100, 6, 8, { vy: 0.6 })];
    const out = stepFrame(state, FIXED_DT, {});
    assert.ok(out.events.some((e) => e.type === "launch"));
    const launched = out.state.coins.find((c) => c.id === 9100);
    assert.ok(launched.air > 0, "被弹射的金币应处于空中状态");
    assert.equal(launched.chute, 0, "弹射不属于投币通道");
    assert.ok(Math.hypot(launched.vx, launched.vy) <= MAX_SPEED);
  });

  it("金塔是实体刚体：落袋给大奖 + 回币，但不清空台面", () => {
    const state = startEndless(50, 20261008);
    state.status = STATUS.PLAYING;
    state.tokens = [];
    state.credits = 0;
    const tower = mkCoin(1, 6, FIELD_H - 0.2, { kind: "tower", r: TOWER_R, mass: 2, vy: 4 });
    state.coins = [tower, mkCoin(2, 3, 6), mkCoin(3, 9, 6)];
    let cur = state;
    let towerEvent = null;
    for (let i = 0; i < 300 && !towerEvent; i++) {
      const out = stepFrame(cur, FIXED_DT, {});
      cur = out.state;
      towerEvent = out.events.find((e) => e.type === "tower_down") ?? null;
    }
    assert.ok(towerEvent, "金塔落袋应触发 tower_down");
    assert.equal(towerEvent.bonus, 2000);
    assert.equal(cur.towerDown, true);
    assert.equal(cur.credits, TOWER_CREDITS, "金塔落袋应回一笔账户币");
    assert.ok(cur.score >= 2000);
    assert.ok(cur.coins.length >= 2, `金塔落袋不得清空台面，实际剩余 ${cur.coins.length}`);
    assert.equal(cur.cleared, 1, "金塔自身应从台面消失并计入 cleared");
    assert.equal(cur.drops, 0, "金塔不是普通落袋币");
  });

  it("每投满 TOKEN_INTERVAL 枚补投一个机关，且台面机关数不超过 MAX_TOKENS", () => {
    let state = startEndless(9999, 20261008);
    state.status = STATUS.PLAYING;
    state.coins = [];
    state.tokens = [];
    const spawned = [];
    for (let i = 0; i < TOKEN_INTERVAL * 30; i++) {
      // 台面清空，专测"补投节奏"本身（否则台面塞满后 canInsert 会先为假）
      state.coins = [];
      const res = insertCoin(state);
      if (res.state === state) break;
      state = res.state;
      for (const ev of res.events) if (ev.type === "token_spawn") spawned.push(ev);
      assert.ok(state.tokens.length <= MAX_TOKENS, `机关数越界 ${state.tokens.length}`);
    }
    assert.equal(state.inserted, TOKEN_INTERVAL * 30);
    assert.equal(spawned.length, 30, `应补投 30 次机关，实际 ${spawned.length}`);
    for (const ev of spawned) {
      assert.ok(["card", "launcher", "magnet", "tower"].includes(ev.token), `未知机关 ${ev.token}`);
      assert.ok(ev.x >= TOKEN_AREA.x0 - 1e-9 && ev.x <= TOKEN_AREA.x1 + 1e-9, "机关 x 越出投放区");
      assert.ok(ev.y >= TOKEN_AREA.y0 - 1e-9 && ev.y <= TOKEN_AREA.y1 + 1e-9, "机关 y 越出投放区");
    }
  });
});

describe("engine: 重开与边界工具", () => {
  it("restartStage 回到同种子同账户的初始态", () => {
    let state = startEndless(37, 777);
    state.status = STATUS.PLAYING;
    state.score = 1234;
    state.credits = 2;
    state.inserted = 35;
    const fresh = restartStage(state);
    assert.equal(fresh.seed, 777);
    assert.equal(fresh.score, 0);
    assert.equal(fresh.inserted, 0);
    assert.equal(fresh.credits, 37);
    assert.equal(fresh.coins.length, startEndless(37, 777).coins.length);
    assert.equal(fresh.status, STATUS.READY);
  });

  it("初始铺币数量与布局一致，且开局台面静止", () => {
    const state = startEndless(DEFAULT_CREDITS, 20261008);
    assert.ok(state.coins.length > 60, `初始铺币过少：${state.coins.length}`);
    assert.ok(state.coins.every((c) => c.vx === 0 && c.vy === 0 && c.chute === 0 && c.air === 0));
    assert.equal(state.credits, DEFAULT_CREDITS);
    assert.equal(ENDLESS_LAYOUT.startY, 4.15);
    assert.equal(TOKEN_TABLE[TOKEN_TABLE.length - 1].upto, 1, "机关权重表最后一项必须为 1");
  });

  it("credits 非法输入回落到默认值并 clamp", () => {
    assert.equal(createInitialState({ credits: -5 }).credits, DEFAULT_CREDITS);
    assert.equal(createInitialState({ credits: 0 }).credits, DEFAULT_CREDITS);
    assert.equal(createInitialState({ credits: NaN }).credits, DEFAULT_CREDITS);
    assert.equal(createInitialState({ credits: 99999 }).credits, MAX_CREDITS);
    assert.deepEqual(CREDIT_OPTIONS, [20, 50, 100]);
  });

  it("clamp / trapezoid / plateFrontAt 边界稳定", () => {
    assert.equal(clamp(-5, 0, 1), 0);
    assert.equal(clamp(5, 0, 1), 1);
    assert.equal(trapezoid(-1), 0);
    assert.equal(trapezoid(2), 1);
    assert.ok(Math.abs(trapezoid(1) - 1) < 1e-9);
    let prev = -1;
    for (let i = 0; i <= 100; i++) {
      const v = trapezoid(i / 100);
      assert.ok(v >= prev - 1e-9, "梯形曲线应单调不减");
      prev = v;
    }
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const front = plateFrontAt(p % 1);
      assert.ok(front >= PUSHER_RETRACT - 1e-9 && front <= PUSHER_EXTEND + 1e-9);
    }
  });
});

describe("engine: 通道内不悬空（挡杆夹持必须脱困）", () => {
  // 缺陷形态：相邻两排挡杆的净空（PEG_ROW_GAP）小于「币心到杆心」的碰撞距离时，
  // 币会同时顶住两根杆；逐个修正时后一根杆的修正恰好抵消前一根，
  // 币就悬死在杆缝里（实测最长静止 1.8s，直到 DROP_MAX_AIR 超时才直落）。
  // 用户看到的就是「金币莫名悬停一会儿、又突然消失」。
  it("多 seed 连投 30s：没有任何通道币长时间静止", () => {
    for (const seed of [20261008, 7, 99, 777]) {
      let state = startEndless(60, seed);
      state.status = STATUS.PLAYING;
      const steps = Math.round(30 / FIXED_DT);
      const every = Math.round(0.35 / FIXED_DT);
      const still = new Map();
      let maxFreeze = 0;
      let worstId = -1;
      for (let i = 0; i < steps; i++) {
        if (i % every === 0) state = insertCoin(state).state;
        state = stepFrame(state, FIXED_DT, {}).state;
        for (const c of state.coins) {
          if (c.chute <= 0) continue;
          let rec = still.get(c.id);
          if (!rec) { still.set(c.id, { f: 0, x: c.x, y: c.y }); continue; }
          // 逐帧位置 bit 级相同 = 求解器死锁（正常弹跳不可能两位小数内完全不动）
          if (c.x === rec.x && c.y === rec.y) {
            rec.f += 1;
            if (rec.f > maxFreeze) { maxFreeze = rec.f; worstId = c.id; }
          } else {
            rec.f = 0; rec.x = c.x; rec.y = c.y;
          }
        }
      }
      const secs = maxFreeze * FIXED_DT;
      assert.ok(secs <= 0.1, `种子 ${seed} 有币 #${worstId} 在通道里静止 ${secs.toFixed(3)}s（被挡杆夹住悬空）`);
    }
  });

  it("横向阻尼让币很快停止横滑：落点收敛在投币口附近", () => {
    // 旧横向阻尼只有 0.25/s（等效冰面），币被杆弹一下能横漂 3 秒、
    // 落点最偏 3.89 单位（13 宽台面的 30%）——即"金币左右漂移、投币位置不准"。
    for (const seed of [20261008, 777, 4242]) {
      let state = startEndless(999, seed);
      state.status = STATUS.PLAYING;
      state.tokens = [];
      state.coins = [];
      let worst = 0;
      for (let i = 0; i < 40; i++) {
        const res = insertCoin(state);
        if (res.state === state) break;
        state = res.state;
        const newest = state.coins.reduce((a, c) => (c.kind === "norm" && (!a || c.id > a.id) ? c : a), null);
        if (!newest) continue;
        const id = newest.id;
        for (let k = 0; k < 900; k++) {
          state = stepFrame(state, FIXED_DT, {}).state;
          const c = state.coins.find((x) => x.id === id);
          if (!c) break;
          if (!(c.chute > 0)) {
            worst = Math.max(worst, Math.abs(c.x - CHUTE_X));
            break;
          }
        }
      }
      // 硬编码设计边界：挡杆只做适度散布，绝不允许横漂过 2.2 单位
      assert.ok(worst <= 2.2, `种子 ${seed} 落点偏离投币口 ${worst.toFixed(2)} 单位（横漂）`);
    }
  });
});

describe("engine: 腾空币遵循重力（弹射是抛掷，不是漂浮）", () => {
  const launcherToken = () => ({
    id: 1, type: "launcher", effect: "", x: 6, y: 8, w: 0, h: 0, r: 0.85,
    used: false, cooldown: 0, pulse: 0
  });

  it("出手向上、vy 全程单调递增、落回时速度与出手对称", () => {
    let state = startEndless(50, 20261008);
    state.status = STATUS.PLAYING;
    state.tokens = [launcherToken()];
    state.coins = [mkCoin(9300, 6, 8, { vy: 0.6 })];
    const out = stepFrame(state, FIXED_DT, {});
    const first = out.state.coins.find((c) => c.id === 9300);
    assert.ok(first.air > 0, "被弹射的金币应处于空中状态");
    assert.equal(first.chute, 0, "弹射不属于投币通道");
    assert.ok(first.vy < 0, `出手必须向上（−y 朝机头），实际 vy=${first.vy}`);

    const vys = [];
    state = out.state;
    for (let k = 0; k < Math.ceil(LAUNCH_AIR / FIXED_DT) + 4; k++) {
      state = stepFrame(state, FIXED_DT, {}).state;
      const c = state.coins.find((x) => x.id === 9300);
      if (!c || !(c.air > 0)) break;
      vys.push(c.vy);
    }
    assert.ok(vys.length >= 40, `腾空样本过少 ${vys.length}`);
    for (let i = 1; i < vys.length; i++) {
      assert.ok(vys[i] > vys[i - 1] - 1e-9,
        `腾空期 vy 必须单调递增（恒定向下加速度），第 ${i} 步 ${vys[i - 1]} → ${vys[i]}`);
    }
    // 抛物线自洽：出手 −v、落回 +v（允许轻微空气阻尼造成的不对称）
    assert.ok(vys[0] < 0 && vys[vys.length - 1] > 0, "必须先升后落");
    assert.ok(Math.abs(vys[vys.length - 1] + vys[0]) < 1.5,
      `落回速度应与出手对称：出手 ${vys[0].toFixed(2)}，落回 ${vys[vys.length - 1].toFixed(2)}`);
  });

  it("腾空时长 = 2v/g，与抛物线严格自洽", () => {
    assert.ok(Math.abs(LAUNCH_AIR - (2 * LAUNCH_SPEED) / DROP_GRAVITY) < 1e-9,
      "腾空时长必须等于抛物线周期，否则币还在上升就被按回台面（位置突跳）");
  });
});

