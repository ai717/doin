// game.mjs — 24 点状态控制器（计算器交互范式：数字 → 运算符 → 数字）
// 不直接碰 DOM，通过回调通知 UI

import * as engine from './engine.mjs';

// ========== 事件派发 ==========
class EventBus {
  constructor() { this.map = new Map(); }
  on(evt, cb) { if (!this.map.has(evt)) this.map.set(evt, []); this.map.get(evt).push(cb); }
  emit(evt, payload) { (this.map.get(evt) || []).forEach(cb => cb(payload)); }
}

// ========== 控制器 ==========
export class Calc24Game {
  constructor() {
    this.bus = new EventBus();
    this.state = null;
    this.pendingOp = null;  // 当前已选但尚未执行的运算符（计算器范式）
    // 当前上下文（用于生成关卡）
    this.ctx = { mode: null, chapterIdx: 0, levelIdx: 0, classicIdx: 0 };
    this.hintInfo = null; // 当前 hint 提示内容
  }

  on(evt, cb) { this.bus.on(evt, cb); }

  // ======== 开局 ========
  startChapter(chapterIdx, levelIdx) {
    this.ctx = { mode: 'chapter', chapterIdx, levelIdx, classicIdx: 0 };
    this.state = engine.createFromLevel(chapterIdx, levelIdx);
    this.pendingOp = null;
    this.hintInfo = null;
    this.bus.emit('state', this.state);
  }

  startClassic(classicIdx) {
    this.ctx = { mode: 'classic', chapterIdx: 0, levelIdx: 0, classicIdx };
    this.state = engine.createFromClassic(classicIdx);
    this.pendingOp = null;
    this.hintInfo = null;
    this.bus.emit('state', this.state);
  }

  startInfinite() {
    this.ctx = { mode: 'infinite', chapterIdx: 0, levelIdx: 0, classicIdx: 0 };
    this.state = engine.createFromRandom();
    this.pendingOp = null;
    this.hintInfo = null;
    this.bus.emit('state', this.state);
  }

  reset() {
    if (this.ctx.mode === 'classic') this.startClassic(this.ctx.classicIdx);
    else if (this.ctx.mode === 'infinite') this.startInfinite();
    else this.startChapter(this.ctx.chapterIdx, this.ctx.levelIdx);
  }

  // ======== 状态查询（UI 用）========
  get firstSelectedId() {
    return this.state?.selectedIds?.[0] || null;
  }

  // ======== 玩家操作（计算器范式：数字 → 运算符 → 数字）========

  /** 阶段 0 → 1：选第 1 个数 → 显示运算符面板
   *  阶段 1 → 0：点已选中的数 → 取消选中
   *  阶段 2 → 执行：点第 2 个数 → 用 pendingOp 立即合并
   */
  selectCard(cardId) {
    if (!this.state || this.state.status !== 'playing') return;

    const firstId = this.firstSelectedId;

    // 阶段 2：已 pendingOp → 点第 2 张 → 立即执行
    if (this.pendingOp && firstId && firstId !== cardId) {
      this._applyWithPending(cardId);
      return;
    }

    // 点同一个卡 → 取消选中 + 清 pendingOp
    if (firstId === cardId) {
      this.state = { ...this.state, selectedIds: [] };
      this.pendingOp = null;
      this.bus.emit('state', this.state);
      return;
    }

    // 阶段 0 / 阶段 1 切换第 1 张：只选 1 张（非 toggle）
    this.state = { ...this.state, selectedIds: [cardId] };
    this.hintInfo = null;
    this.bus.emit('state', this.state);
    this.bus.emit('ready', cardId); // 通知 UI：显示运算符面板
  }

  /** 选运算符
   *  阶段 1 → 2：记住 pendingOp
   *  阶段 2：切换 pendingOp
   */
  selectOperator(op) {
    if (!this.state || this.state.status !== 'playing') return;
    const firstId = this.firstSelectedId;
    if (!firstId) return; // 没选第一个数 → 不响应

    // 更新 pendingOp，emit state 让 UI 高亮
    this.pendingOp = op;
    this.bus.emit('state', this.state); // 携带 pendingOp 变化的视觉更新
  }

  /** 内部：用 pendingOp 合并 first + second 两张卡 */
  _applyWithPending(secondId) {
    if (!this.pendingOp || !this.firstSelectedId) return;

    // 先缓存当前 pendingOp（因为下面会清掉）
    const op = this.pendingOp;
    // 临时把 selectedIds 组装成 [first, second] 供 engine 使用
    const assembledState = {
      ...this.state,
      selectedIds: [this.firstSelectedId, secondId],
    };

    const res = engine.applyOperator(assembledState, op);
    this.pendingOp = null; // 无论成功失败都清掉

    if (res.action === 'invalid') {
      // 恢复 selectedIds 为只含 first（用户可能想换个运算符重试）
      this.state = { ...this.state, selectedIds: [this.firstSelectedId] };
      this.bus.emit('invalid', {});
      this.bus.emit('state', this.state);
      return;
    }

    this.state = res.state;
    this.hintInfo = null;
    this.bus.emit('merge', { op, result: res.result, action: res.action });
    this.bus.emit('state', this.state);

    if (res.action === 'won') {
      const stars = engine.calcStars({ steps: this.state.steps, hintsUsed: this.state.hintsUsed });
      this.bus.emit('won', { stars, steps: this.state.steps });
    } else if (res.action === 'lost') {
      this.bus.emit('lost', { result: res.result });
    }
  }

  // ======== 旧接口兼容（保留 doOperator 以兼容现有 UI 按钮）========
  doOperator(op) {
    if (this.firstSelectedId) {
      this.selectOperator(op);
    } else {
      this.bus.emit('invalid', {});
    }
  }

  clearSelection() {
    if (!this.state) return;
    this.state = engine.clearSelect(this.state);
    this.pendingOp = null;
    this.bus.emit('state', this.state);
  }

  undo() {
    if (!this.state) return;
    const res = engine.undo(this.state);
    if (!res.undone) { this.bus.emit('invalid', {}); return; }
    this.state = res.state;
    this.pendingOp = null; // 撤完回到阶段 0
    this.bus.emit('state', this.state);
  }

  // ======== Hint ========
  requestHint() {
    if (!this.state || this.state.status !== 'playing') return;
    const nums = this.state.cards.map(c => c.value);
    const hint = engine.generateHint(nums);
    if (hint) {
      this.hintInfo = hint;
      this.state = { ...this.state, hintsUsed: this.state.hintsUsed + 1 };
      this.bus.emit('hint', hint);
      this.bus.emit('state', this.state);
    } else {
      this.bus.emit('hint-empty', {});
    }
  }
}

// 导出便捷函数
export const solve = engine.solve;
export const generateHint = engine.generateHint;
export const calcStars = engine.calcStars;
