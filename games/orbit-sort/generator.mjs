// Deterministic level validation and generation for Orbit Dispatch Master.

import { applyAction, createState, isSolved, isTrackComplete, legalActions, applyIntent, canExtract, canInsert, isStuck, extractOrb, insertOrb, clearDockSelection, selectDock } from "./engine.mjs";
import { solve } from "./solver.mjs?v=dev";

function hash(value) {
  let result = 2166136261;
  for (const char of String(value)) {
    result ^= char.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function nextRandom(seed) {
  return (Math.imul(seed, 1664525) + 1013904223) >>> 0;
}

function shuffledColors(colorCount, capacity, seed) {
  const colors = Array.from({ length: colorCount }, (_, color) =>
    Array.from({ length: capacity }, () => color),
  ).flat();
  let current = seed;
  for (let index = colors.length - 1; index > 0; index -= 1) {
    current = nextRandom(current);
    const target = current % (index + 1);
    [colors[index], colors[target]] = [colors[target], colors[index]];
  }
  return { colors, seed: current };
}

function stateForLevel(level) {
  const modifiers = new Map((level.modifiers ?? []).map((modifier) => [modifier.trackId, modifier]));
  const tracks = level.tracks.map((orbs, trackId) => {
    const modifier = modifiers.get(trackId);
    return modifier ? { orbs, ...modifier } : orbs;
  });
  return createState({ ...level, tracks, levelSeed: level.seed ?? null });
}

function fail(reason, message) {
  return { valid: false, reason, message };
}

export function validateLevel(level, options = {}) {
  if (!level || !Number.isInteger(level.capacity) || level.capacity < 1) {
    return fail("invalid-capacity", "容量必须是正整数");
  }
  if (!Number.isInteger(level.dockCount) || level.dockCount < 1) {
    return fail("invalid-dock-count", "中转槽数量必须是正整数");
  }
  if (!Array.isArray(level.tracks) || level.tracks.length === 0) {
    return fail("invalid-tracks", "关卡必须包含轨道");
  }
  if (level.tracks.some((track) => !Array.isArray(track))) {
    return fail("invalid-tracks", "每条轨道必须是星体颜色数组");
  }
  const colors = level.tracks.flat();
  const colorSet = new Set(colors);
  if (colorSet.size === 0 || [...colorSet].some((color) => !Number.isInteger(color) || color < 0)) {
    return fail("invalid-color", "星体颜色必须是从 0 开始的整数");
  }
  const colorCount = colorSet.size;
  if (![...colorSet].every((color) => color < colorCount)) {
    return fail("non-contiguous-colors", "颜色编号必须连续");
  }
  for (let color = 0; color < colorCount; color += 1) {
    if (colors.filter((item) => item === color).length !== level.capacity) {
      return fail("unbalanced-color-count", "每种颜色必须恰好出现容量次");
    }
  }
  if (level.tracks.length < colorCount + 1) {
    return fail("not-enough-empty-tracks", "轨道数量必须为每种颜色提供完成轨道和至少一条空轨道");
  }
  if (level.tracks.some((track) => track.length > level.capacity)) {
    return fail("over-capacity", "轨道初始星体不能超过容量");
  }
  const modifiers = level.modifiers ?? [];
  const modifierIds = new Set();
  for (const modifier of modifiers) {
    if (!Number.isInteger(modifier.trackId) || modifierIds.has(modifier.trackId)) {
      return fail("invalid-modifier", "特殊轨道必须引用唯一的有效轨道");
    }
    modifierIds.add(modifier.trackId);
    if (!level.tracks[modifier.trackId]) return fail("invalid-modifier", "特殊轨道不存在");
    if (!["frozen", "in-only", "out-only"].includes(modifier.mode)) {
      return fail("invalid-modifier", "特殊轨道类型无效");
    }
    if (modifier.frozenUntilColor !== undefined &&
        (!Number.isInteger(modifier.frozenUntilColor) || modifier.frozenUntilColor >= colorCount)) {
      return fail("invalid-freeze-color", "冻结解锁颜色无效");
    }
  }
  const initial = stateForLevel(level);
  if (isSolved(initial) || initial.tracks.some((track) => isTrackComplete(track, level.capacity))) {
    return fail("pre-solved", "初始关卡不能已经完成");
  }
  const result = solve(initial, options);
  if (result.status !== "solved") {
    return fail(result.status === "timeout" ? "solver-timeout" : "unsolved", "关卡没有被确认存在通关路径");
  }
  const firstMoveChecks = [];
  let deadEndFirstMoves = 0;
  for (const action of legalActions(initial)) {
    const applied = applyAction(initial, action);
    if (!applied.valid) return fail("invalid-first-move", "关卡存在无法执行的合法首步");
    const branch = solve(applied.state, options);
    const status = branch.status === "exhausted" ? "dead-end" : branch.status;
    if (status === "dead-end") deadEndFirstMoves += 1;
    firstMoveChecks.push({ action, status, par: branch.par, nodes: branch.nodes });
  }
  if (Number.isInteger(options.maxDeadEndFirstMoves) && deadEndFirstMoves > options.maxDeadEndFirstMoves) {
    return fail("too-many-dead-end-first-moves", "关卡合法首步中存在过多无法通关的分支");
  }

  // --- Intent-route non-regression (用户指令：批量生产新关卡时必须保证 合法不报错) ---
  // 规则不变量：对任意可达 state，只要玩家能从该 state 合理合法地对某条轨道做动作
  // （canExtract 或任一 dock 可 canInsert），applyIntent({target:"track", id}) 就必须
  // 返回 valid=true；否则就是 engine 把合法动作拒之门外的 UX 漏洞。
  // 验证方法：做 options.intentRollouts 轮随机游走（默认 8 轮，每轮最多 intentRolloutSteps 步），
  // 中途每一步每一条 track + 每一个 occupied dock（click dock）校验。
  {
    const rollouts = Number.isInteger(options.intentRollouts) ? options.intentRollouts : 10;
    const maxSteps = Number.isInteger(options.intentRolloutSteps) ? options.intentRolloutSteps : 40;
    let seed = 0xC0FFEE ^ (result.par | 0) ^ level.tracks.length ^ level.capacity;
    for (let r = 0; r < rollouts; r += 1) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      let s = stateForLevel(level);
      for (let step = 0; step < maxSteps; step += 1) {
        // 审计当前 state 的所有 track 点击
        if (!isSolved(s)) {
          for (let tid = 0; tid < s.tracks.length; tid += 1) {
            const hasExtract = canExtract(s, tid);
            const hasInsertAnyDock = s.docks.some(d => d.unlocked && d.orb && canInsert(s, d.id, tid));
            if (hasExtract || hasInsertAnyDock) {
              const r1 = applyIntent(s, { target: "track", id: tid });
              if (!r1.valid) {
                return fail(
                  "intent-false-negative",
                  `意图路由误报：state step=${step} 点击T${tid}应当合法(extract=${hasExtract},可insert dock=${hasInsertAnyDock})，但因[${r1.reason}] ${r1.message ?? ""} 被拒`,
                );
              }
            }
          }
          // 审计每一个 click dock（如果 select 合理）
          for (const d of s.docks) {
            // 合理可点击：(a) 有orb 可被 select 选中作为放入源 (选中它) 或 (b) 当前选中它 可再次点被 clear
            if (d.orb) {
              const same = s.selectedDockId !== null && Number(s.selectedDockId) === Number(d.id);
              // 无论是 select 还是 clear 都应当 valid
              const intent = applyIntent(s, { target: "dock", id: d.id });
              if (!intent.valid) {
                return fail(
                  "intent-dock-false-negative",
                  `意图路由误报：step=${step} 点D${d.id}(有orb${same?"(same->clear)":"(select)"}) 应当合法，但被拒[${intent.reason}] ${intent.message ?? ""}`,
                );
              }
            }
          }
        }
        // 推进：随机从 legalActions 取一个 extract/insert 改变局面
        if (isSolved(s) || isStuck(s)) break;
        const moves = legalActions(s).filter(a => a.type === "extract" || a.type === "insert");
        if (moves.length === 0) break;
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const a = moves[seed % moves.length];
        s = a.type === "extract" ? extractOrb(s, a.trackId) : insertOrb(s, a.dockId, a.trackId);
        // 偶尔插入 select/clear 切换选择态（覆盖 placing/extraction 两模式）
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        if ((seed & 3) === 0) {
          const occupied = s.docks.filter(d => d.unlocked && d.orb);
          if (occupied.length > 0 && s.selectedDockId === null) {
            s = selectDock(s, occupied[seed % occupied.length].id);
          } else if (s.selectedDockId !== null && (seed & 5) === 0) {
            s = clearDockSelection(s);
          }
        }
      }
    }
  }

  return {
    valid: true,
    solvable: true,
    par: result.par,
    nodes: result.nodes,
    elapsedMs: result.elapsedMs,
    deadEndFirstMoves,
    firstMoveChecks,
  };
}

export function generateLevel({
  seed,
  id = seed,
  chapter = 1,
  capacity = 3,
  colorCount = 3,
  dockCount = 1,
  emptyCount,
  attempts = 200,
  solverOptions = { nodeLimit: 250_000, timeLimitMs: 500 },
} = {}) {
  if (seed === undefined) throw new TypeError("generateLevel requires a seed");
  const bufferTracks = emptyCount !== undefined ? emptyCount : Math.max(1, dockCount);
  let random = hash(seed);
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const shuffled = shuffledColors(colorCount, capacity, random);
    random = shuffled.seed;
    const tracks = Array.from({ length: colorCount + bufferTracks }, () => []);
    for (const color of shuffled.colors) {
      let target = random % colorCount;
      random = nextRandom(random);
      while (tracks[target].length >= capacity) {
        target = (target + 1) % colorCount;
      }
      tracks[target].push(color);
    }
    const level = { id, chapter, capacity, dockCount, tracks, modifiers: [], seed: String(seed) };
    const validation = validateLevel(level, solverOptions);
    if (validation.valid) return { ...level, par: validation.par };
  }
  throw new Error(`Unable to generate a solvable level for seed ${seed}`);
}
