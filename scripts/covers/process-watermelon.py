#!/usr/bin/env python
# watermelon-2048 封面后处理：去水印(固定 bbox) → 640x640 → WebP q90
# 用法: python covers/process-watermelon.py <url> <out.webp>
import sys
import urllib.request
import cv2
import numpy as np

url = sys.argv[1]
out = sys.argv[2]

req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
raw = np.asarray(bytearray(urllib.request.urlopen(req).read()), dtype=np.uint8)
img = cv2.imdecode(raw, cv2.IMREAD_COLOR)
if img is None:
    raise SystemExit("decode failed")
h, w = img.shape[:2]

# 固定 bbox 去水印（规范：x > 0.80W, y > 0.91H）
x1 = int(w * 0.80)
y1 = int(h * 0.91)
mask = np.zeros((h, w), dtype=np.uint8)
mask[y1:, x1:] = 255
img = cv2.inpaint(img, mask, 7, cv2.INPAINT_TELEA)

# 缩放 + 落盘
img = cv2.resize(img, (640, 640), interpolation=cv2.INTER_AREA)
ok, buf = cv2.imencode(".webp", img, [cv2.IMWRITE_WEBP_QUALITY, 90])
if not ok:
    raise SystemExit("encode failed")
with open(out, "wb") as f:
    f.write(buf.tobytes())
print(f"written {out} {img.shape[1]}x{img.shape[0]}")
