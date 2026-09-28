// mazes.test.mjs —— 数据层可解性验收（AGENTS §3 铁律：100% 数学可解、严禁死局）。
//
// 校验口径与引擎严格一致：直接复用 parseMaze + neighborTile + canPass，绝不另写一套通行规则
// （另写一套 = 测试数据与运行时两张皮，生成器改了规则测试还绿，那就是假绿）。
// 闸门按「开启」口径判定 —— 闸门周期性开合，若按关闭算，闸门后的豆会被误判成不可达。

import test from "node:test";
import assert from "node:assert/strict";

import { parseMaze, neighborTile, canPass, CELL, FEATURE, DIR } from "../js/engine.mjs";
import { MAZES, SETPIECES, SETPIECE_GOALS } from "../js/mazes.mjs";

const DIRS = [DIR.UP, DIR.DOWN, DIR.LEFT, DIR.RIGHT];

/** 造一个只供 canPass 查询用的假 state：闸门恒开、玩家视角（进不了巢与门） */
function probe(grid, isGhost = false, mode = "chase") {
  return { grid, gatesOpen: true, isGhost, mode };
}

function passable(grid, x, y, dir, isGhost, mode) {
  const nb = neighborTile(grid, x, y, dir);
  if (!nb) return null;
  const st = probe(grid, isGhost, mode);
  return canPass(st, x, y, nb.x, nb.y, dir, isGhost, isGhost ? mode : "chase") ? nb : null;
}

/** 从出生点按有向规则 BFS（玩家视角，闸门开） */
function reachable(grid, from) {
  const seen = new Set([from.y * grid.cols + from.x]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    for (const d of DIRS) {
      const nb = passable(grid, cur.x, cur.y, d, false);
      if (!nb) continue;
      const id = nb.y * grid.cols + nb.x;
      if (seen.has(id)) continue;
      seen.add(id);
      queue.push(nb);
    }
  }
  return seen;
}

/** Tarjan 求最大强连通分量（有向图：单向风道会切分连通性） */
function largestScc(grid) {
  const n = grid.rows * grid.cols;
  const index = new Int32Array(n).fill(-1);
  const low = new Int32Array(n);
  const onStack = new Uint8Array(n);
  const stack = [];
  let counter = 0;
  let best = 0;
  const sizes = [];

  const dfs = (v) => {
    index[v] = low[v] = counter++;
    stack.push(v);
    onStack[v] = 1;
    const x = v % grid.cols;
    const y = Math.floor(v / grid.cols);
    for (const d of DIRS) {
      const nb = passable(grid, x, y, d, false);
      if (!nb) continue;
      const ni = nb.y * grid.cols + nb.x;
      if (index[ni] === -1) {
        dfs(ni);
        low[v] = Math.min(low[v], low[ni]);
      } else if (onStack[ni]) {
        low[v] = Math.min(low[v], index[ni]);
      }
    }
    if (low[v] === index[v]) {
      let size = 0;
      for (;;) {
        const w = stack.pop();
        onStack[w] = 0;
        size += 1;
        if (w === v) break;
      }
      sizes.push(size);
      best = Math.max(best, size);
    }
  };
  for (let v = 0; v < n; v += 1) if (index[v] === -1) dfs(v);
  return best;
}

/** 最长死胡同链：度数为 1 的节点往里走，直到遇到分叉 */
function maxDeadEnd(grid) {
  const deg = (x, y) => DIRS.filter((d) => passable(grid, x, y, d, false)).length;
  let worst = 0;
  for (let y = 0; y < grid.rows; y += 1) {
    for (let x = 0; x < grid.cols; x += 1) {
      const i = y * grid.cols + x;
      if (grid.cell[i] === CELL.WALL) continue;
      if (deg(x, y) !== 1) continue;
      let depth = 1;
      const visited = new Set([i]);
      let cur = { x, y };
      for (;;) {
        const nbs = DIRS.map((d) => passable(grid, cur.x, cur.y, d, false)).filter(
          (nb) => nb && !visited.has(nb.y * grid.cols + nb.x),
        );
        if (nbs.length !== 1) break;
        cur = nbs[0];
        visited.add(cur.y * grid.cols + cur.x);
        depth += 1;
        if (deg(cur.x, cur.y) > 2) break;
        if (depth > 40) break;
      }
      worst = Math.max(worst, depth);
    }
  }
  return worst;
}

const parsed = new Map(MAZES.map((m) => [m.id, parseMaze(m)]));

// ---------------------------------------------------------------- 迷宫

test("七张迷宫：尺寸统一、四周封闭、隧道两端互穿", () => {
  assert.equal(MAZES.length, 7);
  for (const m of MAZES) {
    const g = parsed.get(m.id);
    assert.equal(g.cols, 28, `${m.id} 列数必须是 28`);
    assert.equal(g.rows, 31, `${m.id} 行数必须是 31`);
    for (let x = 0; x < g.cols; x += 1) {
      assert.equal(g.cell[x], CELL.WALL, `${m.id} 顶边漏风`);
      assert.equal(g.cell[(g.rows - 1) * g.cols + x], CELL.WALL, `${m.id} 底边漏风`);
    }
    for (const row of m.tunnelRows) {
      assert.ok(row > 0 && row < g.rows - 1, `${m.id} 隧道行不能在边界上`);
      const left = neighborTile(g, 0, row, DIR.LEFT);
      const right = neighborTile(g, g.cols - 1, row, DIR.RIGHT);
      assert.ok(left && right, `${m.id} 隧道两端必须互穿`);
      assert.equal(g.cell[row * g.cols + left.x] !== CELL.WALL, true, `${m.id} 隧道出口被墙堵了`);
    }
  }
});

test("七张迷宫：所有豆从出生点有向可达（严禁死局）", () => {
  for (const m of MAZES) {
    const g = parsed.get(m.id);
    const seen = reachable(g, g.playerStart);
    let total = 0;
    for (let i = 0; i < g.pellets.length; i += 1) {
      if (!g.pellets[i]) continue;
      total += 1;
      assert.ok(seen.has(i), `${m.id} 的豆 (${i % g.cols},${Math.floor(i / g.cols)}) 从出生点走不到`);
    }
    assert.ok(total >= 150 && total <= 400, `${m.id} 豆数 ${total} 超出合理区间`);
  }
});

test("七张迷宫：最大强连通分量 ≥12（有绕圈的余地，不会被一路堵死）", () => {
  for (const m of MAZES) {
    const scc = largestScc(parsed.get(m.id));
    assert.ok(scc >= 12, `${m.id} 的最大 SCC 只有 ${scc}，纯树状迷宫没有退路`);
  }
});

test("七张迷宫：死胡同深度 ≤4（不挖无底洞）", () => {
  for (const m of MAZES) {
    const d = maxDeadEnd(parsed.get(m.id));
    assert.ok(d <= 4, `${m.id} 的死胡同深度 ${d} 超过 4`);
  }
});

test("幽灵巢必须封闭：四周只有门可进出，否则幽灵会漏出去或出不来", () => {
  for (const m of MAZES) {
    const g = parsed.get(m.id);
    for (const nest of m.nests) {
      // exitTile 是门外的第一格走廊，门格在它下方，巢体在门下方
      const door = { x: nest.exitTile.x, y: nest.exitTile.y + 1 };
      const i = door.y * g.cols + door.x;
      assert.equal(g.cell[i], CELL.DOOR, `${m.id} 巢门位置不是门格`);
      assert.equal(g.cell[(door.y + 1) * g.cols + door.x], CELL.HOUSE, `${m.id} 门里侧不是巢内`);
      assert.equal(g.cell[(door.y - 1) * g.cols + door.x] !== CELL.WALL, true, `${m.id} 门外被墙堵死`);
      // 巢体四周除门以外必须全是墙，否则幽灵会漏出去
      for (const slot of nest.slots) {
        assert.equal(g.cell[slot.y * g.cols + slot.x], CELL.HOUSE, `${m.id} 巢位不是巢内`);
      }
    }
  }
});

test("幽灵必须能出巢：门格在 eaten / exiting 口径下可通行，且门外有路", () => {
  for (const m of MAZES) {
    const g = parsed.get(m.id);
    for (const nest of m.nests) {
      const door = { x: nest.exitTile.x, y: nest.exitTile.y + 1 };
      // 门判定发生在「踏进门格」那一步：从巢内往上走进门，再从门往上走到走廊
      assert.equal(
        canPass(probe(g, true, "exiting"), door.x, door.y + 1, door.x, door.y, DIR.UP, true, "exiting"),
        true,
        `${m.id} 幽灵在 exiting 状态下出不了门`,
      );
      assert.equal(
        canPass(probe(g, true, "eaten"), door.x, door.y + 1, door.x, door.y, DIR.UP, true, "eaten"),
        true,
        `${m.id} 被吃掉的幽灵回不了巢`,
      );
      assert.equal(
        canPass(probe(g, true, "caging"), door.x, door.y + 1, door.x, door.y, DIR.UP, true, "caging"),
        false,
        `${m.id} 巢门对普通状态应该是关的（否则幽灵会自己溜出来）`,
      );
      assert.equal(
        canPass(probe(g, false), door.x, door.y + 1, door.x, door.y, DIR.UP, false, "chase"),
        false,
        `${m.id} 玩家不该能穿门进巢`,
      );
      // 门外那格必须是真通路，否则出了门也是撞墙
      const out = neighborTile(g, door.x, door.y, DIR.UP);
      assert.ok(out && canPass(probe(g, true, "exiting"), door.x, door.y, out.x, out.y, DIR.UP, true, "exiting"),
        `${m.id} 门外一格走不通`);
    }
  }
});

test("出生点合法：是通路、不在巢里、且四向至少有一条出路", () => {
  for (const m of MAZES) {
    const g = parsed.get(m.id);
    const s = g.playerStart;
    const i = s.y * g.cols + s.x;
    assert.equal(g.cell[i] !== CELL.WALL, true, `${m.id} 出生点是墙`);
    assert.notEqual(g.cell[i], CELL.HOUSE, `${m.id} 出生点在巢里`);
    assert.notEqual(g.cell[i], CELL.DOOR, `${m.id} 出生点在门上`);
    const outs = DIRS.filter((d) => passable(g, s.x, s.y, d, false));
    assert.ok(outs.length >= 1, `${m.id} 出生点是死格`);
  }
});

test("机关分布符合主题：tips 声明的机关必须在图上真的存在", () => {
  for (const m of MAZES) {
    const g = parsed.get(m.id);
    const feat = new Set();
    const oneways = new Set();
    for (let i = 0; i < g.feature.length; i += 1) {
      if (g.feature[i] === FEATURE.SYRUP) feat.add("syrup");
      if (g.feature[i] === FEATURE.ICE) feat.add("ice");
      if (g.feature[i] === FEATURE.GATE) feat.add("gate");
    }
    for (let i = 0; i < g.oneway.length; i += 1) if (g.oneway[i] >= 0) oneways.add("oneway");
    for (const tip of m.meta.tips ?? []) {
      assert.ok(feat.has(tip) || oneways.has(tip), `${m.id} 声明了 ${tip} 但图上找不到`);
    }
    if (m.nests.length > 1) assert.equal(m.nests.length, 2, `双巢迷宫应当正好两个巢`);
    for (const tip of ["syrup", "ice", "gate"]) {
      if (feat.has(tip)) assert.ok((m.meta.tips ?? []).includes(tip), `${m.id} 图上有 ${tip} 却没声明`);
    }
    if (oneways.size) assert.ok((m.meta.tips ?? []).includes("oneway"), `${m.id} 图上有风道却没声明`);
  }
});

test("最后一张迷宫是总招牌：机关齐全且双巢", () => {
  const last = MAZES[MAZES.length - 1];
  assert.equal(last.meta.key, "master");
  assert.deepEqual([...last.meta.tips].sort(), ["gate", "ice", "oneway", "syrup"]);
  assert.equal(last.nests.length, 2);
});

// ---------------------------------------------------------------- 残局

test("十张残局：三类目标齐全、限制值有效、一命通关", () => {
  assert.equal(SETPIECES.length, 10);
  assert.deepEqual(SETPIECE_GOALS, ["clear", "escape", "chain"]);
  const byGoal = {};
  for (const sp of SETPIECES) {
    assert.ok(SETPIECE_GOALS.includes(sp.goal), `${sp.id} 的目标类型非法`);
    byGoal[sp.goal] = (byGoal[sp.goal] ?? 0) + 1;
    assert.ok(parsed.has(sp.mazeId), `${sp.id} 引用了不存在的迷宫`);
    assert.equal(sp.lives, 1, `${sp.id} 残局必须一命`);
    assert.ok(sp.limitTime > 0 && sp.limitTime <= 300, `${sp.id} 的限时 ${sp.limitTime} 不合理`);
    assert.equal(sp.ghosts.length, 4, `${sp.id} 必须有四只幽灵`);
  }
  assert.ok(byGoal.clear >= 3 && byGoal.escape >= 3 && byGoal.chain >= 3, `三类残局数量不均：${JSON.stringify(byGoal)}`);
});

test("残局：保留的豆与幽灵落点都合法", () => {
  for (const sp of SETPIECES) {
    const g = parsed.get(sp.mazeId);
    assert.ok(sp.keep.length > 0, `${sp.id} 没保留任何豆`);
    for (const idx of sp.keep) {
      assert.ok(idx >= 0 && idx < g.pellets.length, `${sp.id} 的 keep 索引越界`);
      assert.equal(g.pellets[idx] > 0, true, `${sp.id} 的 keep 里混进了非豆格 (${idx % g.cols},${Math.floor(idx / g.cols)})`);
    }
    for (const gh of sp.ghosts) {
      const i = gh.y * g.cols + gh.x;
      assert.notEqual(g.cell[i], CELL.WALL, `${sp.id} 的幽灵落在墙里`);
      assert.ok(gh.x >= 0 && gh.x < g.cols && gh.y >= 0 && gh.y < g.rows, `${sp.id} 幽灵越界`);
      assert.ok([DIR.UP, DIR.DOWN, DIR.LEFT, DIR.RIGHT].includes(gh.dir), `${sp.id} 幽灵朝向非法`);
    }
  }
});

test("残局目标可完成：保留豆可达、出口可达、出生点不在墙上", () => {
  for (const sp of SETPIECES) {
    const g = parsed.get(sp.mazeId);
    const seen = reachable(g, g.playerStart);
    for (const idx of sp.keep) {
      assert.ok(seen.has(idx), `${sp.id} 的目标豆 (${idx % g.cols},${Math.floor(idx / g.cols)}) 走不到`);
    }
    if (sp.goal === "escape") {
      const i = sp.exit.y * g.cols + sp.exit.x;
      assert.notEqual(g.cell[i], CELL.WALL, `${sp.id} 的出口是墙`);
      assert.ok(seen.has(i), `${sp.id} 的出口走不到`);
    }
  }
});

test("残局里的四只幽灵不会开局就把玩家堵死：出生点与幽灵初始距离 ≥3 格", () => {
  for (const sp of SETPIECES) {
    const g = parsed.get(sp.mazeId);
    const s = g.playerStart;
    for (const gh of sp.ghosts) {
      const d = Math.abs(gh.x - s.x) + Math.abs(gh.y - s.y);
      assert.ok(d >= 3, `${sp.id} 的 ${gh.x},${gh.y} 离出生点只有 ${d} 格，开局即死`);
    }
  }
});
