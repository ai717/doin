/**
 * @file games/screw/js/layout.mjs
 * Canvas 逻辑尺寸与五金工坊配色常量（纯数据，DOM-free）。
 */

export const CANVAS_WIDTH = 900;
export const CANVAS_HEIGHT = 1200;

export const GRID = 8;
export const CELL = 80;
export const BOARD_X = 130;
export const BOARD_Y = 210;
export const BOARD_SIZE = GRID * CELL;

export const BOX_SLOT_W = 210;
export const BOX_SLOT_H = 100;
export const BOX_GAP = 18;
export const BOX_Y = 26;

export const BUFFER_Y = 950;

export const SCREW_COLORS = {
  red: '#ff4757',
  yellow: '#ffa502',
  blue: '#1e90ff',
  green: '#2ed573',
  purple: '#8854d0',
};

export const SCREW_LIGHT = {
  red: '#ffb3b9',
  yellow: '#ffe0a3',
  blue: '#a8d4ff',
  green: '#a9f5c6',
  purple: '#d9c0ff',
};

export const SCREW_DARK = {
  red: '#9e1d2a',
  yellow: '#a46000',
  blue: '#0c4f9e',
  green: '#127a3d',
  purple: '#4b2585',
};
