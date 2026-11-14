// code.mjs —— 巷码：把一张自定义迷宫压成可复制粘贴的字符串（零后端分享）。同码必同图。

import { BRUSH_TILE, TILE_BRUSH, WALL, SPAWN } from "./engine.mjs";

export const CODE_PREFIX = "LM1";
export const MAZE_W = 19;
export const MAZE_H = 21;

const TILE_CODE = {
  [WALL]: "1",
  [BRUSH_TILE.dot]: "2",
  [BRUSH_TILE.pearl]: "3",
  [BRUSH_TILE.path]: "4",
  [BRUSH_TILE.house]: "5",
  [BRUSH_TILE.door]: "6",
  [SPAWN]: "7",
  [BRUSH_TILE.fruit]: "8",
  [BRUSH_TILE.noup]: "9",
};
const CODE_TILE = Object.fromEntries(Object.entries(TILE_CODE).map(([t, c]) => [c, t]));

function pad(n, len) {
  let s = (Number(n) >>> 0).toString(36).toUpperCase();
  while (s.length < len) s = `0${s}`;
  return s.length > len ? s.slice(-len) : s;
}

function unpad(s) {
  const n = parseInt(s, 36);
  return Number.isFinite(n) ? n : -1;
}

export function blankRows(w = MAZE_W, h = MAZE_H) {
  return Array.from({ length: h }, () => WALL.repeat(w));
}

export function rowsValid(rows, w = MAZE_W, h = MAZE_H) {
  if (!Array.isArray(rows) || rows.length !== h) return false;
  return rows.every((r) => typeof r === "string" && r.length === w && [...r].every((c) => c in TILE_BRUSH || c === WALL || c === " "));
}

export function normalizeRows(rows) {
  return (rows ?? []).map((r) =>
    [...String(r)].map((c) => (c === " " ? WALL : c in TILE_BRUSH ? c : WALL)).join("")
  );
}

/** 左右镜像（编辑台的对称笔刷）：以中线 x = (w-1)/2 翻转 */
export function mirrorRows(rows) {
  const src = normalizeRows(rows);
  if (!src.length) return src;
  const w = Math.max(...src.map((r) => r.length));
  return src.map((r) => {
    const row = (r + WALL.repeat(w)).slice(0, w);
    const half = Math.ceil(w / 2);
    const left = [...row.slice(0, half)];
    const right = [...row.slice(0, w - half)].reverse();
    return left.join("") + right.join("");
  });
}

export function encodeRows(rows) {
  const src = normalizeRows(rows);
  if (src.length !== MAZE_H) return "";
  const w = src[0].length;
  const flat = src.map((r) => (r + WALL.repeat(w)).slice(0, w)).join("");
  const runs = [];
  for (const ch of flat) {
    const code = TILE_CODE[ch] ?? TILE_CODE[WALL];
    const last = runs[runs.length - 1];
    if (last && last.code === code && last.n < 1295) last.n += 1;
    else runs.push({ code, n: 1 });
  }
  const body = runs.map((r) => r.code + pad(r.n, 2)).join("");
  const groups = body.match(/.{1,12}/g) ?? [];
  return `${CODE_PREFIX}-${pad(w, 2)}${pad(src.length, 2)}-${groups.join("-")}`.toUpperCase();
}

export function tidyCode(input) {
  return String(input ?? "")
    .toUpperCase()
    .replace(/[\s_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** @returns {{ok:boolean, rows?:string[], error?:string}} */
export function decodeRows(input) {
  const code = tidyCode(input).replace(/-/g, "");
  if (!code.startsWith(CODE_PREFIX)) return { ok: false, error: "prefix" };
  const body = code.slice(CODE_PREFIX.length);
  if (body.length < 4) return { ok: false, error: "short" };
  const w = unpad(body.slice(0, 2));
  const h = unpad(body.slice(2, 4));
  if (w <= 0 || h <= 0 || w > 40 || h > 40) return { ok: false, error: "dims" };
  const runs = body.slice(4);
  if (runs.length % 3 !== 0) return { ok: false, error: "runs" };
  let flat = "";
  for (let i = 0; i < runs.length; i += 3) {
    const tile = CODE_TILE[runs[i]];
    const n = unpad(runs.slice(i + 1, i + 3));
    if (!tile || n < 0) return { ok: false, error: "tile" };
    flat += tile.repeat(n);
    if (flat.length > w * h) return { ok: false, error: "overflow" };
  }
  if (flat.length !== w * h) return { ok: false, error: "length" };
  const rows = [];
  for (let y = 0; y < h; y += 1) rows.push(flat.slice(y * w, y * w + w));
  if (!rows.some((r) => r.includes(SPAWN))) return { ok: false, error: "noSpawn" };
  return { ok: true, rows };
}

export function codeLength(input) {
  return tidyCode(input).length;
}
