"""
One-off review helper: renders quote #1 in all 3 palettes using the new AI
backgrounds (scripts/backgrounds/*.png) with the exact real render_wallpaper()
pipeline, then overlays the full lock-screen mockup chrome (status bar, clock,
Now Playing widget) so the 3 palettes can be eyeballed before committing to
the full 60-image catalog re-render + Supabase upload.

No AI generation here — pure local Pillow compositing, zero additional cost.

Usage:
    source .venv/bin/activate
    python scripts/preview_new_backgrounds.py
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "test-ai-background"))

from scripts.generate_wallpapers import render_wallpaper, split_lines, load_quotes  # noqa: E402
from mockup import apply_mockup_chrome, LORA_REGULAR  # noqa: E402

OUTPUT_DIR = Path(__file__).resolve().parent / "output"

PALETTES = [
    {"id": 1, "name": "cream", "bg_top": "#FBF6EC", "bg_bottom": "#EEE2CE",
     "text_color": "#3A2C24", "accent1": "#5A684E", "accent2": "#A85238"},
    {"id": 2, "name": "dark", "bg_top": "#221C18", "bg_bottom": "#2E241D",
     "text_color": "#F2E9DC", "accent1": "#C9A468", "accent2": "#B5654A"},
    {"id": 3, "name": "warm-neutral", "bg_top": "#E8D5C0", "bg_bottom": "#D8BFA0",
     "text_color": "#4A3826", "accent1": "#6B7052", "accent2": "#9C4E33"},
]

QUOTE_ID = 1


def main():
    quotes = load_quotes()
    quote = next(q for q in quotes if q["id"] == QUOTE_ID)
    lines = split_lines(quote["text"])
    caption = quote["text"].replace("|", " ")

    panels = []
    for palette in PALETTES:
        img = render_wallpaper(lines, palette)
        mockup = apply_mockup_chrome(img, caption, palette["text_color"])
        panels.append((palette["name"], mockup))

    label_h = 60
    gap = 12
    canvas_w = sum(im.width for _, im in panels) + gap * (len(panels) - 1)
    canvas_h = max(im.height for _, im in panels) + label_h
    canvas = Image.new("RGB", (canvas_w, canvas_h), (20, 20, 20))
    draw = ImageDraw.Draw(canvas)
    try:
        font = ImageFont.truetype(str(LORA_REGULAR), 34)
    except Exception:
        font = ImageFont.load_default()

    x = 0
    for name, im in panels:
        canvas.paste(im, (x, label_h))
        draw.text((x + 20, 12), name, font=font, fill=(255, 255, 255))
        x += im.width + gap

    OUTPUT_DIR.mkdir(exist_ok=True)
    dest = OUTPUT_DIR / "new_backgrounds_preview.png"
    canvas.save(dest)
    print(f"Saved -> {dest}")


if __name__ == "__main__":
    main()
