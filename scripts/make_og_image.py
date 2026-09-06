import math
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1200, 630

# 1. Background gradient (175 deg: top-left to bottom-right)
# Colors: top #96f3de (150, 243, 222) -> mid #6fe4cb (111, 228, 203) -> deep #55d3d0 (85, 211, 208)
bg = Image.new("RGBA", (W, H))
px = bg.load()

rad = math.radians(175 - 90)
cos_a = math.cos(rad)
sin_a = math.sin(rad)

c_top = (150, 243, 222)
c_mid = (111, 228, 203)
c_deep = (85, 211, 208)

for y in range(H):
    for x in range(W):
        proj = (y * cos_a + x * sin_a) / H
        t = max(0.0, min(1.0, proj))
        if t < 0.52:
            sub_t = t / 0.52
            r = int(c_top[0] + (c_mid[0] - c_top[0]) * sub_t)
            g = int(c_top[1] + (c_mid[1] - c_top[1]) * sub_t)
            b = int(c_top[2] + (c_mid[2] - c_top[2]) * sub_t)
        else:
            sub_t = (t - 0.52) / 0.48
            r = int(c_mid[0] + (c_deep[0] - c_mid[0]) * sub_t)
            g = int(c_mid[1] + (c_deep[1] - c_mid[1]) * sub_t)
            b = int(c_mid[2] + (c_deep[2] - c_mid[2]) * sub_t)
        px[x, y] = (r, g, b, 255)

# 2. Diamante pattern overlay (60x60 grid)
pattern_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
p_draw = ImageDraw.Draw(pattern_layer)

grid = 60
for gy in range(-grid, H + grid, grid):
    for gx in range(-grid, W + grid, grid):
        # Diamond outer lines: stroke white opacity 0.28
        p_draw.polygon([(gx + 30, gy), (gx + 60, gy + 30), (gx + 30, gy + 60), (gx, gy + 30)],
                       outline=(255, 255, 255, 60), width=2)
        # Inner diamond: fill white opacity 0.08
        p_draw.polygon([(gx + 30, gy + 15), (gx + 45, gy + 30), (gx + 30, gy + 45), (gx + 15, gy + 30)],
                       fill=(255, 255, 255, 20))
        # Corner ticks
        p_draw.line([(gx, gy), (gx + 15, gy + 15)], fill=(255, 255, 255, 34), width=2)
        p_draw.line([(gx + 60, gy), (gx + 45, gy + 15)], fill=(255, 255, 255, 34), width=2)
        p_draw.line([(gx, gy + 60), (gx + 15, gy + 45)], fill=(255, 255, 255, 34), width=2)
        p_draw.line([(gx + 60, gy + 60), (gx + 45, gy + 45)], fill=(255, 255, 255, 34), width=2)

bg = Image.alpha_composite(bg, pattern_layer)

# 3. Floating game cards
def create_card(img_path, size, radius=22):
    im = Image.open(img_path).convert("RGBA").resize((size, size), Image.Resampling.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([(0, 0), (size, size)], radius=radius, fill=255)
    rounded = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    rounded.paste(im, (0, 0), mask)
    # White 2px border
    ImageDraw.Draw(rounded).rounded_rectangle([(0, 0), (size - 1, size - 1)], radius=radius, outline=(255, 255, 255, 140), width=2)
    return rounded

def paste_card(base, card, cx, cy, angle, shadow_blur=18, shadow_offset=(0, 10)):
    w, h = card.size
    pad = 40
    sh_box = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    ImageDraw.Draw(sh_box).rounded_rectangle(
        [(pad, pad), (pad + w, pad + h)],
        radius=22, fill=(4, 68, 77, 90)
    )
    sh_box = sh_box.filter(ImageFilter.GaussianBlur(shadow_blur))
    
    composite = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    composite.paste(sh_box, shadow_offset, sh_box)
    composite.paste(card, (pad, pad), card)
    
    if angle != 0:
        composite = composite.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
    
    cw, ch = composite.size
    base.paste(composite, (int(cx - cw / 2), int(cy - ch / 2)), composite)

covers_dir = "assets/covers"
c_size = 170
card_configs = [
    ("tetris-neo.webp", 125, 130, -9),
    ("2048.webp", 140, 320, 6),
    ("gold-miner.webp", 130, 505, -7),
    ("minesweeper.webp", 1075, 130, 9),
    ("orbit-sort.webp", 1060, 320, -6),
    ("Tile-Matching.webp", 1070, 505, 7),
]

for fname, cx, cy, angle in card_configs:
    fpath = os.path.join(covers_dir, fname)
    if os.path.exists(fpath):
        card = create_card(fpath, c_size, radius=22)
        paste_card(bg, card, cx, cy, angle)

# 4. Center Brand Chip (Doin.win)
chip_w, chip_h = 600, 154
chip_x = (W - chip_w) // 2
chip_y = 175

# Double soft shadow
chip_shadow1 = Image.new("RGBA", (W, H), (0, 0, 0, 0))
ImageDraw.Draw(chip_shadow1).rounded_rectangle([(chip_x, chip_y + 14), (chip_x + chip_w, chip_y + chip_h + 14)], radius=32, fill=(4, 68, 77, 65))
chip_shadow1 = chip_shadow1.filter(ImageFilter.GaussianBlur(24))

chip_shadow2 = Image.new("RGBA", (W, H), (0, 0, 0, 0))
ImageDraw.Draw(chip_shadow2).rounded_rectangle([(chip_x, chip_y + 4), (chip_x + chip_w, chip_y + chip_h + 4)], radius=32, fill=(4, 68, 77, 45))
chip_shadow2 = chip_shadow2.filter(ImageFilter.GaussianBlur(8))

bg = Image.alpha_composite(bg, chip_shadow1)
bg = Image.alpha_composite(bg, chip_shadow2)

# White surface
chip_surface = Image.new("RGBA", (W, H), (0, 0, 0, 0))
ImageDraw.Draw(chip_surface).rounded_rectangle([(chip_x, chip_y), (chip_x + chip_w, chip_y + chip_h)], radius=32, fill=(255, 255, 255, 255))
bg = Image.alpha_composite(bg, chip_surface)

# Typography: "Doin" in #05384a, ".win" in #009cff -> #23cfc0
font_path = r"C:\Windows\Fonts\segoeuib.ttf"
logo_font = ImageFont.truetype(font_path, 102)

bbox_doin = logo_font.getbbox("Doin")
doin_w = bbox_doin[2] - bbox_doin[0]
bbox_win = logo_font.getbbox(".win")
win_w = bbox_win[2] - bbox_win[0]

total_logo_w = doin_w + win_w
start_x = chip_x + (chip_w - total_logo_w) // 2
text_y = chip_y + (chip_h - (bbox_doin[3] - bbox_doin[1])) // 2 - 12

text_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
t_draw = ImageDraw.Draw(text_layer)
t_draw.text((start_x, text_y), "Doin", fill=(5, 56, 74, 255), font=logo_font)

# ".win" gradient mask
win_mask = Image.new("L", (win_w + 30, chip_h), 0)
ImageDraw.Draw(win_mask).text((0, text_y - chip_y), ".win", fill=255, font=logo_font)

win_grad = Image.new("RGBA", (win_w + 30, chip_h), (0, 0, 0, 0))
c1 = (0, 156, 255) # #009cff
c2 = (35, 207, 192) # #23cfc0
for gx in range(win_w + 30):
    gt = gx / (win_w + 30)
    gr = int(c1[0] + (c2[0] - c1[0]) * gt)
    gg = int(c1[1] + (c2[1] - c1[1]) * gt)
    gb = int(c1[2] + (c2[2] - c1[2]) * gt)
    for gy in range(chip_h):
        win_grad.putpixel((gx, gy), (gr, gg, gb, 255))

win_grad.putalpha(win_mask)
text_layer.paste(win_grad, (start_x + doin_w, chip_y), win_grad)
bg = Image.alpha_composite(bg, text_layer)

# 5. Tagline Pill
tag_font = ImageFont.truetype(r"C:\Windows\Fonts\segoeui.ttf", 26)
tag_text = "Free Mini Games · Play Instantly"
t_bbox = tag_font.getbbox(tag_text)
tw = t_bbox[2] - t_bbox[0]
th = t_bbox[3] - t_bbox[1]
tag_w = tw + 52
tag_h = 52
tag_x = (W - tag_w) // 2
tag_y = chip_y + chip_h + 28

tag_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
ImageDraw.Draw(tag_layer).rounded_rectangle([(tag_x, tag_y + 4), (tag_x + tag_w, tag_y + tag_h + 4)], radius=26, fill=(4, 68, 77, 40))
tag_layer = tag_layer.filter(ImageFilter.GaussianBlur(8))

tag_surf = Image.new("RGBA", (W, H), (0, 0, 0, 0))
ts_draw = ImageDraw.Draw(tag_surf)
ts_draw.rounded_rectangle([(tag_x, tag_y), (tag_x + tag_w, tag_y + tag_h)], radius=26, fill=(255, 255, 255, 240))
ts_draw.text(((W - tw) // 2, tag_y + (tag_h - th) // 2 - 3), tag_text, fill=(5, 56, 74, 240), font=tag_font)

bg = Image.alpha_composite(bg, tag_layer)
bg = Image.alpha_composite(bg, tag_surf)

# 6. Feature Badges (clean text without broken glyphs)
feat_font = ImageFont.truetype(r"C:\Windows\Fonts\segoeuib.ttf", 17)
feats = ["10+ Mini Games", "No Download", "Instant Play", "Mobile & PC"]

feat_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
f_draw = ImageDraw.Draw(feat_layer)

f_widths = [feat_font.getbbox(f)[2] - feat_font.getbbox(f)[0] + 32 for f in feats]
total_feats_w = sum(f_widths) + (len(feats) - 1) * 14
fx = (W - total_feats_w) // 2
fy = tag_y + tag_h + 26

for f, fw in zip(feats, f_widths):
    fh = 36
    f_draw.rounded_rectangle([(fx, fy), (fx + fw, fy + fh)], radius=18, fill=(255, 255, 255, 175), outline=(255, 255, 255, 220), width=1)
    f_draw.text((fx + 16, fy + 8), f, fill=(5, 56, 74, 210), font=feat_font)
    fx += fw + 14

bg = Image.alpha_composite(bg, feat_layer)

# Save final image
final_img = bg.convert("RGB")
final_img.save("assets/og-image.png", "PNG", optimize=True)
print("Updated assets/og-image.png successfully!")
