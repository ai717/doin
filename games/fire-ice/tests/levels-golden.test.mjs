// 黄金路径重放：40 关逐一按玩家视角操作回放，验证可通关（确定性 60Hz 重放）
// 由 scripts/tmp-golden.mjs 的 40/40 序列移植而来
import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState, stepFrame } from "../js/engine.mjs";
import { getLevel, LEVEL_COUNT } from "../js/levels.mjs";

const DT = 1 / 60;

function step(state, inp) {
  return stepFrame(state, DT, inp).state;
}

// 按住方向直到 actor.x 越过 targetX
function move(state, kind, dir, targetX, maxSec = 10) {
  let t = 0;
  while (t < maxSec && state.status !== "won") {
    const a = state[kind];
    if ((dir > 0 && a.x >= targetX) || (dir < 0 && a.x <= targetX)) break;
    const inp = { fire: {}, ice: {} };
    inp[kind][dir > 0 ? "right" : "left"] = true;
    state = step(state, inp);
    t += DT;
  }
  return state;
}

// 单次起跳：按住 jump 0.1s 触发跳跃，之后自然落体（可带水平方向）
function jump(state, kind, dir = 0, holdSec = 0.1) {
  let t = 0;
  while (t < holdSec) {
    const inp = { fire: {}, ice: {} };
    inp[kind].jump = true;
    if (dir > 0) inp[kind].right = true;
    if (dir < 0) inp[kind].left = true;
    state = step(state, inp);
    t += DT;
  }
  return state;
}

// 跳上 1 格高平台：走到平台左缘内侧再单跳，自然落回平台
function hopUp(state, kind, platformCol, maxSec = 10) {
  const target = platformCol + 0.15;
  const dir = Math.sign(target - state[kind].x) || 1;
  state = move(state, kind, dir, target, maxSec);
  state = jump(state, kind, 0, 0.1);
  state = wait(state, 1.2); // 落回平台
  return state;
}

// 向前跳（跳过岩浆/坑），按住方向 + 单跳
function leap(state, kind, dir, holdSec = 0.55) {
  state = jump(state, kind, dir, holdSec);
  state = wait(state, 1.2);
  return state;
}

function wait(state, sec, fire = {}, ice = {}) {
  let t = 0;
  while (t < sec) {
    state = step(state, { fire, ice });
    t += DT;
  }
  return state;
}

function run(state, kind, dir, sec) {
  let t = 0;
  while (t < sec) {
    const inp = { fire: {}, ice: {} };
    inp[kind][dir > 0 ? "right" : "left"] = true;
    state = step(state, inp);
    t += DT;
  }
  return state;
}

function pressFreeze(state) {
  return step(state, { freeze: true });
}

// ---- 每关黄金路径 ----
const RUNNERS = [
  // 1-1
  (s) => {
    s = move(s, "fire", 1, 9.0);
    s = move(s, "fire", -1, 2.2);
    s = hopUp(s, "fire", 2.0);
    s = move(s, "ice", 1, 17.0);
    s = hopUp(s, "ice", 17.0);
    return s;
  },
  // 1-2
  (s) => {
    s = move(s, "fire", 1, 8.5);
    s = hopUp(s, "fire", 8.0);
    s = move(s, "ice", 1, 11.0);
    s = hopUp(s, "ice", 11.0);
    return s;
  },
  // 1-3
  (s) => {
    s = move(s, "fire", 1, 8.5);
    s = hopUp(s, "fire", 8.0);
    s = move(s, "ice", -1, 13.5);
    s = hopUp(s, "ice", 11.0);
    return s;
  },
  // 1-4 垫脚之箱
  (s) => {
    s = move(s, "fire", 1, 8.5);
    s = jump(s, "fire", 1, 0.06); // 短跳上箱顶
    s = wait(s, 1.0);
    s = jump(s, "fire", 0, 0.1); // 从箱顶跳 X 平台
    s = wait(s, 1.2);
    s = move(s, "ice", 1, 11.0);
    s = hopUp(s, "ice", 11.0);
    return s;
  },
  // 1-5
  (s) => {
    s = move(s, "fire", 1, 8.5);
    s = hopUp(s, "fire", 8.0);
    s = move(s, "ice", -1, 13.5);
    s = hopUp(s, "ice", 11.0);
    return s;
  },
  // 1-6 水火交汇
  (s) => {
    s = move(s, "fire", 1, 1.9);
    s = leap(s, "fire", 1); // 跳岩浆
    s = move(s, "fire", 1, 5.6); // 踩 o(5) 开 D(8)
    s = move(s, "fire", 1, 10.5, 4); // 过 D(8)
    s = hopUp(s, "fire", 10.0);
    s = move(s, "ice", -1, 16.2, 4);
    s = hopUp(s, "ice", 16.0);
    return s;
  },
  // 1-7
  (s) => {
    s = move(s, "fire", 1, 4.0);
    s = move(s, "fire", 1, 10.5);
    s = hopUp(s, "fire", 10.0);
    s = move(s, "ice", 1, 16.0);
    s = hopUp(s, "ice", 16.0);
    return s;
  },
  // 1-8
  (s) => {
    s = move(s, "fire", 1, 9.5);
    s = hopUp(s, "fire", 9.0);
    s = move(s, "ice", -1, 13.5);
    s = hopUp(s, "ice", 11.0);
    return s;
  },
  // 2-1 冰上漫步
  (s) => {
    s = run(s, "fire", 1, 1.6);
    s = wait(s, 1.5);
    s = move(s, "fire", -1, 2.2, 8);
    s = hopUp(s, "fire", 2.0);
    s = move(s, "ice", 1, 17.0);
    s = hopUp(s, "ice", 17.0);
    return s;
  },
  // 2-2 冻结之桥
  (s) => {
    s = move(s, "ice", 1, 7.5, 4); // C@5 右走到冻结点
    s = pressFreeze(s);
    s = move(s, "ice", 1, 16.0, 8); // 趁桥 3s 走冰桥过危格
    s = hopUp(s, "ice", 16.0);
    s = move(s, "fire", 1, 10.5, 8); // 火人免疫岩浆直走
    s = hopUp(s, "fire", 10.0);
    return s;
  },
  // 2-3 双桥接力
  (s) => {
    s = move(s, "ice", 1, 5.5, 4); // C@3 → 冻桥1
    s = pressFreeze(s);
    s = move(s, "ice", 1, 14.5, 8); // 走桥1 → 冻桥2（不碰 M2）
    s = pressFreeze(s);
    s = move(s, "ice", 1, 16.0, 6); // 趁桥2 走桥 → Y
    s = hopUp(s, "ice", 16.0);
    s = move(s, "fire", 1, 10.5, 8); // 免疫岩浆直走
    s = hopUp(s, "fire", 10.0);
    return s;
  },
  // 2-4 冰火同行
  (s) => {
    s = move(s, "ice", 1, 7.5, 6); // C@5 过冰面 → 冻结点
    s = pressFreeze(s);
    s = move(s, "fire", 1, 10.5, 8); // 火人紧跟走冰桥过水面
    s = move(s, "fire", 1, 14.0, 4);
    s = hopUp(s, "fire", 14.0);
    s = move(s, "ice", 1, 16.0, 10); // 冰人再走桥过水面 → Y
    s = hopUp(s, "ice", 16.0);
    return s;
  },
  // 2-5 冻桥开门
  (s) => {
    s = move(s, "ice", 1, 7.5, 4); // C@5 → 冻桥
    s = pressFreeze(s);
    s = move(s, "ice", 1, 11.5, 4); // 趁桥走桥 → 踩 o 开 D@14
    s = wait(s, 0.3);
    s = move(s, "ice", 1, 16.0, 8); // 过 D → Y
    s = hopUp(s, "ice", 16.0);
    s = move(s, "fire", 1, 10.5, 8); // 火人直走（免疫岩浆）
    s = hopUp(s, "fire", 10.0);
    return s;
  },
  // 2-6 寒潭飞跃
  (s) => {
    s = run(s, "fire", 1, 1.8);
    s = leap(s, "fire", 1);
    s = move(s, "fire", -1, 2.2, 10);
    s = run(s, "fire", 1, 0.6);
    s = leap(s, "fire", -1);
    s = move(s, "fire", -1, 2.2, 6);
    s = hopUp(s, "fire", 2.0);
    s = move(s, "ice", 1, 17.0);
    s = hopUp(s, "ice", 17.0);
    return s;
  },
  // 2-7 毒沼之桥
  (s) => {
    s = move(s, "ice", -1, 6.2, 8);
    s = pressFreeze(s);
    s = move(s, "fire", 1, 7.8, 6);
    s = move(s, "fire", -1, 10.2, 4);
    s = hopUp(s, "fire", 10.0);
    s = move(s, "ice", 1, 16.0, 8);
    s = hopUp(s, "ice", 16.0);
    return s;
  },
  // 2-8 回廊之考
  (s) => {
    s = move(s, "fire", 1, 1.9);
    s = leap(s, "fire", 1); // 跳岩浆
    s = move(s, "fire", 1, 5.5, 6); // 踩 o(5)
    s = move(s, "fire", 1, 9.0, 4); // 过 D(8)
    s = move(s, "fire", -1, 14.2, 4);
    s = hopUp(s, "fire", 14.0);
    s = move(s, "ice", -1, 15.2);
    s = hopUp(s, "ice", 16.0);
    return s;
  },
  // 3-1 浮台引路
  (s) => {
    s = move(s, "fire", 1, 2.5);
    s = leap(s, "fire", 1); // 跳岩浆
    s = move(s, "fire", 1, 13.0, 8);
    s = move(s, "fire", -1, 2.2, 8);
    s = leap(s, "fire", -1);
    s = move(s, "fire", -1, 2.2, 4);
    s = hopUp(s, "fire", 2.0);
    s = move(s, "ice", 1, 17.0);
    s = hopUp(s, "ice", 17.0);
    return s;
  },
  // 3-2 燃藤开路
  (s) => {
    s = move(s, "fire", 1, 6.3, 8);
    s = wait(s, 1.6);
    s = move(s, "fire", 1, 9.0, 8);
    s = move(s, "fire", -1, 2.2, 8);
    s = hopUp(s, "fire", 2.0);
    s = move(s, "ice", 1, 17.0);
    s = hopUp(s, "ice", 17.0);
    return s;
  },
  // 3-3 藤门双障
  (s) => {
    s = move(s, "fire", 1, 6.3, 8);
    s = wait(s, 1.6);
    s = move(s, "fire", 1, 9.3, 8);
    s = wait(s, 1.6);
    s = move(s, "fire", 1, 11.0, 8);
    s = move(s, "fire", -1, 2.2, 8);
    s = hopUp(s, "fire", 2.0);
    s = move(s, "ice", 1, 17.0);
    s = hopUp(s, "ice", 17.0);
    return s;
  },
  // 3-4 浮台接力
  (s) => {
    s = move(s, "fire", 1, 2.5);
    s = leap(s, "fire", 1);
    s = move(s, "fire", 1, 13.5, 8);
    s = move(s, "fire", -1, 2.2, 8);
    s = leap(s, "fire", -1);
    s = move(s, "fire", -1, 2.2, 4);
    s = hopUp(s, "fire", 2.0);
    s = move(s, "ice", 1, 17.0);
    s = hopUp(s, "ice", 17.0);
    return s;
  },
  // 3-5 燃藤与门
  (s) => {
    s = move(s, "fire", 1, 6.3, 8);
    s = wait(s, 1.6);
    s = move(s, "fire", 1, 8.5, 6);
    s = move(s, "fire", 1, 10.8, 6); // 踩 o 过门
    s = move(s, "fire", -1, 14.2, 4);
    s = hopUp(s, "fire", 14.0);
    s = move(s, "ice", -1, 16.15, 4);
    s = hopUp(s, "ice", 16.0);
    return s;
  },
  // 3-6 升降浮台
  (s) => {
    s = move(s, "fire", 1, 2.5);
    s = leap(s, "fire", 1);
    s = move(s, "fire", 1, 10.0, 8);
    s = wait(s, 1.2);
    s = move(s, "fire", -1, 2.2, 10);
    s = leap(s, "fire", -1);
    s = move(s, "fire", -1, 2.2, 4);
    s = hopUp(s, "fire", 2.0);
    s = move(s, "ice", 1, 17.0);
    s = hopUp(s, "ice", 17.0);
    return s;
  },
  // 3-7 熔岩长廊
  (s) => {
    s = move(s, "fire", 1, 2.5);
    s = leap(s, "fire", 1);
    s = move(s, "fire", 1, 13.5, 8);
    s = move(s, "fire", -1, 2.2, 8);
    s = leap(s, "fire", -1);
    s = move(s, "fire", -1, 2.2, 4);
    s = hopUp(s, "fire", 2.0);
    s = move(s, "ice", 1, 17.0);
    s = hopUp(s, "ice", 17.0);
    return s;
  },
  // 3-8 熔心之考
  (s) => {
    s = move(s, "fire", 1, 6.3, 8);
    s = wait(s, 1.6);
    s = move(s, "fire", 1, 10.0, 8);
    s = wait(s, 0.8);
    s = move(s, "fire", 1, 15.0, 8);
    s = move(s, "fire", -1, 2.2, 10);
    s = hopUp(s, "fire", 2.0);
    s = move(s, "ice", 1, 17.0);
    s = hopUp(s, "ice", 17.0);
    return s;
  },
  // 4-1 水晶之门
  (s) => {
    s = move(s, "fire", 1, 6.5, 8);
    s = wait(s, 0.5);
    s = move(s, "fire", -1, 2.2, 10);
    s = hopUp(s, "fire", 2.0);
    s = move(s, "ice", 1, 17.0);
    s = hopUp(s, "ice", 17.0);
    return s;
  },
  // 4-2 传送与门
  (s) => {
    s = move(s, "fire", 1, 10.5, 8);
    s = wait(s, 0.9); // 传送 + 落地
    s = move(s, "fire", -1, 14.15, 4);
    s = hopUp(s, "fire", 14.0);
    s = move(s, "ice", -1, 15.2);
    s = hopUp(s, "ice", 16.0);
    return s;
  },
  // 4-3 同心石桥
  (s) => {
    s = move(s, "fire", 1, 6.5, 8);
    s = move(s, "ice", -1, 13.5, 8);
    s = wait(s, 0.5);
    s = move(s, "fire", -1, 2.2, 10);
    s = hopUp(s, "fire", 2.0);
    s = move(s, "ice", 1, 17.0, 8);
    s = hopUp(s, "ice", 17.0);
    return s;
  },
  // 4-4 双人合闸
  (s) => {
    s = move(s, "fire", 1, 3.5, 6); // 踩 o(3)
    s = move(s, "fire", 1, 9.5, 6); // 踩 s(9)
    s = wait(s, 0.4);
    s = move(s, "ice", -1, 14.5, 6); // 踩 s(14)
    s = wait(s, 0.4); // 双板同踩，D(11) 开
    s = move(s, "fire", 1, 11.8, 4);
    s = move(s, "fire", 1, 14.2, 4);
    s = hopUp(s, "fire", 14.0);
    s = move(s, "ice", 1, 16.2, 4);
    s = hopUp(s, "ice", 16.0);
    return s;
  },
  // 4-5 传送迷宫
  (s) => {
    s = move(s, "fire", 1, 6.5, 8);
    s = wait(s, 0.4);
    s = move(s, "fire", -1, 2.2, 10);
    s = hopUp(s, "fire", 2.0);
    s = move(s, "ice", 1, 17.0);
    s = hopUp(s, "ice", 17.0);
    return s;
  },
  // 4-6 双板双门
  (s) => {
    s = move(s, "fire", 1, 3.5, 6); // 踩 o(3) 开 D(6)
    s = move(s, "fire", 1, 6.8, 4); // 过 D(6)
    s = move(s, "fire", 1, 14.2, 4);
    s = hopUp(s, "fire", 14.0);
    s = move(s, "ice", -1, 16.2, 4);
    s = hopUp(s, "ice", 16.0);
    return s;
  },
  // 4-7 传送冰桥
  (s) => {
    s = move(s, "ice", -1, 13.2, 8);
    s = pressFreeze(s); // 冻桥
    s = move(s, "fire", 1, 3.2, 6);
    s = leap(s, "fire", 1);
    s = move(s, "fire", 1, 6.2, 4);
    s = wait(s, 0.6); // 传送
    s = move(s, "fire", -1, 14.2, 6);
    s = hopUp(s, "fire", 14.0);
    s = move(s, "ice", -1, 5.6, 6);
    s = wait(s, 0.6); // 传送回右侧
    s = move(s, "ice", 1, 16.0, 6);
    s = hopUp(s, "ice", 16.0);
    return s;
  },
  // 4-8 幽谷之考
  (s) => {
    s = move(s, "fire", 1, 3.5, 6); // 踩 o(3) 开 D(6)
    s = move(s, "ice", -1, 14.2, 6); // ice 过 D(6)
    s = hopUp(s, "ice", 14.0);
    s = move(s, "fire", -1, 2.2, 4);
    s = hopUp(s, "fire", 2.0);
    return s;
  },
  // 5-1 箱台之门
  (s) => {
    s = move(s, "fire", 1, 6.5, 8);
    s = move(s, "fire", 1, 11.5, 8);
    s = move(s, "fire", -1, 2.2, 10);
    s = hopUp(s, "fire", 2.0);
    s = move(s, "ice", 1, 17.0);
    s = hopUp(s, "ice", 17.0);
    return s;
  },
  // 5-2 冻桥与门
  (s) => {
    s = move(s, "fire", 1, 4.0, 6);
    s = leap(s, "fire", 1);
    s = move(s, "fire", 1, 10.5, 8);
    s = move(s, "fire", -1, 2.2, 10);
    s = leap(s, "fire", -1);
    s = move(s, "fire", -1, 2.2, 4);
    s = hopUp(s, "fire", 2.0);
    s = move(s, "ice", 1, 17.0);
    s = hopUp(s, "ice", 17.0);
    return s;
  },
  // 5-3 传送合璧
  (s) => {
    s = move(s, "fire", 1, 3.5, 6);
    s = wait(s, 0.5);
    s = move(s, "fire", -1, 2.2, 10);
    s = hopUp(s, "fire", 2.0);
    s = move(s, "ice", 1, 17.0);
    s = hopUp(s, "ice", 17.0);
    return s;
  },
  // 5-4 藤墙合闸
  (s) => {
    s = move(s, "fire", 1, 3.2, 6); // 撞 V(3) 点燃
    s = wait(s, 1.7); // 烧藤
    s = move(s, "fire", 1, 6.5, 4); // 踩 o(6) 开 D(11)
    s = move(s, "fire", 1, 11.8, 4); // 过 D(11)
    s = move(s, "fire", 1, 14.2, 4);
    s = hopUp(s, "fire", 14.0);
    s = move(s, "ice", -1, 16.2, 4);
    s = hopUp(s, "ice", 16.0);
    return s;
  },
  // 5-5 长廊重奏
  (s) => {
    s = move(s, "fire", 1, 3.2, 6); // 撞 V(3) 点燃
    s = wait(s, 1.7); // 烧藤
    s = move(s, "fire", 1, 6.5, 4); // 踩 o(6) 开 D(11)
    s = move(s, "fire", 1, 11.8, 4); // 过 D(11)
    s = move(s, "fire", 1, 14.2, 4);
    s = hopUp(s, "fire", 14.0);
    s = move(s, "ice", -1, 16.2, 4);
    s = hopUp(s, "ice", 16.0);
    return s;
  },
  // 5-6 双门双桥
  (s) => {
    s = move(s, "fire", 1, 1.9, 4);
    s = leap(s, "fire", 1); // 跳岩浆
    s = move(s, "fire", 1, 5.6, 4); // 踩 o(5) 开 D(8)
    s = move(s, "fire", 1, 9.0, 4); // 过 D(8)
    s = move(s, "fire", 1, 11.5, 4); // 踩 o(11) 开 D(14)
    s = move(s, "ice", -1, 14.2, 4); // ice 过 D(14)
    s = hopUp(s, "ice", 14.0);
    s = hopUp(s, "fire", 11.0);
    return s;
  },
  // 5-7 双子试炼
  (s) => {
    s = move(s, "fire", 1, 3.5, 6);
    s = wait(s, 0.6); // 传送到 T(11)
    s = move(s, "fire", -1, 2.2, 8); // 左走途中传回 T(3)
    s = hopUp(s, "fire", 2.0);
    s = move(s, "ice", -1, 18.2, 4);
    s = hopUp(s, "ice", 17.0);
    return s;
  },
  // 5-8 双子王座
  (s) => {
    s = move(s, "fire", 1, 3.5, 6); // 踩 o(3) 开 D(6)
    s = move(s, "ice", -1, 14.2, 6); // ice 过 D(6)
    s = hopUp(s, "ice", 14.0);
    s = move(s, "fire", -1, 2.2, 4);
    s = hopUp(s, "fire", 2.0);
    return s;
  }
];

test("黄金路径：40 关全部可通关", () => {
  let pass = 0;
  const fails = [];
  for (let i = 0; i < LEVEL_COUNT; i++) {
    const lv = getLevel(i);
    let state = createInitialState(lv, { levelIndex: i });
    try {
      state = RUNNERS[i](state);
    } catch (e) {
      fails.push(`${i + 1} 异常: ${e.message}`);
      continue;
    }
    if (state.status === "won") pass += 1;
    else fails.push(`${i + 1} (${state.levelName}) FAIL t=${state.stats.time.toFixed(1)}s`);
  }
  assert.equal(pass, LEVEL_COUNT, `通过 ${pass}/${LEVEL_COUNT}\n${fails.join("\n")}`);
});
