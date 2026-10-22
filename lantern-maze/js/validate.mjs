// validate.mjs —— 扎巷坊的五道硬性验收：连通、环路、巡逻可达、安全间距。第五道（影子玩家跑图）在 bot.mjs。
// 纯函数，DOM-free：编辑台与测试共用同一份判定。

import {
  parseLayout,
  buildField,
  charAt,
  isWalkableTile,
  DOT,
  PEARL,
  SPAWN,
  FRUIT,
  DIRS,
} from "./engine.mjs";

export const LIMITS = {
  minCycles: 3,
  maxPatrolSteps: 46,
  minPearlGap: 8,
  minPearls: 2,
  minPearlDirs: 2,
  minSpawnToHouse: 6,
  minDots: 40,
};

const CODES = {
  NO_SPAWN: "noSpawn",
  NO_HOUSE: "noHouse",
  ISLAND: "unreachableDust",
  TRAP: "noRetreat",
  PATROL: "patrolTooFar",
  PEARL: "pearlUnsafe",
  SPAWN: "spawnTooClose",
  THIN: "tooFewDust",
};

function key(layout, x, y) {
  return y * layout.width + x;
}

function walkableNeighbours(layout, x, y) {
  let n = 0;
  const list = [];
  for (const d of DIRS) {
    const nx = x + d.x;
    const ny = y + d.y;
    if (isWalkableTile(charAt(layout, nx, ny))) {
      n += 1;
      list.push({ x: nx, y: ny });
    }
  }
  return { n, list };
}

/** 图论环数 E - V + 1：≥1 才说明巷子里有活环可绕，纯树状 = 无退路 */
export function graphStats(layout) {
  const tiles = [];
  const index = new Map();
  for (let y = 0; y < layout.height; y += 1) {
    for (let x = 0; x < layout.width; x += 1) {
      if (!isWalkableTile(charAt(layout, x, y))) continue;
      index.set(key(layout, x, y), tiles.length);
      tiles.push({ x, y });
    }
  }
  const wrap = new Set(layout.wrapRows);
  const seen = new Set();
  let edges = 0;
  for (const t of tiles) {
    for (const d of DIRS) {
      let nx = t.x + d.x;
      const ny = t.y + d.y;
      if (nx < 0 && wrap.has(t.y)) nx = layout.width - 1;
      else if (nx >= layout.width && wrap.has(t.y)) nx = 0;
      if (nx < 0 || nx >= layout.width || ny < 0 || ny >= layout.height) continue;
      if (!isWalkableTile(charAt(layout, nx, ny))) continue;
      const a = index.get(key(layout, t.x, t.y));
      const b = index.get(key(layout, nx, ny));
      const pair = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (seen.has(pair)) continue;
      seen.add(pair);
      edges += 1;
    }
  }
  const v = tiles.length;
  return { vertices: v, edges, cycles: v ? Math.max(0, edges - v + 1) : 0, tiles };
}

/**
 * @returns {{ok:boolean, problems:Array<{code:string,rule:number,msg:string,tiles:Array<{x,y}>}>, stats:object}}
 */
export function validateRows(rows) {
  const src = typeof rows === "string" ? rows.split("\n") : rows;
  const raw = Array.isArray(src) ? src.map((r) => String(r ?? "")) : [];
  const layout = parseLayout(raw);
  const problems = [];
  if (!layout || !layout.width) {
    return { ok: false, problems: [{ code: "shape", rule: 0, msg: "empty", tiles: [] }], stats: {} };
  }
  const stats = graphStats(layout);
  // parseLayout 会把短行补齐，形制问题只能看原始入参
  if (raw.length > 1 && raw.some((r) => r.length !== raw[0].length)) {
    problems.push({ code: "shape", rule: 0, msg: "raggedRows", tiles: [] });
  }

  // ① 连通性：每一粒光尘与每一颗日曜珠都必须从出生点可达
  const from = layout.spawn ? [layout.spawn] : [];
  const field = buildField(layout, from, "player");
  const islands = [];
  const pearls = [];
  for (let y = 0; y < layout.height; y += 1) {
    for (let x = 0; x < layout.width; x += 1) {
      const ch = charAt(layout, x, y);
      if (ch === PEARL) pearls.push({ x, y });
      if (!isWalkableTile(ch)) continue;
      if (field[key(layout, x, y)] < 0) islands.push({ x, y });
    }
  }
  if (!layout.spawn) problems.push({ code: CODES.NO_SPAWN, rule: 1, msg: "noSpawn", tiles: [] });
  if (islands.length) {
    const dust = islands.filter((t) => [DOT, PEARL, FRUIT, SPAWN].includes(charAt(layout, t.x, t.y)));
    problems.push({ code: CODES.ISLAND, rule: 1, msg: "unreachable", tiles: dust.length ? dust : islands.slice(0, 60) });
  }

  // ② 环路数：至少三条活环，杜绝树状死巷
  if (stats.cycles < LIMITS.minCycles) {
    problems.push({ code: CODES.TRAP, rule: 2, msg: `cycles:${stats.cycles}`, tiles: stats.tiles.slice(0, 80) });
  }

  // ③ 影魅巡逻可行性 + 日曜珠分布
  if (!layout.houses.length) {
    problems.push({ code: CODES.NO_HOUSE, rule: 3, msg: "noHouse", tiles: [] });
  } else {
    for (const house of layout.houses) {
      if (!house.door) {
        problems.push({ code: CODES.NO_HOUSE, rule: 3, msg: "noDoor", tiles: house.cells.slice(0, 8) });
        continue;
      }
      const patrol = buildField(layout, [house.exit], "ghost");
      let far = null;
      let farD = -1;
      const stranded = [];
      for (let y = 0; y < layout.height; y += 1) {
        for (let x = 0; x < layout.width; x += 1) {
          if (!isWalkableTile(charAt(layout, x, y))) continue;
          const d = patrol[key(layout, x, y)];
          if (d < 0) {
            stranded.push({ x, y });
            continue;
          }
          if (d > farD) {
            farD = d;
            far = { x, y };
          }
        }
      }
      if (stranded.length) {
        problems.push({ code: CODES.PATROL, rule: 3, msg: "noPatrol", tiles: stranded.slice(0, 40) });
      } else if (farD > LIMITS.maxPatrolSteps) {
        problems.push({ code: CODES.PATROL, rule: 3, msg: `patrol:${farD}`, tiles: far ? [far] : [] });
      }
    }
  }
  if (pearls.length < LIMITS.minPearls) {
    problems.push({ code: CODES.PEARL, rule: 3, msg: "pearlCount", tiles: pearls });
  }
  for (let i = 0; i < pearls.length; i += 1) {
    for (let j = i + 1; j < pearls.length; j += 1) {
      const gap = Math.abs(pearls[i].x - pearls[j].x) + Math.abs(pearls[i].y - pearls[j].y);
      if (gap < LIMITS.minPearlGap) {
        problems.push({ code: CODES.PEARL, rule: 3, msg: `pearlGap:${gap}`, tiles: [pearls[i], pearls[j]] });
      }
    }
  }
  for (const p of pearls) {
    const { n } = walkableNeighbours(layout, p.x, p.y);
    if (n < LIMITS.minPearlDirs) problems.push({ code: CODES.PEARL, rule: 4, msg: "pearlCorner", tiles: [p] });
  }

  // ④ 安全间距：出生点不能贴着影匣门
  if (layout.spawn && layout.houses.length) {
    const houseField = buildField(layout, [layout.houses[0].exit], "player");
    const gap = houseField[key(layout, layout.spawn.x, layout.spawn.y)];
    if (gap >= 0 && gap < LIMITS.minSpawnToHouse) {
      problems.push({ code: CODES.SPAWN, rule: 4, msg: `spawnGap:${gap}`, tiles: [layout.spawn, layout.houses[0].exit] });
    }
  }
  if (layout.dots < LIMITS.minDots) {
    problems.push({ code: CODES.THIN, rule: 4, msg: `dust:${layout.dots}`, tiles: [] });
  }

  return {
    ok: problems.length === 0,
    problems,
    stats: {
      dots: layout.dots,
      pearls: pearls.length,
      cycles: stats.cycles,
      vertices: stats.vertices,
      houses: layout.houses.length,
      wrapRows: layout.wrapRows.length,
    },
  };
}

export function problemHint(code) {
  switch (code) {
    case CODES.NO_SPAWN:
      return "missingSpawn";
    case CODES.NO_HOUSE:
      return "missingHouse";
    case CODES.ISLAND:
      return "island";
    case CODES.TRAP:
      return "noLoop";
    case CODES.PATROL:
      return "patrol";
    case CODES.PEARL:
      return "pearl";
    case CODES.SPAWN:
      return "spawn";
    case CODES.THIN:
      return "thin";
    default:
      return "shape";
  }
}
