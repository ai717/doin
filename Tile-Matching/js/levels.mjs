// 生成 50 关科学梯度的波浪难度配置
function generate50Levels() {
  const levels = [];

  for (let i = 1; i <= 50; i++) {
    // 基础参数计算：颜色数从 4 色平滑过渡至 6 色
    let colors = 4;
    if (i > 8) colors = 5;
    if (i > 24) colors = 6;

    // 波浪起伏难度模式：每 5 关一个周期，周期末为挑战关，下一个周期开端适当减压
    const cyclePhase = (i - 1) % 5; // 0, 1, 2, 3, 4
    const cycleIndex = Math.floor((i - 1) / 5);

    // 步数设计：初期步数宽裕（26-30步），随关卡推进逐渐收紧（18-24步）
    let baseMoves = Math.max(18, 30 - cycleIndex * 1.2);
    // 周期内微调
    if (cyclePhase === 4) {
      baseMoves = Math.max(16, baseMoves - 3); // 挑战关紧凑步数
    } else if (cyclePhase === 0 && i > 1) {
      baseMoves += 2; // 周期开端释放压力
    }
    const moves = Math.round(baseMoves);

    // 目标设置：1~2种目标逐渐过渡到 3~4 种目标
    let goalCount = 2;
    if (i > 12) goalCount = 3;
    if (i > 30) goalCount = 4;

    // 挑选本关的目标颜色（避免连续关卡目标重复）
    const chosenColors = [];
    const colorPool = Array.from({ length: colors }, (_, idx) => idx + 1);
    // 固定伪随机挑选
    for (let g = 0; g < goalCount; g++) {
      const pickIdx = (i * 2 + g * 3) % colorPool.length;
      chosenColors.push(colorPool.splice(pickIdx, 1)[0]);
    }

    // 计算每个目标的消除数量（随关卡缓慢增长，波浪起伏）
    const baseTargetNum = 12 + Math.floor(i * 0.45) + (cyclePhase === 4 ? 4 : 0);
    const goals = {};
    chosenColors.forEach((c) => {
      // 目标数量错开 2-4 颗，更具策略节奏感
      const offset = (c * 2) % 5;
      goals[c] = Math.max(12, baseTargetNum + offset);
    });

    // 星级门槛：剩余步数评价
    const starThresholdMoves = [
      Math.max(2, Math.round(moves * 0.15)),
      Math.max(5, Math.round(moves * 0.35)),
      Math.max(8, Math.round(moves * 0.55))
    ];

    // 描述生成
    const descZh = cyclePhase === 4
      ? `关卡 ${i} [高难挑战]：紧凑步数，合理合成火箭与彩虹突破！`
      : `关卡 ${i}：收集指定元素的能量晶石以通关。`;
    const descEn = cyclePhase === 4
      ? `Level ${i} [Challenger]: Tight moves, forge special gems to clear!`
      : `Level ${i}: Gather the required elemental crystals.`;

    levels.push({
      id: i,
      moves,
      colors,
      goals,
      starThresholdMoves,
      descZh,
      descEn
    });
  }

  return levels;
}

export const LEVEL_CONFIGS = generate50Levels();

export function getLevelConfig(levelId) {
  const cfg = LEVEL_CONFIGS.find((l) => l.id === levelId);
  return cfg || LEVEL_CONFIGS[0];
}
