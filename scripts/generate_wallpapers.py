"""
Renders the full wallpaper catalog (quotes x palettes) as PNGs, uploads each to
Supabase Storage, and upserts the matching `quotes` / `wallpapers` rows.

Usage:
    python scripts/generate_wallpapers.py

Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env (see .env.example).
If they're not set, the script still renders everything to output/ locally and
just skips the upload/DB steps — useful for checking the visual output before
a Supabase project exists.
"""

import csv
import os
from pathlib import Path

from dotenv import load_dotenv
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
FONTS_DIR = Path(__file__).resolve().parent / "fonts"
OUTPUT_DIR = Path(__file__).resolve().parent / "output"
BACKGROUNDS_DIR = Path(__file__).resolve().parent / "backgrounds"
QUOTES_CSV = ROOT / "quotes.csv"

W, H = 1284, 2778  # tall "universal" portrait canvas, per project-brief.md

SAFE_TOP = H * 0.15      # keeps text within the middle ~60-70% of height
SAFE_BOTTOM = H * 0.85
SAFE_WIDTH = W * 0.80    # clears the left/right ~10% margins

FONT_REGULAR_PATH = FONTS_DIR / "Lora-Regular.ttf"
FONT_ITALIC_PATH = FONTS_DIR / "Lora-Italic.ttf"

BASE_SIZE_REGULAR = 104
BASE_SIZE_ITALIC = 72
BASE_SIZE_BOLD = 108
MIN_SIZE = 40
LINE_SPACING = 38

BLOB_RADIUS_1 = 458
BLOB_RADIUS_2 = 523
BLOB_OPACITY_1 = 70
BLOB_OPACITY_2 = 60
BLOB_BLUR_1 = 160
BLOB_BLUR_2 = 170


def hex_to_rgb(hex_str):
    hex_str = hex_str.lstrip("#")
    return tuple(int(hex_str[i:i + 2], 16) for i in (0, 2, 4))


def load_font(path, size, variation):
    font = ImageFont.truetype(str(path), size)
    try:
        font.set_variation_by_name(variation)
    except Exception:
        pass
    return font


def fit_font(path, variation, start_size, text, draw, max_width):
    size = start_size
    while size > MIN_SIZE:
        font = load_font(path, size, variation)
        bbox = draw.textbbox((0, 0), text, font=font)
        if bbox[2] - bbox[0] <= max_width:
            return font, bbox
        size -= 4
    font = load_font(path, MIN_SIZE, variation)
    bbox = draw.textbbox((0, 0), text, font=font)
    return font, bbox


def render_gradient(top_rgb, bottom_rgb):
    img = Image.new("RGB", (W, H), top_rgb)
    draw = ImageDraw.Draw(img)
    for y in range(H):
        t = (y / (H - 1)) ** 1.3
        r = round(top_rgb[0] + (bottom_rgb[0] - top_rgb[0]) * t)
        g = round(top_rgb[1] + (bottom_rgb[1] - top_rgb[1]) * t)
        b = round(top_rgb[2] + (bottom_rgb[2] - top_rgb[2]) * t)
        draw.line([(0, y), (W, y)], fill=(r, g, b))
    return img


def add_blob(base_img, center, radius, color, opacity, blur):
    layer = Image.new("L", (W, H), 0)
    ld = ImageDraw.Draw(layer)
    cx, cy = center
    ld.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=opacity)
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    color_layer = Image.new("RGB", (W, H), color)
    return Image.composite(color_layer, base_img, layer)


def load_background(palette):
    """Uses the AI-generated background for this palette (scripts/backgrounds/
    <name>.png, produced once by generate_backgrounds.py) if present, falling
    back to the flat gradient + blobs so rendering still works before that
    one-time step has been run."""
    bg_path = BACKGROUNDS_DIR / f"{palette['name']}.png"
    if bg_path.exists():
        img = Image.open(bg_path).convert("RGB")
        if img.size != (W, H):
            img = img.resize((W, H), Image.LANCZOS)
        return img

    bg_top = hex_to_rgb(palette["bg_top"])
    bg_bottom = hex_to_rgb(palette["bg_bottom"])
    accent1 = hex_to_rgb(palette["accent1"])
    accent2 = hex_to_rgb(palette["accent2"])
    img = render_gradient(bg_top, bg_bottom)
    img = add_blob(img, (W * 0.12, H * 0.16), BLOB_RADIUS_1, accent1, BLOB_OPACITY_1, BLOB_BLUR_1)
    img = add_blob(img, (W * 0.90, H * 0.88), BLOB_RADIUS_2, accent2, BLOB_OPACITY_2, BLOB_BLUR_2)
    return img


def render_wallpaper(lines, palette):
    """lines: list of (text, weight) where weight is 'regular' | 'italic' | 'bold'."""
    text_color = hex_to_rgb(palette["text_color"])

    img = load_background(palette)
    draw = ImageDraw.Draw(img)

    weight_specs = {
        "regular": (FONT_REGULAR_PATH, "Regular", BASE_SIZE_REGULAR),
        "italic": (FONT_ITALIC_PATH, "Medium Italic", BASE_SIZE_ITALIC),
        "bold": (FONT_REGULAR_PATH, "Bold", BASE_SIZE_BOLD),
    }

    line_data = []
    for text, weight in lines:
        path, variation, base_size = weight_specs[weight]
        font, bbox = fit_font(path, variation, base_size, text, draw, SAFE_WIDTH)
        line_data.append((text, font, bbox[2] - bbox[0], bbox[3] - bbox[1], bbox[1]))

    total_h = sum(h for _, _, _, h, _ in line_data) + LINE_SPACING * (len(line_data) - 1)
    y = max(SAFE_TOP, (H - total_h) / 2)
    if y + total_h > SAFE_BOTTOM:
        y = SAFE_BOTTOM - total_h

    for text, font, w, h, top_offset in line_data:
        x = (W - w) / 2
        draw.text((x, y - top_offset), text, font=font, fill=text_color)
        y += h + LINE_SPACING

    return img


def split_lines(text):
    segments = [s.strip() for s in text.split("|")]
    if len(segments) == 2:
        return [(segments[0], "regular"), (segments[1], "bold")]
    if len(segments) == 3:
        return [(segments[0], "regular"), (segments[1], "italic"), (segments[2], "bold")]
    raise ValueError(f"expected 2 or 3 '|'-separated segments, got {len(segments)}: {text!r}")


def load_quotes():
    quotes = []
    with open(QUOTES_CSV, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            quotes.append({
                "id": int(row["id"]),
                "text": row["text"],
                "language": row["language"],
            })
    return quotes


def main():
    load_dotenv(ROOT / ".env")
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    client = None
    if supabase_url and supabase_key:
        from supabase import create_client
        client = create_client(supabase_url, supabase_key)
    else:
        print("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — rendering locally only, skipping upload/DB steps.")

    OUTPUT_DIR.mkdir(exist_ok=True)
    quotes = load_quotes()

    if client:
        upsert_rows = [{"id": q["id"], "text": q["text"], "language": q["language"]} for q in quotes]
        client.table("quotes").upsert(upsert_rows, on_conflict="id").execute()
        palettes = client.table("palettes").select("*").execute().data
        if not palettes:
            raise RuntimeError("No rows in `palettes` — run supabase/migrations/0001_init.sql first.")
    else:
        # Local-only fallback so rendering can be smoke-tested before Supabase exists.
        palettes = [
            {"id": 1, "name": "cream", "bg_top": "#FBF6EC", "bg_bottom": "#EEE2CE",
             "text_color": "#3A2C24", "accent1": "#5A684E", "accent2": "#A85238"},
            {"id": 2, "name": "dark", "bg_top": "#221C18", "bg_bottom": "#2E241D",
             "text_color": "#F2E9DC", "accent1": "#C9A468", "accent2": "#B5654A"},
            {"id": 3, "name": "warm-neutral", "bg_top": "#E8D5C0", "bg_bottom": "#D8BFA0",
             "text_color": "#4A3826", "accent1": "#6B7052", "accent2": "#9C4E33"},
        ]

    rendered, uploaded = 0, 0
    for quote in quotes:
        lines = split_lines(quote["text"])
        for palette in palettes:
            filename = f"{quote['id']}_{palette['name']}.png"
            img = render_wallpaper(lines, palette)
            local_path = OUTPUT_DIR / filename
            img.save(local_path, "PNG")
            rendered += 1

            if client:
                with open(local_path, "rb") as f:
                    client.storage.from_("wallpapers").upload(
                        filename, f.read(),
                        file_options={"content-type": "image/png", "upsert": "true"},
                    )
                client.table("wallpapers").upsert(
                    {"quote_id": quote["id"], "palette_id": palette["id"], "image_path": filename},
                    on_conflict="quote_id,palette_id",
                ).execute()
                uploaded += 1

    print(f"Rendered {rendered} wallpapers to {OUTPUT_DIR}")
    if client:
        print(f"Uploaded {uploaded} to Supabase Storage bucket 'wallpapers' and upserted matching rows.")


if __name__ == "__main__":
    main()
