// storage.mjs — calc24 存档唯一口径
// Key: doin.calc24.v1
// 损坏自动 normalize 退回默认，静默降级内存

import { getTotalChapters, getLevelsPerChapter, getClassicCount } from './engine.mjs';

const KEY = 'doin.calc24.v1';

const DEFAULT = {
  // 章节进度：{ chapterIdx: { levelIdx: { stars, steps } } }
  chapters: {},
  // 经典难题通关记录：{ idx: { stars, steps } }
  classic: {},
  // 当前选中关卡位置
  current: { mode: 'chapter', chapterIdx: 0, levelIdx: 0 },
};

function normalize(raw) {
  if (!raw || typeof raw !== 'object') return structuredClone(DEFAULT);
  const out = {
    chapters: raw.chapters && typeof raw.chapters === 'object' ? raw.chapters : {},
    classic: raw.classic && typeof raw.classic === 'object' ? raw.classic : {},
    current: {
      mode: raw.current?.mode === 'classic' ? 'classic' : 'chapter',
      chapterIdx: Number(raw.current?.chapterIdx) || 0,
      levelIdx: Number(raw.current?.levelIdx) || 0,
    },
  };
  return out;
}

let _memory = null;

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      _memory = normalize(parsed);
      return _memory;
    }
  } catch (e) { /* ignore */ }
  _memory = structuredClone(DEFAULT);
  return _memory;
}

export function save(data) {
  _memory = data;
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) { /* fallback to memory only */ }
}

export function updateLevelRecord({ mode, chapterIdx, levelIdx, idxInClassic, stars, steps }) {
  const data = load();
  if (mode === 'classic') {
    const key = String(idxInClassic);
    const existing = data.classic[key];
    if (!existing || stars > existing.stars || (stars === existing.stars && steps < existing.steps)) {
      data.classic[key] = { stars, steps };
    }
  } else {
    const ch = data.chapters[chapterIdx] || {};
    const existing = ch[levelIdx];
    if (!existing || stars > existing.stars || (stars === existing.stars && steps < existing.steps)) {
      ch[levelIdx] = { stars, steps };
    }
    data.chapters[chapterIdx] = ch;
  }
  save(data);
  return data;
}

export function clearAll() {
  try { localStorage.removeItem(KEY); } catch (e) {}
  _memory = structuredClone(DEFAULT);
}
