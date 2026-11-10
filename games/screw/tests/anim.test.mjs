import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FALL_GRAVITY,
  createPlateFall,
  stepPlateFall,
  swingTargetAngle,
  createScrewFlight,
  stepScrewFlight,
  easeOutCubic,
} from '../js/anim.mjs';

function fallEvent() {
  return {
    plateId: 'a',
    layer: 2,
    material: 'wood',
    shape: 'bar',
    tone: 0,
    cells: [{ c: 0, r: 0 }, { c: 1, r: 0 }],
  };
}

test('anim: plate fall follows fixed gravity and eventually finishes', () => {
  let fall = createPlateFall(fallEvent());
  assert.equal(fall.vy, 0);
  let steps = 0;
  while (!fall.done && steps < 600) {
    fall = stepPlateFall(fall, 1 / 60);
    steps += 1;
  }
  assert.ok(fall.done);
  assert.ok(fall.vy > FALL_GRAVITY * 0.1);
  assert.ok(fall.y > 100);
  assert.ok(fall.alpha <= 1);
});

test('anim: fall stepping is deterministic', () => {
  let a = createPlateFall(fallEvent(), 0.4);
  let b = createPlateFall(fallEvent(), 0.4);
  for (let i = 0; i < 40; i += 1) {
    a = stepPlateFall(a, 1 / 60);
    b = stepPlateFall(b, 1 / 60);
  }
  assert.deepEqual(a, b);
});

test('anim: hinge swings toward the side of the centroid', () => {
  assert.ok(swingTargetAngle({ c: 4, r: 2 }, { c: 2, r: 2 }) > 0);
  assert.ok(swingTargetAngle({ c: 1, r: 2 }, { c: 3, r: 2 }) < 0);
});

test('anim: screw flight follows an arc and lands at its target', () => {
  let flight = createScrewFlight({ from: { x: 100, y: 300 }, to: { x: 500, y: 60 }, color: 'red' });
  let steps = 0;
  while (!flight.done && steps < 200) {
    flight = stepScrewFlight(flight, 1 / 60);
    steps += 1;
  }
  assert.ok(flight.done);
  assert.equal(flight.t, 1);
  assert.ok(Math.abs(flight.x - 500) < 0.001);
  assert.ok(Math.abs(flight.y - 60) < 0.001);
  assert.equal(easeOutCubic(0), 0);
  assert.equal(easeOutCubic(1), 1);
});
