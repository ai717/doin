// render.test.mjs — 斜俯视 2.5D 投影的纯几何契约（不依赖 DOM，可在 Node 直接验证）
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  VIEW, VIEW_W, VIEW_H, TILT, VERT, PERSP, COIN_THICK,
  computeViewport, worldToScreen, screenToWorld, depthScale, projectedBounds, viewAspect,
  dropHeightRatio, CHUTE_LIFT, PLATE_H, BACK_H, WALL_H, RAIL_H, TOWER_THICK, STACK_MAX,
  launchArcHeight, LAUNCH_ARC_MAX
} from "../js/render.mjs";
import {
  FIELD_W, FIELD_H, PUSHER_EXTEND, CHUTE_Y0, COIN_R, GUTTER, PEG_Y0, PEG_ROWS, PEG_ROW_GAP,
  LAUNCH_SPEED, LAUNCH_AIR, DROP_GRAVITY
} from "../js/engine.mjs";

const CORNERS = [
  [VIEW.x0, VIEW.y0], [VIEW.x1, VIEW.y0], [VIEW.x0, VIEW.y1], [VIEW.x1, VIEW.y1]
];

describe("render: 投影参数自洽", () => {
  it("俯角分解自洽：TILT = sin，VERT = cos，两者平方和为 1", () => {
    assert.ok(TILT > 0 && TILT < 1, `TILT 应在 (0,1)，实际 ${TILT}`);
    assert.ok(Math.abs(TILT * TILT + VERT * VERT - 1) < 1e-12, "sin²+cos² 必须为 1");
  });

  it("纵深压缩：地面纵深按 TILT 压缩，立面高度按 VERT 压缩（立面比地面高）", () => {
    assert.ok(VERT > TILT, "立面压缩系数必须大于地面压缩系数，否则机台会塌成平板");
  });

  it("透视：y 越大（越靠近观众）深度系数越大", () => {
    assert.ok(PERSP > 0);
    let prev = -Infinity;
    for (let y = VIEW.y0; y <= VIEW.y1; y += 0.5) {
      const k = depthScale(y);
      assert.ok(k > prev, `depthScale 必须随 y 单调递增，y=${y}`);
      prev = k;
    }
    assert.ok(Math.abs(depthScale(VIEW.y0) - (1 - PERSP / 2)) < 1e-12);
    assert.ok(Math.abs(depthScale(VIEW.y1) - (1 + PERSP / 2)) < 1e-12);
  });

  it("世界视窗覆盖整块台面并留出后墙与前方托盘", () => {
    assert.equal(VIEW.x0, 0);
    assert.equal(VIEW.x1, FIELD_W);
    assert.ok(VIEW.y0 < 0, "后墙应在 y=0 之上");
    assert.ok(VIEW.y1 > FIELD_H, "出币滑道与托盘应在边缘线之下");
    assert.equal(VIEW_W, FIELD_W);
    assert.equal(VIEW_H, VIEW.y1 - VIEW.y0);
  });
});

describe("render: 等比适配", () => {
  it("与投影包围盒同比时铺满且无偏移", () => {
    const b = projectedBounds();
    const v = computeViewport(b.w * 60, b.h * 60);
    assert.ok(Math.abs(v.scale - 60) < 1e-9);
    assert.ok(Math.abs(v.ox) < 1e-9);
    assert.ok(Math.abs(v.oy) < 1e-9);
  });

  it("画布更宽时左右居中、上下贴边", () => {
    const b = projectedBounds();
    const v = computeViewport(b.w * 60 + 240, b.h * 60);
    assert.ok(Math.abs(v.scale - 60) < 1e-9);
    assert.ok(Math.abs(v.ox - 120) < 1e-9);
    assert.ok(Math.abs(v.oy) < 1e-9);
  });

  it("画布更高时上下居中", () => {
    const b = projectedBounds();
    const v = computeViewport(b.w * 60, b.h * 60 + 300);
    assert.ok(Math.abs(v.scale - 60) < 1e-9);
    assert.ok(Math.abs(v.ox) < 1e-9);
    assert.ok(Math.abs(v.oy - 150) < 1e-9);
  });

  it("非法尺寸回落投影包围盒，不产生 NaN", () => {
    for (const bad of [0, -10, NaN, undefined, null]) {
      const v = computeViewport(bad, bad);
      assert.ok(Number.isFinite(v.scale) && v.scale > 0);
      assert.ok(Number.isFinite(v.ox) && Number.isFinite(v.oy));
    }
  });

  it("视窗四角映射后全部落在画布内（任意画布尺寸）", () => {
    for (const [w, h] of [[780, 565], [1000, 700], [780, 1200], [420, 300], [1440, 900], [390, 253]]) {
      const v = computeViewport(w, h);
      for (const [x, y] of CORNERS) {
        const p = worldToScreen(v, x, y);
        assert.ok(p.x >= -1e-6 && p.x <= w + 1e-6, `x=${p.x} 越界 (${w}x${h})`);
        assert.ok(p.y >= -1e-6 && p.y <= h + 1e-6, `y=${p.y} 越界 (${w}x${h})`);
      }
    }
  });

  it("viewAspect 与投影包围盒一致（CSS aspect-ratio 的取值来源）", () => {
    const b = projectedBounds();
    assert.ok(Math.abs(viewAspect() - b.w / b.h) < 1e-12);
    // 竖向刻意拉高（机顶灯箱 / 投币滑道 / 挡杆帘 / 落币竖井 / 托盘都要进画），
    // 因此只要求「仍偏横向」而不设过高的下界。
    assert.ok(viewAspect() > 1.0 && viewAspect() < 1.8, `斜俯视机台窗口应偏横向，实际 ${viewAspect()}`);
  });
});

describe("render: 坐标往返", () => {
  it("worldToScreen ∘ screenToWorld = identity", () => {
    const v = computeViewport(1000, 900);
    for (const [x, y] of [[0, -3], [0, 0], [6.5, 5.5], [13, 11], [2.35, 9.87], [-0.5, 14.1], [13, 14]]) {
      const p = worldToScreen(v, x, y);
      const back = screenToWorld(v, p.x, p.y);
      assert.ok(Math.abs(back.x - x) < 1e-9, `${x} → ${back.x}`);
      assert.ok(Math.abs(back.y - y) < 1e-9, `${y} → ${back.y}`);
    }
  });

  it("台面中轴线映射到画布中轴（透视不得把台面推偏）", () => {
    const v = computeViewport(780, 565);
    for (const y of [VIEW.y0, 0, FIELD_H / 2, FIELD_H, VIEW.y1]) {
      const p = worldToScreen(v, FIELD_W / 2, y);
      assert.ok(Math.abs(p.x - 390) < 1e-9, `y=${y} 中轴偏移到 ${p.x}`);
    }
  });

  it("纵向单调：y 越大屏幕越靠下", () => {
    const v = computeViewport(780, 565);
    let prev = -Infinity;
    for (let y = VIEW.y0; y <= VIEW.y1; y += 0.25) {
      const p = worldToScreen(v, 6.5, y);
      assert.ok(p.y > prev, `y=${y} 未单调`);
      prev = p.y;
    }
  });

  it("透视生效：同一世界宽度在近端比远端宽", () => {
    const v = computeViewport(780, 565);
    const farL = worldToScreen(v, VIEW.x0, VIEW.y0);
    const farR = worldToScreen(v, VIEW.x1, VIEW.y0);
    const nearL = worldToScreen(v, VIEW.x0, VIEW.y1);
    const nearR = worldToScreen(v, VIEW.x1, VIEW.y1);
    assert.ok((nearR.x - nearL.x) > (farR.x - farL.x), "近端台面必须比远端宽");
  });

  it("纵深压缩生效：等长世界纵深在屏幕上比等长世界宽度短", () => {
    const v = computeViewport(780, 565);
    const dx = worldToScreen(v, 6, 5).x - worldToScreen(v, 5, 5).x;
    const dy = worldToScreen(v, 6, 6).y - worldToScreen(v, 6, 5).y;
    assert.ok(dy < dx * 0.8, `纵深应被压缩（dy=${dy} 应明显小于 dx=${dx}）`);
    assert.ok(dy > 0, "纵深仍必须为正，否则画面上下颠倒");
  });

  it("金币可见厚度为正：圆柱壁必须真的占屏幕高度", () => {
    assert.ok(COIN_THICK > 0 && COIN_THICK < 0.5, `金币厚度比例应合理，实际 ${COIN_THICK}`);
  });

  it("边缘线 y=FIELD_H 落在画布内且位于台面后缘下方", () => {
    const v = computeViewport(780, 565);
    const lip = worldToScreen(v, 6.5, FIELD_H);
    const top = worldToScreen(v, 6.5, 0);
    assert.ok(lip.y > top.y, "边缘线必须在台面后缘下方");
    assert.ok(lip.y < 565);
  });
});

describe("render: 投币通道高度曲线（币与挡杆共用同一条曲线）", () => {
  it("投币口处最高（比值 1），落到推板前缘时贴台面（比值 0）", () => {
    assert.ok(Math.abs(dropHeightRatio(CHUTE_Y0) - 1) < 1e-12, "出口处应满高");
    const land = PUSHER_EXTEND + COIN_R;
    assert.ok(Math.abs(dropHeightRatio(land)) < 1e-12, "落地线处应贴台面");
    assert.equal(dropHeightRatio(land + 3), 0, "越过落地线后恒为 0");
    assert.equal(dropHeightRatio(CHUTE_Y0 - 5), 1, "投币口之上恒为 1（不得出现负高度）");
  });

  it("单调不增，且全程有限", () => {
    let prev = Infinity;
    for (let y = CHUTE_Y0 - 1; y <= PUSHER_EXTEND + COIN_R + 1; y += 0.05) {
      const v = dropHeightRatio(y);
      assert.ok(Number.isFinite(v) && v >= 0 && v <= 1, `y=${y} 高度比越界 ${v}`);
      assert.ok(v <= prev + 1e-12, `y=${y} 高度比回升`);
      prev = v;
    }
  });

  it("挡杆阵整段都处在通道高度上（杆必须真的挡在币的路径里，不能埋进台面）", () => {
    const bottom = PEG_Y0 + (PEG_ROWS - 1) * PEG_ROW_GAP;
    assert.ok(bottom < PUSHER_EXTEND + COIN_R, "挡杆阵必须在落地线之上，否则币已经贴台面了还在撞杆");
    for (let r = 0; r < PEG_ROWS; r++) {
      const y = PEG_Y0 + r * PEG_ROW_GAP;
      assert.ok(dropHeightRatio(y) > 0.05, `第 ${r + 1} 排挡杆几乎贴在台面上（比值 ${dropHeightRatio(y)}）`);
    }
  });

  it("通道比推板立面高：飞行中的币画在推板之上，不会被金属板盖住", () => {
    assert.ok(CHUTE_LIFT > PLATE_H, `CHUTE_LIFT ${CHUTE_LIFT} 必须大于推板立面 ${PLATE_H}`);
  });

  it("立面高度次序合理：后墙 ≥ 侧壁 > 推板 > 沟槽挡边", () => {
    assert.ok(BACK_H >= WALL_H);
    assert.ok(WALL_H > PLATE_H);
    assert.ok(PLATE_H > RAIL_H);
    assert.ok(RAIL_H > 0);
  });

  it("金塔比普通币厚，叠币抬升有上限", () => {
    assert.ok(TOWER_THICK > COIN_THICK);
    assert.ok(STACK_MAX > 0 && STACK_MAX < 0.6, "叠币抬升过大会让币飘出台面");
  });

  it("沟槽带落在视窗内（否则沟槽画不出来）", () => {
    assert.ok(GUTTER > 0 && GUTTER < FIELD_W / 2);
    const v = computeViewport(780, 565);
    assert.ok(worldToScreen(v, GUTTER, 5).x > 0);
    assert.ok(worldToScreen(v, FIELD_W - GUTTER, 5).x < 780);
  });
});

describe("render: 腾空币高度 = 真实抛物线", () => {
  it("先升后落，两端贴台面，顶点 = v₀²/(2g)", () => {
    // h(t) = v₀t − ½g t²，t = LAUNCH_AIR − air。端点高度必须为 0，
    // 否则币会在"还在上升"时被按回台面 —— 一次可见的位置突跳（用户看到的"突然消失"）。
    assert.equal(launchArcHeight(LAUNCH_AIR), 0, "刚出手时应贴台面");
    assert.equal(launchArcHeight(0), 0, "即将落地时应贴台面");
    const mid = launchArcHeight(LAUNCH_AIR / 2);
    // 顶点用引擎设计常量算，不从被测函数反推
    const expected = (LAUNCH_SPEED * LAUNCH_SPEED) / (2 * DROP_GRAVITY);
    assert.ok(Math.abs(mid - expected) < 1e-9,
      `腾空最高点应为 ${expected.toFixed(3)}，实际 ${mid.toFixed(3)}`);
    assert.ok(Math.abs(LAUNCH_ARC_MAX - expected) < 1e-9, "导出的顶点常量与抛物线顶点不一致");
    // 上升段单调、全程非负、单峰。抛物线顶点恒在 t = v/g = 半个周期处，故以中点分段。
    let prev = -1;
    let sawDescent = false;
    for (let k = 0; k <= 40; k++) {
      const h = launchArcHeight((LAUNCH_AIR * k) / 40);
      assert.ok(h >= 0, "抛物线高度不得为负");
      if (k <= 20) {
        assert.ok(h >= prev - 1e-9, `上升段必须单调（k=${k}）`);
      } else if (k >= 21) {
        assert.ok(h <= prev + 1e-9, `下降段必须单调（k=${k}）`);
        sawDescent = true;
      }
      prev = h;
    }
    assert.ok(sawDescent, "必须有下降段（否则就是匀速上漂，不是抛物线）");
  });
});
