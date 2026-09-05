#!/usr/bin/env python3
"""生成 Tetris Neo 封面：赛博霓虹风，与游戏内视觉一致。640x640 WebP。

用法： python games/tetris-neo/scripts/make_cover.py
产物： assets/covers/tetris-neo.webp（无随机、可重复生成）
"""
from PIL import Image, ImageDraw, ImageFilter
from pathlib import Path

W = H = 640
COLS, ROWS, CELL = 10, 13, 44
BOARD_W, BOARD_H = COLS * CELL, ROWS * CELL
X0, Y0 = (W - BOARD_W) // 2, (H - BOARD_H) // 2

# 与 js/engine.mjs 的 COLORS 逐字一致
COLORS = {
    "I": "#00f0ff",
    "J": "#2563eb",
    "L": "#f97316",
    "O": "#eab308",
    "S": "#10b981",
    "T": "#a855f7",
    "Z": "#ef4444",
}
CYAN = "#00f0ff"
BG_TOP = "#06070a"
BG_BOTTOM = "#0d1017"
WELL = "#05070d"

# 堆叠：每列高度（格数），最右列留空当 I 块井
COLUMN_HEIGHTS = [4, 5, 4, 6, 5, 3, 4, 5, 4, 0]
COLUMN_COLORS = ["J", "S", "L", "T", "O", "Z", "I", "S", "L", None]
CLEAR_ROW = 3  # 从底数第 3 行整行消掉，发白光
ACTIVE = {"type": "T", "col": 3}  # 正在下落的 T

OUT = Path(__file__).resolve().parents[3] / "assets" / "covers" / "tetris-neo.webp"


def background():
    img = Image.new("RGB", (W, H), BG_TOP)
    px = img.load()
    top = tuple(int(BG_TOP[i : i + 2], 16) for i in (1, 3, 5))
    bottom = tuple(int(BG_BOTTOM[i : i + 2], 16) for i in (1, 3, 5))
    for y in range(H):
        t = y / H
        row = tuple(int(top[c] + (bottom[c] - top[c]) * t) for c in range(3))
        for x in range(W):
            px[x, y] = row
    return img


def cell_box(col, row, inset=3):
    x = X0 + col * CELL
    y = Y0 + (ROWS - 1 - row) * CELL  # row 0 = 最底行
    return x + inset, y + inset, x + CELL - inset, y + CELL - inset


def draw_block(layer, box, color, radius=7):
    draw = ImageDraw.Draw(layer)
    r, g, b = tuple(int(color[i : i + 2], 16) for i in (1, 3, 5))
    draw.rounded_rectangle(box, radius=radius, fill=(r, g, b))
    x0, y0, x1, y1 = box
    # 顶部高光 + 底部暗边，做出霓虹浮雕感
    draw.rounded_rectangle((x0 + 2, y0 + 2, x1 - 2, y0 + 8), radius=4,
                           fill=(min(r + 90, 255), min(g + 90, 255), min(b + 90, 255)))
    draw.line((x0 + 4, y1 - 2, x1 - 4, y1 - 2), fill=(r // 2, g // 2, b // 2), width=2)


def main():
    img = background()

    # 井底青辉光
    glow = Image.new("RGB", (W, H), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((X0 - 40, Y0 + BOARD_H - 200, X0 + BOARD_W + 40, Y0 + BOARD_H + 140), fill=(0, 96, 110))
    glow = glow.filter(ImageFilter.GaussianBlur(70))
    img = Image.blend(img, Image.eval(glow, lambda v: min(v, 255)), 0.35)

    # 屏幕玻璃底 + 边框
    frame = ImageDraw.Draw(img)
    frame.rounded_rectangle((X0 - 10, Y0 - 10, X0 + BOARD_W + 10, Y0 + BOARD_H + 10),
                            radius=14, fill=WELL, outline=(0, 150, 170), width=2)
    for c in range(1, COLS):
        x = X0 + c * CELL
        frame.line((x, Y0, x, Y0 + BOARD_H), fill=(255, 255, 255, 26), width=1)
    for r in range(1, ROWS):
        y = Y0 + r * CELL
        frame.line((X0, y, X0 + BOARD_W, y), fill=(255, 255, 255, 26), width=1)

    blocks = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    halos = Image.new("RGBA", (W, H), (0, 0, 0, 0))

    # 已落定的堆叠
    for col, height in enumerate(COLUMN_HEIGHTS):
        color = COLUMN_COLORS[col]
        if not color:
            continue
        for row in range(height):
            if row == CLEAR_ROW:
                continue  # 这一行正在消，单独画
            draw_block(blocks, cell_box(col, row), COLORS[color])
            draw_block(halos, cell_box(col, row, inset=0), COLORS[color], radius=9)

    # 正在消除的一整行：白光爆闪
    for col in range(COLS):
        draw_block(blocks, cell_box(col, CLEAR_ROW), "#ffffff", radius=7)
        draw_block(halos, cell_box(col, CLEAR_ROW, inset=-4), CYAN, radius=11)

    # 下落中的 T（悬在顶部）+ 落点幽灵（停在堆叠之上），都用 cell_box 的"row 0 = 最底行"约定
    active_cells = [(ACTIVE["col"] + 1, 11), (ACTIVE["col"], 10), (ACTIVE["col"] + 1, 10), (ACTIVE["col"] + 2, 10)]
    ghost_cells = [(col, row) for col, row in [(ACTIVE["col"] + 1, 7), (ACTIVE["col"], 6), (ACTIVE["col"] + 1, 6), (ACTIVE["col"] + 2, 6)]]
    ghost_draw = ImageDraw.Draw(blocks)
    for col, row in ghost_cells:
        ghost_draw.rounded_rectangle(cell_box(col, row), radius=7, outline=(0, 240, 255, 130), width=2)
    for col, row in active_cells:
        draw_block(blocks, cell_box(col, row), COLORS[ACTIVE["type"]])
        draw_block(halos, cell_box(col, row, inset=0), COLORS[ACTIVE["type"]], radius=9)

    halos = halos.filter(ImageFilter.GaussianBlur(11))
    halos.putalpha(halos.getchannel("A").point(lambda v: int(v * 0.6)))
    img = Image.alpha_composite(img.convert("RGBA"), halos).convert("RGB")
    img = Image.alpha_composite(img.convert("RGBA"), blocks).convert("RGB")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT, "WEBP", quality=90, method=6)
    print(f"written {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
