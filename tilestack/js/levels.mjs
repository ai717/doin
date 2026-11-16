/**
 * Level definitions and geometric layout generators for TileStack (千层瓦片 · 叠叠消)
 * 40 levels across 5 chapters. All tile counts are strictly multiples of 3.
 */

import { CHAPTERS, GAME_CONSTANTS, LEVEL_NAMES } from './data.mjs';

/**
 * Helper to build tiered geometric layouts centered around (0, 0).
 * Tile dimensions: W=56, H=68. Grid steps typically dx=50, dy=60, half-steps dx=25, dy=30.
 */
function createLayout(type, variant = 0) {
  const slots = [];
  let idCounter = 1;

  function add(x, y, layer, special = null) {
    slots.push({
      id: idCounter++,
      x: Math.round(x),
      y: Math.round(y),
      layer,
      special
    });
  }

  switch (type) {
    case 'pyramid_small': {
      // 24 tiles (3 layers): L0 (4x3=12), L1 (3x3=9), L2 (1x3=3)
      // L0: 4 cols x 3 rows = 12
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 4; c++) {
          add((c - 1.5) * 52, (r - 1) * 62, 0);
        }
      }
      // L1: 3 cols x 3 rows = 9 (half-step offset)
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          add((c - 1) * 52, (r - 1) * 62, 1);
        }
      }
      // L2: 1 col x 3 rows = 3
      for (let r = 0; r < 3; r++) {
        add(0, (r - 1) * 62, 2);
      }
      break;
    }

    case 'diamond_27': {
      // 27 tiles: L0: 15 tiles, L1: 9 tiles, L2: 3 tiles
      // L0 diamond: 1, 3, 5, 3, 1 = 13 (need 15 -> 1, 3, 5, 5, 1 = 15)
      const rowsL0 = [
        [0],
        [-1, 0, 1],
        [-2, -1, 0, 1, 2],
        [-1.5, -0.5, 0.5, 1.5, 0],
        [0]
      ];
      // Let's do explicit coordinate grid to ensure exactly 27:
      // L0: 15 tiles
      for (let r = -2; r <= 2; r++) {
        const count = 5 - Math.abs(r); // 3, 4, 5, 4, 3 = 19
        // Take specific symmetric subsets
      }
      // Clean approach: explicit coords
      // L0 (15): 5x3 rectangle
      for (let r = -1; r <= 1; r++) {
        for (let c = -2; c <= 2; c++) {
          add(c * 50, r * 60, 0);
        }
      }
      // L1 (9): 3x3 centered
      for (let r = -1; r <= 1; r++) {
        for (let c = -1; c <= 1; c++) {
          add(c * 50 + 25, r * 60 + 30, 1);
        }
      }
      // L2 (3): center vertical line
      for (let r = -1; r <= 1; r++) {
        add(25, r * 60 + 30, 2);
      }
      break;
    }

    case 'pagoda_30': {
      // 30 tiles: L0 (16: 4x4), L1 (10: 2 rows of 3, 2 rows of 2), L2 (4: 2x2) -> 16+10+4 = 30
      for (let r = -1.5; r <= 1.5; r += 1) {
        for (let c = -1.5; c <= 1.5; c += 1) {
          add(c * 52, r * 62, 0);
        }
      }
      // L1 (10 tiles)
      for (let r = -1; r <= 1; r++) {
        for (let c = -1; c <= 1; c++) {
          add(c * 52, r * 62, 1);
        }
      }
      add(0, -2 * 62, 1); // 9 + 1 = 10
      // L2 (4 tiles)
      add(-26, -31, 2);
      add(26, -31, 2);
      add(-26, 31, 2);
      add(26, 31, 2);
      break;
    }

    case 'cross_33': {
      // 33 tiles: L0 (17), L1 (11), L2 (5)
      // L0: central cross (17 tiles)
      for (let c = -3; c <= 3; c++) add(c * 50, 0, 0); // 7
      for (let r = -2; r <= 2; r++) {
        if (r !== 0) {
          add(0, r * 60, 0);
          add(-50, r * 60, 0);
          add(50, r * 60, 0);
        }
      } // 7 + 4*3 = 19 -> adjust to 17
      slots.length = 0;
      idCounter = 1;
      // Precise:
      // L0 (18 tiles): 6x3
      for (let r = -1; r <= 1; r++) {
        for (let c = -2.5; c <= 2.5; c += 1) {
          add(c * 50, r * 60, 0);
        }
      }
      // L1 (10 tiles): 4x2 + 2 wings
      for (let r = -0.5; r <= 0.5; r += 1) {
        for (let c = -1.5; c <= 1.5; c += 1) {
          add(c * 50, r * 60, 1);
        }
      }
      add(-125, 0, 1);
      add(125, 0, 1);
      // L2 (5 tiles): diamond in center
      add(0, 0, 2);
      add(-35, -35, 2);
      add(35, -35, 2);
      add(-35, 35, 2);
      add(35, 35, 2);
      break;
    }

    case 'temple_36': {
      // 36 tiles (4 layers)
      // L0 (18): 6x3
      for (let r = -1; r <= 1; r++) {
        for (let c = -2.5; c <= 2.5; c += 1) {
          add(c * 52, r * 62, 0);
        }
      }
      // L1 (12): 4x3
      for (let r = -1; r <= 1; r++) {
        for (let c = -1.5; c <= 1.5; c += 1) {
          add(c * 52, r * 62, 1);
        }
      }
      // L2 (4): 2x2
      for (let r = -0.5; r <= 0.5; r += 1) {
        for (let c = -0.5; c <= 0.5; c += 1) {
          add(c * 52, r * 62, 2);
        }
      }
      // L3 (2): center 2 tiles
      add(0, -25, 3);
      add(0, 25, 3);
      break;
    }

    case 'twin_39': {
      // 39 tiles (Twin pagodas)
      // Left tower (18 tiles): 3 layers (9, 6, 3)
      [-110, 110].forEach(cx => {
        // L0 (9): 3x3
        for (let r = -1; r <= 1; r++) {
          for (let c = -1; c <= 1; c++) {
            add(cx + c * 48, r * 58, 0);
          }
        }
        // L1 (6): 2x3
        for (let r = -1; r <= 1; r++) {
          for (let c = -0.5; c <= 0.5; c += 1) {
            add(cx + c * 48, r * 58, 1);
          }
        }
        // L2 (3): 1x3
        for (let r = -1; r <= 1; r++) {
          add(cx, r * 58, 2);
        }
      });
      // 2 * (9 + 6 + 3) = 36 tiles + 3 central bridge tiles
      add(0, -58, 0);
      add(0, 0, 1);
      add(0, 58, 0);
      // Total = 39 tiles!
      break;
    }

    case 'fortress_42': {
      // 42 tiles
      // L0 (20): 5x4
      for (let r = -1.5; r <= 1.5; r += 1) {
        for (let c = -2; c <= 2; c++) {
          add(c * 52, r * 62, 0);
        }
      }
      // L1 (14): outer rim / inner ring
      for (let r = -1; r <= 1; r++) {
        for (let c = -1.5; c <= 1.5; c += 1) {
          add(c * 52, r * 62, 1);
        }
      }
      add(-104, 0, 1);
      add(104, 0, 1);
      // L2 (6): 3x2 center
      for (let r = -0.5; r <= 0.5; r += 1) {
        for (let c = -1; c <= 1; c++) {
          add(c * 52, r * 62, 2);
        }
      }
      // L3 (2): top crown
      add(-26, 0, 3);
      add(26, 0, 3);
      break;
    }

    case 'lotus_45': {
      // 45 tiles: 5-petal lotus flower
      // L0 (24): central 4x4 (16) + 8 rim petals
      for (let r = -1.5; r <= 1.5; r += 1) {
        for (let c = -1.5; c <= 1.5; c += 1) {
          add(c * 52, r * 60, 0);
        }
      }
      add(-130, -30, 0); add(130, -30, 0);
      add(-130, 30, 0); add(130, 30, 0);
      add(-30, -120, 0); add(30, -120, 0);
      add(-30, 120, 0); add(30, 120, 0);
      // L1 (14): 3x3 inner (9) + 5 accents
      for (let r = -1; r <= 1; r++) {
        for (let c = -1; c <= 1; c++) {
          add(c * 52, r * 60, 1);
        }
      }
      add(0, -90, 1); add(0, 90, 1);
      add(-80, 0, 1); add(80, 0, 1);
      add(0, 0, 2); // 1 extra
      // L2 (6): ring around center
      add(-35, -40, 2); add(35, -40, 2);
      add(-50, 0, 2); add(50, 0, 2);
      add(-35, 40, 2); add(35, 40, 2);
      // L3 (1): very center bud
      add(0, 0, 3);
      break;
    }

    case 'palace_48': {
      // 48 tiles
      // L0 (24): 6x4
      for (let r = -1.5; r <= 1.5; r += 1) {
        for (let c = -2.5; c <= 2.5; c += 1) {
          add(c * 50, r * 60, 0);
        }
      }
      // L1 (15): 5x3
      for (let r = -1; r <= 1; r++) {
        for (let c = -2; c <= 2; c++) {
          add(c * 50 + 25, r * 60 + 30, 1);
        }
      }
      // L2 (6): 3x2
      for (let r = -0.5; r <= 0.5; r += 1) {
        for (let c = -1; c <= 1; c++) {
          add(c * 50, r * 60, 2);
        }
      }
      // L3 (3): 1x3 crest
      for (let r = -1; r <= 1; r++) {
        add(0, r * 60, 3);
      }
      break;
    }

    case 'grand_pagoda_54': {
      // 54 tiles: 5 layers (24 + 16 + 8 + 4 + 2 = 54)
      // L0 (24): 6x4
      for (let r = -1.5; r <= 1.5; r += 1) {
        for (let c = -2.5; c <= 2.5; c += 1) {
          add(c * 52, r * 62, 0);
        }
      }
      // L1 (16): 4x4
      for (let r = -1.5; r <= 1.5; r += 1) {
        for (let c = -1.5; c <= 1.5; c += 1) {
          add(c * 52, r * 62, 1);
        }
      }
      // L2 (8): 4x2
      for (let r = -0.5; r <= 0.5; r += 1) {
        for (let c = -1.5; c <= 1.5; c += 1) {
          add(c * 52, r * 62, 2);
        }
      }
      // L3 (4): 2x2
      for (let r = -0.5; r <= 0.5; r += 1) {
        for (let c = -0.5; c <= 0.5; c += 1) {
          add(c * 52, r * 62, 3);
        }
      }
      // L4 (2): peak
      add(0, -26, 4);
      add(0, 26, 4);
      break;
    }

    case 'celestial_60': {
      // 60 tiles (Master Tower)
      // L0 (28): 7x4
      for (let r = -1.5; r <= 1.5; r += 1) {
        for (let c = -3; c <= 3; c++) {
          add(c * 50, r * 60, 0);
        }
      }
      // L1 (18): 6x3
      for (let r = -1; r <= 1; r++) {
        for (let c = -2.5; c <= 2.5; c += 1) {
          add(c * 50, r * 60, 1);
        }
      }
      // L2 (9): 3x3
      for (let r = -1; r <= 1; r++) {
        for (let c = -1; c <= 1; c++) {
          add(c * 50, r * 60, 2);
        }
      }
      // L3 (4): 2x2
      for (let r = -0.5; r <= 0.5; r += 1) {
        for (let c = -0.5; c <= 0.5; c += 1) {
          add(c * 50, r * 60, 3);
        }
      }
      // L4 (1): crown jewel
      add(0, 0, 4);
      break;
    }

    default:
      // Fallback 24
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 4; c++) {
          add((c - 1.5) * 52, (r - 1) * 62, 0);
          add((c - 1.5) * 52, (r - 1) * 62, 1);
        }
      }
      break;
  }

  // Ensure total count is strictly divisible by 3
  const remainder = slots.length % 3;
  if (remainder !== 0) {
    slots.splice(slots.length - remainder, remainder);
  }

  return slots;
}

// Generate the 40 Level configs
const LEVEL_PATTERNS = [
  'pyramid_small',  // 24
  'diamond_27',     // 27
  'pagoda_30',      // 30
  'cross_33',       // 33
  'temple_36',      // 36
  'twin_39',        // 39
  'fortress_42',    // 42
  'palace_48',      // 48 (Chapter 1 Boss / Timed)
];

export const LEVELS = [];

for (let i = 1; i <= 40; i++) {
  const chapterIdx = Math.floor((i - 1) / 8);
  const chapter = CHAPTERS[chapterIdx];
  const levelInChapter = ((i - 1) % 8) + 1;
  const isTimed = (levelInChapter === 8) || (chapterIdx === 4 && levelInChapter >= 5);
  
  // Pattern selection scales smoothly
  let patternName;
  if (i <= 8) {
    patternName = LEVEL_PATTERNS[(i - 1) % LEVEL_PATTERNS.length];
  } else if (i <= 16) {
    const list = ['diamond_27', 'pagoda_30', 'cross_33', 'temple_36', 'twin_39', 'fortress_42', 'lotus_45', 'palace_48'];
    patternName = list[(i - 9) % list.length];
  } else if (i <= 24) {
    const list = ['pagoda_30', 'cross_33', 'temple_36', 'twin_39', 'fortress_42', 'lotus_45', 'palace_48', 'grand_pagoda_54'];
    patternName = list[(i - 17) % list.length];
  } else if (i <= 32) {
    const list = ['cross_33', 'temple_36', 'twin_39', 'fortress_42', 'lotus_45', 'palace_48', 'grand_pagoda_54', 'grand_pagoda_54'];
    patternName = list[(i - 25) % list.length];
  } else {
    const list = ['fortress_42', 'lotus_45', 'palace_48', 'grand_pagoda_54', 'grand_pagoda_54', 'celestial_60', 'celestial_60', 'celestial_60'];
    patternName = list[(i - 33) % list.length];
  }

  const baseSlots = createLayout(patternName);
  
  // Mark special mechanics based on chapter
  const slots = baseSlots.map((s, idx) => {
    let special = null;
    if (chapterIdx === 1) { // Ch2: Key & Lock
      if (idx === 0) special = 'lock';
      if (idx === Math.floor(baseSlots.length / 2)) special = 'key';
    } else if (chapterIdx === 2) { // Ch3: Frozen (requires 2 matches)
      if (idx % 9 === 0) special = 'frozen';
    } else if (chapterIdx === 3) { // Ch4: Wild Rainbow
      if (idx % 12 === 0) special = 'wild';
    }
    return { ...s, special };
  });

  const nameMeta = LEVEL_NAMES[i - 1] || { zh: `Level ${i}`, en: `Level ${i}` };

  LEVELS.push({
    id: i,
    chapter: chapterIdx + 1,
    chapterTheme: chapter.theme,
    skinId: chapter.skinId,
    nameZh: nameMeta.zh,
    nameEn: nameMeta.en,
    tileCount: slots.length,
    isTimed,
    timeLimit: isTimed ? GAME_CONSTANTS.CHALLENGE_TIME_LIMIT_SEC : 0,
    seed: 1000 + i * 7919, // Fixed deterministic seed per level
    starCriteria: {
      maxUndos: 2,
      maxHints: 0
    },
    slots
  });
}
