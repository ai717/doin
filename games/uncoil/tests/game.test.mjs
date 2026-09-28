// 倒退贪吃蛇 Uncoil · 控制器单测（DOM-free）
import test from "node:test";
import assert from "node:assert/strict";
import { UncoilGame, MODE, dailyLevelId, dateKeyOf, stageLevelAt, stageIndexById } from "../js/game.mjs";
import { LEVELS, ENDGAME, SOLUTION_DIRS } from "../js/levels.mjs";
import { STATUS, mulberry32, bodySet, validateLevel } from "../js/engine.mjs";

function playSolution(game, upTo = Infinity) {
  const lv = game.state.level;
  let n = 0;
  for (const ch of lv.solution) {
    if (n >= upTo) break;
    const dir = SOLUTION_DIRS[ch];
    const action = game.move(dir);
    assert.ok(action, `参考解第 ${n + 1} 步 ${ch} 被判非法`);
    n += 1;
    if (game.state.status !== STATUS.PLAYING) break;
  }
  return n;
}

test("装载关卡：初始长度 / 步数 / 进度归零", () => {
  const game = new UncoilGame();
  const st = game.loadLevel("level_1_1", MODE.STAGE);
  assert.equal(st.mode, MODE.STAGE);
  assert.equal(st.initLen, st.level.snake.length);
  assert.equal(st.engine.steps, 0);
  assert.equal(game.progress(), 0);
  assert.equal(game.length(), st.initLen);
  assert.equal(st.status, STATUS.PLAYING);
});

test("装载不存在的关卡返回 null（不抛错）", () => {
  const game = new UncoilGame();
  assert.equal(game.loadLevel("nope", MODE.STAGE), null);
  assert.equal(game.state, null);
  assert.equal(game.move("up"), null);
  assert.equal(game.undo(), false);
});

test("逐 tick 回放参考解：终点 WON、步数 == par、三星", () => {
  const game = new UncoilGame();
  const events = [];
  game.subscribe((e) => events.push(e.type));
  game.loadLevel("level_3_4", MODE.STAGE);
  const n = playSolution(game);
  assert.equal(game.state.status, STATUS.WON);
  assert.equal(game.state.engine.snake.length, 1);
  assert.equal(n, game.state.level.par);
  assert.equal(game.state.engine.steps, game.state.level.par);
  assert.equal(game.stars(), 3);
  assert.ok(events.includes("win"));
});

test("全 52 关参考解均能被控制器走到 WON", () => {
  for (const lv of LEVELS) {
    const game = new UncoilGame();
    game.loadLevel(lv.id, lv.chapter === "endgame" ? MODE.ENDGAME : MODE.STAGE);
    playSolution(game);
    assert.equal(game.state.status, STATUS.WON, `${lv.id} 未通关`);
    assert.equal(game.length(), 1, `${lv.id} 通关时长度不为 1`);
  }
});

test("撤销：回到上一 tick 的完整快照，长度与步数同步回退", () => {
  const game = new UncoilGame();
  game.loadLevel("level_2_3", MODE.STAGE);
  playSolution(game, 5);
  const lenBefore = game.length();
  const stepsBefore = game.state.engine.steps;
  assert.equal(game.canUndo(), true);
  assert.equal(game.undo(), true);
  assert.equal(game.state.engine.steps, stepsBefore - 1);
  assert.ok(game.length() >= lenBefore, "撤销后长度应恢复（不增不减或更长）");
});

test("连撤到底：回到开局且不可再撤", () => {
  const game = new UncoilGame();
  game.loadLevel("level_1_5", MODE.STAGE);
  playSolution(game, 6);
  let guard = 0;
  while (game.canUndo() && guard < 200) {
    game.undo();
    guard += 1;
  }
  assert.equal(game.state.engine.steps, 0);
  assert.equal(game.canUndo(), false);
  assert.equal(game.undo(), false);
  assert.equal(game.length(), game.state.initLen);
});

test("通关后撤销被禁用（成绩已定，不许回退偷改）", () => {
  const game = new UncoilGame();
  game.loadLevel("level_1_1", MODE.STAGE);
  playSolution(game);
  assert.equal(game.state.status, STATUS.WON);
  assert.equal(game.canUndo(), false);
});

test("非法方向：返回 null 并广播 blocked，状态不变", () => {
  const game = new UncoilGame();
  const blocked = [];
  game.subscribe((e) => {
    if (e.type === "blocked") blocked.push(e.dir);
  });
  game.loadLevel("level_1_1", MODE.STAGE);
  const illegal = ["up", "down", "left", "right"].filter((d) => !game.legalDirs().includes(d));
  assert.ok(illegal.length > 0, "开局竟无任何非法方向，用例前置不成立");
  for (const d of illegal) {
    const before = game.state.engine.steps;
    assert.equal(game.move(d), null);
    assert.equal(game.state.engine.steps, before);
  }
  assert.deepEqual(blocked, illegal);
});

test("终局后一切操作 no-op（不抛错、不改状态）", () => {
  const game = new UncoilGame();
  game.loadLevel("level_1_1", MODE.STAGE);
  playSolution(game);
  const steps = game.state.engine.steps;
  for (const d of ["up", "down", "left", "right"]) {
    assert.equal(game.move(d), null);
  }
  assert.equal(game.state.engine.steps, steps);
});

test("困毙能被触发并广播 entombed（随机乱走必自锁）", () => {
  let entombed = 0;
  for (let seed = 1; seed <= 24 && entombed === 0; seed += 1) {
    const game = new UncoilGame();
    let fired = 0;
    game.subscribe((e) => {
      if (e.type === "entombed") fired += 1;
    });
    game.loadLevel("level_1_1", MODE.STAGE);
    const rng = mulberry32(seed);
    for (let i = 0; i < 200 && game.state.status === STATUS.PLAYING; i += 1) {
      const dirs = game.legalDirs();
      game.move(dirs[Math.floor(rng() * dirs.length)]);
    }
    if (game.state.status === STATUS.ENTOMBED) {
      entombed = 1;
      assert.ok(fired >= 1, "困毙未广播 entombed 事件");
      assert.equal(game.legalDirs().length, 0);
    }
  }
  assert.equal(entombed, 1, "24 个种子都没走出困毙，用例失效");
});

test("每日缠局：同日同题、可解、模式标记正确", () => {
  const a = dailyLevelId(20260928);
  const b = dailyLevelId(20260928);
  const c = dailyLevelId(20260929);
  assert.equal(a, b);
  assert.ok(a && LEVELS.some((l) => l.id === a));
  assert.ok(dailyLevelId(0), "日期为 0 也要有兜底关卡");
  const game = new UncoilGame();
  const st = game.loadDaily(20260928);
  assert.equal(st.mode, MODE.DAILY);
  assert.equal(st.dateKey, 20260928);
  assert.notEqual(c === a, true, "相邻日期应大概率换题（允许同题但不强制）");
});

test("dateKeyOf 产出的键形如 YYYYMMDD", () => {
  const k = dateKeyOf(new Date(2026, 8, 28));
  assert.equal(k, 20260928);
});

test("主线关序列：index 与 id 可互转，越界钳制", () => {
  const first = stageLevelAt(0);
  const last = stageLevelAt(999);
  assert.ok(first && last);
  assert.equal(stageIndexById(first.id), 0);
  assert.equal(stageIndexById("endgame_1"), -1);
  assert.equal(stageLevelAt(-5).id, first.id);
});

test("nextLevelId：主线推进，最后一关返回 null", () => {
  const game = new UncoilGame();
  game.loadLevel(stageLevelAt(0).id, MODE.STAGE);
  assert.ok(game.nextLevelId());
  const chapters = LEVELS.filter((l) => l.chapter !== "endgame");
  game.loadLevel(chapters[chapters.length - 1].id, MODE.STAGE);
  assert.equal(game.nextLevelId(), null);
});

test("残局模式：nextLevelId 在末关为 null", () => {
  const game = new UncoilGame();
  game.loadLevel(ENDGAME[ENDGAME.length - 1].id, MODE.ENDGAME);
  assert.equal(game.nextLevelId(), null);
});

test("solveDir 逐步给出参考解方向，走完后返回 null", () => {
  const game = new UncoilGame();
  game.loadLevel("level_2_1", MODE.STAGE);
  const first = game.solveDir();
  assert.ok(["up", "down", "left", "right"].includes(first));
  playSolution(game);
  assert.equal(game.solveDir(), null);
});

test("★ 1000 步随机游走：状态机不崩、不变式守恒", () => {
  let steps = 0;
  const rng = mulberry32(20260928);
  let games = 0;
  while (steps < 1000) {
    const lv = LEVELS[Math.floor(rng() * LEVELS.length)];
    const game = new UncoilGame();
    game.loadLevel(lv.id, lv.chapter === "endgame" ? MODE.ENDGAME : MODE.STAGE);
    games += 1;
    for (let i = 0; i < 40 && game.state.status === STATUS.PLAYING && steps < 1000; i += 1) {
      const st = game.state.engine;
      // 不变式 1：蛇身无自重叠
      const set = bodySet(st, false);
      assert.equal(set.size, st.snake.length, `${lv.id} 出现自重叠`);
      // 不变式 2：相邻两节正交相邻。
      // 例外：头走回环门时会瞬移到另一扇门，蛇身上随之留下**恰好一处**断点，
      // 它会随每次移动往尾巴方向漂、最终从尾部走出。这是传送门的设计后果，不是断裂。
      let breaks = 0;
      for (let k = 1; k < st.snake.length; k += 1) {
        const d = Math.abs(st.snake[k].r - st.snake[k - 1].r) + Math.abs(st.snake[k].c - st.snake[k - 1].c);
        if (d !== 1) breaks += 1;
      }
      const allowed = (lv.portals || []).length ? 1 : 0;
      assert.ok(breaks <= allowed, `${lv.id} 蛇身断裂 ${breaks} 处（允许 ${allowed} 处）`);
      // 不变式 3：长度单调不增
      const before = st.snake.length;
      const dirs = game.legalDirs();
      if (!dirs.length) break;
      game.move(dirs[Math.floor(rng() * dirs.length)]);
      assert.ok(game.length() <= before, `${lv.id} 长度变长了`);
      steps += 1;
      // 不变式 4：终局判定自洽
      if (game.state.status === STATUS.WON) assert.equal(game.length(), 1);
      if (game.state.status === STATUS.ENTOMBED) assert.equal(game.legalDirs().length, 0);
    }
  }
  assert.ok(games > 5, "采样关卡太少");
  assert.ok(steps >= 1000);
});

test("数据健康：全关卡经 validateLevel 检查零问题", () => {
  for (const lv of LEVELS) {
    assert.deepEqual(validateLevel(lv), [], `${lv.id} 数据有问题`);
  }
});
