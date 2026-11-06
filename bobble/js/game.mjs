// 泡泡射手 · 状态机控制器（DOM-free：接收 UI 意图，调度 engine，广播事件）

import {
  MODE,
  AIM,
  PRISM,
  CRYSTAL,
  EMPTY,
  DEATH_ROW,
  CANNON_X,
  CANNON_Y,
  MAX_ANGLE,
  mulberry32,
  simulateShot,
  resolveLanding,
  applyIcePick,
  pressRow,
  makeRow,
  nextColor,
  pressInterval,
  isDead,
  lowestOccupiedRow,
  predictPath,
  getCell
} from "./engine.mjs";
import {
  stageLevel,
  puzzleBoard,
  instantiate,
  endlessBoard,
  dailySpec,
  ENDLESS
} from "./levels.mjs";
import { shotScore, starsFor, isAvalanche } from "./score.mjs";

export const FLIGHT_SPEED = 1500;   // px/s
const SETTLE_MS = 140;

function countCrystals(board) {
  let n = 0;
  for (const row of board) {
    for (const v of row.cells) if (v === CRYSTAL) n += 1;
  }
  return n;
}

function countBubbles(board) {
  let n = 0;
  for (const row of board) {
    for (const v of row.cells) if (v !== EMPTY && v !== CRYSTAL) n += 1;
  }
  return n;
}

export class BobbleGame {
  constructor() {
    this.listeners = [];
    this.state = null;
    this.paused = false;
  }

  // 借屏浮层（玩法说明等）打开时冻结对局，关闭后原样恢复
  pause() {
    this.paused = true;
  }
  resume() {
    this.paused = false;
  }

  subscribe(fn) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((f) => f !== fn);
    };
  }

  emit(type, payload = {}) {
    const event = { type, ...payload };
    for (const fn of this.listeners) fn(event, this.state);
  }

  // ---------- 装载 ----------
  loadStage(id) {
    const lv = stageLevel(id);
    const seed = 1000 + lv.id * 37;
    const board = instantiate(lv, seed);
    this.state = {
      mode: MODE.STAGE,
      levelId: lv.id,
      chapter: lv.chapter,
      board,
      palette: lv.palette.slice(),
      target: lv.target,
      rng: mulberry32(seed >>> 0),
      loaded: 0,
      next: 0,
      queue: null,
      angle: 0,
      aimTier: AIM.EXTENDED,
      shots: 0,
      score: 0,
      streak: 0,
      maxChain: 0,
      lastChain: 0,
      status: "aim",
      flight: null,
      settle: 0,
      pressIn: pressInterval(lv.palette.length, lv.palette.length),
      pressCount: 0,
      picks: lv.chapter === 3 ? 2 : lv.chapter === 2 ? 1 : 0,
      pickArmed: false,
      rescueUsed: false,
      crystals: 0,
      seed,
      proBonus: false
    };
    this.state.loaded = nextColor(board, this.state.palette, this.state.rng);
    this.state.next = nextColor(board, this.state.palette, this.state.rng);
    this.emit("loaded", { levelId: lv.id });
    return this.state;
  }

  loadPuzzle(id) {
    const pz = puzzleBoard(id);
    const seed = 500 + pz.id * 91;
    const board = instantiate(pz, seed);
    this.state = {
      mode: MODE.PUZZLE,
      puzzleId: pz.id,
      board,
      palette: pz.palette.slice(),
      target: pz.shots,
      rng: mulberry32(seed >>> 0),
      loaded: pz.load[0],
      next: pz.load[1] ?? pz.load[0],
      queue: pz.load.slice(),
      angle: 0,
      aimTier: AIM.EXTENDED,
      shots: 0,
      score: 0,
      streak: 0,
      maxChain: 0,
      lastChain: 0,
      status: "aim",
      flight: null,
      settle: 0,
      pressIn: 99,
      pressCount: 0,
      picks: 0,
      pickArmed: false,
      rescueUsed: false,
      crystals: countCrystals(board),
      seed,
      proBonus: false
    };
    this.emit("loaded", { puzzleId: pz.id });
    return this.state;
  }

  loadEndless(seed = Date.now() % 100000) {
    const { board, palette } = endlessBoard(seed >>> 0);
    this.state = {
      mode: MODE.ENDLESS,
      board,
      palette: palette.slice(),
      target: 0,
      rng: mulberry32((seed >>> 0) ^ 0x5f3a),
      loaded: 0,
      next: 0,
      queue: null,
      angle: 0,
      aimTier: AIM.EXTENDED,
      shots: 0,
      score: 0,
      streak: 0,
      maxChain: 0,
      lastChain: 0,
      status: "aim",
      flight: null,
      settle: 0,
      pressIn: pressInterval(palette.length, palette.length),
      pressCount: 0,
      picks: 1,
      pickArmed: false,
      rescueUsed: false,
      crystals: 0,
      seed: seed >>> 0,
      proBonus: false
    };
    this.state.loaded = nextColor(board, this.state.palette, this.state.rng);
    this.state.next = nextColor(board, this.state.palette, this.state.rng);
    this.emit("loaded", { mode: MODE.ENDLESS });
    return this.state;
  }

  loadDaily(seed) {
    const spec = dailySpec(seed);
    const board = instantiate(spec, seed);
    this.state = {
      mode: MODE.DAILY,
      board,
      palette: spec.palette.slice(),
      target: spec.target,
      rng: mulberry32(seed >>> 0),
      loaded: 0,
      next: 0,
      queue: null,
      angle: 0,
      aimTier: AIM.EXTENDED,
      shots: 0,
      score: 0,
      streak: 0,
      maxChain: 0,
      lastChain: 0,
      status: "aim",
      flight: null,
      settle: 0,
      pressIn: pressInterval(spec.palette.length, spec.palette.length),
      pressCount: 0,
      picks: 1,
      pickArmed: false,
      rescueUsed: false,
      crystals: 0,
      seed: seed >>> 0,
      proBonus: false
    };
    this.state.loaded = nextColor(board, this.state.palette, this.state.rng);
    this.state.next = nextColor(board, this.state.palette, this.state.rng);
    this.emit("loaded", { mode: MODE.DAILY });
    return this.state;
  }

  restart() {
    const s = this.state;
    if (!s) return null;
    if (s.mode === MODE.STAGE) return this.loadStage(s.levelId);
    if (s.mode === MODE.PUZZLE) return this.loadPuzzle(s.puzzleId);
    if (s.mode === MODE.ENDLESS) return this.loadEndless(s.seed);
    return this.loadDaily(s.seed);
  }

  // ---------- 瞄准 ----------
  setAimTier(tier) {
    if (!this.state) return;
    this.state.aimTier = tier;
    this.state.proBonus = tier === AIM.PRO;
  }

  setAngle(angle) {
    if (this.paused) return;
    if (!this.state) return;
    this.state.angle = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, angle));
  }

  nudge(delta) {
    if (!this.state) return;
    this.setAngle(this.state.angle + delta);
  }

  aimAt(x, y) {
    if (!this.state) return;
    const dx = x - CANNON_X;
    const dy = CANNON_Y - y;
    if (dy <= 8) return;
    this.setAngle(Math.atan2(dx, dy));
  }

  path() {
    if (!this.state) return { dots: [], land: null };
    return predictPath(this.state.board, this.state.angle, this.state.aimTier);
  }

  swap() {
    if (this.paused) return false;
    const s = this.state;
    if (!s || s.status !== "aim" || s.queue) return false;
    const tmp = s.loaded;
    s.loaded = s.next;
    s.next = tmp;
    this.emit("swap", {});
    return true;
  }

  togglePick() {
    if (this.paused) return false;
    const s = this.state;
    if (!s || s.status !== "aim") return false;
    if (s.picks <= 0 && !s.pickArmed) {
      this.emit("pick_empty", {});
      return false;
    }
    if (s.pickArmed) {
      s.pickArmed = false;
    } else {
      s.pickArmed = true;
    }
    this.emit("pick_arm", { armed: s.pickArmed });
    return true;
  }

  // ---------- 发射 ----------
  fire() {
    if (this.paused) return false;
    const s = this.state;
    if (!s || s.status !== "aim") return false;
    if (s.queue && s.shots >= s.queue.length) return false;
    const color = s.pickArmed ? -1 : s.loaded;
    const shot = simulateShot(s.board, s.angle);
    if (!shot.land && !s.pickArmed) return false;
    const pts = shot.points.length ? shot.points : [{ x: CANNON_X, y: CANNON_Y }];
    const lens = [];
    let total = 0;
    for (let i = 1; i < pts.length; i += 1) {
      const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      lens.push(seg);
      total += seg;
    }
    s.shots += 1;
    s.pressIn -= 1;
    s.flight = {
      points: pts,
      lens,
      total: Math.max(1, total),
      dist: 0,
      seg: 0,
      color,
      pick: s.pickArmed,
      land: shot.land,
      x: pts[0].x,
      y: pts[0].y
    };
    s.status = "flying";
    this.emit("shoot", { pick: s.pickArmed });
    return true;
  }

  // ---------- 主循环 ----------
  step(dt) {
    if (this.paused) return;
    const s = this.state;
    if (!s) return;
    if (s.status === "flying") {
      this.stepFlight(dt);
      return;
    }
    if (s.status === "settle") {
      s.settle -= dt * 1000;
      if (s.settle <= 0) {
        s.status = "aim";
        this.checkEnd();
      }
    }
  }

  stepFlight(dt) {
    const s = this.state;
    const f = s.flight;
    if (!f) return;
    f.dist += FLIGHT_SPEED * dt;
    let remain = f.dist;
    let seg = 0;
    while (seg < f.lens.length && remain > f.lens[seg]) {
      remain -= f.lens[seg];
      seg += 1;
      if (seg < f.points.length) this.emit("bounce", { x: f.points[seg].x, y: f.points[seg].y, bounces: seg });
    }
    if (seg >= f.lens.length) {
      const last = f.points[f.points.length - 1];
      f.x = last.x;
      f.y = last.y;
      this.land();
      return;
    }
    f.seg = seg;
    const a = f.points[seg];
    const b = f.points[seg + 1];
    const t = f.lens[seg] ? remain / f.lens[seg] : 0;
    f.x = a.x + (b.x - a.x) * t;
    f.y = a.y + (b.y - a.y) * t;
  }

  land() {
    const s = this.state;
    const f = s.flight;
    s.flight = null;
    if (f.pick) {
      s.picks = Math.max(0, s.picks - 1);
      s.pickArmed = false;
      const res = applyIcePick(s.board, s.angle);
      s.board = res.board;
      this.emit("pick", { cleared: res.cleared, dropped: res.dropped.length });
      if (res.dropped.length) this.emit("drop", { cells: res.dropped, dropped: res.dropped.length });
      this.afterResolve(0, 0);
      return;
    }
    if (!f.land) {
      this.afterResolve(0, 0);
      return;
    }
    const [row, col] = f.land;
    const prev = s.board;
    const res = resolveLanding(prev, row, col, f.color);
    const droppedColors = res.dropped.map(([r, c]) => getCell(prev, r, c));
    s.board = res.board;
    const popped = res.popped.length;
    const dropped = res.dropped.length;
    const chain = popped + dropped;
    if (popped >= 3) this.emit("pop", { cells: res.popped, popped, chain, color: f.color });
    if (dropped) this.emit("drop", { cells: res.dropped, dropped, chain, colors: droppedColors });
    if (chain >= 5) this.emit("avalanche", { chain });
    if (chain > 0) {
      s.streak += 1;
      s.lastChain = chain;
      s.maxChain = Math.max(s.maxChain, chain);
      s.score += shotScore({ popped, dropped, streak: s.streak, pro: s.proBonus });
    } else {
      s.streak = 0;
      s.lastChain = 0;
      this.emit("land", { row, col });
    }
    if (isAvalanche(chain)) s.chain5 = true;
    this.afterResolve(popped, dropped);
  }

  afterResolve(popped, dropped) {
    const s = this.state;
    if (s.mode === MODE.PUZZLE) {
      const left = countCrystals(s.board);
      s.crystals = left;
      if (left === 0) {
        s.status = "win";
        this.emit("win", { shots: s.shots, score: s.score });
        return;
      }
      if (s.shots >= s.queue.length) {
        s.status = "over";
        this.emit("lose", { reason: "shots" });
        return;
      }
    } else if ((s.mode === MODE.STAGE || s.mode === MODE.DAILY) && countBubbles(s.board) === 0) {
      s.status = "win";
      this.emit("win", { shots: s.shots, score: s.score, stars: starsFor(s.shots, s.target || 1) });
      return;
    }
    // 冰盖下压
    if (s.pressIn <= 0) {
      const active = new Set();
      for (const row of s.board) for (const v of row.cells) if (v !== EMPTY && v !== CRYSTAL) active.add(v);
      const interval = pressInterval(s.palette.length, active.size);
      s.pressIn = interval;
      s.pressCount += 1;
      const parity = s.board[0].parity === 0 ? 1 : 0;
      if (s.mode === MODE.ENDLESS) {
        if (s.pressCount % ENDLESS.colorStepEvery === 0 && s.palette.length < ENDLESS.maxColors) {
          s.palette.push(s.palette.length);
        }
        const cells = makeRow(parity, s.palette, s.rng, ENDLESS.rowDensity);
        s.board = pressRow(s.board, cells);
      } else {
        s.board = pressRow(s.board, null);
      }
      this.emit("press", { pressCount: s.pressCount });
    }
    // 绝境补给：濒临冰封线时发一颗棱镜泡
    const lowest = lowestOccupiedRow(s.board);
    if (s.mode === MODE.ENDLESS && !s.rescueUsed && lowest >= DEATH_ROW - 1) {
      s.rescueUsed = true;
      if (!s.queue) {
        s.next = PRISM;
      }
      this.emit("rescue", {});
    }
    if (isDead(s.board)) {
      s.status = "over";
      this.emit("lose", { reason: "freeze" });
      return;
    }
    // 补充下一颗（残局模式按确定序列）
    if (s.queue) {
      s.loaded = s.queue[Math.min(s.shots, s.queue.length - 1)];
      s.next = s.queue[Math.min(s.shots + 1, s.queue.length - 1)];
    } else {
      s.loaded = s.next;
      s.next = nextColor(s.board, s.palette, s.rng);
    }
    s.status = "settle";
    s.settle = SETTLE_MS;
  }

  checkEnd() {
    const s = this.state;
    if (!s || s.status !== "aim") return;
    if (s.mode === MODE.ENDLESS && isDead(s.board)) {
      s.status = "over";
      this.emit("lose", { reason: "freeze" });
    }
  }

  // 供 UI 展示：剩余冰泡数
  bubblesLeft() {
    return this.state ? countBubbles(this.state.board) : 0;
  }
}
