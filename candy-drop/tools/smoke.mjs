// tools/smoke.mjs — 物理引擎冒烟：摆锤周期、能量守恒、切绳、弹性绳
import { createState, stepFrame, simulate, cutRopes, WORLD, GRAVITY, FIXED_DT } from "../js/engine.mjs";

function pendulum(len) {
  return {
    candy: [450 + len * 0.6, 120 + len * 0.8],
    ropes: [{ a: [450, 120], len }],
    stars: [],
    monster: { at: [450, 700] },
  };
}

// 1. 摆锤：单摆周期 T ≈ 2π√(L/g)（小角度）
{
  const L = 200;
  const s = createState(pendulum(L));
  // 从水平位置释放
  s.candy.x = 450 + L;
  s.candy.y = 120;
  s.candy.px = s.candy.x;
  s.candy.py = s.candy.y;
  let crossings = [];
  let prev = s.candy.x - 450;
  for (let i = 0; i < 1200; i += 1) {
    stepFrame(s, FIXED_DT);
    const cur = s.candy.x - 450;
    if (prev > 0 && cur <= 0) crossings.push(i * FIXED_DT);
    prev = cur;
  }
  const period = crossings.length > 1 ? (crossings[crossings.length - 1] - crossings[0]) / (crossings.length - 1) : 0;
  const ideal = 2 * Math.PI * Math.sqrt(L / GRAVITY);
  console.log(`摆锤 L=${L}: 实测半周期=${period.toFixed(3)}s 全周期≈${(period * 2).toFixed(3)}s 理论=${ideal.toFixed(3)}s`);
}

// 2. 摆幅衰减：10 秒后仍应有明显速度（不能阻尼过大）
{
  const s = createState(pendulum(200));
  s.candy.x = 650;
  s.candy.y = 120;
  simulate(s, 10);
  console.log(`10s 后速率=${Math.hypot(s.candy.vx, s.candy.vy).toFixed(1)} px/s，位置=(${s.candy.x.toFixed(0)},${s.candy.y.toFixed(0)})`);
}

// 3. 自由落体：切绳后应近似 g
{
  const s = createState(pendulum(200));
  s.candy.x = 450;
  s.candy.y = 320;
  cutRopes(s, [0]);
  simulate(s, 0.5);
  console.log(`自由落体 0.5s 后 vy=${s.candy.vy.toFixed(0)}（理论≈${(GRAVITY * 0.5).toFixed(0)}）y=${s.candy.y.toFixed(0)}`);
}

// 4. 弹性绳：静止拉伸量应接近设计值
{
  const stretch = 60;
  const s = createState({
    candy: [450, 200],
    ropes: [{ a: [450, 120], elastic: { rest: 80, stretch } }],
    stars: [],
    monster: { at: [450, 900] },
  });
  simulate(s, 6);
  const d = s.candy.y - 120;
  console.log(`弹性绳 rest=80 stretch=${stretch}：平衡长度=${d.toFixed(1)}（期望≈${80 + stretch}）`);
  cutRopes(s, [0]);
  console.log(`  切断后 vy=${s.candy.vy.toFixed(0)}（应向上为负，弹射）`);
}

// 5. 结束态 no-op
{
  const s = createState(pendulum(120));
  s.status = "won";
  const before = { ...s.candy };
  stepFrame(s, FIXED_DT);
  console.log(`终止态 no-op: ${s.candy.x === before.x && s.candy.y === before.y}`);
}
