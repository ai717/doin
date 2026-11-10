#!/usr/bin/env python3
"""生成 Block Duel 封面：明亮橙红渐变 + 双色软胶方块对撞。640x640 WebP。

用法： python games/blockduel/scripts/make_cover.py
产物： assets/covers/blockduel.webp（无随机、可重复生成）
"""
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

S = 1280  # 2x supersample, final 640
OUT_SIZE = 640
OUT = Path(__file__).resolve().parents[3] / "assets" / "covers" / "blockduel.webp"

RED = (242, 68, 84)
RED_DARK = (168, 26, 52)
BLUE = (48, 128, 240)
BLUE_DARK = (24, 62, 150)
GOLD = (255, 214, 112)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def background():
    img = Image.new("RGB", (S, S))
    draw = ImageDraw.Draw(img)
    # 斜向明亮橙红渐变，绝非白/黑/暗霓虹
    top = (255, 178, 92)
    mid = (255, 106, 74)
    bottom = (214, 42, 96)
    for y in range(S):
        t = y / (S - 1)
        if t < 0.55:
            row = lerp(top, mid, t / 0.55)
        else:
            row = lerp(mid, bottom, (t - 0.55) / 0.45)
        draw.line((0, y, S, y), fill=row)

    # 左上暖金光晕 + 中心柔光
    glow = Image.new("RGB", (S, S), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((-S * 0.25, -S * 0.3, S * 0.85, S * 0.65), fill=(255, 226, 150))
    gd.ellipse((S * 0.18, S * 0.08, S * 1.0, S * 0.9), fill=(255, 120, 120))
    glow = glow.filter(ImageFilter.GaussianBlur(150))
    img = Image.blend(img, glow, 0.34)

    # 轻微暗角，保持整体明亮
    vig = Image.new("L", (S, S), 0)
    vd = ImageDraw.Draw(vig)
    vd.ellipse((-S * 0.15, -S * 0.15, S * 1.15, S * 1.15), fill=235)
    vig = vig.filter(ImageFilter.GaussianBlur(170))
    dark = Image.new("RGB", (S, S), (120, 20, 60))
    img = Image.composite(img, dark, vig)
    return img.convert("RGBA")


def rounded_mask(size, radius):
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return mask


def glossy_block(size, color, dark):
    """一块厚实软胶方块：背面厚度、纵向渐变、顶部高光、边缘反光。"""
    pad = 18
    dim = size + pad * 2
    layer = Image.new("RGBA", (dim, dim), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    radius = int(size * 0.23)
    x0 = pad
    top = lerp(color, (255, 255, 255), 0.22)
    bottom = lerp(dark, (0, 0, 0), 0.12)

    # 底部厚度层
    draw.rounded_rectangle((x0, x0 + 11, x0 + size, x0 + size + 11),
                           radius=radius, fill=dark)
    # 纵向渐变面
    grad = Image.new("RGB", (size, size))
    gp = grad.load()
    for y in range(size):
        t = y / (size - 1)
        if t < 0.42:
            c = lerp(top, color, t / 0.42)
        else:
            c = lerp(color, bottom, (t - 0.42) / 0.58)
        for x in range(size):
            gp[x, y] = c
    layer.paste(grad, (x0, x0), rounded_mask(size, radius))

    # 顶部玻璃高光
    shine = Image.new("RGBA", (dim, dim), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shine)
    sd.rounded_rectangle((x0 + 12, x0 + 8, x0 + size - 12, x0 + int(size * 0.27)),
                         radius=int(radius * 0.7), fill=(255, 255, 255, 62))
    shine = shine.filter(ImageFilter.GaussianBlur(7))
    layer = Image.alpha_composite(layer, shine)

    # 下缘内阴影
    shade = Image.new("RGBA", (dim, dim), (0, 0, 0, 0))
    shd = ImageDraw.Draw(shade)
    shd.rounded_rectangle((x0 + 3, x0 + int(size * 0.62), x0 + size - 3, x0 + size - 2),
                          radius=int(radius * 0.55), fill=(*dark, 86))
    shade = shade.filter(ImageFilter.GaussianBlur(14))
    mask = Image.new("L", (dim, dim), 0)
    ImageDraw.Draw(mask).rounded_rectangle((x0, x0, x0 + size, x0 + size), radius=radius, fill=255)
    shade.putalpha(Image.composite(shade.getchannel("A"), Image.new("L", (dim, dim), 0), mask))
    layer = Image.alpha_composite(layer, shade)

    # 外缘细反光 + 左上角方光
    draw = ImageDraw.Draw(layer)
    draw.rounded_rectangle((x0 + 1, x0 + 1, x0 + size - 1, x0 + size - 1),
                           radius=radius, outline=(255, 255, 255, 54), width=2)
    dot = Image.new("RGBA", (dim, dim), (0, 0, 0, 0))
    dd = ImageDraw.Draw(dot)
    dd.ellipse((x0 + size * 0.16, x0 + size * 0.13, x0 + size * 0.34, x0 + size * 0.24),
               fill=(255, 255, 255, 132))
    dot = dot.filter(ImageFilter.GaussianBlur(6))
    layer = Image.alpha_composite(layer, dot)
    return layer


def place_cluster(base, cells, center, size, color, dark, angle):
    """按格子坐标紧排一组方块，绕形状包围盒中心旋转后整体贴到画布。"""
    min_x = min(c[0] for c in cells)
    max_x = max(c[0] for c in cells)
    min_y = min(c[1] for c in cells)
    max_y = max(c[1] for c in cells)
    cols = max_x - min_x + 1
    rows = max_y - min_y + 1
    pad = 18
    span_x = cols * size + pad * 2
    span_y = rows * size + pad * 2
    local = Image.new("RGBA", (span_x, span_y), (0, 0, 0, 0))
    block = glossy_block(size, color, dark)
    for cx, cy in cells:
        px = (cx - min_x) * size
        py = (cy - min_y) * size
        local.alpha_composite(block, (px, py))
    rotated = local.rotate(angle, resample=Image.BICUBIC, expand=True)
    base.alpha_composite(rotated, (int(center[0] - rotated.width / 2),
                                   int(center[1] - rotated.height / 2)))
    return rotated.width, rotated.height


def spark(base, cx, cy):
    # 中心撞击光晕
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for r, a in ((150, 64), (86, 104), (40, 170)):
        gd.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(*GOLD, a))
    glow = glow.filter(ImageFilter.GaussianBlur(36))
    base.alpha_composite(glow)

    star = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    sd = ImageDraw.Draw(star)
    pts = []
    for i in range(16):
        ang = -math.pi / 2 + i * math.pi / 8
        rad = 58 if i % 2 == 0 else 20
        pts.append((cx + math.cos(ang) * rad, cy + math.sin(ang) * rad))
    sd.polygon(pts, fill=(255, 248, 216, 255))
    star = star.filter(ImageFilter.GaussianBlur(2))
    base.alpha_composite(star)

    core = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    cd = ImageDraw.Draw(core)
    cd.ellipse((cx - 18, cy - 18, cx + 18, cy + 18), fill=(255, 255, 255, 255))
    core = core.filter(ImageFilter.GaussianBlur(2))
    base.alpha_composite(core)


def particles(base):
    rng = random.Random(20261110)
    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for _ in range(58):
        x = rng.uniform(40, S - 40)
        y = rng.uniform(40, S - 40)
        if 380 < x < 900 and 380 < y < 920:
            continue  # 主体附近留干净
        r = rng.choice([2, 3, 4, 5, 6, 8])
        col = rng.choice([GOLD, (255, 255, 255), (255, 236, 190), (255, 150, 120)])
        a = rng.randint(60, 190)
        d.ellipse((x - r, y - r, x + r, y + r), fill=(*col, a))
    for _ in range(12):
        x = rng.uniform(60, S - 60)
        y = rng.uniform(60, S - 60)
        if 380 < x < 900 and 380 < y < 920:
            continue
        s = rng.choice([7, 9, 12])
        col = rng.choice([RED, BLUE, GOLD, (255, 255, 255)])
        d.rounded_rectangle((x - s, y - s, x + s, y + s), radius=3, fill=(*col, 110))
    layer = layer.filter(ImageFilter.GaussianBlur(1.2))
    base.alpha_composite(layer)


def main():
    img = background()

    # 地面投影
    shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.ellipse((210, 900, 1130, 1050), fill=(120, 16, 48, 170))
    shadow = shadow.filter(ImageFilter.GaussianBlur(52))
    img.alpha_composite(shadow)

    size = 210
    # 蓝方 T 块竖立、尖角朝右（向右倾）
    blue_cells = [(0, -1), (0, 0), (0, 1), (1, 0)]
    place_cluster(img, blue_cells, (550, 690), size, BLUE, BLUE_DARK, -6)
    # 红方 T 块竖立、尖角朝左（向左倾）
    red_cells = [(0, -1), (0, 0), (0, 1), (-1, 0)]
    place_cluster(img, red_cells, (970, 690), size, RED, RED_DARK, 6)

    spark(img, 760, 690)
    particles(img)

    img = img.resize((OUT_SIZE, OUT_SIZE), Image.LANCZOS).convert("RGB")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT, "WEBP", quality=92, method=6)
    print(f"written {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
