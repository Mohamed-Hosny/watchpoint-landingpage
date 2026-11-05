"""
Watch Point — brand asset builder
---------------------------------
Creates web-ready derivatives of the ORIGINAL logo without redrawing,
cropping, stretching or recolouring it. Squares are produced by padding
(letterboxing) with the logo's own background colour.

Usage:  python tools/build-brand-assets.py
Input:  assets/images/brand/watch-point-logo.jpg
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
BRAND = ROOT / "assets" / "images" / "brand"
SRC = BRAND / "watch-point-logo.jpg"

DEEP = (16, 42, 86)        # #102A56
TECH = (23, 105, 170)      # #1769AA
SKY = (56, 166, 232)       # #38A6E8

logo = Image.open(SRC).convert("RGB")
w, h = logo.size


def edge_colour(img):
    """Average colour of the outer 2% frame of the logo (its own background)."""
    px = img.load()
    iw, ih = img.size
    band = max(2, int(min(iw, ih) * 0.02))
    total, n = [0, 0, 0], 0
    for x in range(0, iw, 4):
        for y in list(range(band)) + list(range(ih - band, ih)):
            r, g, b = px[x, y]
            total[0] += r; total[1] += g; total[2] += b; n += 1
    return tuple(c // n for c in total)


BG = edge_colour(logo)


def fit_height(img, target_h):
    ratio = target_h / img.height
    return img.resize((round(img.width * ratio), target_h), Image.LANCZOS)


def fit_width(img, target_w):
    ratio = target_w / img.width
    return img.resize((target_w, round(img.height * ratio)), Image.LANCZOS)


def square(img, size, pad_ratio=0.04):
    side = max(img.size)
    pad = int(side * pad_ratio)
    canvas = Image.new("RGB", (side + pad * 2, side + pad * 2), BG)
    canvas.paste(img, ((canvas.width - img.width) // 2, (canvas.height - img.height) // 2))
    return canvas.resize((size, size), Image.LANCZOS)


# Header (2x for retina, displayed ~64px tall) and footer versions — proportional.
for name, img in {
    "logo-128h": fit_height(logo, 128),
    "logo-256h": fit_height(logo, 256),
    "logo-480w": fit_width(logo, 480),
    "logo-800w": fit_width(logo, 800),
}.items():
    img.save(BRAND / f"{name}.webp", "WEBP", quality=88, method=6)
    img.save(BRAND / f"{name}.jpg", "JPEG", quality=88, optimize=True, progressive=True)

# Favicons / app icons (padded, never cropped)
for size in (16, 32, 48, 180, 192, 512):
    square(logo, size).save(BRAND / f"icon-{size}.png", optimize=True)
square(logo, 256).save(ROOT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])

# Open Graph cover 1200x630: brand gradient + untouched logo
og = Image.new("RGB", (1200, 630), DEEP)
px = og.load()
for x in range(1200):
    t = x / 1199
    if t < 0.55:
        k = t / 0.55
        c = tuple(round(DEEP[i] + (TECH[i] - DEEP[i]) * k) for i in range(3))
    else:
        k = (t - 0.55) / 0.45
        c = tuple(round(TECH[i] + (SKY[i] - TECH[i]) * k) for i in range(3))
    for y in range(630):
        px[x, y] = c
mark = fit_height(logo, 560)
og.paste(mark, ((1200 - mark.width) // 2, 35))
og.save(ROOT / "assets" / "images" / "og-cover.jpg", "JPEG", quality=86, optimize=True, progressive=True)

print("logo:", (w, h), "background:", "#%02x%02x%02x" % BG)
