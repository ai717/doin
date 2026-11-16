// 3D 骰子画布渲染器：零外部依赖、100% 纯 Canvas 物理光影与等轴三维投影。
// 彻底杜绝 CSS 3D 上下文在 Chromium/WebKit 中被压平、Z-buffer 失效与旋转畸变问题。
// 支持：初始 Face 1 大红心展示、1.1s 三段物理触台反弹翻滚、动态地面阴影、空闲呼吸浮动。

const S = 27; // 骰子立方体半边长（宽 54px）

// 立方体 8 个三维顶点
const VERTICES = [
  [-S, -S,  S], [ S, -S,  S], [ S,  S,  S], [-S,  S,  S], // 0, 1, 2, 3: 前面 (+Z)
  [-S, -S, -S], [ S, -S, -S], [ S,  S, -S], [-S,  S, -S], // 4, 5, 6, 7: 后面 (-Z)
];

// 6 个面定义：点数、四个顶点索引、法线方向、局部 U 轴、局部 V 轴
const FACES = [
  { val: 1, idx: [0, 1, 2, 3], norm: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },     // 前面 1 点
  { val: 6, idx: [5, 4, 7, 6], norm: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },    // 后面 6 点
  { val: 2, idx: [1, 5, 6, 2], norm: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },    // 右面 2 点
  { val: 5, idx: [4, 0, 3, 7], norm: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },     // 左面 5 点
  { val: 3, idx: [4, 5, 1, 0], norm: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },    // 顶面 3 点
  { val: 4, idx: [3, 2, 6, 7], norm: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },    // 底面 4 点
];

// 各点数点位坐标（相对面局部坐标，范围 -1 ~ 1）
const PIPS = {
  1: [[0, 0]],
  2: [[-0.55, -0.55], [0.55, 0.55]],
  3: [[-0.55, -0.55], [0, 0], [0.55, 0.55]],
  4: [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]],
  5: [[-0.55, -0.55], [0.55, -0.55], [0, 0], [-0.55, 0.55], [0.55, 0.55]],
  6: [[-0.55, -0.6], [0.55, -0.6], [-0.55, 0], [0.55, 0], [-0.55, 0.6], [0.55, 0.6]],
};

// 光照向量（从左上方投射，产生自然立体阴影）
const LIGHT_DIR = normalize([0.35, -0.85, 0.4]);

function deg2rad(d) {
  return (d * Math.PI) / 180;
}

function normalize([x, y, z]) {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

function multMat(A, B) {
  const res = Array(9).fill(0);
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      let sum = 0;
      for (let k = 0; k < 3; k += 1) sum += A[r * 3 + k] * B[k * 3 + c];
      res[r * 3 + c] = sum;
    }
  }
  return res;
}

function vecMul(M, [x, y, z]) {
  return [
    M[0] * x + M[1] * y + M[2] * z,
    M[3] * x + M[4] * y + M[5] * z,
    M[6] * x + M[7] * y + M[8] * z,
  ];
}

function eulerMat(rx, ry, rz = 0) {
  const cx = Math.cos(deg2rad(rx)), sx = Math.sin(deg2rad(rx));
  const cy = Math.cos(deg2rad(ry)), sy = Math.sin(deg2rad(ry));
  const cz = Math.cos(deg2rad(rz)), sz = Math.sin(deg2rad(rz));
  const Rx = [1, 0, 0,  0, cx, -sx,  0, sx, cx];
  const Ry = [cy, 0, sy,  0, 1, 0,  -sy, 0, cy];
  const Rz = [cz, -sz, 0,  sz, cz, 0,  0, 0, 1];
  return multMat(Rx, multMat(Ry, Rz));
}

// 基础桌面等轴视角：下俯 22°，偏转 24°
const BASE_CAMERA = eulerMat(-22, 24, 0);

// 各点数对齐正面的模型空间旋转
const FACE_MODEL_ROTS = {
  1: eulerMat(0, 0, 0),
  2: eulerMat(0, -90, 0),
  3: eulerMat(-90, 0, 0),
  4: eulerMat(90, 0, 0),
  5: eulerMat(0, 90, 0),
  6: eulerMat(0, 180, 0),
};

// 预计算 1~6 点落定时的基准三维朝向矩阵
const SETTLED_MATRICES = {};
for (let i = 1; i <= 6; i += 1) {
  SETTLED_MATRICES[i] = multMat(BASE_CAMERA, FACE_MODEL_ROTS[i]);
}

export function createDice3D(canvas, options = {}) {
  const ctx = canvas?.getContext("2d");
  if (!ctx) return null;

  let currentVal = 1;
  let currentMat = [...SETTLED_MATRICES[1]];
  let isRolling = false;
  let animId = null;
  let idleAnimId = null;
  let isIdle = false;

  const width = canvas.width || 160;
  const height = canvas.height || 160;
  const cx = width / 2;
  const cy = height / 2 + 2;

  function render(matrix, heightOffset = 0) {
    ctx.clearRect(0, 0, width, height);

    // 1. 绘制地面柔和投影（高度越高，阴影越小越淡）
    const shadowFactor = Math.max(0, 1 - heightOffset / 140);
    const sw = 40 * shadowFactor;
    const sh = 12 * shadowFactor;
    const sy = cy + 34;

    if (shadowFactor > 0.05) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, sy, Math.max(8, sw), Math.max(3, sh), 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 0, 0, ${0.48 * shadowFactor})`;
      ctx.filter = "blur(3px)";
      ctx.fill();
      ctx.restore();
    }

    // 2. 变换 8 个顶点并进行透视投影
    const projVerts = VERTICES.map((v) => {
      const [tx, ty, tz] = vecMul(matrix, v);
      return {
        x: cx + tx,
        y: cy + ty - heightOffset,
        z: tz,
      };
    });

    // 3. 计算可见面（法线 Z > 0）并按深度降序排序（画家算法）
    const visibleFaces = [];
    for (const face of FACES) {
      const norm = vecMul(matrix, face.norm);
      if (norm[2] > 0.02) {
        // 计算面几何中心深度
        const p0 = projVerts[face.idx[0]];
        const p1 = projVerts[face.idx[1]];
        const p2 = projVerts[face.idx[2]];
        const p3 = projVerts[face.idx[3]];
        const avgZ = (p0.z + p1.z + p2.z + p3.z) / 4;
        visibleFaces.push({ face, norm, avgZ, pts: [p0, p1, p2, p3] });
      }
    }
    visibleFaces.sort((a, b) => a.avgZ - b.avgZ);

    // 4. 逐面绘制实体与光泽
    for (const { face, norm, pts } of visibleFaces) {
      // 物理光照模型：环境光 + 漫反射定向光 + 微量高光
      const dot = norm[0] * LIGHT_DIR[0] + norm[1] * LIGHT_DIR[1] + norm[2] * LIGHT_DIR[2];
      const light = Math.max(0, Math.min(1, 0.58 + 0.42 * dot));

      // 象牙微黄润泽色系
      const r = Math.round(252 * light);
      const g = Math.round(246 * light);
      const b = Math.round(232 * light);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[1].x, pts[1].y);
      ctx.lineTo(pts[2].x, pts[2].y);
      ctx.lineTo(pts[3].x, pts[3].y);
      ctx.closePath();

      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fill();

      // 边框倒角立体微光线
      ctx.strokeStyle = `rgba(55, 42, 22, ${0.45 * light})`;
      ctx.lineWidth = 1.6;
      ctx.lineJoin = "round";
      ctx.stroke();

      // 5. 绘制该面上的骰子点数
      const faceCenter = [
        (pts[0].x + pts[1].x + pts[2].x + pts[3].x) / 4,
        (pts[0].y + pts[1].y + pts[2].y + pts[3].y) / 4,
      ];
      const uVec = vecMul(matrix, face.u);
      const vVec = vecMul(matrix, face.v);
      const pipList = PIPS[face.val] ?? [];
      const isRed = face.val === 1 || face.val === 4;

      for (const [pu, pv] of pipList) {
        const px = faceCenter[0] + (pu * uVec[0] + pv * vVec[0]) * 0.52 * S;
        const py = faceCenter[1] + (pu * uVec[1] + pv * vVec[1]) * 0.52 * S;

        const baseRad = face.val === 1 ? 7.6 : 4.4;

        ctx.beginPath();
        ctx.arc(px, py, baseRad, 0, Math.PI * 2);

        if (isRed) {
          // 经典国风红宝石圆点
          const grad = ctx.createRadialGradient(px - 1.5, py - 1.5, 0.5, px, py, baseRad);
          grad.addColorStop(0, "#ff4d4d");
          grad.addColorStop(0.5, "#d91414");
          grad.addColorStop(1, "#800808");
          ctx.fillStyle = grad;
        } else {
          // 极具质感的黑曜石圆点
          const grad = ctx.createRadialGradient(px - 1.2, py - 1.2, 0.5, px, py, baseRad);
          grad.addColorStop(0, "#4a3c28");
          grad.addColorStop(0.6, "#241c10");
          grad.addColorStop(1, "#0a0804");
          ctx.fillStyle = grad;
        }
        ctx.fill();

        // 点数凹坑高光边
        ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // 矩阵简易线性插值与正交归一化
  function blendMatrices(A, B, t) {
    const res = Array(9).fill(0);
    for (let i = 0; i < 9; i += 1) {
      res[i] = A[i] * (1 - t) + B[i] * t;
    }
    // Gram-Schmidt 归一化防止挤压变形
    let v0 = normalize([res[0], res[3], res[6]]);
    let v1 = [res[1], res[4], res[7]];
    const dot = v0[0] * v1[0] + v0[1] * v1[1] + v0[2] * v1[2];
    v1 = normalize([v1[0] - dot * v0[0], v1[1] - dot * v0[1], v1[2] - dot * v0[2]]);
    const v2 = [
      v0[1] * v1[2] - v0[2] * v1[1],
      v0[2] * v1[0] - v0[0] * v1[2],
      v0[0] * v1[1] - v0[1] * v1[0],
    ];
    return [v0[0], v1[0], v2[0],  v0[1], v1[1], v2[1],  v0[2], v1[2], v2[2]];
  }

  function show(val = 1) {
    currentVal = val;
    currentMat = [...(SETTLED_MATRICES[val] ?? SETTLED_MATRICES[1])];
    render(currentMat, 0);
  }

  function rollTo(targetVal, onComplete) {
    if (animId) cancelAnimationFrame(animId);
    stopIdle();
    isRolling = true;

    const duration = 1100; // 严格 1.1 秒完整多轴翻滚与三段弹跳过程
    const startTime = performance.now();
    const targetMat = SETTLED_MATRICES[targetVal] ?? SETTLED_MATRICES[1];

    // 生成随机起始剧烈翻滚旋转轴与角速度
    const randRx = 720 + Math.random() * 360;
    const randRy = 540 + Math.random() * 360;
    const randRz = 360 + Math.random() * 240;

    function frame(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);

      // 三段物理抛物线弹跳曲线：跃起 -> 落地反弹 1 -> 反弹 2 -> 停稳
      let h = 0;
      if (progress < 0.6) {
        // 第一阶段大抛物线跃起 (最高 68px)
        const p = progress / 0.6;
        h = Math.sin(p * Math.PI) * 68;
      } else if (progress < 0.85) {
        // 第二阶段小反弹 (最高 22px)
        const p = (progress - 0.6) / 0.25;
        h = Math.sin(p * Math.PI) * 22;
      } else if (progress < 0.98) {
        // 第三阶段微震颤 (最高 6px)
        const p = (progress - 0.85) / 0.13;
        h = Math.sin(p * Math.PI) * 6;
      } else {
        h = 0;
      }

      // 旋转过渡：前期高速多轴翻滚，后期平滑收敛到目标落定矩阵
      const tumbleWeight = Math.pow(1 - progress, 1.8);
      const curRx = randRx * tumbleWeight;
      const curRy = randRy * tumbleWeight;
      const curRz = randRz * tumbleWeight;
      const tumbleMat = eulerMat(curRx, curRy, curRz);
      const intermediate = multMat(targetMat, tumbleMat);

      render(intermediate, h);

      if (progress < 1) {
        animId = requestAnimationFrame(frame);
      } else {
        isRolling = false;
        animId = null;
        currentVal = targetVal;
        currentMat = [...targetMat];
        render(targetMat, 0);
        if (typeof onComplete === "function") onComplete(targetVal);
      }
    }

    animId = requestAnimationFrame(frame);
  }

  function startIdle() {
    if (isIdle || isRolling) return;
    isIdle = true;
    let t = 0;
    function loop() {
      if (!isIdle) return;
      t += 0.05;
      const h = Math.sin(t) * 4;
      render(currentMat, h);
      idleAnimId = requestAnimationFrame(loop);
    }
    idleAnimId = requestAnimationFrame(loop);
  }

  function stopIdle() {
    isIdle = false;
    if (idleAnimId) {
      cancelAnimationFrame(idleAnimId);
      idleAnimId = null;
    }
    render(currentMat, 0);
  }

  // 初始加载：立刻呈现 Face 1 大红心 3D 姿态
  show(1);

  return {
    show,
    rollTo,
    startIdle,
    stopIdle,
    get isRolling() {
      return isRolling;
    },
    get value() {
      return currentVal;
    },
  };
}
