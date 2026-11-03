/**
 * @file games/sleepwalker/js/levels.mjs
 * 22 levels across 5 acts. 100% deterministic, zero hardcoded Chinese strings.
 */

export const LEVELS = [
  // ==========================================
  // ACT 1: City Rooftops (4 levels)
  // ==========================================
  {
    id: 1,
    key: 'level_1',
    act: 1,
    spawn: { x: 40, y: 320, facing: 1 },
    bed: { x: 740, y: 320, w: 56, h: 28 },
    platforms: [
      { id: 'p1_1', x: 20, y: 320, w: 260, type: 'roof' },
      { id: 'p1_2', x: 360, y: 320, w: 450, type: 'roof' },
    ],
    gadgets: [
      {
        id: 'g_manhole_1',
        type: 'timed',
        duration: 5.0,
        x: 280,
        y: 320,
        w: 80,
        h: 16,
        props: {
          platform: { x: 280, y: 320, w: 80, h: 16, type: 'manhole' },
        },
      },
    ],
    bubbles: [
      { id: 1, x: 160, y: 300, r: 14 },
      { id: 2, x: 320, y: 300, r: 14 },
      { id: 3, x: 560, y: 300, r: 14 },
    ],
    hazards: [],
    parTime: 14,
    goldenSolution: [
      { time: 2.2, gadgetId: 'g_manhole_1' },
    ],
  },
  {
    id: 2,
    key: 'level_2',
    act: 1,
    spawn: { x: 40, y: 230, facing: 1 },
    bed: { x: 740, y: 240, w: 56, h: 28 },
    platforms: [
      { id: 'p2_1', x: 20, y: 230, w: 210, type: 'roof' },
      { id: 'p2_2', x: 340, y: 240, w: 480, type: 'roof' },
    ],
    gadgets: [
      {
        id: 'g_awning_1',
        type: 'toggle',
        x: 230,
        y: 330,
        w: 120,
        h: 24,
        props: {
          isBouncy: true,
          bounceVy: -460,
          bounceVx: 180,
        },
      },
    ],
    bubbles: [
      { id: 1, x: 140, y: 210, r: 14 },
      { id: 2, x: 360, y: 200, r: 14 },
      { id: 3, x: 580, y: 220, r: 14 },
    ],
    hazards: [],
    parTime: 14,
    goldenSolution: [
      { time: 2.0, gadgetId: 'g_awning_1' },
    ],
  },
  {
    id: 3,
    key: 'level_3',
    act: 1,
    spawn: { x: 40, y: 360, facing: 1 },
    bed: { x: 740, y: 360, w: 56, h: 28 },
    platforms: [
      { id: 'p3_1', x: 20, y: 360, w: 790, type: 'street' },
    ],
    gadgets: [
      {
        id: 'g_bone_1',
        type: 'distract',
        duration: 9.0,
        x: 370,
        y: 310,
        w: 44,
        h: 44,
        props: {},
      },
    ],
    bubbles: [
      { id: 1, x: 180, y: 340, r: 14 },
      { id: 2, x: 430, y: 340, r: 14 },
      { id: 3, x: 620, y: 340, r: 14 },
    ],
    hazards: [
      { id: 'h_dog_1', type: 'dog', x: 420, y: 330, w: 40, h: 32, linkedGadgetId: 'g_bone_1' },
    ],
    parTime: 15,
    goldenSolution: [
      { time: 3.5, gadgetId: 'g_bone_1' },
    ],
  },
  {
    id: 4,
    key: 'level_4',
    act: 1,
    spawn: { x: 40, y: 320, facing: 1 },
    bed: { x: 740, y: 320, w: 56, h: 28 },
    platforms: [
      { id: 'p4_1', x: 20, y: 320, w: 220, type: 'roof' },
      { id: 'p4_2', x: 320, y: 320, w: 490, type: 'roof' },
    ],
    gadgets: [
      {
        id: 'g_steam_valve',
        type: 'timed',
        duration: 6.0,
        x: 100,
        y: 250,
        w: 40,
        h: 40,
        props: {},
      },
      {
        id: 'g_bridge_1',
        type: 'toggle',
        x: 220,
        y: 320,
        w: 100,
        h: 16,
        props: {
          platform: { x: 220, y: 320, w: 100, h: 16, type: 'bridge' },
        },
      },
    ],
    bubbles: [
      { id: 1, x: 130, y: 300, r: 14 },
      { id: 2, x: 270, y: 300, r: 14 },
      { id: 3, x: 540, y: 300, r: 14 },
    ],
    hazards: [
      { id: 'h_steam_1', type: 'steam', x: 160, y: 290, w: 32, h: 32, linkedGadgetId: 'g_steam_valve' },
    ],
    parTime: 15,
    goldenSolution: [
      { time: 1.0, gadgetId: 'g_steam_valve' },
      { time: 2.5, gadgetId: 'g_bridge_1' },
    ],
  },

  // ==========================================
  // ACT 2: Amusement Carnival (5 levels)
  // ==========================================
  {
    id: 5,
    key: 'level_5',
    act: 2,
    spawn: { x: 40, y: 360, facing: 1 },
    bed: { x: 740, y: 220, w: 56, h: 28 },
    platforms: [
      { id: 'p5_1', x: 20, y: 360, w: 230, type: 'wood' },
      { id: 'p5_2', x: 340, y: 220, w: 480, type: 'tent' },
    ],
    gadgets: [
      {
        id: 'g_clown_boot',
        type: 'spring',
        duration: 3.0,
        x: 240,
        y: 360,
        w: 100,
        h: 30,
        props: {
          isBouncy: true,
          bounceVy: -480,
          bounceVx: 160,
        },
      },
    ],
    bubbles: [
      { id: 1, x: 160, y: 340, r: 14 },
      { id: 2, x: 380, y: 200, r: 14 },
      { id: 3, x: 620, y: 200, r: 14 },
    ],
    hazards: [],
    parTime: 14,
    goldenSolution: [
      { time: 2.5, gadgetId: 'g_clown_boot' },
    ],
  },
  {
    id: 6,
    key: 'level_6',
    act: 2,
    spawn: { x: 40, y: 300, facing: 1 },
    bed: { x: 740, y: 300, w: 56, h: 28 },
    platforms: [
      { id: 'p6_1', x: 20, y: 300, w: 240, type: 'carnival' },
      { id: 'p6_2', x: 420, y: 300, w: 400, type: 'carnival' },
    ],
    gadgets: [
      {
        id: 'g_ferris_ferry',
        type: 'toggle',
        x: 260,
        y: 300,
        w: 160,
        h: 16,
        props: {
          platform: { x: 260, y: 300, w: 160, h: 16, type: 'wood' },
        },
      },
    ],
    bubbles: [
      { id: 1, x: 160, y: 280, r: 14 },
      { id: 2, x: 340, y: 280, r: 14 },
      { id: 3, x: 580, y: 280, r: 14 },
    ],
    hazards: [],
    parTime: 14,
    goldenSolution: [
      { time: 2.0, gadgetId: 'g_ferris_ferry' },
    ],
  },
  {
    id: 7,
    key: 'level_7',
    act: 2,
    spawn: { x: 40, y: 340, facing: 1 },
    bed: { x: 740, y: 340, w: 56, h: 28 },
    platforms: [
      { id: 'p7_1', x: 20, y: 340, w: 220, type: 'track' },
      { id: 'p7_2', x: 340, y: 340, w: 470, type: 'track' },
    ],
    gadgets: [
      {
        id: 'g_coaster_brake',
        type: 'timed',
        duration: 5.5,
        x: 240,
        y: 340,
        w: 100,
        h: 20,
        props: {
          platform: { x: 240, y: 340, w: 100, h: 16, type: 'metal' },
        },
      },
    ],
    bubbles: [
      { id: 1, x: 140, y: 320, r: 14 },
      { id: 2, x: 290, y: 320, r: 14 },
      { id: 3, x: 520, y: 320, r: 14 },
    ],
    hazards: [],
    parTime: 14,
    goldenSolution: [
      { time: 2.2, gadgetId: 'g_coaster_brake' },
    ],
  },
  {
    id: 8,
    key: 'level_8',
    act: 2,
    spawn: { x: 40, y: 260, facing: 1 },
    bed: { x: 740, y: 260, w: 56, h: 28 },
    platforms: [
      { id: 'p8_1', x: 20, y: 260, w: 230, type: 'wood' },
      { id: 'p8_2', x: 370, y: 260, w: 440, type: 'wood' },
    ],
    gadgets: [
      {
        id: 'g_balloon_lift',
        type: 'timed',
        duration: 5.0,
        x: 250,
        y: 260,
        w: 120,
        h: 16,
        props: {
          platform: { x: 250, y: 260, w: 120, h: 16, type: 'wood' },
        },
      },
    ],
    bubbles: [
      { id: 1, x: 150, y: 240, r: 14 },
      { id: 2, x: 310, y: 240, r: 14 },
      { id: 3, x: 560, y: 240, r: 14 },
    ],
    hazards: [],
    parTime: 14,
    goldenSolution: [
      { time: 2.4, gadgetId: 'g_balloon_lift' },
    ],
  },
  {
    id: 9,
    key: 'level_9',
    act: 2,
    spawn: { x: 40, y: 360, facing: 1 },
    bed: { x: 740, y: 220, w: 56, h: 28 },
    platforms: [
      { id: 'p9_1', x: 20, y: 360, w: 200, type: 'wood' },
      { id: 'p9_2', x: 420, y: 220, w: 400, type: 'tent' },
    ],
    gadgets: [
      {
        id: 'g_carnival_boot',
        type: 'spring',
        duration: 3.0,
        x: 210,
        y: 360,
        w: 100,
        h: 24,
        props: {
          isBouncy: true,
          bounceVy: -480,
          bounceVx: 140,
        },
      },
      {
        id: 'g_awning_circus',
        type: 'spring',
        duration: 3.0,
        x: 310,
        y: 280,
        w: 100,
        h: 20,
        props: {
          isBouncy: true,
          bounceVy: -460,
          bounceVx: 140,
        },
      },
    ],
    bubbles: [
      { id: 1, x: 120, y: 340, r: 14 },
      { id: 2, x: 280, y: 230, r: 14 },
      { id: 3, x: 600, y: 200, r: 14 },
    ],
    hazards: [],
    parTime: 15,
    goldenSolution: [
      { time: 2.0, gadgetId: 'g_carnival_boot' },
      { time: 3.5, gadgetId: 'g_awning_circus' },
    ],
  },

  // ==========================================
  // ACT 3: Construction Site (5 levels)
  // ==========================================
  {
    id: 10,
    key: 'level_10',
    act: 3,
    spawn: { x: 40, y: 280, facing: 1 },
    bed: { x: 740, y: 280, w: 56, h: 28 },
    platforms: [
      { id: 'p10_1', x: 20, y: 280, w: 250, type: 'girder' },
      { id: 'p10_2', x: 410, y: 280, w: 400, type: 'girder' },
    ],
    gadgets: [
      {
        id: 'g_crane_beam',
        type: 'toggle',
        x: 270,
        y: 280,
        w: 140,
        h: 16,
        props: {
          platform: { x: 270, y: 280, w: 140, h: 16, type: 'girder' },
        },
      },
    ],
    bubbles: [
      { id: 1, x: 170, y: 260, r: 14 },
      { id: 2, x: 340, y: 260, r: 14 },
      { id: 3, x: 580, y: 260, r: 14 },
    ],
    hazards: [],
    parTime: 14,
    goldenSolution: [
      { time: 2.2, gadgetId: 'g_crane_beam' },
    ],
  },
  {
    id: 11,
    key: 'level_11',
    act: 3,
    spawn: { x: 40, y: 260, facing: 1 },
    bed: { x: 740, y: 350, w: 56, h: 28 },
    platforms: [
      { id: 'p11_1', x: 20, y: 260, w: 220, type: 'girder' },
      { id: 'p11_2', x: 420, y: 350, w: 400, type: 'scaffold' },
    ],
    gadgets: [
      {
        id: 'g_cement_slide',
        type: 'toggle',
        x: 240,
        y: 310,
        w: 180,
        h: 16,
        props: {
          platform: { x: 240, y: 310, w: 180, h: 16, type: 'metal' },
        },
      },
    ],
    bubbles: [
      { id: 1, x: 150, y: 240, r: 14 },
      { id: 2, x: 330, y: 290, r: 14 },
      { id: 3, x: 600, y: 330, r: 14 },
    ],
    hazards: [],
    parTime: 14,
    goldenSolution: [
      { time: 2.0, gadgetId: 'g_cement_slide' },
    ],
  },
  {
    id: 12,
    key: 'level_12',
    act: 3,
    spawn: { x: 40, y: 300, facing: 1 },
    bed: { x: 740, y: 300, w: 56, h: 28 },
    platforms: [
      { id: 'p12_1', x: 20, y: 300, w: 260, type: 'scaffold' },
      { id: 'p12_2', x: 440, y: 300, w: 380, type: 'scaffold' },
    ],
    gadgets: [
      {
        id: 'g_pneumatic_lift',
        type: 'timed',
        duration: 5.5,
        x: 280,
        y: 300,
        w: 160,
        h: 16,
        props: {
          platform: { x: 280, y: 300, w: 160, h: 16, type: 'metal' },
        },
      },
    ],
    bubbles: [
      { id: 1, x: 160, y: 280, r: 14 },
      { id: 2, x: 360, y: 280, r: 14 },
      { id: 3, x: 570, y: 280, r: 14 },
    ],
    hazards: [],
    parTime: 14,
    goldenSolution: [
      { time: 2.5, gadgetId: 'g_pneumatic_lift' },
    ],
  },
  {
    id: 13,
    key: 'level_13',
    act: 3,
    spawn: { x: 40, y: 220, facing: 1 },
    bed: { x: 740, y: 320, w: 56, h: 28 },
    platforms: [
      { id: 'p13_1', x: 20, y: 220, w: 210, type: 'girder' },
      { id: 'p13_2', x: 340, y: 320, w: 480, type: 'scaffold' },
    ],
    gadgets: [
      {
        id: 'g_safety_net',
        type: 'spring',
        duration: 3.0,
        x: 220,
        y: 330,
        w: 130,
        h: 24,
        props: {
          isBouncy: true,
          bounceVy: -460,
          bounceVx: 160,
        },
      },
    ],
    bubbles: [
      { id: 1, x: 130, y: 200, r: 14 },
      { id: 2, x: 360, y: 230, r: 14 },
      { id: 3, x: 590, y: 300, r: 14 },
    ],
    hazards: [],
    parTime: 14,
    goldenSolution: [
      { time: 2.0, gadgetId: 'g_safety_net' },
    ],
  },
  {
    id: 14,
    key: 'level_14',
    act: 3,
    spawn: { x: 40, y: 270, facing: 1 },
    bed: { x: 740, y: 270, w: 56, h: 28 },
    platforms: [
      { id: 'p14_1', x: 20, y: 270, w: 200, type: 'girder' },
      { id: 'p14_2', x: 320, y: 270, w: 160, type: 'girder' },
      { id: 'p14_3', x: 580, y: 270, w: 240, type: 'penthouse' },
    ],
    gadgets: [
      {
        id: 'g_girder_link_1',
        type: 'toggle',
        x: 220,
        y: 270,
        w: 100,
        h: 16,
        props: {
          platform: { x: 220, y: 270, w: 100, h: 16, type: 'girder' },
        },
      },
      {
        id: 'g_girder_link_2',
        type: 'toggle',
        x: 480,
        y: 270,
        w: 100,
        h: 16,
        props: {
          platform: { x: 480, y: 270, w: 100, h: 16, type: 'girder' },
        },
      },
    ],
    bubbles: [
      { id: 1, x: 130, y: 250, r: 14 },
      { id: 2, x: 390, y: 250, r: 14 },
      { id: 3, x: 670, y: 250, r: 14 },
    ],
    hazards: [],
    parTime: 15,
    goldenSolution: [
      { time: 1.5, gadgetId: 'g_girder_link_1' },
      { time: 4.8, gadgetId: 'g_girder_link_2' },
    ],
  },

  // ==========================================
  // ACT 4: Midnight Zoo (4 levels)
  // ==========================================
  {
    id: 15,
    key: 'level_15',
    act: 4,
    spawn: { x: 40, y: 320, facing: 1 },
    bed: { x: 740, y: 320, w: 56, h: 28 },
    platforms: [
      { id: 'p15_1', x: 20, y: 320, w: 250, type: 'stone' },
      { id: 'p15_2', x: 410, y: 320, w: 400, type: 'stone' },
    ],
    gadgets: [
      {
        id: 'g_seal_ball',
        type: 'timed',
        duration: 5.5,
        x: 270,
        y: 320,
        w: 140,
        h: 16,
        props: {
          platform: { x: 270, y: 320, w: 140, h: 16, type: 'wood' },
        },
      },
    ],
    bubbles: [
      { id: 1, x: 150, y: 300, r: 14 },
      { id: 2, x: 340, y: 300, r: 14 },
      { id: 3, x: 570, y: 300, r: 14 },
    ],
    hazards: [],
    parTime: 14,
    goldenSolution: [
      { time: 2.2, gadgetId: 'g_seal_ball' },
    ],
  },
  {
    id: 16,
    key: 'level_16',
    act: 4,
    spawn: { x: 40, y: 240, facing: 1 },
    bed: { x: 740, y: 340, w: 56, h: 28 },
    platforms: [
      { id: 'p16_1', x: 20, y: 240, w: 220, type: 'wood' },
      { id: 'p16_2', x: 420, y: 340, w: 400, type: 'lawn' },
    ],
    gadgets: [
      {
        id: 'g_giraffe_neck',
        type: 'toggle',
        x: 240,
        y: 290,
        w: 180,
        h: 16,
        props: {
          platform: { x: 240, y: 290, w: 180, h: 16, type: 'wood' },
        },
      },
    ],
    bubbles: [
      { id: 1, x: 140, y: 220, r: 14 },
      { id: 2, x: 330, y: 270, r: 14 },
      { id: 3, x: 580, y: 320, r: 14 },
    ],
    hazards: [],
    parTime: 14,
    goldenSolution: [
      { time: 2.0, gadgetId: 'g_giraffe_neck' },
    ],
  },
  {
    id: 17,
    key: 'level_17',
    act: 4,
    spawn: { x: 40, y: 340, facing: 1 },
    bed: { x: 740, y: 230, w: 56, h: 28 },
    platforms: [
      { id: 'p17_1', x: 20, y: 340, w: 240, type: 'lawn' },
      { id: 'p17_2', x: 370, y: 230, w: 450, type: 'treehouse' },
    ],
    gadgets: [
      {
        id: 'g_elephant_geyser',
        type: 'fan',
        x: 270,
        y: 350,
        w: 90,
        h: 40,
        props: {
          isWind: true,
          windX: 250,
          windY: 150,
          windW: 130,
          windH: 220,
        },
      },
    ],
    bubbles: [
      { id: 1, x: 160, y: 320, r: 14 },
      { id: 2, x: 350, y: 170, r: 14 },
      { id: 3, x: 600, y: 210, r: 14 },
    ],
    hazards: [],
    parTime: 14,
    goldenSolution: [
      { time: 1.5, gadgetId: 'g_elephant_geyser' },
    ],
  },
  {
    id: 18,
    key: 'level_18',
    act: 4,
    spawn: { x: 40, y: 310, facing: 1 },
    bed: { x: 740, y: 310, w: 56, h: 28 },
    platforms: [
      { id: 'p18_1', x: 20, y: 310, w: 230, type: 'wood' },
      { id: 'p18_2', x: 410, y: 310, w: 400, type: 'wood' },
    ],
    gadgets: [
      {
        id: 'g_monkey_swing',
        type: 'timed',
        duration: 5.5,
        x: 250,
        y: 310,
        w: 160,
        h: 16,
        props: {
          platform: { x: 250, y: 310, w: 160, h: 16, type: 'rope' },
        },
      },
    ],
    bubbles: [
      { id: 1, x: 140, y: 290, r: 14 },
      { id: 2, x: 330, y: 290, r: 14 },
      { id: 3, x: 570, y: 290, r: 14 },
    ],
    hazards: [],
    parTime: 14,
    goldenSolution: [
      { time: 2.2, gadgetId: 'g_monkey_swing' },
    ],
  },

  // ==========================================
  // ACT 5: Cosmic Metropolis (4 levels)
  // ==========================================
  {
    id: 19,
    key: 'level_19',
    act: 5,
    spawn: { x: 40, y: 340, facing: 1 },
    bed: { x: 740, y: 210, w: 56, h: 28 },
    platforms: [
      { id: 'p19_1', x: 20, y: 340, w: 250, type: 'neon' },
      { id: 'p19_2', x: 370, y: 210, w: 450, type: 'neon' },
    ],
    gadgets: [
      {
        id: 'g_antigrav_beam',
        type: 'fan',
        x: 280,
        y: 350,
        w: 90,
        h: 40,
        props: {
          isWind: true,
          windX: 260,
          windY: 130,
          windW: 130,
          windH: 240,
        },
      },
    ],
    bubbles: [
      { id: 1, x: 150, y: 320, r: 14 },
      { id: 2, x: 350, y: 150, r: 14 },
      { id: 3, x: 590, y: 190, r: 14 },
    ],
    hazards: [],
    parTime: 14,
    goldenSolution: [
      { time: 1.5, gadgetId: 'g_antigrav_beam' },
    ],
  },
  {
    id: 20,
    key: 'level_20',
    act: 5,
    spawn: { x: 40, y: 290, facing: 1 },
    bed: { x: 740, y: 290, w: 56, h: 28 },
    platforms: [
      { id: 'p20_1', x: 20, y: 290, w: 240, type: 'cyber' },
      { id: 'p20_2', x: 430, y: 290, w: 390, type: 'cyber' },
    ],
    gadgets: [
      {
        id: 'g_holo_bridge',
        type: 'toggle',
        x: 260,
        y: 290,
        w: 170,
        h: 16,
        props: {
          platform: { x: 260, y: 290, w: 170, h: 16, type: 'holo' },
        },
      },
    ],
    bubbles: [
      { id: 1, x: 160, y: 270, r: 14 },
      { id: 2, x: 350, y: 270, r: 14 },
      { id: 3, x: 590, y: 270, r: 14 },
    ],
    hazards: [],
    parTime: 14,
    goldenSolution: [
      { time: 2.0, gadgetId: 'g_holo_bridge' },
    ],
  },
  {
    id: 21,
    key: 'level_21',
    act: 5,
    spawn: { x: 40, y: 310, facing: 1 },
    bed: { x: 740, y: 310, w: 56, h: 28 },
    platforms: [
      { id: 'p21_1', x: 20, y: 310, w: 220, type: 'maglev' },
      { id: 'p21_2', x: 410, y: 310, w: 410, type: 'maglev' },
    ],
    gadgets: [
      {
        id: 'g_train_dock',
        type: 'timed',
        duration: 5.5,
        x: 240,
        y: 310,
        w: 170,
        h: 16,
        props: {
          platform: { x: 240, y: 310, w: 170, h: 16, type: 'metal' },
        },
      },
    ],
    bubbles: [
      { id: 1, x: 140, y: 290, r: 14 },
      { id: 2, x: 320, y: 290, r: 14 },
      { id: 3, x: 570, y: 290, r: 14 },
    ],
    hazards: [],
    parTime: 14,
    goldenSolution: [
      { time: 2.2, gadgetId: 'g_train_dock' },
    ],
  },
  {
    id: 22,
    key: 'level_22',
    act: 5,
    spawn: { x: 40, y: 340, facing: 1 },
    bed: { x: 740, y: 220, w: 56, h: 28 },
    platforms: [
      { id: 'p22_1', x: 20, y: 340, w: 220, type: 'space' },
      { id: 'p22_2', x: 350, y: 220, w: 170, type: 'space' },
      { id: 'p22_3', x: 620, y: 220, w: 200, type: 'capsule' },
    ],
    gadgets: [
      {
        id: 'g_cosmic_lift',
        type: 'fan',
        x: 250,
        y: 350,
        w: 90,
        h: 40,
        props: {
          isWind: true,
          windX: 230,
          windY: 140,
          windW: 130,
          windH: 230,
        },
      },
      {
        id: 'g_holo_airlock',
        type: 'toggle',
        x: 520,
        y: 220,
        w: 100,
        h: 16,
        props: {
          platform: { x: 520, y: 220, w: 100, h: 16, type: 'holo' },
        },
      },
    ],
    bubbles: [
      { id: 1, x: 140, y: 320, r: 14 },
      { id: 2, x: 330, y: 160, r: 14 },
      { id: 3, x: 670, y: 200, r: 14 },
    ],
    hazards: [],
    parTime: 16,
    goldenSolution: [
      { time: 1.5, gadgetId: 'g_cosmic_lift' },
      { time: 5.5, gadgetId: 'g_holo_airlock' },
    ],
  },
];

export function getLevelById(id) {
  return LEVELS.find((l) => l.id === id) || LEVELS[0];
}

export function getTotalLevels() {
  return LEVELS.length;
}
