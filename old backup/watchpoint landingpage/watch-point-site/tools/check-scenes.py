"""
Generate scene images (office, home, shop) if needed using clean composite styling
or fallback compositions using PIL
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(r"d:\AI\watchpoint landingpage\watch-point-site")
PHOTOS = ROOT / "assets" / "images" / "photos"
PHOTOS.mkdir(parents=True, exist_ok=True)

# Colors
DEEP = (16, 42, 86)      # #102A56
TECH = (23, 105, 170)    # #1769AA
SKY = (56, 166, 232)     # #38A6E8
CLOUD = (234, 245, 252)  # #EAF5FC
WHITE = (255, 255, 255)

# If scene images don't exist yet, we can create high-aesthetic branded scene visuals
scenes = {
    "office-security.jpg": ("حلول أمنية للشركات والمكاتب", "Modern Corporate Security & Access Control"),
    "home-security.jpg": ("حماية وتأمين الفلل والمنازل", "Smart Home & Villa Surveillance Systems"),
    "shop-security.jpg": ("تأمين المحلات والأنشطة التجارية", "Retail & Commercial Store Security")
}

for filename, (title_ar, title_en) in scenes.items():
    file_path = PHOTOS / filename
    if not file_path.exists():
        # Create a 1344x768 clean modern architectural gradient background
        img = Image.new("RGB", (1344, 768), CLOUD)
        draw = ImageDraw.Draw(img)
        
        # Draw tech gradient lines and subtle security shield / grid
        for y in range(768):
            ratio = y / 768.0
            r = int(CLOUD[0] * (1 - ratio * 0.15) + DEEP[0] * (ratio * 0.15))
            g = int(CLOUD[1] * (1 - ratio * 0.15) + DEEP[1] * (ratio * 0.15))
            b = int(CLOUD[2] * (1 - ratio * 0.15) + DEEP[2] * (ratio * 0.15))
            draw.line([(0, y), (1344, y)], fill=(r, g, b))
        
        # Add decorative modern tech grid
        for x in range(0, 1344, 48):
            draw.line([(x, 0), (x, 768)], fill=(210, 230, 245), width=1)
        for y in range(0, 768, 48):
            draw.line([(0, y), (1344, y)], fill=(210, 230, 245), width=1)
            
        # Add tech glow
        draw.ellipse([800, 100, 1400, 700], fill=(220, 240, 255))
        
        img.save(file_path, "JPEG", quality=90)
        print(f"Generated placeholder scene {filename}")

print("Scenes check complete.")
