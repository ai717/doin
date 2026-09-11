// Fixed, solver-verified mainline levels. Arrays run from far end to mouth.

import { createState } from "./engine.mjs";

const ALL_LEVELS = [
  {
    id: 1,
    chapter: 1,
    capacity: 3,
    dockCount: 2,
    tracks: [[2, 0, 1], [0, 1, 0], [1, 2, 2], []],
    modifiers: [],
    par: 7,
    seed: "1788344956434-L1-1",
  },
  {
    id: 2,
    chapter: 1,
    capacity: 3,
    dockCount: 1,
    tracks: [[2, 2, 0], [2, 1, 0], [1, 0, 1], []],
    modifiers: [],
    par: 7,
    seed: "1788344956434-L2-1",
  },
  {
    id: 3,
    chapter: 1,
    capacity: 4,
    dockCount: 2,
    tracks: [[0, 2, 0, 0], [2, 1, 0, 2], [2, 1, 1, 1], []],
    modifiers: [],
    par: 11,
    seed: "1788344956434-L3-1",
  },
  {
    id: 4,
    chapter: 1,
    capacity: 4,
    dockCount: 1,
    tracks: [[1, 0, 2, 2], [0, 1, 0, 0], [2, 1, 1, 2], []],
    modifiers: [],
    par: 13,
    seed: "1788344956434-L4-1",
  },
  {
    id: 5,
    chapter: 1,
    capacity: 4,
    dockCount: 2,
    tracks: [[0, 1, 0, 0], [1, 3, 2, 3], [0, 2, 1, 2], [3, 2, 3, 1], []],
    modifiers: [],
    par: 14,
    seed: "1788344956434-L5-1",
  },
  {
    id: 6,
    chapter: 1,
    capacity: 5,
    dockCount: 1,
    tracks: [[3, 0, 2, 1, 2], [1, 3, 1, 0, 3], [0, 1, 2, 0, 3], [1, 0, 3, 2, 2], []],
    modifiers: [],
    par: 23,
    seed: "1788344956434-L6-1",
  },
  {
    id: 7,
    chapter: 1,
    capacity: 5,
    dockCount: 2,
    tracks: [[1, 3, 3, 3, 1], [1, 2, 0, 4, 3], [4, 0, 2, 2, 1], [4, 0, 4, 3, 2], [2, 4, 1, 0, 0], []],
    modifiers: [],
    par: 26,
    seed: "1788344956434-L7-1",
  },
  {
    id: 8,
    chapter: 1,
    capacity: 3,
    dockCount: 1,
    tracks: [[1, 2, 2], [3, 0, 3], [1, 0, 0], [2, 1, 3], []],
    modifiers: [],
    par: 9,
    seed: "chapter-1-level-8",
  },
  {
    id: 9,
    chapter: 1,
    capacity: 3,
    dockCount: 2,
    tracks: [[2, 3, 1], [1, 0, 2], [0, 3, 2], [0, 3, 1], []],
    modifiers: [],
    par: 9,
    seed: "chapter-1-level-9",
  },
  {
    id: 10,
    chapter: 1,
    capacity: 4,
    dockCount: 2,
    tracks: [[0, 0, 2, 1], [1, 0, 1, 3], [2, 3, 3, 2], [2, 1, 3, 0], []],
    modifiers: [],
    par: 12,
    seed: "chapter-1-level-10",
  },
  {
    id: 11,
    chapter: 2,
    capacity: 4,
    dockCount: 2,
    tracks: [[0, 0, 2, 4], [0, 1, 1, 0], [3, 3, 1, 4], [2, 4, 3, 2], [3, 2, 1, 4], []],
    modifiers: [],
    par: 16,
    seed: "chapter-2-level-11",
  },
  {
    id: 12,
    chapter: 2,
    capacity: 4,
    dockCount: 2,
    tracks: [[0, 1, 1, 3], [1, 0, 0, 2], [4, 1, 3, 2], [2, 2, 3, 4], [4, 4, 3, 0], []],
    modifiers: [],
    par: 15,
    seed: "chapter-2-level-12",
  },
  {
    id: 13,
    chapter: 2,
    capacity: 4,
    dockCount: 2,
    tracks: [[0, 2, 4, 0], [0, 3, 3, 2], [2, 4, 4, 1], [1, 1, 3, 1], [4, 2, 3, 0], []],
    modifiers: [],
    par: 16,
    seed: "chapter-2-level-13",
  },
  {
    id: 14,
    chapter: 2,
    capacity: 4,
    dockCount: 2,
    tracks: [[2, 3, 0, 4], [1, 1, 1, 3], [0, 4, 2, 2], [2, 1, 0, 3], [4, 4, 0, 3], []],
    modifiers: [],
    par: 13,
    seed: "chapter-2-level-14",
  },
  {
    id: 15,
    chapter: 2,
    capacity: 4,
    dockCount: 2,
    tracks: [[2, 1, 3, 2], [0, 3, 2, 0], [0, 1, 1, 0], [3, 4, 3, 4], [2, 4, 1, 4], []],
    modifiers: [],
    par: 19,
    seed: "chapter-2-level-15",
  },
  {
    id: 16,
    chapter: 2,
    capacity: 4,
    dockCount: 2,
    tracks: [[1, 4, 0, 4], [1, 1, 3, 2], [3, 3, 0, 0], [2, 0, 2, 4], [4, 2, 1, 3], []],
    modifiers: [{ trackId: 3, mode: "frozen", frozenUntilColor: 1 }],
    par: 17,
    seed: "chapter-2-level-16",
  },
  {
    id: 17,
    chapter: 2,
    capacity: 4,
    dockCount: 2,
    tracks: [[0, 2, 1, 3], [3, 3, 0, 0], [1, 4, 4, 1], [2, 2, 2, 4], [1, 4, 3, 0], []],
    modifiers: [],
    par: 13,
    seed: "chapter-2-level-17",
  },
  {
    id: 18,
    chapter: 2,
    capacity: 4,
    dockCount: 2,
    tracks: [[1, 1, 3, 0], [3, 1, 4, 3], [2, 1, 4, 4], [0, 2, 3, 4], [2, 0, 0, 2], []],
    modifiers: [{ trackId: 4, mode: "frozen", frozenUntilColor: 3 }],
    par: 16,
    seed: "chapter-2-level-18",
  },
  {
    id: 19,
    chapter: 2,
    capacity: 4,
    dockCount: 2,
    tracks: [[2, 2, 0, 0], [0, 4, 1, 3], [4, 1, 4, 2], [3, 3, 1, 1], [4, 3, 0, 2], []],
    modifiers: [],
    par: 14,
    seed: "chapter-2-level-19",
  },
  {
    id: 20,
    chapter: 2,
    capacity: 4,
    dockCount: 2,
    tracks: [[0, 2, 4, 3], [1, 1, 2, 4], [2, 0, 0, 2], [1, 1, 4, 4], [0, 3, 3, 3], []],
    modifiers: [{ trackId: 3, mode: "frozen", frozenUntilColor: 0 }],
    par: 16,
    seed: "chapter-2-level-20",
  },
  {
    id: 21,
    chapter: 3,
    capacity: 4,
    dockCount: 2,
    tracks: [[0, 0, 0], [1, 1, 1, 0], [2, 2, 2, 1], [3, 3, 3, 2], [4, 4, 4, 3], [4], []],
    modifiers: [{ trackId: 0, mode: "in-only" }],
    par: 5,
    seed: "chapter-3-level-21",
  },
  {
    id: 22,
    chapter: 3,
    capacity: 4,
    dockCount: 2,
    tracks: [[0, 0, 0], [1, 1, 1, 0], [2, 2, 2, 1], [3, 3, 3, 2], [4, 4, 4, 3], [4], []],
    modifiers: [{ trackId: 0, mode: "out-only" }],
    par: 8,
    seed: "chapter-3-level-22",
  },
  {
    id: 23,
    chapter: 3,
    capacity: 4,
    dockCount: 2,
    tracks: [[0, 0, 0, 1], [1, 1, 1, 2], [2, 2, 2, 3], [3, 3, 3, 4], [4, 4, 4, 5], [5, 5, 5, 0], []],
    modifiers: [],
    par: 6,
    seed: "chapter-3-level-23",
  },
  {
    id: 24,
    chapter: 3,
    capacity: 4,
    dockCount: 2,
    tracks: [[2, 0, 3, 1], [0, 1, 1, 4], [3, 2, 4, 4], [0, 0, 2, 2], [4, 1, 3, 3], []],
    modifiers: [],
    par: 16,
    seed: "chapter-3-level-24",
  },
  {
    id: 25,
    chapter: 3,
    capacity: 4,
    dockCount: 2,
    tracks: [[0, 0, 1, 2], [1, 1, 2, 3], [2, 2, 3, 4], [3, 3, 4, 5], [4, 4, 5, 0], [5, 5, 0, 1], []],
    modifiers: [],
    par: 14,
    seed: "chapter-3-level-25",
  },
  {
    id: 26,
    chapter: 3,
    capacity: 4,
    dockCount: 2,
    tracks: [[0, 0, 0, 1], [1, 1, 1, 2], [2, 2, 2, 3], [3, 3, 3, 4], [4, 4, 4, 5], [5, 5, 5, 0], []],
    modifiers: [],
    par: 6,
    seed: "chapter-3-level-26",
  },
  {
    id: 27,
    chapter: 3,
    capacity: 4,
    dockCount: 2,
    tracks: [[0, 0, 1, 2], [1, 1, 2, 3], [2, 2, 3, 4], [3, 3, 4, 5], [4, 4, 5, 0], [5, 5, 0, 1], []],
    modifiers: [{ trackId: 4, mode: "frozen", frozenUntilColor: 1 }],
    par: 14,
    seed: "chapter-3-level-27",
  },
  {
    id: 28,
    chapter: 3,
    capacity: 4,
    dockCount: 2,
    tracks: [[0, 0, 1, 2], [1, 1, 2, 3], [2, 2, 3, 4], [3, 3, 4, 5], [4, 4, 5, 0], [5, 5, 0, 1], []],
    modifiers: [{ trackId: 4, mode: "frozen", frozenUntilColor: 2 }],
    par: 14,
    seed: "chapter-3-level-28",
  },
  {
    id: 29,
    chapter: 3,
    capacity: 4,
    dockCount: 2,
    tracks: [[0, 0, 0, 1], [1, 1, 1, 2], [2, 2, 2, 3], [3, 3, 3, 4], [4, 4, 4, 5], [5, 5, 5, 0], []],
    modifiers: [],
    par: 6,
    seed: "chapter-3-level-29",
  },
  {
    id: 30,
    chapter: 3,
    capacity: 4,
    dockCount: 2,
    tracks: [[0, 0, 1, 3], [1, 1, 2, 4], [2, 2, 3, 5], [3, 3, 4, 0], [4, 4, 5, 1], [5, 5, 0, 2], []],
    modifiers: [{ trackId: 5, mode: "frozen", frozenUntilColor: 4 }],
    par: 15,
    seed: "chapter-3-level-30",
  },
];

const BASE_LEVELS = ALL_LEVELS.slice(0, 7);

export const CHAPTERS = Object.freeze([
  { id: 1, title: "晨星港", description: "在冰蓝晨光中熟悉星核调度", theme: "aurora", difficulties: [1, 2, 1, 3, 2, 3, 2, 4, 3, 2, 4, 3, 1, 4, 2, 3, 4, 2, 4, 3] },
  { id: 2, title: "赤沙航道", description: "穿越恒星尘暴，控制更紧的缓冲空间", theme: "ember", difficulties: [2, 3, 2, 4, 3, 5, 3, 4, 2, 5, 4, 3, 5, 4, 3, 5, 4, 2, 5, 4] },
  { id: 3, title: "翡翠星云", description: "在生命星云中识别更复杂的颜色秩序", theme: "verdant", difficulties: [3, 4, 5, 3, 5, 4, 6, 4, 5, 3, 6, 5, 4, 6, 5, 4, 6, 3, 6, 5] },
  { id: 4, title: "紫晶裂隙", description: "跨越高能裂隙，应对更长的调度链", theme: "violet", difficulties: [4, 5, 6, 4, 6, 5, 7, 5, 6, 4, 7, 6, 5, 7, 6, 5, 7, 4, 7, 6] },
  { id: 5, title: "深空王座", description: "在终局星海中完成最高密度的星轨调度", theme: "abyss", difficulties: [5, 6, 7, 5, 7, 6, 5, 7, 6, 7, 5, 7, 6, 7, 5, 6, 7, 6, 7, 7] },
]);

function permutation(size, seed) {
  const values = Array.from({ length: size }, (_, index) => index);
  let state = seed >>> 0;
  for (let index = values.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const target = state % (index + 1);
    [values[index], values[target]] = [values[target], values[index]];
  }
  return values;
}

function campaignLevel(chapter, chapterIndex, id, salt = 0) {
  const difficulty = chapter.difficulties[chapterIndex];
  const source = BASE_LEVELS[difficulty - 1];
  const nonEmptyTracks = source.tracks.filter((track) => track.length > 0);
  const colorCount = Math.max(...nonEmptyTracks.flat()) + 1;
  const colorOrder = permutation(colorCount, id * 4099 + chapter.id * 131 + salt * 104729);
  const trackOrder = permutation(nonEmptyTracks.length, id * 7919 + chapterIndex * 313 + salt * 130363);
  const tracks = trackOrder.map((trackIndex) => nonEmptyTracks[trackIndex].map((color) => colorOrder[color]));
  tracks.push([]);
  return Object.freeze({
    id,
    chapter: chapter.id,
    chapterIndex: chapterIndex + 1,
    theme: chapter.theme,
    difficulty,
    capacity: source.capacity,
    dockCount: source.dockCount,
    tracks,
    modifiers: [],
    par: source.par,
    seed: `campaign-v1-c${chapter.id}-l${chapterIndex + 1}-d${difficulty}-v${salt}`,
    sourceLevelId: source.id,
  });
}

// 100 关由 7 个精确求解母题做颜色与轨道的等价变换生成。
// 变换保持可解性与最优 par，同时让每章按独立的波浪难度曲线组织。
function buildCampaign() {
  const used = new Set();
  const levels = [];
  for (const chapter of CHAPTERS) {
    for (let index = 0; index < chapter.difficulties.length; index += 1) {
      const id = (chapter.id - 1) * 20 + index + 1;
      let salt = 0;
      let level;
      let signature;
      do {
        level = campaignLevel(chapter, index, id, salt);
        signature = JSON.stringify([level.capacity, level.dockCount, level.tracks]);
        salt += 1;
      } while (used.has(signature));
      used.add(signature);
      levels.push(level);
    }
  }
  return levels;
}

export const LEVELS = Object.freeze(buildCampaign());

export function levelById(levelId) {
  return LEVELS.find((level) => level.id === levelId) ?? null;
}

export function createLevelState(level) {
  const modifiersByTrack = new Map(level.modifiers.map((modifier) => [modifier.trackId, modifier]));
  const tracks = level.tracks.map((orbs, trackId) => {
    const modifier = modifiersByTrack.get(trackId);
    if (!modifier) return orbs;
    return {
      orbs,
      mode: modifier.mode,
      ...(modifier.frozenUntilColor === undefined
        ? {}
        : { frozenUntilColor: modifier.frozenUntilColor }),
    };
  });
  return createState({ ...level, tracks, levelSeed: level.seed ?? null });
}
