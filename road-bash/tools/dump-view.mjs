// 无 DOM 透视抽帧：把公路投影画成 PPM，供人工核对「路在下、天在上」。
import { writeFileSync } from "node:fs";
import { createRace, playerOf } from "../js/engine.mjs";
import { CAM_BACK, DRAW_DIST, HORIZON, SEG, VH, VW, projectSway, projectWorld } from "../js/render.mjs";
import { hillAt } from "../js/engine.mjs";

const race = createRace({ mode: "league", raceId: 0, seed: 1 });
race.status = "racing";
race.countdown = 0;
const player = playerOf(race);
player.z = 40;
player.x = 0.15;
const cam = { z: player.z - CAM_BACK, x: player.x * 0.72 };
const track = race.spec.track;

const buf = Buffer.alloc(VW * VH * 3);
function setPx(x, y, r, g, b) {
  if (x < 0 || y < 0 || x >= VW || y >= VH) return;
  const i = (y * VW + x) * 3;
  buf[i] = r;
  buf[i + 1] = g;
  buf[i + 2] = b;
}
function fillRect(x0, y0, x1, y1, r, g, b) {
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) setPx(x, y, r, g, b);
  }
}
fillRect(0, 0, VW, HORIZON, 255, 107, 61);
fillRect(0, HORIZON, VW, VH, 37, 82, 52);

function project(z) {
  return projectWorld({ ...cam, sway: projectSway(z, track) }, 0, z, hillAt(z, track));
}
const segs = [];
for (let z = cam.z + SEG; z < cam.z + DRAW_DIST; z += SEG) {
  const pr = project(z);
  if (pr) segs.push(pr);
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
for (let i = segs.length - 2; i >= 0; i -= 1) {
  const a = segs[i];
  const b = segs[i + 1];
  if (b.y >= a.y - 0.5) continue;
  const odd = i % 2 === 0;
  const y0 = Math.max(0, Math.round(Math.min(a.y, b.y)));
  const y1 = Math.min(VH - 1, Math.round(Math.max(a.y, b.y)));
  const span = b.y - a.y;
  for (let y = y0; y <= y1; y += 1) {
    const t = (y - a.y) / (Math.abs(span) < 0.001 ? 1 : span);
    const cx = lerp(a.x, b.x, t);
    const w = lerp(a.w, b.w, t);
    const x0 = Math.round(cx - w);
    const x1 = Math.round(cx + w);
    for (let x = x0; x <= x1; x += 1) {
      const rumble = x < cx - w * 0.86 || x > cx + w * 0.86;
      if (rumble) setPx(x, y, odd ? 242 : 196, odd ? 212 : 61, odd ? 74 : 61);
      else setPx(x, y, odd ? 62 : 51, odd ? 66 : 54, odd ? 72 : 59);
    }
  }
}
const pr = projectWorld({ ...cam, sway: projectSway(player.z, track) }, player.x, player.z, 0);
if (pr) {
  for (let dy = -18; dy <= 8; dy += 1) {
    for (let dx = -14; dx <= 14; dx += 1) setPx(Math.round(pr.x + dx), Math.round(pr.y + dy), 226, 75, 50);
  }
}

const header = Buffer.from(`P6\n${VW} ${VH}\n255\n`);
writeFileSync(new URL("./dump-view.ppm", import.meta.url), Buffer.concat([header, buf]));
console.log("player", pr, "horizon", HORIZON, "nearY", segs[0]?.y, "farY", segs.at(-1)?.y);
