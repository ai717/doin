# Procedural soft-gel cover for unravel (640x640 WebP, no text).
# Style per docs/COVER-STYLE.md: 3D clay yarn ball, warm amber/copper gradient,
# floating particles, single centered subject at ~65%.
import math
import random

from PIL import Image, ImageDraw, ImageFilter

SIZE = 1280
FINAL = 640


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))


def background(size):
    small = 96
    img = Image.new("RGB", (small, small))
    top = (244, 196, 122)
    mid = (214, 146, 74)
    bottom = (150, 88, 40)
    px = img.load()
    for y in range(small):
        for x in range(small):
            t = y / (small - 1)
            base = lerp(top, mid, t * 2) if t < 0.5 else lerp(mid, bottom, (t - 0.5) * 2)
            # soft center light
            dx = (x / small - 0.5) * 2
            dy = (y / small - 0.5) * 2
            d = math.hypot(dx, dy)
            glow = max(0.0, 1.0 - d * 0.9) * 34
            px[x, y] = tuple(min(255, int(c + glow)) for c in base)
    return img.resize((size, size), Image.BICUBIC)


def yarn_ball(layer, cx, cy, r, light, dark, arc_dark, seed):
    draw = ImageDraw.Draw(layer, "RGBA")
    # sphere body: concentric radial gradient via rings
    rings = 56
    for i in range(rings, 0, -1):
        t = i / rings
        color = lerp(light, dark, t)
        rr = r * (1.02 - 0.0) * t
        draw.ellipse(
            [cx - rr, cy - rr, cx + rr, cy + rr],
            fill=color + (255,),
        )
    # wrapped yarn strands: arcs of offset circles clipped to the ball
    rng = random.Random(seed)
    arcs = 9
    for i in range(arcs):
        angle = rng.uniform(0, math.pi)
        off = rng.uniform(-r * 0.75, r * 0.75)
        bend = rng.uniform(r * 0.35, r * 0.8) * rng.choice([-1, 1])
        shade = lerp(arc_dark, dark, rng.uniform(0.1, 0.55))
        # approximate the wrap with many small circles along a bent path
        steps = 26
        x1 = cx - r * math.cos(angle)
        y1 = cy - r * math.sin(angle)
        x2 = cx + r * math.cos(angle)
        y2 = cy + r * math.sin(angle)
        nx = -math.sin(angle)
        ny = math.cos(angle)
        pts = []
        for s in range(steps + 1):
            t = s / steps
            px_ = lerp((int(x1), int(y1)), (int(x2), int(y2)), t)
            b = math.sin(t * math.pi) * bend
            pts.append((px_[0] + nx * b, px_[1] + ny * b))
        width = max(6, int(r * 0.055))
        for j in range(len(pts) - 1):
            draw.line([pts[j], pts[j + 1]], fill=shade + (255,), width=width)
    # soft top-left highlight
    hl = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    hdraw = ImageDraw.Draw(hl)
    hdraw.ellipse(
        [cx - r * 0.55, cy - r * 0.72, cx + r * 0.15, cy - r * 0.05],
        fill=(255, 255, 255, 88),
    )
    hl = hl.filter(ImageFilter.GaussianBlur(r * 0.12))
    layer.alpha_composite(hl)
    # rim shading bottom-right
    rim = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    rdraw = ImageDraw.Draw(rim)
    rdraw.ellipse(
        [cx - r, cy - r, cx + r, cy + r],
        outline=(90, 30, 20, 130),
        width=max(4, int(r * 0.06)),
    )
    rim = rim.filter(ImageFilter.GaussianBlur(r * 0.05))
    layer.alpha_composite(rim)


def particles(layer, size, seed, count=26):
    rng = random.Random(seed)
    draw = ImageDraw.Draw(layer, "RGBA")
    for _ in range(count):
        x = rng.uniform(size * 0.05, size * 0.95)
        y = rng.uniform(size * 0.05, size * 0.8)
        rr = rng.uniform(3, 11)
        alpha = rng.randint(60, 150)
        color = (255, 240, 214, alpha)
        draw.ellipse([x - rr, y - rr, x + rr, y + rr], fill=color)


def main():
    random.seed(11)
    img = background(SIZE).convert("RGBA")
    # ground shadows
    shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.ellipse([330, 950, 950, 1060], fill=(70, 34, 10, 130))
    sd.ellipse([840, 990, 1120, 1060], fill=(70, 34, 10, 110))
    sd.ellipse([150, 1010, 400, 1070], fill=(70, 34, 10, 100))
    shadow = shadow.filter(ImageFilter.GaussianBlur(24))
    img.alpha_composite(shadow)

    # main coral-red yarn ball
    main_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    yarn_ball(
        main_layer, 640, 620, 330,
        light=(255, 150, 124), dark=(201, 74, 60), arc_dark=(154, 44, 36), seed=7,
    )
    img.alpha_composite(main_layer)

    # companion balls: teal and amber
    teal = Image.new("RGBA", img.size, (0, 0, 0, 0))
    yarn_ball(
        teal, 980, 940, 110,
        light=(126, 214, 202), dark=(58, 141, 132), arc_dark=(40, 104, 98), seed=21,
    )
    img.alpha_composite(teal)
    amber = Image.new("RGBA", img.size, (0, 0, 0, 0))
    yarn_ball(
        amber, 280, 980, 88,
        light=(255, 208, 128), dark=(216, 148, 54), arc_dark=(172, 106, 34), seed=33,
    )
    img.alpha_composite(amber)

    # a loose strand trailing from the main ball
    trail = Image.new("RGBA", img.size, (0, 0, 0, 0))
    td = ImageDraw.Draw(trail)
    width = 18
    pts = []
    for s in range(40):
        t = s / 39
        x = 940 + t * 220
        y = 690 + math.sin(t * math.pi * 1.4) * 60
        pts.append((x, y))
    for j in range(len(pts) - 1):
        td.line([pts[j], pts[j + 1]], fill=(170, 52, 42, 255), width=width)
    img.alpha_composite(trail)

    particles(img, SIZE, 99)

    final = img.convert("RGB").resize((FINAL, FINAL), Image.LANCZOS)
    final.save(
        "assets/covers/unravel.webp",
        "WEBP",
        quality=90,
        method=6,
    )
    print("saved assets/covers/unravel.webp")


if __name__ == "__main__":
    main()
