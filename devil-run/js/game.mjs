// 恶魔迷途 · DOM-free 游戏状态控制器
// 接收 UI 意图（输入、关卡切换），调度 engine，派发事件。
// 绝对禁止访问 window / document / localStorage。
//
// 关键：固定步长累积器。渲染帧率与物理步长解耦，保证
//  1) 物理完全确定性（同一输入序列 → 同一结果，与帧率无关）；
//  2) 高刷屏与 30fps 老设备手感一致；
//  3) 掉帧时用「最大追帧数」兜底，绝不让一次卡顿把玩家推进陷阱。

import { createInitialState, stepFrame, formatClock } from "./engine.mjs";
import { getLevel, getNodeOf, LEVEL_COUNT, NODES } from "./levels.mjs";
import { sealsFromState } from "./score.mjs";

export const FIXED_DT = 1 / 60;      // 物理固定步长
export const MAX_STEPS_FRAME = 5;    // 单次 tick 最多追帧数（超出则丢弃积压，避免螺旋死亡）

export class DevilRunGame {
  constructor(options = {}) {
    this.levelIndex = options.levelIndex ?? 0;
    this.listeners = new Set();
    this.inputs = { left: false, right: false, jump: false, restart: false };
    this.state = this.buildState(this.levelIndex);
    this.phase = "playing";          // playing | won
    this.accumulator = 0;
    this.isPaused = false;
    this.pendingRestart = false;
    // 本次运行内的统计（用于结算展示）
    this.runDeaths = 0;
    this.runCandle = false;
  }

  buildState(levelIndex) {
    const level = getLevel(levelIndex);
    if (!level) return null;
    return createInitialState(level, { levelIndex });
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(event) {
    for (const fn of this.listeners) {
      try {
        fn(event, this.state);
      } catch {
        // 监听者报错绝不阻断游戏逻辑
      }
    }
  }

  // ---- 输入意图 ----
  setInput(name, value) {
    if (!(name in this.inputs)) return;
    this.inputs[name] = Boolean(value);
  }

  clearInputs() {
    this.inputs = { left: false, right: false, jump: false, restart: false };
  }

  // ---- 关卡流程 ----
  startLevel(index, opts = {}) {
    if (!Number.isInteger(index) || index < 0 || index >= LEVEL_COUNT) return;
    this.levelIndex = index;
    this.state = this.buildState(index);
    this.phase = "playing";
    this.accumulator = 0;
    this.isPaused = false;
    this.runDeaths = 0;
    this.runCandle = false;
    if (!opts.keepInputs) this.clearInputs();
    this.emit({ type: "level_started", levelIndex: index });
  }

  restartLevel() {
    this.startLevel(this.levelIndex, { keepInputs: true });
  }

  goNextLevel() {
    if (this.levelIndex + 1 >= LEVEL_COUNT) return;
    this.startLevel(this.levelIndex + 1);
  }

  setPaused(paused) {
    const next = Boolean(paused);
    if (this.phase === "won") return;
    if (this.isPaused === next) return;
    this.isPaused = next;
    if (!next) this.accumulator = 0; // 恢复时丢掉积压，避免补帧暴走
    this.emit({ type: "pause_toggled", isPaused: this.isPaused });
  }

  togglePause() {
    this.setPaused(!this.isPaused);
  }

  // ---- 主循环：固定步长累积器 ----
  // 返回本 tick 内产生的事件数组（供 UI 播特效/音效）
  tick(frameDt) {
    if (this.isPaused || this.phase === "won" || !this.state) return [];

    // R 键重玩：引擎层不支持 restart 语义，这里在控制器层落实
    if (this.inputs.restart) {
      this.inputs.restart = false;
      this.restartLevel();
      return [{ type: "manual_restart" }];
    }

    let dt = Number(frameDt);
    if (!Number.isFinite(dt) || dt <= 0) dt = FIXED_DT;
    // 单帧最多吃 0.25s，防止切换标签页回来后疯狂追帧
    if (dt > 0.25) dt = 0.25;

    this.accumulator += dt;
    const events = [];
    let steps = 0;

    while (this.accumulator >= FIXED_DT && steps < MAX_STEPS_FRAME) {
      const prevDeaths = this.state.stats.deaths;
      const hadCandle = this.state.gotCandle;

      const r = stepFrame(this.state, FIXED_DT, {
        left: this.inputs.left,
        right: this.inputs.right,
        jump: this.inputs.jump,
        restart: false
      });
      this.state = r.state;
      steps++;
      this.accumulator -= FIXED_DT;

      for (const ev of r.events) events.push(ev);

      // 死亡累计（引擎派发 { type: "death" }）
      const newDeaths = this.state.stats.deaths - prevDeaths;
      if (newDeaths > 0) {
        this.runDeaths += newDeaths;
        events.push({ type: "deaths_added", count: newDeaths, total: this.state.stats.deaths });
      }
      // 蜡烛
      if (!hadCandle && this.state.gotCandle) {
        this.runCandle = true;
      }
    }

    // 追帧上限触发：丢弃剩余积压，避免越欠越多
    if (steps >= MAX_STEPS_FRAME) {
      this.accumulator = 0;
    }

    // 结算
    if (this.state.status === "won" && this.phase !== "won") {
      this.phase = "won";
      const seals = sealsFromState(this.state);
      this.emit({
        type: "win",
        levelIndex: this.levelIndex,
        seals,
        elapsed: this.state.elapsed,
        deaths: this.state.stats.deathsThisRun,
        gotCandle: this.state.gotCandle,
        totalDeaths: this.state.stats.deaths
      });
    }

    return events;
  }

  // ---- 只读快照（UI 唯一数据来源）----
  getSummary() {
    const s = this.state;
    if (!s) return null;
    const node = getNodeOf(this.levelIndex);
    return {
      levelIndex: this.levelIndex,
      levelNumber: this.levelIndex + 1,
      name: s.levelName,
      nodeId: s.nodeId,
      nodeName: node ? node.name : "",
      elapsed: s.elapsed,
      clock: formatClock(s.elapsed),
      deaths: s.stats.deaths,
      deathsThisRun: s.stats.deathsThisRun,
      gotCandle: s.gotCandle,
      candle: { x: s.candle.x, y: s.candle.y },
      candleX: s.candle ? s.candle.x : 0,
      candleY: s.candle ? s.candle.y : 0,
      gravityDir: s.gravityDir,
      reverseLeft: s.reverseLeft,
      player: {
        x: s.player.x,
        y: s.player.y,
        vx: s.player.vx,
        vy: s.player.vy,
        onGround: s.player.onGround,
        facing: s.player.facing
      },
      goal: { x: s.goal.x, y: s.goal.y, visible: s.goal.visible, moved: s.goal.moved },
      // 陷阱与脚印必须浅拷贝出一层新数组，否则 UI 拿到的是引擎内部引用，
      // 一旦就地改动就会绕过控制器直接污染规则状态（破坏 DOM-Free 隔离）。
      traps: s.traps.map((t) => ({ ...t })),
      marks: s.marks.map((m) => ({ ...m })),
      phase: s.phase,
      status: s.status
    };
  }

  get isWon() {
    return this.phase === "won";
  }

  static get levelCount() {
    return LEVEL_COUNT;
  }

  static get nodes() {
    return NODES;
  }
}

export { LEVEL_COUNT, NODES, getLevel, getNodeOf };
