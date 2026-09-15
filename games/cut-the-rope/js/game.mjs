// 割绳子 DOM-free 状态控制器（接收 UI 意图，调度 engine，派发纯事件回调）
import { createLevelState, cutRopes, popBubble, puffBellows, stepFrame } from "./engine.mjs";
import { getLevelById } from "./levels.mjs";

export class GameController {
  constructor(initialLevelId = 1) {
    this.currentLevelId = initialLevelId;
    this.state = null;
    this.listeners = {
      cut: [],
      star: [],
      pop: [],
      puff: [],
      win: [],
      fail: [],
      reset: []
    };
    this.prevStars = 0;
    this.initLevel(initialLevelId);
  }

  on(event, cb) {
    if (this.listeners[event]) {
      this.listeners[event].push(cb);
    }
  }

  emit(event, data) {
    if (this.listeners[event]) {
      for (const cb of this.listeners[event]) {
        try {
          cb(data);
        } catch (err) {
          // 静默保护
        }
      }
    }
  }

  initLevel(levelId) {
    this.currentLevelId = levelId;
    const def = getLevelById(levelId);
    this.state = createLevelState(def);
    this.prevStars = 0;
    this.emit("reset", { levelId, state: this.state });
  }

  resetLevel() {
    this.initLevel(this.currentLevelId);
  }

  handleCut(p1, p2, strokeId = null) {
    if (!this.state || this.state.status !== "playing") return { cutCount: 0, cuts: [] };
    const res = cutRopes(this.state, p1, p2, strokeId);
    if (res.cutCount > 0) {
      this.emit("cut", res);
    }
    return res;
  }

  handleTap(x, y) {
    if (!this.state || this.state.status !== "playing") return;

    // 1. 是否点击了气泡
    for (const b of this.state.bubbles) {
      if (b.popped) continue;
      const d = Math.hypot(x - b.x, y - b.y);
      if (d <= b.r + 14) {
        const res = popBubble(this.state, b.id);
        if (res.popped) {
          this.emit("pop", { bubbleId: b.id, x: b.x, y: b.y });
          return;
        }
      }
    }

    // 2. 是否点击了皮囊
    for (const bel of this.state.bellows) {
      const d = Math.hypot(x - bel.x, y - bel.y);
      if (d <= 45) {
        const res = puffBellows(this.state, bel.id);
        if (res.puffed) {
          this.emit("puff", { bellowsId: bel.id, x: bel.x, y: bel.y });
          return;
        }
      }
    }
  }

  step(dt = 1 / 60) {
    if (!this.state) return;
    const prevStatus = this.state.status;
    const prevStarCount = this.state.starsCollected;

    stepFrame(this.state, dt);

    // 星星拾取事件
    if (this.state.starsCollected > prevStarCount) {
      this.emit("star", {
        count: this.state.starsCollected,
        index: this.state.starsCollected - 1
      });
    }

    // 状态转移事件
    if (prevStatus === "playing") {
      if (this.state.status === "cleared") {
        this.emit("win", {
          levelId: this.currentLevelId,
          stars: this.state.starsCollected,
          time: this.state.timeElapsed
        });
      } else if (this.state.status === "failed") {
        this.emit("fail", {
          levelId: this.currentLevelId,
          reason: this.state.failReason
        });
      }
    }
  }
}
