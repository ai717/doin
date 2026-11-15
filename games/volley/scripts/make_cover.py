#!/usr/bin/env python3
"""生成 Volley Bombard 封面：明黄到天蓝渐变 + 隔山积木堡垒与金色炮弹。640x640 WebP。

用法： python games/volley/scripts/make_cover.py
产物： assets/covers/volley.webp（无随机、可重复生成）
"""
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

S = 1280  # 2x supersample, final 640
OUT_SIZE = 640
OUT = Path(__file__).resolve().parents[3] / "assets" / "covers" / "volley.webp"

# 西军红（同游戏内 --red 系）与东军蓝（--blue 系）
RED = (240, 96, 74)
RED_DARK = (166, 44, 38)
BLUE = (74, 152, 214)
BLUE_DARK = (38, 84, 138)
GOLD = (255, 214, 118)
WOOD = (150, 116, 74)
WOOD_DARK = (104, 78, 48)
GREEN = (148, 178, 96)
GREEN_DARK = (92, 118, 58)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def background():
    img = Image.new("RGB", (S, S))
    draw = ImageDraw.Draw(img)
    # 沙盘明黄 → 天空蓝 斜向渐变（避开已占用色相）
    top = (252, 226, 132)
    mid = (188, 214, 178)
    bottom = (116, 184, 222)
    for y in range(S):
        t = y / (S - 1)
        if t < 0.5:
            row = lerp(top, mid, t / 0.5)
        else:
            row = lerp(mid, bottom, (t - 0.5) / 0.5)
        draw.line((0, y, S, y), fill=row)

    # 太阳暖光 + 天蓝柔光
    glow = Image.new("RGB", (S, S), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((-S * 0.3, -S * 0.35, S * 0.55, S * 0.5), fill=(255, 240, 180))
    gd.ellipse((S * 0.35, S * 0.1, S * 1.2, S * 0.95), fill=(140, 200, 235))
    glow = glow.filter(ImageFilter.GaussianBlur(150))
    img = Image.blend(img, glow, 0.36)

    # 轻微暖暗角
    vig = Image.new("L", (S, S), 0)
    vd = ImageDraw.Draw(vig)
    vd.ellipse((-S * 0.15, -S * 0.15, S * 1.15, S * 1.15), fill=235)
    vig = vig.filter(ImageFilter.GaussianBlur(170))
    dark = Image.new("RGB", (S, S), (98, 84, 52))
    img = Image.composite(img, dark, vig)
    return img.convert("RGBA")


def rounded_mask(size, radius):
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return mask


def glossy_block(size, color, dark):
    """一块厚实软胶积木：背面厚度、纵向渐变、顶部高光、边缘反光。"""
    pad = 18
    dim = size + pad * 2
    layer = Image.new("RGBA", (dim, dim), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    radius = int(size * 0.22)
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
    """按格子坐标紧排一组积木，绕形状包围盒中心旋转后整体贴到画布。"""
    min_x = min(c[0] for c in cells)
    max_x = max(c[0] for c in cells)
    min_y = min(c[1] for c in cells)
    max_y = max(c[1] for c in cells)
    cols = int(max_x - min_x) + 1
    rows = int(max_y - min_y) + 1
    pad = 18
    span_x = cols * size + pad * 2
    span_y = rows * size + pad * 2
    local = Image.new("RGBA", (span_x, span_y), (0, 0, 0, 0))
    block = glossy_block(size, color, dark)
    for cx, cy in cells:
        px = int(round((cx - min_x) * size))
        py = int(round((cy - min_y) * size))
        local.alpha_composite(block, (px, py))
    rotated = local.rotate(angle, resample=Image.BICUBIC, expand=True)
    base.alpha_composite(rotated, (int(center[0] - rotated.width / 2),
                                   int(center[1] - rotated.height / 2)))
    return rotated.width, rotated.height


def glossy_hill(base):
    """中央绿色软胶小山：两层叠加的圆润弧体 + 顶部高光。"""
    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx, base_y = S / 2, 1010
    # 后层缓坡
    d.ellipse((cx - 560, base_y - 430, cx + 560, base_y + 180), fill=(*lerp(GREEN_DARK, (40, 52, 30), 0.35), 255))
    # 前层主峰
    d.ellipse((cx - 420, base_y - 560, cx + 420, base_y + 240), fill=(*GREEN, 255))
    # 顶部光晕高光
    hi = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    hd = ImageDraw.Draw(hi)
    hd.ellipse((cx - 240, base_y - 560, cx + 240, base_y - 220), fill=(220, 238, 168, 150))
    hi = hi.filter(ImageFilter.GaussianBlur(60))
    layer = Image.alpha_composite(layer, hi)
    # 底部融入地面阴影
    fade = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    fd = ImageDraw.Draw(fade)
    fd.ellipse((cx - 520, base_y - 40, cx + 520, base_y + 260), fill=(72, 88, 44, 190))
    fade = fade.filter(ImageFilter.GaussianBlur(70))
    layer = Image.alpha_composite(layer, fade)
    base.alpha_composite(layer)


def wind_flag(base):
    """山顶木质风旗，旗面指向右上（风从西来）。"""
    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx, cy = S / 2, 470
    # 旗杆
    d.rounded_rectangle((cx - 7, cy - 190, cx + 7, cy + 10), radius=6, fill=(*WOOD_DARK, 255))
    # 金色顶饰
    d.ellipse((cx - 16, cy - 222, cx + 16, cy - 190), fill=(*GOLD, 255))
    # 飘旗面（梯形，微卷）
    flag = Image.new("RGBA", (360, 200), (0, 0, 0, 0))
    fd = ImageDraw.Draw(flag)
    fd.polygon([(10, 30), (330, 10), (350, 96), (30, 150)], fill=(255, 236, 168, 245))
    fd.polygon([(10, 30), (330, 10), (326, 34), (16, 58)], fill=(255, 255, 255, 110))
    flag = flag.rotate(-8, resample=Image.BICUBIC, expand=True)
    layer.alpha_composite(flag, (int(cx + 4), int(cy - 208)))
    base.alpha_composite(layer)


def shell_arc(base):
    """金色炮弹越过山头的虚线弹道 + 高光弹体。"""
    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    # 虚线抛物线（西侧炮位 → 东侧堡垒）
    pts = []
    for i in range(61):
        t = i / 60
        x = 150 + (1130 - 150) * t
        y = 950 - 3.1 * (x - 150) * (x - 1130) ** 0 / 1 - 620 * math.sin(math.pi * t) + 60 * t
        pts.append((x, y))
    d.line(pts, fill=(255, 244, 206, 150), width=7)
    dash = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    dd = ImageDraw.Draw(dash)
    # 把实线改造成虚线：每隔一段挖空
    for i in range(0, len(pts) - 1):
        if (i // 4) % 2 == 0:
            dd.line([pts[i], pts[i + 1]], fill=(255, 244, 206, 170), width=7)
    base.alpha_composite(dash)
    # 弹体（顶点处）
    sx, sy = pts[30]
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for r, a in ((120, 70), (70, 110), (36, 180)):
        gd.ellipse((sx - r, sy - r, sx + r, sy + r), fill=(*GOLD, a))
    glow = glow.filter(ImageFilter.GaussianBlur(30))
    base.alpha_composite(glow)
    ball = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    bd = ImageDraw.Draw(ball)
    bd.ellipse((sx - 46, sy - 46, sx + 46, sy + 46), fill=(*lerp(GOLD, (255, 255, 255), 0.3), 255))
    bd.ellipse((sx - 46, sy - 46, sx + 46, sy + 46), outline=(*lerp(GOLD, (120, 80, 20), 0.4), 255), width=4)
    bd.ellipse((sx - 28, sy - 34, sx - 4, sy - 14), fill=(255, 255, 255, 170))
    base.alpha_composite(ball)
    layer = layer
    return sx, sy


def particles(base):
    rng = random.Random(20261115)
    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for _ in range(58):
        x = rng.uniform(40, S - 40)
        y = rng.uniform(40, S - 40)
        if 380 < x < 960 and 320 < y < 950:
            continue  # 主体附近留干净
        r = rng.choice([2, 3, 4, 5, 6, 8])
        col = rng.choice([GOLD, (255, 255, 255), (255, 236, 190), (120, 190, 235)])
        a = rng.randint(60, 190)
        d.ellipse((x - r, y - r, x + r, y + r), fill=(*col, a))
    for _ in range(10):
        x = rng.uniform(60, S - 60)
        y = rng.uniform(60, S - 60)
        if 380 < x < 960 and 320 < y < 950:
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
    sd.ellipse((170, 920, 1150, 1080), fill=(84, 96, 58, 170))
    shadow = shadow.filter(ImageFilter.GaussianBlur(52))
    img.alpha_composite(shadow)

    # 东侧积木堡垒（3 层错位，红旗立在顶层）
    size = 128
    fort = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    place_cluster(fort, [(0, 2), (1, 2), (2, 2)], (960, 860), size, RED, RED_DARK, 0)
    place_cluster(fort, [(0.35, 1), (1.4, 1)], (960, 700), size, RED, RED_DARK, 0)
    place_cluster(fort, [(0.8, 0)], (960, 545), size, RED, RED_DARK, 0)
    img.alpha_composite(fort)
    # 堡垒顶小旗
    flagpole = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    fd = ImageDraw.Draw(flagpole)
    fd.rounded_rectangle((958, 380, 968, 500), radius=4, fill=(*WOOD_DARK, 255))
    fd.polygon([(968, 388), (1030, 402), (968, 424)], fill=(255, 120, 110, 255))
    img.alpha_composite(flagpole)

    # 西侧木质炮台（斜置炮管）
    cannon = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    cd = ImageDraw.Draw(cannon)
    barrel = Image.new("RGBA", (300, 110), (0, 0, 0, 0))
    bd = ImageDraw.Draw(barrel)
    bd.rounded_rectangle((0, 30, 280, 92), radius=30, fill=(*WOOD, 255))
    bd.rounded_rectangle((0, 30, 280, 54), radius=24, fill=(190, 158, 108, 255))
    bd.rounded_rectangle((236, 22, 292, 100), radius=22, fill=(*WOOD_DARK, 255))
    barrel = barrel.rotate(38, resample=Image.BICUBIC, expand=True)
    cannon.alpha_composite(barrel, (120, 560))
    cd.rounded_rectangle((120, 740, 400, 850), radius=34, fill=(*WOOD_DARK, 255))
    cd.rounded_rectangle((140, 740, 380, 790), radius=24, fill=(*lerp(WOOD_DARK, (255, 255, 255), 0.18), 255))
    # 底座轮子
    cd.ellipse((150, 800, 250, 900), fill=(*lerp(WOOD, (0, 0, 0), 0.25), 255))
    cd.ellipse((290, 800, 390, 900), fill=(*lerp(WOOD, (0, 0, 0), 0.25), 255))
    cd.ellipse((180, 828, 220, 868), fill=(*lerp(WOOD, (255, 255, 255), 0.35), 255))
    cd.ellipse((320, 828, 360, 868), fill=(*lerp(WOOD, (255, 255, 255), 0.35), 255))
    img.alpha_composite(cannon)

    glossy_hill(img)
    wind_flag(img)
    shell_arc(img)
    particles(img)

    img = img.resize((OUT_SIZE, OUT_SIZE), Image.LANCZOS).convert("RGB")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT, "WEBP", quality=92, method=6)
    print(f"written {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
