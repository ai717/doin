// ui.mjs —— 唯一碰 DOM 的层：玻璃柜体、LED 计分牌、Canvas 输入（拖放/旋转/键盘/触控）、
// 抽屉与弹层、吐司。预览状态（选中槽/旋转/光标）是视图关注点，全部收敛在本层；
// 引擎只接收最终放置意图 (slot, rotation, row, col)。
//
// 旋转契约（用户拍板）：旋转只发生在托盘区——拖拽进入网格后朝向即锁定，
// 拖拽中滚轮/右键一律不转；滚轮/右键仅命中托盘槽时旋转该槽；R 键为无障碍通道保留。
import { GRID, canPlace } from "./engine.mjs";
import { createRenderer } from "./render.mjs";
import { DIFFICULTIES, DEFAULT_DIFFICULTY, pickDifficulty } from "./difficulty.mjs";
import { format } from "./i18n.mjs";

const $ = (id) => document.getElementById(id);

export function createUi(handlers) {
  const canvas = $("stage");
  const renderer = createRenderer(canvas);
  const audio = handlers.audio;

  let view = null;
  let strings = handlers.strings;
  let selected = null; // 选中的队列槽位
  let rotations = [0, 0, 0]; // 各槽预览旋转
  let cursor = null; // 键盘/悬停光标格
  let dragging = false;
  let pointerId = null;
  let overlayOpen = null; // "help" | "difficulty" | "result" | null（与 *-layer 元素 id 严格对应）
  let toastTimer = 0;
  let bestScores = {}; // 各难度最高分 { easy: n, normal: n, hard: n }
  let currentDifficulty = DEFAULT_DIFFICULTY;

  // ---------------------------------------------------------------- 吐司

  function toast(key, params) {
    const el = $("toast");
    if (!el) return;
    el.textContent = format(strings[key] ?? key, params);
    el.hidden = false;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.hidden = true;
      el.classList.remove("show");
    }, 1500);
  }

  // ---------------------------------------------------------------- 输入

  function canvasPoint(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function traySlotAt(e) {
    const p = canvasPoint(e);
    const hit = renderer.hitTest(p.x, p.y);
    return hit && hit.type === "queue" ? hit.slot : null;
  }

  function selectSlot(slot) {
    if (!view || view.status !== "playing") return;
    if (!view.queue[slot]) return;
    selected = slot;
    // 取块只点亮托盘，绝不在网格里画预览：预览仅由「拖入棋盘 / 方向键 / 非法落点反馈」产生。
    // 曾在取块时把光标摆到棋盘中心，点击或旋转顶部拼块瞬间亮出一块幽灵，会被误认为已经落子。
    cursor = null;
    audio.playUi();
  }

  function rotateSelected(dir = 1) {
    if (selected === null) return;
    // 旋转移出网格：拖拽进入棋盘后朝向锁定，只能 Esc 取出后再转
    if (dragging) {
      toast("toastRotOnTray");
      return;
    }
    rotations[selected] = ((rotations[selected] ?? 0) + dir + 4) % 4;
    audio.playUi();
  }

  function cancelSelection() {
    selected = null;
    cursor = null;
    dragging = false;
  }

  function currentAnchor() {
    if (selected === null || !cursor) return null;
    const pieceId = view.queue[selected];
    if (!pieceId) return null;
    return renderer.anchorFor(pieceId, rotations[selected] ?? 0, cursor.row, cursor.col);
  }

  function placementLegal() {
    const anchor = currentAnchor();
    if (!anchor) return false;
    const pieceId = view.queue[selected];
    return canPlace(view.board, pieceId, rotations[selected] ?? 0, anchor.row, anchor.col);
  }

  function tryPlace() {
    if (!view || view.status !== "playing" || selected === null || !cursor) return;
    if (!placementLegal()) {
      audio.playReject();
      toast("toastNoPlace");
      return;
    }
    const anchor = currentAnchor();
    const rotation = rotations[selected] ?? 0;
    const slot = selected;
    cancelSelection();
    handlers.onPlace(slot, rotation, anchor.row, anchor.col);
  }

  function onPointerDown(e) {
    if (overlayOpen) return;
    if (!view || view.status !== "playing") return;
    const p = canvasPoint(e);
    const hit = renderer.hitTest(p.x, p.y);
    if (!hit) return;
    if (hit.type === "queue") {
      if (!view.queue[hit.slot]) return;
      selectSlot(hit.slot);
      dragging = true;
      pointerId = e.pointerId;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      e.preventDefault();
      return;
    }
    // 点棋盘：已取块则直接落子
    if (selected !== null) {
      cursor = { row: hit.row, col: hit.col };
      tryPlace();
      e.preventDefault();
    }
  }

  function onPointerMove(e) {
    if (!dragging || selected === null) return;
    const p = canvasPoint(e);
    const hit = renderer.hitTest(p.x, p.y);
    cursor = hit && hit.type === "board" ? { row: hit.row, col: hit.col } : null;
  }

  function onPointerUp(e) {
    if (!dragging || selected === null) {
      dragging = false;
      return;
    }
    const p = canvasPoint(e);
    const hit = renderer.hitTest(p.x, p.y);
    dragging = false;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (pointerId !== null && e.pointerId !== pointerId) return;
    pointerId = null;
    if (hit && hit.type === "board") {
      cursor = { row: hit.row, col: hit.col };
      tryPlace();
    } else {
      // 松手不在棋盘（托盘/柜体外）：收回预览，不在网格里残留幽灵；
      // 选择保留（点击取块模式），随后点格即放。
      cursor = null;
    }
    // 松手在队列/柜体外：保持已取块（点击取块模式）
  }

  /** 滚轮只在托盘区生效：悬停哪个槽就旋转哪个槽（顺带选中） */
  function onWheel(e) {
    if (overlayOpen) return;
    e.preventDefault();
    const slot = traySlotAt(e);
    if (slot === null || !view || view.status !== "playing") return;
    if (!view.queue[slot]) return;
    if (selected !== slot) selectSlot(slot);
    rotateSelected(e.deltaY > 0 ? 1 : -1);
  }

  /** 右键同样只在托盘区旋转；网格内右键不弹系统菜单也不旋转 */
  function onContextMenu(e) {
    e.preventDefault();
    if (overlayOpen) return;
    const slot = traySlotAt(e);
    if (slot === null || !view || view.status !== "playing") return;
    if (!view.queue[slot]) return;
    if (selected !== slot) selectSlot(slot);
    rotateSelected(1);
  }

  function onKeyDown(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const key = e.key;
    if (key === "Escape") {
      if (overlayOpen) {
        closeOverlay();
      } else {
        cancelSelection();
      }
      e.preventDefault();
      return;
    }
    if (overlayOpen) return;
    if (key === "1" || key === "2" || key === "3") {
      selectSlot(Number(key) - 1);
      e.preventDefault();
      return;
    }
    if (key === "r" || key === "R") {
      rotateSelected(1);
      e.preventDefault();
      return;
    }
    if (key === " " || key === "Spacebar") {
      tryPlace();
      e.preventDefault();
      return;
    }
    const moves = {
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      a: [0, -1],
      d: [0, 1],
      w: [-1, 0],
      s: [1, 0],
      A: [0, -1],
      D: [0, 1],
      W: [-1, 0],
      S: [1, 0],
    };
    const delta = moves[key];
    if (delta && selected !== null) {
      const base = cursor ?? { row: 3, col: 3 };
      cursor = {
        row: Math.min(GRID - 1, Math.max(0, base.row + delta[0])),
        col: Math.min(GRID - 1, Math.max(0, base.col + delta[1])),
      };
      e.preventDefault();
    }
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("contextmenu", onContextMenu);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("resize", () => renderer.syncSize());

  // ---------------------------------------------------------------- HUD

  function hudValue(id, value) {
    const el = $(id);
    if (el) el.textContent = String(value);
  }

  function difficultyName(id) {
    return strings[`diff${id[0].toUpperCase()}${id.slice(1)}`] ?? id;
  }

  function updateHud() {
    if (!view) return;
    hudValue("led-score", view.score);
    hudValue("led-combo", `x${view.combo}`);
    hudValue("led-max-combo", `x${view.maxCombo}`);
    hudValue("led-rows", view.rowsCleared);
    hudValue("led-cross", view.crossCount);
    hudValue("led-difficulty", difficultyName(view.difficulty ?? currentDifficulty));
    hudValue("led-best", bestScores[view.difficulty ?? currentDifficulty] ?? 0);
  }

  // ---------------------------------------------------------------- 渲染

  function render(v, dt = 0.016) {
    view = v;
    updateHud();
    if (!v) return;
    renderer.render(v, { selected, rotations, cursor }, dt);
  }

  // ---------------------------------------------------------------- 弹层

  function setOverlay(name) {
    overlayOpen = name;
    for (const layer of ["help-layer", "difficulty-layer", "result-layer"]) {
      const el = $(layer);
      if (el) el.hidden = layer !== `${name}-layer`;
    }
  }

  function closeOverlay() {
    setOverlay(null);
  }

  function showHelp() {
    setOverlay("help");
  }

  /** 难度层：静态卡壳 + 动态状态（当前勾选 / 各档最高分 / 描述） */
  function showDifficulties() {
    for (const diff of DIFFICULTIES) {
      const card = $(`diff-${diff.id}`);
      if (!card) continue;
      card.classList.toggle("current", diff.id === currentDifficulty);
      card.setAttribute("aria-pressed", String(diff.id === currentDifficulty));
      const desc = $(`diff-${diff.id}-desc`);
      if (desc) desc.textContent = format(strings[`diff${diff.id[0].toUpperCase()}${diff.id.slice(1)}Desc`] ?? "", {});
      const best = $(`diff-${diff.id}-best`);
      if (best) best.textContent = format(strings.statBest, { n: bestScores[diff.id] ?? 0 });
    }
    setOverlay("difficulty");
  }

  function showResult(result, { isRecord = false } = {}) {
    const badge = $("result-badge");
    if (badge) {
      badge.textContent = isRecord ? strings.toastRecord : strings.overStuck;
      badge.classList.toggle("record", isRecord);
    }
    const sub = $("result-sub");
    if (sub) {
      sub.textContent = `${strings.resultDifficulty}: ${difficultyName(result.difficulty ?? currentDifficulty)}`;
    }
    const rows = $("result-rows");
    if (rows) {
      const items = [
        [strings.resultScore, result.score],
        [strings.resultRows, result.rowsCleared],
        [strings.resultCross, result.crossCount],
        [strings.resultMaxCombo, `x${result.maxCombo}`],
      ];
      rows.textContent = "";
      for (const [label, value] of items) {
        const row = document.createElement("div");
        row.className = "result-row";
        const span = document.createElement("span");
        span.textContent = label;
        const b = document.createElement("b");
        b.textContent = String(value);
        row.appendChild(span);
        row.appendChild(b);
        rows.appendChild(row);
      }
    }
    setOverlay("result");
  }

  function hideOverlays() {
    closeOverlay();
  }

  // ---------------------------------------------------------------- 静态绑定

  $("btn-help")?.addEventListener("click", () => {
    audio.playUi();
    showHelp();
  });
  $("help-close")?.addEventListener("click", () => {
    audio.playUi();
    closeOverlay();
  });
  $("btn-difficulty")?.addEventListener("click", () => {
    audio.playUi();
    handlers.onRequestDifficulty();
  });
  for (const diff of DIFFICULTIES) {
    $(`diff-${diff.id}`)?.addEventListener("click", () => {
      audio.playUi();
      handlers.onStartDifficulty(diff.id);
    });
  }
  $("btn-rotate")?.addEventListener("click", () => rotateSelected(1));
  $("btn-reset")?.addEventListener("click", () => {
    audio.playUi();
    cancelSelection();
    handlers.onReset();
  });
  $("result-again")?.addEventListener("click", () => {
    audio.playUi();
    cancelSelection();
    handlers.onReset();
  });
  $("result-difficulty")?.addEventListener("click", () => {
    audio.playUi();
    handlers.onRequestDifficulty();
  });
  $("result-close")?.addEventListener("click", () => {
    audio.playUi();
    closeOverlay();
  });
  $("difficulty-close")?.addEventListener("click", () => {
    audio.playUi();
    closeOverlay();
  });
  $("btn-sound")?.addEventListener("click", () => handlers.onSound());
  $("btn-lang")?.addEventListener("click", () => handlers.onLang());

  // ---------------------------------------------------------------- 对外

  return {
    render,
    toast,
    showResult,
    showDifficulties,
    showHelp,
    hideOverlays,
    closeOverlay,
    setSoundIcon(muted) {
      const btn = $("btn-sound");
      if (!btn) return;
      btn.textContent = muted ? "🔇" : "🔊";
      btn.setAttribute("aria-label", muted ? strings.soundOff : strings.soundOn);
    },
    /** 全量同步各难度最高分与当前难度（开局 / 结算 / 破纪录后调用） */
    syncBest({ bests = {}, difficulty = DEFAULT_DIFFICULTY } = {}) {
      bestScores = bests;
      currentDifficulty = pickDifficulty(difficulty);
      updateHud();
      if (overlayOpen === "difficulty") showDifficulties();
    },
    applyStrings(nextStrings) {
      strings = nextStrings;
      // 覆盖层若打开则按新语言重铸内容
      if (overlayOpen === "difficulty") showDifficulties();
      if (overlayOpen === "result") {
        // 结果层由 showResult 全量重建，语言切换时关闭更稳妥
        closeOverlay();
      }
      updateHud();
    },
    syncSize: () => renderer.syncSize(),
    previewState: () => ({ selected, rotations: [...rotations], cursor: cursor ? { ...cursor } : null }),
    cancelSelection,
    selectSlot,
  };
}
