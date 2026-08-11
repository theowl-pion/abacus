"""
test-ai-background: one-off comparison test only. Does NOT touch the real
pipeline (scripts/generate_wallpapers.py) or regenerate the catalog.

Generates one AI background (kie.ai, model "gpt-image-2-text-to-image") in
the Cream palette style, draws quote #1 on top of it using the exact same
tested typography code from scripts/generate_wallpapers.py, and builds a
side-by-side comparison against the existing flat-gradient reference image.

Usage (from the project root):
    source .venv/bin/activate
    python test-ai-background/generate.py

Requires KIE_API_KEY in test-ai-background/.env (gitignored).
"""

import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from dotenv import load_dotenv
from PIL import Image, ImageDraw, ImageFont
import os

TEST_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = TEST_DIR.parent
OUTPUT_DIR = TEST_DIR / "output"
REFERENCE_IMAGE = PROJECT_ROOT / "scripts" / "output" / "1_cream.png"

# Reuse the exact tested typography/layout code — no re-implementation.
sys.path.insert(0, str(PROJECT_ROOT))
from scripts.generate_wallpapers import (  # noqa: E402
    W,
    H,
    SAFE_TOP,
    SAFE_BOTTOM,
    SAFE_WIDTH,
    LINE_SPACING,
    hex_to_rgb,
    fit_font,
    split_lines,
)

load_dotenv(TEST_DIR / ".env")
API_KEY = os.environ.get("KIE_API_KEY")
BASE_URL = "https://api.kie.ai/api/v1"

CREAM_PALETTE = {
    "bg_top": "#FBF6EC",
    "bg_bottom": "#EEE2CE",
    "text_color": "#3A2C24",
    "accent1": "#5A684E",
    "accent2": "#A85238",
}

QUOTE_ID = 1
QUOTE_TEXT = "A goal|without a deadline|is a fantasy."

BACKGROUND_PROMPT = (
    "Soft abstract phone wallpaper background, warm cream and beige tones, "
    "gentle gradient from off-white FBF6EC at the top to warm beige EEE2CE "
    "at the bottom, subtle soft-focus organic color blobs in muted sage "
    "green and warm terracotta near the corners, minimal and calm, smooth "
    "and uncluttered in the vertical center so text can be overlaid legibly, "
    "no text, no words, no letters, no people, no objects, tall portrait "
    "orientation, aesthetic lock-screen wallpaper aesthetic, soft light, "
    "gentle film grain"
)


def api_request(method, endpoint, data=None):
    url = f"{BASE_URL}{endpoint}"
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    }
    req_data = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        print(f"API error {e.code}: {body}", file=sys.stderr)
        sys.exit(1)


def create_task():
    data = {
        "model": "gpt-image-2-text-to-image",
        "input": {
            "prompt": BACKGROUND_PROMPT,
            "aspect_ratio": "9:21",  # closest preset to our 1284x2778 canvas
            "resolution": "1K",  # 9:21 isn't supported at 2K/4K per kie.ai docs
        },
    }
    result = api_request("POST", "/jobs/createTask", data)
    if result.get("code") != 200:
        print(f"Error creating task: {result.get('msg')}", file=sys.stderr)
        sys.exit(1)
    return result["data"]["taskId"]


def wait_for_completion(task_id, max_wait=300):
    start = time.time()
    attempt = 0
    while (time.time() - start) < max_wait:
        time.sleep(5)
        attempt += 1
        result = api_request("GET", f"/jobs/recordInfo?taskId={task_id}")
        if result.get("code") != 200:
            print(f"Error querying task: {result.get('msg')}", file=sys.stderr)
            sys.exit(1)
        data = result["data"]
        state = data.get("state", "unknown").lower()
        if attempt % 6 == 0:
            print(f"  still waiting... ({state})")
        if state in ("fail", "failed"):
            print(f"Task failed ({data.get('failCode')}): {data.get('failMsg')}", file=sys.stderr)
            sys.exit(1)
        if state in ("success", "done"):
            result_data = json.loads(data.get("resultJson", "{}"))
            images = result_data.get("resultUrls", result_data.get("images", []))
            if not images:
                print("Task succeeded but no image URL returned", file=sys.stderr)
                sys.exit(1)
            return images[0]
        if state in ("failed", "FAILED"):
            print(f"Task failed: {data.get('failMsg')}", file=sys.stderr)
            sys.exit(1)
    print(f"Timeout after {max_wait}s", file=sys.stderr)
    sys.exit(1)


def download_image(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as response:
        dest.write_bytes(response.read())


def cover_resize(img, target_w, target_h):
    """Scale to fully cover the target box, then center-crop the overflow."""
    src_w, src_h = img.size
    scale = max(target_w / src_w, target_h / src_h)
    new_w, new_h = round(src_w * scale), round(src_h * scale)
    img = img.resize((new_w, new_h), Image.LANCZOS)
    left = (new_w - target_w) // 2
    top = (new_h - target_h) // 2
    return img.crop((left, top, left + target_w, top + target_h))


def draw_quote(img, lines, text_color_hex):
    """Exact same text-fitting/positioning logic as render_wallpaper() in
    scripts/generate_wallpapers.py, applied to an arbitrary base image."""
    draw = ImageDraw.Draw(img)
    text_color = hex_to_rgb(text_color_hex)

    from scripts.generate_wallpapers import FONT_REGULAR_PATH, FONT_ITALIC_PATH, BASE_SIZE_REGULAR, BASE_SIZE_ITALIC, BASE_SIZE_BOLD

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


def build_comparison(reference_path, ai_path, dest_path):
    ref = Image.open(reference_path).convert("RGB")
    ai = Image.open(ai_path).convert("RGB")

    label_h = 60
    gap = 12
    canvas_w = ref.width + ai.width + gap
    canvas_h = max(ref.height, ai.height) + label_h
    canvas = Image.new("RGB", (canvas_w, canvas_h), (20, 20, 20))

    canvas.paste(ref, (0, label_h))
    canvas.paste(ai, (ref.width + gap, label_h))

    draw = ImageDraw.Draw(canvas)
    try:
        font = ImageFont.truetype(
            str(PROJECT_ROOT / "scripts" / "fonts" / "Lora-Regular.ttf"), 36
        )
    except Exception:
        font = ImageFont.load_default()
    draw.text((20, 12), "Reference (flat gradient)", font=font, fill=(255, 255, 255))
    draw.text((ref.width + gap + 20, 12), "AI background (kie.ai GPT Image 2)", font=font, fill=(255, 255, 255))

    canvas.save(dest_path)


def main():
    if not API_KEY:
        print("Error: KIE_API_KEY not set in test-ai-background/.env", file=sys.stderr)
        sys.exit(1)

    OUTPUT_DIR.mkdir(exist_ok=True)

    print("Requesting background from kie.ai (gpt-image-2-text-to-image)...")
    task_id = create_task()
    print(f"Task ID: {task_id}")

    print("Waiting for completion...")
    image_url = wait_for_completion(task_id)

    raw_path = OUTPUT_DIR / "ai_background_raw.png"
    print(f"Downloading -> {raw_path}")
    download_image(image_url, raw_path)

    print(f"Resizing/cropping to {W}x{H} (cover-fit)...")
    bg = Image.open(raw_path).convert("RGB")
    bg = cover_resize(bg, W, H)
    resized_path = OUTPUT_DIR / "ai_background_cream.png"
    bg.save(resized_path)

    print("Drawing quote #1 with the tested typography...")
    lines = split_lines(QUOTE_TEXT)
    result = draw_quote(bg.copy(), lines, CREAM_PALETTE["text_color"])
    result_path = OUTPUT_DIR / "test_ai_cream_quote1.png"
    result.save(result_path)

    if REFERENCE_IMAGE.exists():
        comparison_path = OUTPUT_DIR / "comparison.png"
        print(f"Building side-by-side comparison -> {comparison_path}")
        build_comparison(REFERENCE_IMAGE, result_path, comparison_path)
    else:
        print(f"(No reference image found at {REFERENCE_IMAGE}, skipping comparison)")

    print("\nDone. Files in test-ai-background/output/:")
    print(f"  - {resized_path.name}  (raw AI background, resized to canvas)")
    print(f"  - {result_path.name}  (AI background + quote #1, cream palette)")
    print("  - comparison.png  (reference vs AI, side by side)")


if __name__ == "__main__":
    main()
