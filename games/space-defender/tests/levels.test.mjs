import test from "node:test";
import assert from "node:assert/strict";

import {
  TOTAL_WAVES,
  SECTOR_COUNT,
  WAVES_PER_SECTOR,
  waveSpec,
  survivalSpec,
  rushSpec,
  sectorOf,
  isBossWave,
  ENEMY_TYPES,
  SECTORS,
} from "../js/levels.mjs";

test("levels: 30 waves across 5 sectors, one mothership per sector end", () => {
  assert.equal(TOTAL_WAVES, 30);
  assert.equal(SECTOR_COUNT, 5);
  for (let i = 0; i < TOTAL_WAVES; i += 1) {
    const spec = waveSpec(i);
    assert.equal(spec.index, i);
    assert.equal(spec.boss, isBossWave(i));
    assert.equal(spec.sector, sectorOf(i).id);
    if (spec.boss) {
      assert.ok(spec.bossHp > 0);
      assert.equal(spec.rows, 0);
    } else {
      assert.ok(spec.rows >= 3);
      assert.equal(spec.types.length, spec.rows);
      assert.ok(spec.cols >= 6);
    }
    assert.ok(spec.par > 0);
    assert.ok(spec.maxDivers >= 2 && spec.maxDivers <= 5, "俯冲上限必须在 2~5 之间");
    assert.ok(spec.bulletBudget > 0 && spec.bulletBudget <= 13, "弹幕预算必须有上限");
  }
  for (let s = 0; s < SECTOR_COUNT; s += 1) {
    assert.equal(waveSpec(s * WAVES_PER_SECTOR + WAVES_PER_SECTOR - 1).boss, true);
  }
});

test("levels: enemy roster is complete and captors only appear with the capture flag", () => {
  for (const id of ["wasp", "falcon", "crab", "queen"]) {
    assert.ok(ENEMY_TYPES[id], `${id} 缺失`);
    assert.ok(ENEMY_TYPES[id].hp > 0 && ENEMY_TYPES[id].score > 0);
  }
  assert.equal(ENEMY_TYPES.queen.captor, true);
  assert.equal(ENEMY_TYPES.falcon.diver, true);
  for (const sector of SECTORS) {
    const hasCaptor = sector.rows.some((row) => row.some((id) => ENEMY_TYPES[id].captor));
    assert.equal(sector.capture, hasCaptor, "俘获机制与皇蜂出场必须一致");
  }
});

test("levels: difficulty ramps monotonically inside a sector", () => {
  for (let s = 0; s < SECTOR_COUNT; s += 1) {
    let prevSpeed = 0;
    for (let slot = 0; slot < WAVES_PER_SECTOR - 1; slot += 1) {
      const spec = waveSpec(s * WAVES_PER_SECTOR + slot);
      assert.ok(spec.speed >= prevSpeed);
      prevSpeed = spec.speed;
    }
  }
});

test("levels: survival extrapolates without exploding", () => {
  for (const wave of [0, 7, 29, 30, 61, 120]) {
    const spec = survivalSpec(wave);
    assert.ok(spec.speed > 0 && Number.isFinite(spec.speed));
    assert.ok(spec.bulletBudget <= 15);
    assert.ok(spec.par > 0);
  }
});

test("levels: rush is five boss stages of rising toughness", () => {
  let prev = 0;
  for (let i = 0; i < SECTOR_COUNT; i += 1) {
    const spec = rushSpec(i);
    assert.equal(spec.boss, true);
    assert.ok(spec.bossHp > prev);
    prev = spec.bossHp;
  }
});
