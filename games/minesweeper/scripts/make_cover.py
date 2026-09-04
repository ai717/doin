#!/usr/bin/env python3
"""生成扫雷封面：Neon Grid 深色霓虹风，与游戏内视觉一致。640x640 WebP。"""
import math
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W = H = 640
CELL = 64
PAD = (W - CELL * 8) // 2  # 居中放 8x8
NUM_COLORS = {
    1: "#4fc3f7", 2: "#69f0ae", 3: "#ff5b6e", 4: "#b388ff",
    5: "#ffd54f", 6: "#40c4ff", 7: "#ff8a80", 8: "#cfd8dc",
}

img = Image.new("RGB", (W, H), "#0e131a")
px = img.load()
for y in range(H):
    t = y / H
    r = int(0x0E + (0x14 - 0x0E) * t)
    g = int(0x13 + (0x1A - 0x13) * t)
    b = int(0x1A + (0x22 - 0x1A) * t)
    for x in range(W):
        px[x, y] = (r, g, b)

d = ImageDraw.Draw(img)


def cell_box(cx, cy):
    x0 = PAD + cx * CELL
    y0 = PAD + cy * CELL
    return x0 + 3, y0 + 3, x0 + CELL - 3, y0 + CELL - 3


def hidden_cell(cx, cy):
    x0, y0, x1, y1 = cell_box(cx, cy)
    d.rounded_rectangle([x0, y0, x1, y1], radius=8, fill="#2b3341", outline="#0a0e14", width=2)
    d.line([(x0 + 6, y0 + 6), (x1 - 6, y0 + 6)], fill="#3a4556", width=2)
    d.line([(x0 + 6, y1 - 6), (x1 - 6, y1 - 6)], fill="#171d27", width=2)


def revealed_cell(cx, cy, num):
    x0, y0, x1, y1 = cell_box(cx, cy)
    d.rounded_rectangle([x0, y0, x1, y1], radius=8, fill="#141a22", outline="#0a0e14", width=2)
    f = ImageFont.load_default(28)
    d.text((x0 + (x1 - x0) // 2, y0 + (y1 - y0) // 2), str(num),
           fill=NUM_COLORS[num], anchor="mm", font=f)


def flag_cell(cx, cy):
    x0, y0 = PAD + cx * CELL, PAD + cy * CELL
    xc, yc = x0 + CELL // 2, y0 + CELL // 2
    hidden_cell(cx, cy)
    d.line([(xc, yc - 16), (xc, yc + 16)], fill="#cfd8dc", width=3)
    d.polygon([(xc, yc - 16), (xc + 18, yc - 9), (xc, yc - 2)], fill="#ff4d6d")
    d.line([(xc - 14, yc + 16), (xc + 14, yc + 16)], fill="#cfd8dc", width=3)


def mine_cell(cx, cy):
    x0, y0 = PAD + cx * CELL, PAD + cy * CELL
    xc, yc = x0 + CELL // 2, y0 + CELL // 2
    bx0, by0, bx1, by1 = cell_box(cx, cy)
    d.rounded_rectangle([bx0, by0, bx1, by1], radius=8, fill="#1a1016", outline="#0a0e14", width=2)
    # 暗色光晕（不用透明 mask，直接画同心椭圆）
    d.ellipse([xc - 20, yc - 20, xc + 20, yc + 20], fill="#3a1020")
    d.ellipse([xc - 10, yc - 10, xc + 10, yc + 10], fill="#ff5277", outline="#ffd0dc")
    for ang in range(0, 360, 45):
        a = math.radians(ang)
        d.line([(xc, yc), (xc + 20 * math.cos(a), yc + 20 * math.sin(a))], fill="#ff8aa3", width=3)


for cy in range(8):
    for cx in range(8):
        hidden_cell(cx, cy)

revealed = [(0, 0, 1), (1, 0, 2), (2, 0, 1), (0, 1, 2), (1, 1, 3), (2, 1, 1),
            (0, 2, 1), (1, 2, 2), (2, 2, 2)]
for cx, cy, n in revealed:
    revealed_cell(cx, cy, n)

flag_cell(6, 6)
mine_cell(5, 5)

try:
    title_font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 38)
except Exception:
    title_font = ImageFont.load_default(38)
d.text((W // 2, H - 30), "扫雷 · MINESWEEPER", fill="#e6f7ff", anchor="mm", font=title_font)

img.save("G:/work/code/game/doin/assets/covers/minesweeper.webp", "WEBP", quality=92)
print("cover written ->", img.size)
