// Volley Bombard — AI aim solver. Pure functions, DOM-free; imports engine constants.
// Strategy: virtual-shot simulation (same integrator constants as the real sim)
// across an angle/power/weapon grid, score = enemy damage - self damage, with
// per-level deterministic jitter (mulberry32 via state.rng) after the grid search.

import {
  WEAPON_SPECS, MUZZLES, SHELL_RADIUS, GRAVITY, WIND_ACCEL, SIM_DT,
  WORLD, GROUND, MIN_ANGLE, MAX_ANGLE, MAX_POWER, AI_ERROR, AI_POWER_ERROR,
  terrainHeightAt, initialVelocity,
} from "./engine.mjs";

function blastFalloff(dist, radius) {
  if (dist <= radius * 0.5) return 1;
  if (dist >= radius) return 0;
  return 1 - (dist - radius * 0.5) / (radius * 0.5);
}

function cloneTargets(state) {
  return {
    blocks: state.blocks.filter((b) => b.alive).map((b) => ({ ...b })),
    flags: state.flags.map((f) => ({ ...f })),
  };
}

// Virtual shot: integrate with wind against cloned targets, return damage report.
export function simulateShot(state, side, angleDeg, power, weaponId) {
  const spec = WEAPON_SPECS[weaponId] ?? WEAPON_SPECS.stone;
  const { vx, vy } = initialVelocity(state, side, angleDeg, power, weaponId);
  const targets = cloneTargets(state);
  const enemy = 1 - side;
  const shells = [
    {
      x: MUZZLES[side].x,
      y: MUZZLES[side].y,
      cvx: vx,
      cvy: vy,
      splitDone: weaponId !== "split",
      penetrated: false,
      pierceGrace: 0,
      dead: false,
    },
  ];
  const windAcc = state.wind * WIND_ACCEL;
  let enemyDamage = 0;
  let selfDamage = 0;
  let flagKilled = false;
  for (let step = 0; step < 1200 && shells.length > 0; step += 1) {
    for (let si = shells.length - 1; si >= 0; si -= 1) {
      const s = shells[si];
      if (s.dead) { shells.splice(si, 1); continue; }
      if (s.pierceGrace > 0) s.pierceGrace -= 1;
      const wasRising = s.cvy > 0;
      s.cvx += windAcc * spec.windMul * SIM_DT;
      s.cvy -= GRAVITY * spec.gravMul * SIM_DT;
      s.x += s.cvx * SIM_DT;
      s.y += s.cvy * SIM_DT;
      if (spec.split > 0 && !s.splitDone && wasRising && s.cvy <= 0) {
        s.splitDone = true;
        const speed = Math.hypot(s.cvx, s.cvy);
        const baseAng = Math.atan2(s.cvy, s.cvx);
        for (let k = -1; k <= 1; k += 1) {
          if (k === 0) continue;
          const ang = baseAng + k * (14 * Math.PI) / 180;
          shells.push({ x: s.x, y: s.y, cvx: Math.cos(ang) * speed, cvy: Math.sin(ang) * speed, splitDone: true, penetrated: false, pierceGrace: 0, dead: false });
        }
      }
      let hit = null;
      for (const block of targets.blocks) {
        if (!block.alive || s.pierceGrace > 0) continue;
        if (s.x + SHELL_RADIUS > block.x && s.x - SHELL_RADIUS < block.x + block.w && s.y + SHELL_RADIUS > block.y && s.y - SHELL_RADIUS < block.y + block.h) {
          hit = { kind: "block", block };
          break;
        }
      }
      if (!hit) {
        for (const flag of targets.flags) {
          if (flag.down) continue;
          if (s.x + SHELL_RADIUS > flag.x && s.x - SHELL_RADIUS < flag.x + flag.w && s.y + SHELL_RADIUS > flag.y && s.y - SHELL_RADIUS < flag.y + flag.h) {
            hit = { kind: "flag", flag };
            break;
          }
        }
      }
      const th = terrainHeightAt(state.profile, s.x);
      const terrainHit = s.y <= th || s.y <= GROUND;
      const cx = s.x;
      const cy = Math.max(s.y, th > 0 ? th : GROUND);
      if (hit && hit.kind === "block" && spec.drill > 0 && !s.penetrated) {
        s.penetrated = true;
        s.pierceGrace = 8;
        s.cvx *= 0.75;
        s.cvy *= 0.75;
        const applied = Math.min(hit.block.hp, spec.pierceDmg);
        hit.block.hp -= applied;
        if (hit.block.hp <= 0) hit.block.alive = false;
        if (hit.block.side === side) selfDamage += applied;
        else enemyDamage += applied;
        continue;
      }
      if (hit || (terrainHit && spec.sticky <= 0) || (terrainHit && spec.sticky > 0)) {
        let localEnemy = 0;
        let localSelf = 0;
        const directId = hit ? (hit.kind === "flag" ? `flag${hit.flag.side}` : hit.block.id) : null;
        for (const block of targets.blocks) {
          if (!block.alive) continue;
          let dmg = 0;
          if (spec.radius === 0) {
            if (directId === block.id) dmg = spec.dmg;
          } else {
            const d = Math.hypot(block.x + block.w / 2 - cx, block.y + block.h / 2 - cy);
            dmg = spec.dmg * blastFalloff(d, spec.radius);
          }
          const applied = Math.min(block.hp, Math.round(dmg));
          if (applied > 0) {
            block.hp -= applied;
            if (block.hp <= 0) block.alive = false;
            if (block.side === side) localSelf += applied;
            else localEnemy += applied;
          }
        }
        for (const flag of targets.flags) {
          if (flag.down) continue;
          let dmg = 0;
          if (spec.radius === 0) {
            if (directId === `flag${flag.side}`) dmg = spec.dmg;
          } else {
            const d = Math.hypot(flag.x + flag.w / 2 - cx, flag.y + flag.h / 2 - cy);
            dmg = spec.dmg * blastFalloff(d, spec.radius);
          }
          const applied = Math.min(flag.hp, Math.round(dmg));
          if (applied > 0) {
            flag.hp -= applied;
            if (flag.hp <= 0) { flag.down = true; if (flag.side === enemy) flagKilled = true; }
            if (flag.side === side) localSelf += applied;
            else localEnemy += applied;
          }
        }
        enemyDamage += localEnemy;
        selfDamage += localSelf;
        s.dead = true;
      } else if (s.x < -60 || s.x > WORLD.w + 60) {
        s.dead = true;
      }
    }
  }
  return { enemyDamage, selfDamage, flagKilled };
}

// Grid search + deterministic per-level error. Pure: only reads state.rng.
export function aiPlan(state, side = state.turn) {
  const level = state.aiLevel;
  let best = null;
  let bestScore = -Infinity;
  const enemyFlag = state.flags[1 - side];
  const flagCx = enemyFlag.x + enemyFlag.w / 2;
  for (let angle = 20; angle <= 85; angle += 2.5) {
    for (let power = 30; power <= 100; power += 5) {
      for (const weaponId of state.weapons) {
        const r = simulateShot(state, side, angle, power, weaponId);
        let score = r.enemyDamage * 2 - r.selfDamage * 1.5;
        if (r.flagKilled) score += 500;
        if (level === "master") {
          // favour shots landing near the flag column: load-bearing shatter
          score += r.enemyDamage * 0.5;
          if (Math.abs(flagCx - (enemyFlag.x + enemyFlag.w / 2)) < 60) score += 5;
        }
        if (score > bestScore) {
          bestScore = score;
          best = { angle, power, weapon: weaponId };
        }
      }
    }
  }
  if (!best) best = { angle: 45, power: 60, weapon: state.weapons[0] };
  const errA = AI_ERROR[level] ?? 4;
  const errP = AI_POWER_ERROR[level] ?? 6;
  const jitterA = (state.rng() * 2 - 1) * errA;
  const jitterP = (state.rng() * 2 - 1) * errP;
  return {
    angle: Math.max(MIN_ANGLE, Math.min(MAX_ANGLE, best.angle + jitterA)),
    power: Math.max(10, Math.min(MAX_POWER, best.power + jitterP)),
    weapon: best.weapon,
  };
}
