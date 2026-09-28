// 泡泡射手 · 存档单元测试
// 覆盖：坏数据归一化 / 隐私模式降级内存 / 往返读写一致 / 星级与残局集合净化
import test from "node:test";
import assert from "node:assert/strict";

const STORAGE_KEY = "doin.bobble.v1";

// 受控内存 localStorage（Node 无该全局）
globalThis.localStorage = (() => {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k)
  };
})();

const { loadSave, saveSave, clearSave, defaultSave, normalize, totalStars } = await import("../js/storage.mjs");

test("存档键统一为 doin.bobble.v1", () => {
  const mod = loadSave();
  assert.ok(mod);
  assert.equal(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"), null);
  saveSave(defaultSave());
  assert.ok(localStorage.getItem(STORAGE_KEY) !== null);
});

test("默认存档：解锁首关、完整预测线、音效开启", () => {
  const d = defaultSave();
  assert.equal(d.stageUnlocked, 1);
  assert.equal(d.aim, "extended");
  assert.equal(d.sound, true);
  assert.equal(d.assist, false);
  assert.deepEqual(d.stars, {});
  assert.deepEqual(d.puzzleSolved, []);
});

test("坏数据归一化：越界与类型错误全部回退安全值", () => {
  const raw = normalize({
    sound: "yes",
    aim: "ultra",
    assist: 1,
    stageUnlocked: 999,
    stars: { 3: 9, 40: 2, abc: 1 },
    puzzleSolved: [2, 2, 99, "5", -1],
    endlessShots: -20,
    endlessChain: "x",
    dailyDate: 1e12
  });
  assert.equal(raw.sound, true, "非布尔音效偏好回默认开启");
  assert.equal(raw.aim, "extended", "非法瞄准档回默认");
  assert.equal(raw.assist, false);
  assert.equal(raw.stageUnlocked, 30, "越界解锁关卡收敛到 30");
  assert.equal(raw.stars[3], 3, "星级收敛到 0~3");
  assert.ok(!(40 in raw.stars) && !("abc" in raw.stars), "非法关卡号剔除");
  assert.deepEqual(raw.puzzleSolved, [2, 5], "残局集合去重净化并排序");
  assert.equal(raw.endlessShots, 0);
  assert.equal(raw.endlessChain, 0);
});

test("往返读写一致", () => {
  const save = defaultSave();
  save.stageUnlocked = 7;
  save.stars = { 1: 3, 2: 2 };
  save.puzzleSolved = [1, 4, 9];
  save.endlessShots = 33;
  save.endlessChain = 12;
  save.endlessScore = 45678;
  save.dailyDate = 20260928;
  save.dailyShots = 19;
  save.dailyChain = 7;
  save.aim = "pro";
  saveSave(save);
  const back = loadSave();
  assert.deepEqual(back, save);
});

test("损坏 JSON 静默回默认，绝不抛错", () => {
  localStorage.setItem(STORAGE_KEY, "{not-json");
  const save = loadSave();
  assert.equal(save.stageUnlocked, 1);
});

test("localStorage 不可用时降级内存（不白屏）", async () => {
  const real = globalThis.localStorage;
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem() {
        throw new Error("denied");
      },
      setItem() {
        throw new Error("denied");
      },
      removeItem() {
        throw new Error("denied");
      }
    },
    configurable: true,
    writable: true
  });
  // 新实例重新探测后端，走内存兜底
  const fresh = await import("../js/storage.mjs?fresh=1");
  let loaded;
  assert.doesNotThrow(() => {
    loaded = fresh.loadSave();
  });
  assert.equal(loaded.stageUnlocked, 1);
  const save = fresh.defaultSave();
  save.stageUnlocked = 9;
  save.stars = { 1: 3 };
  assert.doesNotThrow(() => fresh.saveSave(save));
  assert.equal(fresh.loadSave().stageUnlocked, 9, "内存兜底应能往返读写");
  assert.doesNotThrow(() => fresh.clearSave());
  Object.defineProperty(globalThis, "localStorage", { value: real, configurable: true, writable: true });
});

test("清空存档后回到默认", () => {
  const save = defaultSave();
  save.stageUnlocked = 12;
  saveSave(save);
  clearSave();
  assert.equal(loadSave().stageUnlocked, 1);
});

test("总星数统计", () => {
  const save = defaultSave();
  save.stars = { 1: 3, 2: 2, 3: 1 };
  assert.equal(totalStars(save), 6);
  assert.equal(totalStars(defaultSave()), 0);
});
