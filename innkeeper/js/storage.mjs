/**
 * 中华客栈 · 跑堂点菜 (Inn Master)
 * 存档管理 (集中 try/catch 降级内存, 稳健校验)
 */

const STORAGE_KEY = "doin.innkeeper.v1";

const DEFAULT_RECORD = {
  version: 1,
  totalSilver: 0,
  unlockedShifts: ["shift_lunch"],
  bestScores: {
    shift_lunch: 0,
    shift_dinner: 0,
    shift_night: 0,
    shift_fair: 0,
  },
  stars: {
    shift_lunch: 0,
    shift_dinner: 0,
    shift_night: 0,
    shift_fair: 0,
  },
  upgrades: {
    tray: false,
    kettle: false,
    helper: false,
  },
  soundEnabled: true,
};

let memoryStore = null;

function getStore() {
  if (memoryStore) return memoryStore;
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        memoryStore = normalizeRecord(parsed);
        return memoryStore;
      }
    }
  } catch (err) {
    // Degrade gracefully to memory
  }
  memoryStore = { ...DEFAULT_RECORD };
  return memoryStore;
}

export function normalizeRecord(raw) {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_RECORD };
  }

  const validShifts = ["shift_lunch", "shift_dinner", "shift_night", "shift_fair"];
  const unlocked = Array.isArray(raw.unlockedShifts)
    ? raw.unlockedShifts.filter((s) => validShifts.includes(s))
    : ["shift_lunch"];
  if (!unlocked.includes("shift_lunch")) {
    unlocked.unshift("shift_lunch");
  }

  const bestScores = { ...DEFAULT_RECORD.bestScores };
  if (raw.bestScores && typeof raw.bestScores === "object") {
    for (const key of validShifts) {
      if (typeof raw.bestScores[key] === "number" && raw.bestScores[key] >= 0) {
        bestScores[key] = Math.floor(raw.bestScores[key]);
      }
    }
  }

  const stars = { ...DEFAULT_RECORD.stars };
  if (raw.stars && typeof raw.stars === "object") {
    for (const key of validShifts) {
      if (typeof raw.stars[key] === "number" && raw.stars[key] >= 0 && raw.stars[key] <= 3) {
        stars[key] = Math.floor(raw.stars[key]);
      }
    }
  }

  const upgrades = {
    tray: Boolean(raw.upgrades?.tray),
    kettle: Boolean(raw.upgrades?.kettle),
    helper: Boolean(raw.upgrades?.helper),
  };

  return {
    version: 1,
    totalSilver: typeof raw.totalSilver === "number" && raw.totalSilver >= 0 ? Math.floor(raw.totalSilver) : 0,
    unlockedShifts: unlocked,
    bestScores,
    stars,
    upgrades,
    soundEnabled: raw.soundEnabled !== undefined ? Boolean(raw.soundEnabled) : true,
  };
}

export function saveRecord(patch = {}) {
  const current = getStore();
  const next = normalizeRecord({ ...current, ...patch });
  memoryStore = next;

  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  } catch (err) {
    // Degrade silently
  }
  return next;
}

export function loadRecord() {
  return getStore();
}

export function recordShiftResult(shiftId, silver, starsEarned) {
  const current = getStore();
  const prevBest = current.bestScores[shiftId] || 0;
  const newBest = Math.max(prevBest, silver);

  const prevStars = current.stars[shiftId] || 0;
  const newStars = Math.max(prevStars, starsEarned);

  const unlocked = [...current.unlockedShifts];
  if (starsEarned >= 1) {
    if (shiftId === "shift_lunch" && !unlocked.includes("shift_dinner")) {
      unlocked.push("shift_dinner");
    } else if (shiftId === "shift_dinner" && !unlocked.includes("shift_night")) {
      unlocked.push("shift_night");
    } else if (shiftId === "shift_night" && !unlocked.includes("shift_fair")) {
      unlocked.push("shift_fair");
    }
  }

  return saveRecord({
    totalSilver: current.totalSilver + silver,
    unlockedShifts: unlocked,
    bestScores: { ...current.bestScores, [shiftId]: newBest },
    stars: { ...current.stars, [shiftId]: newStars },
  });
}

export function buyUpgrade(upgradeKey, cost) {
  const current = getStore();
  if (current.totalSilver < cost || current.upgrades[upgradeKey]) {
    return false;
  }
  saveRecord({
    totalSilver: current.totalSilver - cost,
    upgrades: { ...current.upgrades, [upgradeKey]: true },
  });
  return true;
}
