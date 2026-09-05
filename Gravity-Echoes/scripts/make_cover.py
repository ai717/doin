#!/usr/bin/env python3
"""Render a deterministic 640x640 Gravity Echoes cover from its game motifs."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

W = 640
OUT = Path(__file__).resolve().parents[3] / "assets" / "covers" / "Gravity-Echoes.webp"


def main():
    image = Image.new("RGB", (W, W), "#060918")
    pixels = image.load()
    for y in range(W):
        for x in range(W):
            dx, dy = x - W * 0.52, y - W * 0.42
            radius = (dx * dx + dy * dy) ** 0.5 / W
            pixels[x, y] = (
                max(4, int(8 - radius * 5)),
                max(7, int(15 + (1 - min(radius, 1)) * 11)),
                max(18, int(36 + (1 - min(radius, 1)) * 38)),
            )

    glow = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((115, 60, 575, 520), outline=(56, 189, 248, 165), width=22)
    gd.ellipse((170, 100, 540, 480), outline=(192, 132, 252, 145), width=15)
    gd.ellipse((255, 182, 415, 342), fill=(56, 189, 248, 120))
    glow = glow.filter(ImageFilter.GaussianBlur(24))
    image = Image.alpha_composite(image.convert("RGBA"), glow)

    draw = ImageDraw.Draw(image)
    for x, y, r, color in [(88, 98, 2, "#d9fbff"), (525, 86, 3, "#bfeeff"), (560, 445, 2, "#ffffff"), (102, 506, 2, "#bfeeff")]:
        draw.ellipse((x - r, y - r, x + r, y + r), fill=color)
    for offset, color in [(0, "#38bdf8"), (23, "#c084fc"), (46, "#fbbf24")]:
        y = 410 + offset
        draw.rounded_rectangle((80 + offset // 2, y, 560 - offset // 2, y + 19), radius=8, fill=color)
        for cut in (205, 335, 465):
            draw.rectangle((cut, y, cut + 9, y + 19), fill="#0b1630")

    draw.ellipse((270, 192, 426, 348), fill="#02030a")
    draw.ellipse((285, 207, 411, 333), outline="#6ee7f9", width=5)
    draw.arc((230, 151, 467, 388), 210, 72, fill="#c084fc", width=7)
    draw.arc((218, 137, 479, 400), 30, 195, fill="#38bdf8", width=5)
    draw.ellipse((428, 123, 470, 165), fill="#ffffff")
    draw.ellipse((436, 131, 458, 153), fill="#38bdf8")
    draw.rounded_rectangle((221, 535, 421, 558), radius=11, fill="#2dd4bf")
    draw.rectangle((294, 539, 348, 543), fill="#ffffff")

    image.convert("RGB").save(OUT, "WEBP", quality=90, method=6)
    print(f"written {OUT}")


if __name__ == "__main__":
    main()
