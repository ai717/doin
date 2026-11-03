// levels.test.mjs — 24 层关卡数据完整性：尺寸 / 楼梯 / 连通 / 钥匙经济 / 怪物槽位
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LEVELS } from "../js/levels.mjs";
import { MONSTERS, TOTAL_FLOORS, ZONE_RANGES } from "../js/data.mjs";

const GRID = 11;
const KNOWN = new Set(["#", ".", "^", "v", "Y", "B", "R", "y", "b", "r", "g", "G", "p", "P", "A", "F", "W", "S", "C", "i", "T", "M", "Z", "x"]);
const WALK_ALL = (ch) => ch !== "#";

describe("levels: 基本结构", () => {
  it("共 24 层且 id 递增连续", () => {
    assert.equal(LEVELS.length, TOTAL_FLOORS);
    LEVELS.forEach((level, i) => assert.equal(level.id, i + 1));
  });

  it("每层 11 行 × 11 列，四周为石墙", () => {
    for (const level of LEVELS) {
      assert.equal(level.rows.length, GRID, `F${level.id} 行数`);
      level.rows.forEach((row, y) => {
        assert.equal(row.length, GRID, `F${level.id} 第 ${y} 行宽度`);
      });
      assert.equal(level.rows[0], "#".repeat(GRID), `F${level.id} 上边界`);
      assert.equal(level.rows[GRID - 1], "#".repeat(GRID), `F${level.id} 下边界`);
      for (let y = 1; y < GRID - 1; y += 1) {
        assert.equal(level.rows[y][0], "#", `F${level.id} 第 ${y} 行左边墙`);
        assert.equal(level.rows[y][GRID - 1], "#", `F${level.id} 第 ${y} 行右边墙`);
      }
    }
  });

  it("字符全部属于图例，怪物槽位都有映射且映射的怪存在", () => {
    for (const level of LEVELS) {
      const flat = level.rows.join("");
      for (const ch of flat) {
        if (/[1-9]/.test(ch)) continue;
        assert.ok(KNOWN.has(ch), `F${level.id} 出现未知字符 ${ch}`);
      }
      for (const ch of flat) {
        if (!/[1-9]/.test(ch)) continue;
        const id = level.monsters[ch];
        assert.ok(id, `F${level.id} 槽位 ${ch} 无怪物映射`);
        assert.ok(MONSTERS[id], `F${level.id} 映射了不存在的怪物 ${id}`);
      }
    }
  });

  it("1~23 层有且仅有一个上楼口，2~24 层有且仅有一个下楼口", () => {
    for (const level of LEVELS) {
      const flat = level.rows.join("");
      const ups = flat.split("").filter((c) => c === "^").length;
      const downs = flat.split("").filter((c) => c === "v").length;
      if (level.id < TOTAL_FLOORS) assert.equal(ups, 1, `F${level.id} 上楼口`);
      if (level.id > 1) assert.equal(downs, 1, `F${level.id} 下楼口`);
    }
  });
});

describe("levels: 连通性与可达", () => {
  it("把门 / 怪 / 暗墙视作可通行时，整层除墙外全部连通", () => {
    for (const level of LEVELS) {
      const flat = level.rows.join("");
      const start = flat.indexOf("v");
      const seen = new Uint8Array(GRID * GRID);
      const queue = [start];
      seen[start] = 1;
      while (queue.length) {
        const cur = queue.shift();
        const x = cur % GRID;
        const y = Math.floor(cur / GRID);
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
          const ni = ny * GRID + nx;
          if (seen[ni] || !WALK_ALL(flat[ni])) continue;
          seen[ni] = 1;
          queue.push(ni);
        }
      }
      const orphans = [];
      for (let i = 0; i < flat.length; i += 1) {
        if (flat[i] === "#") continue;
        if (!seen[i]) orphans.push(`${i % GRID},${Math.floor(i / GRID)}`);
      }
      assert.deepEqual(orphans, [], `F${level.id} 存在不可达格：${orphans.join(" ")}`);
    }
  });

  it("每层的钥匙数量不少于同色门数量（分层自足，不怕钥匙囤积）", () => {
    for (const level of LEVELS) {
      const flat = level.rows.join("");
      const count = (ch) => flat.split(ch).length - 1;
      assert.ok(count("y") >= count("Y"), `F${level.id} 黄钥匙不足：${count("y")} < ${count("Y")}`);
      assert.ok(count("b") >= count("B"), `F${level.id} 蓝钥匙不足`);
      assert.ok(count("r") >= count("R"), `F${level.id} 红钥匙不足`);
    }
  });

  it("每层至少有一只怪与一件增益道具", () => {
    for (const level of LEVELS) {
      const flat = level.rows.join("");
      const monsters = flat.split("").filter((c) => /[1-9]/.test(c)).length;
      const gain = flat.split("").filter((c) => "AFpgPGWS".includes(c)).length;
      assert.ok(monsters >= 1, `F${level.id} 没有怪`);
      assert.ok(gain >= 1, `F${level.id} 没有增益道具`);
    }
  });
});

describe("levels: 叙事节点", () => {
  it("五区各 5/5/5/5/4 层", () => {
    for (const range of ZONE_RANGES) {
      const floors = LEVELS.filter((level) => level.id >= range.from && level.id <= range.to);
      assert.equal(floors.length, range.to - range.from + 1);
      for (const level of floors) assert.equal(level.zone, range.zone);
    }
  });

  it("守关头目分布在 5 / 10 / 15 / 20 / 24 层，且只有 20 层是假魔王关卡", () => {
    const bossFloors = LEVELS.filter((level) => Object.values(level.monsters).some((id) => MONSTERS[id].boss)).map((level) => level.id);
    assert.deepEqual(bossFloors, [5, 10, 15, 20, 24]);
    const gates = LEVELS.filter((level) => level.gate).map((level) => level.id);
    assert.deepEqual(gates, [20]);
  });

  it("5 层有被囚的小偷，18 层有十字架，24 层有公主", () => {
    const has = (id, ch) => LEVELS[id - 1].rows.join("").includes(ch);
    assert.ok(has(5, "T"));
    assert.ok(has(18, "C"));
    assert.ok(has(24, "Z"));
  });

  it("至少有一层藏着暗墙，且暗墙出现晚于小偷所在层", () => {
    const sealed = LEVELS.filter((level) => level.rows.join("").includes("x")).map((level) => level.id);
    assert.ok(sealed.length >= 1);
    assert.ok(sealed.every((id) => id > 5));
  });
});
