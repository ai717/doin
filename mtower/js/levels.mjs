/**
 * @file games/mtower/js/levels.mjs
 * 纯静态魔塔 50 层五大区域地图与关卡矩阵，零硬编码中文。
 * 包含完整 50 层巅峰战役与 25 层精炼速通赛制。
 */

import { CH, MONSTERS, ITEMS } from './data.mjs';

/**
 * 创建标准 11x11 地牢楼层模板
 */
function createFloorData(floorNum, act, theme, layoutRows, monsterMapping = {}, special = {}) {
  return {
    floor: floorNum,
    act, // 1~5
    theme, // 'dungeon' | 'corridor' | 'fortress' | 'lava' | 'apex'
    map: layoutRows.map((r) => r.padEnd(11, '#').slice(0, 11)),
    monsters: { ...monsterMapping },
    special,
  };
}

/**
 * 经典 50 层战役全景楼层生成器
 */
export function buildClassic50Floors() {
  const floors = [];

  for (let f = 1; f <= 50; f++) {
    const act = Math.min(5, Math.floor((f - 1) / 10) + 1);
    const theme = ['dungeon', 'corridor', 'fortress', 'lava', 'apex'][act - 1];

    let rows = [];
    let monsterMapping = {};
    let special = {};

    // 10F, 20F, 30F, 40F, 44F, 49F, 50F 经典里程碑 Boss 关
    if (f === 10) {
      rows = [
        "###########",
        "#p.A#^#D.P#",
        "#.#.#M#.#.#",
        "#...#0#...#",
        "###Y###Y###",
        "#y...#...y#",
        "###Y###Y###",
        "#...#.#...#",
        "#.#.#.#.#.#",
        "#...#v#...#",
        "###########"
      ];
      monsterMapping = { '0': 'boss_skeleton_a' };
      special = { bossFloor: true, rewardEquip: 'W1' };
    } else if (f === 20) {
      rows = [
        "###########",
        "#P.A#^#D.P#",
        "#.###M###.#",
        "#...#0#...#",
        "###B###B###",
        "#b...#...b#",
        "###B###B###",
        "#...#.#...#",
        "#.#.###.#.#",
        "#...#v#...#",
        "###########"
      ];
      monsterMapping = { '0': 'boss_vampire' };
      special = { bossFloor: true, rewardEquip: 'W2' };
    } else if (f === 30) {
      rows = [
        "###########",
        "#P.A#^#D.P#",
        "#.#.#M#.#.#",
        "#.#.#0#.#.#",
        "#.#B###B#.#",
        "#b...#...b#",
        "###R###R###",
        "#...#.#...#",
        "#.#.###.#.#",
        "#...#v#...#",
        "###########"
      ];
      monsterMapping = { '0': 'boss_knight_gold' };
      special = { bossFloor: true, rewardEquip: 'W3' };
    } else if (f === 40) {
      rows = [
        "###########",
        "#P.A#^#D.P#",
        "#.#.#M#.#.#",
        "#...#0#...#",
        "###R###R###",
        "#r..#c#..r#",
        "###R###R###",
        "#...#.#...#",
        "#.#.###.#.#",
        "#...#v#...#",
        "###########"
      ];
      monsterMapping = { '0': 'boss_archmage' };
      special = { bossFloor: true, rewardEquip: 'W4' };
    } else if (f === 44) {
      // 44F 魔龙圣殿
      rows = [
        "###########",
        "#P.A#^#D.P#",
        "#.#.#M#.#.#",
        "#...#0#...#",
        "###R###R###",
        "#s...#...s#",
        "###R###R###",
        "#...#.#...#",
        "#.#.###.#.#",
        "#...#v#...#",
        "###########"
      ];
      monsterMapping = { '0': 'boss_dragon' };
      special = { dragonFloor: true };
    } else if (f === 49) {
      // 49F 假魔王决战
      rows = [
        "###########",
        "#P.A#^#D.P#",
        "#.#.#M#.#.#",
        "#...#0#...#",
        "###R###R###",
        "#w...#...w#",
        "###R###R###",
        "#...#.#...#",
        "#.#.###.#.#",
        "#...#v#...#",
        "###########"
      ];
      monsterMapping = { '0': 'boss_false_demon' };
      special = { bossFloor: true, rewardEquip: 'W5' };
    } else if (f === 50) {
      // 50F 真·终极魔王魔殿
      rows = [
        "###########",
        "#P.A...D.P#",
        "#.........#",
        "#....0....#",
        "###R###R###",
        "#....M....#",
        "###R###R###",
        "#.........#",
        "#....#....#",
        "#....v....#",
        "###########"
      ];
      monsterMapping = { '0': 'boss_true_demon' };
      special = { finalFloor: true };
    } else {
      // 常规探索层生成
      const isUpStairs = f < 50;
      const isDownStairs = f > 1;
      const upCh = isUpStairs ? '^' : '#';
      const downCh = isDownStairs ? 'v' : '.';

      // 根据区域配置怪物与宝藏分布
      if (act === 1) {
        monsterMapping = { '1': 'green_slime', '2': 'red_slime', '3': 'black_slime', '4': 'bat_small', '5': 'skeleton_c' };
        rows = [
          "###########",
          `#p.y#${upCh}#y.p#`,
          "#.#.#Y#.#.#",
          "#1..#.#..2#",
          "###Y###Y###",
          "#A.3...4.D#",
          "###Y###Y###",
          "#5..#.#..1#",
          "#.#.#.#.#.#",
          `#g..#${downCh}#..y#`,
          "###########"
        ];
      } else if (act === 2) {
        monsterMapping = { '1': 'orc_warrior', '2': 'orc_guard', '3': 'bat_big', '4': 'wizard_junior', '5': 'guard_gold' };
        rows = [
          "###########",
          `#P.y#${upCh}#b.P#`,
          "#.#.#B#.#.#",
          "#1..#.#..2#",
          "###B###B###",
          "#A.3...4.D#",
          "###B###B###",
          "#5..#.#..1#",
          "#.#.#.#.#.#",
          `#g..#${downCh}#..b#`,
          "###########"
        ];
      } else if (act === 3) {
        monsterMapping = { '1': 'knight_junior', '2': 'knight_senior', '3': 'swordsman_double', '4': 'wizard_senior' };
        rows = [
          "###########",
          `#P.b#${upCh}#r.P#`,
          "#.#.#B#.#.#",
          "#1..#.#..2#",
          "###B###B###",
          "#A.3...4.D#",
          "###R###R###",
          "#2..#.#..1#",
          "#.#.###.#.#",
          `#g..#${downCh}#..r#`,
          "###########"
        ];
      } else if (act === 4) {
        monsterMapping = { '1': 'mage_crimson', '2': 'knight_ghost', '3': 'demon_flame' };
        rows = [
          "###########",
          `#P.r#${upCh}#r.P#`,
          "#.#.#R#.#.#",
          "#1..#.#..2#",
          "###R###R###",
          "#A.3...1.D#",
          "###R###R###",
          "#2..#.#..3#",
          "#.#.###.#.#",
          `#g..#${downCh}#..r#`,
          "###########"
        ];
      } else {
        monsterMapping = { '1': 'knight_dark', '2': 'demon_flame', '3': 'mage_crimson' };
        rows = [
          "###########",
          `#P.A#${upCh}#D.P#`,
          "#.#.#R#.#.#",
          "#1..#.#..2#",
          "###R###R###",
          "#A.3...1.D#",
          "###R###R###",
          "#2..#.#..1#",
          "#.#.###.#.#",
          `#w..#${downCh}#..w#`,
          "###########"
        ];
      }

      // 在特定层插入神装武器、护盾与特殊法宝
      if (f === 5) rows[1] = rows[1].replace('p.y', 'W1.');
      if (f === 9) rows[1] = rows[1].replace('y.p', '.S1');
      if (f === 15) rows[1] = rows[1].replace('P.y', 'W2.');
      if (f === 19) rows[1] = rows[1].replace('b.P', '.S2');
      if (f === 25) rows[1] = rows[1].replace('P.b', 'W3.');
      if (f === 28) rows[1] = rows[1].replace('r.P', '.S3');
      if (f === 35) rows[1] = rows[1].replace('P.r', 'W4.');
      if (f === 38) rows[1] = rows[1].replace('r.P', '.S4');
      if (f === 12) rows[5] = rows[5].replace('...', '.f.'); // 飞行羽毛
      if (f === 17) rows[5] = rows[5].replace('...', '.q.'); // 地震卷轴
      if (f === 33) rows[5] = rows[5].replace('...', '.c.'); // 神圣十字架
      if (f === 41) rows[5] = rows[5].replace('...', '.s.'); // 屠龙匕首
    }

    floors.push(createFloorData(f, act, theme, rows, monsterMapping, special));
  }

  return floors;
}

/**
 * 25 层精炼速通赛制地图生成器 (5/5/5/4/6 浓缩版)
 */
export function buildFast25Floors() {
  const allFloors = buildClassic50Floors();
  // 挑选 25 个最具决策深度的标志性楼层重新映射索引
  const selectedIndices = [
    1, 3, 5, 8, 10,       // Act 1: 5 层
    12, 14, 16, 18, 20,   // Act 2: 5 层
    22, 24, 26, 28, 30,   // Act 3: 5 层
    33, 35, 37, 38, 40,   // Act 4: 5 层
    42, 44, 47, 49, 50    // Act 5: 5 层 (共 25 层巅峰速通)
  ];

  return selectedIndices.map((origF, idx) => {
    const raw = allFloors[origF - 1];
    const newFloorNum = idx + 1;
    const isUp = newFloorNum < selectedIndices.length;
    const isDown = newFloorNum > 1;

    const modifiedMap = raw.map.map((row) => {
      let r = row;
      if (!isUp) r = r.replace('^', '#');
      if (!isDown) r = r.replace('v', '.');
      return r;
    });

    return {
      ...raw,
      floor: newFloorNum,
      map: modifiedMap,
    };
  });
}
