import os
import base64
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_ROOT = os.path.dirname(ROOT)

src_path = os.path.join(PROJECT_ROOT, "logo.jpeg")
full_img = Image.open(src_path).convert("RGB")
w, h = full_img.size

dirs = [
    os.path.join(PROJECT_ROOT, "watch-point-landing", "assets", "images"),
    os.path.join(PROJECT_ROOT, "watch-point-site", "assets", "images"),
]

# Emblem crop
cx, cy = 679, 556
half = 560
mark = full_img.crop((cx - half, cy - half, cx + half, cy + half))

mark_512 = mark.resize((512, 512), Image.Resampling.LANCZOS)
mark_256 = mark.resize((256, 256), Image.Resampling.LANCZOS)
mark_180 = mark.resize((180, 180), Image.Resampling.LANCZOS)
mark_128 = mark.resize((128, 128), Image.Resampling.LANCZOS)
mark_64  = mark.resize((64, 64), Image.Resampling.LANCZOS)
mark_32  = mark.resize((32, 32), Image.Resampling.LANCZOS)

# Hero showcase
hero_w = 780
hero_h = int(hero_w * h / w)
hero_img = full_img.resize((hero_w, hero_h), Image.Resampling.LANCZOS).convert("RGBA")
mask = Image.new("L", (hero_w, hero_h), 0)
d = ImageDraw.Draw(mask)
d.rounded_rectangle([(0, 0), (hero_w, hero_h)], radius=32, fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(radius=1.5))
hero_img.putalpha(mask)

# Open Graph Cover
og_w, og_h = 1200, 630
og = Image.new("RGB", (og_w, og_h), (7, 19, 36))
og_d = ImageDraw.Draw(og)
for x in range(og_w):
    t = x / og_w
    r = int(6 + 12 * t)
    g = int(18 + 24 * t)
    b = int(35 + 55 * t)
    og_d.line([(x, 0), (x, og_h)], fill=(r, g, b))
og_logo_h = 560
og_logo_w = int(full_img.width * (og_logo_h / full_img.height))
og_logo = full_img.resize((og_logo_w, og_logo_h), Image.Resampling.LANCZOS)
og.paste(og_logo, ((og_w - og_logo_w) // 2, (og_h - og_logo_h) // 2))

# Save across directories
for target in dirs:
    os.makedirs(target, exist_ok=True)
    full_img.save(os.path.join(target, "watch-point-logo.webp"), "WEBP", quality=92, method=6)
    full_img.save(os.path.join(target, "watch-point-logo.jpeg"), "JPEG", quality=90, optimize=True)
    full_img.save(os.path.join(target, "watch-point-logo.jpg"), "JPEG", quality=90, optimize=True)

    mark_512.save(os.path.join(target, "brand-mark.webp"), "WEBP", quality=92)
    mark_512.save(os.path.join(target, "brand-mark.png"), "PNG", optimize=True)
    mark_128.save(os.path.join(target, "brand-mark-128.png"), "PNG", optimize=True)
    mark_64.save(os.path.join(target, "brand-mark-64.png"), "PNG", optimize=True)
    mark_180.save(os.path.join(target, "apple-touch-icon.png"), "PNG")
    mark_180.save(os.path.join(target, "icon-192.png"), "PNG")
    mark_512.save(os.path.join(target, "icon-512.png"), "PNG")

    hero_img.save(os.path.join(target, "hero-showcase.webp"), "WEBP", quality=94)
    hero_img.save(os.path.join(target, "hero-showcase.png"), "PNG")

    og.save(os.path.join(target, "og-cover.jpg"), "JPEG", quality=88, optimize=True)

    fav_sizes = [(16, 16), (32, 32), (48, 48), (64, 64)]
    favs = [mark.resize(s, Image.Resampling.LANCZOS) for s in fav_sizes]
    favs[0].save(os.path.join(target, "favicon.ico"), format="ICO", sizes=fav_sizes, append_images=favs[1:])
    root_site = os.path.dirname(os.path.dirname(target))
    favs[0].save(os.path.join(root_site, "favicon.ico"), format="ICO", sizes=fav_sizes, append_images=favs[1:])

# Create SVG wrappers for logo-mark.svg and favicon.svg
b64_mark = base64.b64encode(open(os.path.join(dirs[0], "brand-mark-128.png"), "rb").read()).decode("ascii")
svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <clipPath id="squircle">
    <rect width="128" height="128" rx="26" ry="26"/>
  </clipPath>
  <g clip-path="url(#squircle)">
    <image href="data:image/png;base64,{b64_mark}" width="128" height="128" preserveAspectRatio="xMidYMid slice"/>
  </g>
</svg>'''

for target in dirs:
    for name in ["favicon.svg", "logo-mark.svg"]:
        with open(os.path.join(target, name), "w", encoding="utf-8") as f:
            f.write(svg_content)

print("Brand build completed successfully!")
