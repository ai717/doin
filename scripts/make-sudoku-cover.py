"""
Sudoku cover image, isometric 3D look matching the 2048 cover aesthetic.

Style: warm cream/beige palette, chunky 3D rounded tiles with visible side
thickness and perspective tilt, central tile shows a 9x9 sudoku grid with one
highlighted cell; surrounding tiles each show a single digit 1-9. Soft warm
glow, subtle confetti particles and tiny arrows.
Output: G:/work/code/game/doin/assets/covers/sudoku.png at 630x500.
"""
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import math
import random
import os

W, H = 630, 500
random.seed(11)

# ---- Palette ----
BG_TOP     = (243, 232, 214)
BG_BOT     = (230, 211, 184)
INK        = (45, 38, 30)
INK_SOFT   = (60, 50, 38)
ACCENT     = (160, 58, 48)         # dark red highlight (matches #9A3B2F)
SHADOW     = (110, 85, 60)
SOFT_GLOW  = (255, 225, 175)

# ---- Font helper ----
def _font():
    for c in [
        "C:/Windows/Fonts/seguisb.ttf",
        "C:/Windows/Fonts/segoeuib.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
        "C:/Windows/Fonts/arial.ttf",
    ]:
        if os.path.exists(c):
            return c
    return None
FONT_PATH = _font()

# ---- Background ----
def gradient_bg(w, h):
    img = Image.new("RGB", (w, h), BG_TOP)
    px = img.load()
    for y in range(h):
        t = y / max(1, h - 1)
        r = int(BG_TOP[0] * (1 - t) + BG_BOT[0] * t)
        g = int(BG_TOP[1] * (1 - t) + BG_BOT[1] * t)
        b = int(BG_TOP[2] * (1 - t) + BG_BOT[2] * t)
        for x in range(w):
            px[x, y] = (r, g, b)
    return img

def soft_radial_glow(canvas, cx, cy, radius, color, alpha=120):
    glow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(glow)
    for i in range(int(radius), 0, -4):
        a = int(alpha * (1 - i / radius) ** 2 * 0.35)
        d.ellipse([cx - i, cy - i, cx + i, cy + i], fill=(*color, a))
    glow = glow.filter(ImageFilter.GaussianBlur(6))
    canvas.alpha_composite(glow)

# ---- Isometric 3D tile ----
# We render the tile as 3 visible faces in 3/4 isometric perspective:
#   - top face  (rounded square, slightly trapezoidal)
#   - right side face
#   - bottom side face
# Skew parameters approximate a 30-35 deg camera.
SKEW_X = 0.18   # horizontal tilt
SKEW_Y = 0.10   # vertical tilt

def iso_project(cx, cy, sx, sy, depth, tilt_x=SKEW_X, tilt_y=SKEW_Y):
    """Project a 3D point (sx,sy on top, depth) onto 2D (cx,cy origin)."""
    # top face point: slightly shrunk and skewed
    dx = sx * (1 - tilt_x)
    dy = sy * (1 - tilt_y)
    return cx + dx, cy + dy

def draw_iso_tile(canvas, cx, cy, size, depth=12, face_top=(255, 251, 240),
                  face=(252, 246, 234),
                  edge=(214, 188, 152), edge_dark=(168, 138, 104),
                  radius_ratio=0.20, tilt_x=SKEW_X, tilt_y=SKEW_Y,
                  glow=True, glow_color=(255, 215, 170), glow_alpha=70,
                  rotation=0.0):
    """Draw a 3D isometric rounded tile centered at (cx, cy) with edge size and depth."""
    # Compute top-face quad in screen coords (centered, then rotated by `rotation`)
    half = size / 2
    # Top-face corners before rotation
    corners = [(-half, -half), (half, -half), (half, half), (-half, half)]
    # Rotate around center
    cos_r, sin_r = math.cos(rotation), math.sin(rotation)
    rot = [(x * cos_r - y * sin_r, x * sin_r + y * cos_r) for x, y in corners]
    # Skew for isometric (top face is a slight parallelogram)
    def skew(px, py):
        return px * (1 - tilt_x * 0.5) + py * (tilt_x * 0.0), \
               py * (1 - tilt_y) + px * (tilt_y * 0.2)
    rot = [skew(x, y) for x, y in rot]
    top_quad = [(cx + x, cy + y) for x, y in rot]
    # Drop shadow on ground (offset down)
    sh = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    sd.ellipse([cx - size * 0.55, cy + size * 0.30 - depth * 0.4,
                cx + size * 0.55, cy + size * 0.55],
               fill=(*SHADOW, 90))
    sh = sh.filter(ImageFilter.GaussianBlur(8))
    canvas.alpha_composite(sh)
    # Optional warm glow under tile
    if glow:
        soft_radial_glow(canvas, cx, cy + 4, int(size * 0.85),
                         glow_color, alpha=glow_alpha)
    # Build an isolated layer for the 3D tile (rasterize the polygons)
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    # Front / right side face: from top quad (right-front corner area) to bottom quad
    # Bottom-face quad: each top corner dropped by (dx, dy+depth)
    depth_dx = depth * 0.6
    depth_dy = depth
    bot_quad = [(p[0] + depth_dx, p[1] + depth_dy) for p in top_quad]
    # Right side: corner 1 (top-right) -> corner 2 (bot-right) -> corner 3 (bot-left) -> corner 0 (top-left of side)
    # We'll just draw the whole right+bottom band as one polygon: top edge then bot edge reversed
    # Specifically: visible front face is the union of "right" and "front" sides.
    # The visible sides are those whose normal points toward camera: corners 1,2,3 (with negative y_dir).
    # Simplified: front face polygon = (top_quad[1], top_quad[2], bot_quad[2], bot_quad[1]) + (top_quad[2], top_quad[3], bot_quad[3], bot_quad[2])
    # Combine into one polygon for the visible side band
    side_poly = [top_quad[1], top_quad[2], top_quad[3], bot_quad[3],
                 bot_quad[2], bot_quad[1]]
    # Outer dark side
    ld.polygon(side_poly, fill=(*edge_dark, 255))
    # Inner lighter band: slightly inset upward
    inset = 3
    side_poly_inner = [
        (top_quad[1][0], top_quad[1][1] + inset),
        (top_quad[2][0] + inset * 0.3, top_quad[2][1] + inset),
        (top_quad[3][0] - inset * 0.3, top_quad[3][1] + inset),
        (bot_quad[3][0] - inset * 0.3, bot_quad[3][1]),
        (bot_quad[2][0], bot_quad[2][1]),
        (bot_quad[1][0], bot_quad[1][1]),
    ]
    ld.polygon(side_poly_inner, fill=(*edge, 255))
    # Top face: rounded-rect mask, but we approximate with a polygon for iso
    # We'll render the top face as a polygon + rounded corners via a separate mask
    # First draw a soft warm fill on the quad
    ld.polygon(top_quad, fill=(*face_top, 255))
    # Now overlay a gradient on the top face for the glossy effect
    grad = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(grad)
    # Bounding box of top quad
    xs = [p[0] for p in top_quad]; ys = [p[1] for p in top_quad]
    bx0, by0, bx1, by1 = min(xs), min(ys), max(xs), max(ys)
    bw, bh = bx1 - bx0, by1 - by0
    for i in range(int(bh)):
        t = i / max(1, bh - 1)
        r0 = int(face_top[0] * (1 - t * 0.10) + face[0] * (t * 0.10))
        g0 = int(face_top[1] * (1 - t * 0.10) + face[1] * (t * 0.10))
        b0 = int(face_top[2] * (1 - t * 0.10) + face[2] * (t * 0.10))
        gd.line([(bx0, by0 + i), (bx1, by0 + i)], fill=(r0, g0, b0, 255))
    # Mask to top quad
    mask = Image.new("L", canvas.size, 0)
    md = ImageDraw.Draw(mask)
    md.polygon(top_quad, fill=255)
    masked_grad = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    masked_grad.paste(grad, (0, 0), mask)
    layer.alpha_composite(masked_grad)
    # Soft top edge highlight (along the front edge of the top face)
    hl = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    hd = ImageDraw.Draw(hl)
    front_edge = [top_quad[2], top_quad[3]]
    hd.line([front_edge[0], front_edge[1]], fill=(255, 245, 220, 220), width=2)
    layer.alpha_composite(hl)
    canvas.alpha_composite(layer)
    # Return top-face geometry for content drawing
    return {
        "top_quad": top_quad,
        "bot_quad": bot_quad,
        "cx": cx, "cy": cy,
        "size": size,
    }

def face_local_coords(geom, u, v):
    """Map local (u,v) in [-0.5, 0.5]^2 to top-face screen coords via bilinear."""
    # Bilinear interpolation of top_quad corners
    # corners order: 0=TL, 1=TR, 2=BR, 3=BL
    q = geom["top_quad"]
    # u,v in [-0.5, 0.5]; convert to [0,1]
    s = u + 0.5
    t = v + 0.5
    # bilinear
    top = (q[0][0] * (1 - s) + q[1][0] * s,
           q[0][1] * (1 - s) + q[1][1] * s)
    bot = (q[3][0] * (1 - s) + q[2][0] * s,
           q[3][1] * (1 - s) + q[2][1] * s)
    return (top[0] * (1 - t) + bot[0] * t,
            top[1] * (1 - t) + bot[1] * t)

def draw_digit_on_face(canvas, geom, digit, scale=0.55, color=INK):
    """Draw a centered digit on the tile's top face."""
    if FONT_PATH is None:
        return
    size = geom["size"]
    font = ImageFont.truetype(FONT_PATH, int(size * scale))
    d = ImageDraw.Draw(canvas)
    text = str(digit)
    bbox = d.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    # Center on tile
    cx, cy = face_local_coords(geom, 0, 0)
    tx = int(cx - tw / 2 - bbox[0])
    ty = int(cy - th / 2 - bbox[1])
    d.text((tx, ty), text, font=font, fill=color)

def draw_sudoku_on_face(canvas, geom, highlight=(4, 4)):
    """Draw a 9x9 sudoku grid on the tile's top face with one highlighted cell."""
    if FONT_PATH is None:
        return
    q = geom["top_quad"]
    # Compute local grid bounds via face_local_coords
    # Inset margin
    def lp(u, v):
        return face_local_coords(geom, u, v)
    p00 = lp(-0.36, -0.36)
    p10 = lp( 0.36, -0.36)
    p11 = lp( 0.36,  0.36)
    p01 = lp(-0.36,  0.36)
    # Draw highlight cell first
    hr, hc = highlight
    # cell u range
    cu0 = -0.36 + (hc / 9.0) * 0.72
    cu1 = -0.36 + ((hc + 1) / 9.0) * 0.72
    cv0 = -0.36 + (hr / 9.0) * 0.72
    cv1 = -0.36 + ((hr + 1) / 9.0) * 0.72
    h00 = lp(cu0, cv0)
    h10 = lp(cu1, cv0)
    h11 = lp(cu1, cv1)
    h01 = lp(cu0, cv1)
    # Highlight bg
    d = ImageDraw.Draw(canvas)
    d.polygon([h00, h10, h11, h01], fill=ACCENT)
    # Sample digits resembling a sudoku puzzle snapshot. The 3x3 box around the
    # highlight cell (rows 3-5, cols 3-5) is intentionally sparser so the red
    # highlight pops as "the next move".
    sample_digits = {
        # row 0
        (0, 0): 5, (0, 1): 3, (0, 4): 7, (0, 7): 1, (0, 8): 4,
        # row 1
        (1, 0): 6, (1, 3): 1, (1, 5): 5, (1, 8): 2,
        # row 2
        (2, 1): 9, (2, 2): 8, (2, 6): 6, (2, 7): 3, (2, 8): 7,
        # row 3
        (3, 0): 8, (3, 7): 9, (3, 8): 3,
        # row 4
        (4, 0): 4, (4, 1): 7, (4, 8): 1,
        # row 5
        (5, 0): 2, (5, 7): 4, (5, 8): 6,
        # row 6
        (6, 0): 3, (6, 1): 6, (6, 2): 4, (6, 5): 7, (6, 8): 8,
        # row 7
        (7, 0): 7, (7, 3): 5, (7, 5): 1, (7, 7): 6,
        # row 8
        (8, 1): 2, (8, 2): 1, (8, 5): 4, (8, 6): 9, (8, 8): 5,
    }
    # Choose font size relative to face size
    size = geom["size"]
    font = ImageFont.truetype(FONT_PATH, int(size * 0.055))
    # Helper: midpoint of a cell
    def cell_center(r, c):
        cu = -0.36 + ((c + 0.5) / 9.0) * 0.72
        cv = -0.36 + ((r + 0.5) / 9.0) * 0.72
        return lp(cu, cv)
    for (r0, c0), dv in sample_digits.items():
        cx, cy = cell_center(r0, c0)
        text = str(dv)
        bbox = d.textbbox((0, 0), text, font=font)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        tx = int(cx - tw / 2 - bbox[0])
        ty = int(cy - th / 2 - bbox[1])
        col = (255, 250, 240) if (r0, c0) == highlight else INK
        d.text((tx, ty), text, font=font, fill=col)
    # Grid lines: thin 1px every cell, thick 2px every 3 cells
    line_thin = INK
    for i in range(0, 10):
        u = -0.36 + (i / 9.0) * 0.72
        is_thick = (i % 3 == 0)
        w = 3 if is_thick else 1
        # horizontal line
        a = lp(u, -0.36); b = lp(u, 0.36)
        d.line([a, b], fill=line_thin, width=w)
        # vertical line
        a = lp(-0.36, u); b = lp(0.36, u)
        d.line([a, b], fill=line_thin, width=w)
    # subtle inner shadow on top edge
    a = lp(-0.36, -0.36); b = lp(0.36, -0.36)
    d.line([a, b], fill=(0, 0, 0, 0), width=0)

def draw_confetti(canvas, count=80, avoid_center=True):
    d = ImageDraw.Draw(canvas)
    palette = [
        (228, 130, 90), (240, 195, 110), (180, 200, 150),
        (190, 140, 200), (220, 100, 110), (140, 180, 220),
    ]
    for _ in range(count):
        cx = random.randint(0, W)
        cy = random.randint(0, H)
        if avoid_center and 200 < cx < 430 and 150 < cy < 380:
            if random.random() < 0.85:
                continue
        col = random.choice(palette)
        shape = random.choice(["sq", "sq", "dot", "tri"])
        sz = random.randint(3, 7)
        if shape == "sq":
            d.rectangle([cx, cy, cx + sz, cy + sz], fill=(*col, 200))
        elif shape == "dot":
            d.ellipse([cx, cy, cx + sz, cy + sz], fill=(*col, 220))
        else:
            d.polygon([(cx, cy), (cx + sz, cy + sz), (cx, cy + sz)],
                      fill=(*col, 200))

def draw_arrow(canvas, x1, y1, x2, y2, color=(170, 130, 100), width=3, head=10):
    d = ImageDraw.Draw(canvas)
    d.line([(x1, y1), (x2, y2)], fill=(*color, 200), width=width)
    ang = math.atan2(y2 - y1, x2 - x1)
    p1 = (x2, y2)
    p2 = (x2 - head * math.cos(ang - math.pi / 7),
          y2 - head * math.sin(ang - math.pi / 7))
    p3 = (x2 - head * math.cos(ang + math.pi / 7),
          y2 - head * math.sin(ang + math.pi / 7))
    d.polygon([p1, p2, p3], fill=(*color, 220))

def main():
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    bg = gradient_bg(W, H).convert("RGBA")
    canvas.alpha_composite(bg)
    # central warm glow
    soft_radial_glow(canvas, W // 2, H // 2, 280, SOFT_GLOW, alpha=120)
    # confetti
    draw_confetti(canvas, count=95)
    # arrows (behind tiles)
    draw_arrow(canvas, 80, 95, 150, 130)
    draw_arrow(canvas, W - 145, 390, W - 80, 415)
    # central big tile
    cx, cy = W // 2, H // 2 - 4
    geom_c = draw_iso_tile(
        canvas, cx, cy, size=300, depth=18,
        face_top=(255, 248, 234), face=(248, 238, 222),
        edge=(214, 188, 152), edge_dark=(168, 138, 104),
        radius_ratio=0.18, tilt_x=0.12, tilt_y=0.18,
        glow=True, glow_color=(255, 215, 170), glow_alpha=80,
        rotation=math.radians(-2),
    )
    draw_sudoku_on_face(canvas, geom_c, highlight=(4, 4))
    # surrounding 8 small tiles
    # (dx, dy, size, digit, rotation_deg)
    placements = [
        (-225,  -40, 100, 3,  -8),
        ( 230,  -75,  92, 7,  10),
        (-180,  170,  95, 1,  -5),
        ( 240,  155, 108, 9,  6),
        ( -95, -200,  85, 2,  -12),
        ( 135,  220,  90, 4,  8),
        (  15, -215,  80, 6,  4),
        ( -40,  225,  85, 8,  -6),
    ]
    for dx, dy, sz, digit, rot_deg in placements:
        tx, ty = cx + dx, cy + dy
        g = draw_iso_tile(
            canvas, tx, ty, size=sz, depth=10,
            face_top=(255, 251, 240), face=(252, 246, 234),
            edge=(210, 184, 150), edge_dark=(168, 138, 104),
            radius_ratio=0.22, tilt_x=0.10, tilt_y=0.16,
            glow=False, rotation=math.radians(rot_deg),
        )
        draw_digit_on_face(canvas, g, digit, scale=0.50, color=INK)
    # top-layer sparkle (skip central area)
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    for _ in range(30):
        x = random.randint(0, W); y = random.randint(0, H)
        if abs(x - W // 2) < 170 and abs(y - (H // 2 - 4)) < 170:
            continue
        col = random.choice([
            (228, 130, 90), (240, 195, 110), (180, 200, 150), (190, 140, 200),
        ])
        sz = random.randint(2, 4)
        ld.ellipse([x, y, x + sz, y + sz], fill=(*col, 230))
    canvas.alpha_composite(layer)
    # subtle vignette
    vignette = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    vd = ImageDraw.Draw(vignette)
    for i in range(40):
        a = int(20 * (1 - i / 40))
        vd.rectangle([i, i, W - i, H - i], outline=(90, 70, 50, a))
    canvas.alpha_composite(vignette)
    out = canvas.convert("RGB")
    out_path = r"G:/work/code/game/doin/assets/covers/sudoku.png"
    out.save(out_path, "PNG", optimize=True)
    print("saved", out_path, out.size)

if __name__ == "__main__":
    main()
