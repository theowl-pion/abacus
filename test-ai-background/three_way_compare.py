"""
Three-way comparison, all with full mockup chrome applied:
  1. Reference (flat gradient, current pipeline)
  2. AI background - text-to-image only
  3. AI background - image-to-image, guided by user's reference photo

Usage:
    source .venv/bin/activate
    python test-ai-background/three_way_compare.py
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

from mockup import LORA_REGULAR

TEST_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = TEST_DIR / "output"

PANELS = [
    ("Reference (flat gradient)", OUTPUT_DIR / "reference_with_mockup.png"),
    ("AI text-to-image", OUTPUT_DIR / "ai_with_mockup.png"),
    ("AI image-to-image (ref photo)", OUTPUT_DIR / "ai_img2img_with_mockup.png"),
]


def main():
    for label, path in PANELS:
        if not path.exists():
            raise SystemExit(f"Missing {path} — run generate.py, preview_compare.py, and generate_img2img.py first")

    imgs = [Image.open(p).convert("RGB") for _, p in PANELS]
    label_h = 60
    gap = 12
    canvas_w = sum(im.width for im in imgs) + gap * (len(imgs) - 1)
    canvas_h = max(im.height for im in imgs) + label_h
    canvas = Image.new("RGB", (canvas_w, canvas_h), (20, 20, 20))

    try:
        font = ImageFont.truetype(str(LORA_REGULAR), 34)
    except Exception:
        font = ImageFont.load_default()

    draw = ImageDraw.Draw(canvas)
    x = 0
    for (label, _), im in zip(PANELS, imgs):
        canvas.paste(im, (x, label_h))
        draw.text((x + 20, 12), label, font=font, fill=(255, 255, 255))
        x += im.width + gap

    dest = OUTPUT_DIR / "three_way_comparison.png"
    canvas.save(dest)
    print(f"Saved -> {dest}")


if __name__ == "__main__":
    main()
