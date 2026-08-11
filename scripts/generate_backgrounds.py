"""
Generates the 3 palette background images used by generate_wallpapers.py, via
kie.ai's GPT Image 2 (text-to-image), and saves them to scripts/backgrounds/.

This is the ONLY step that costs money — exactly 3 paid AI generations, one
per palette (Cream, Dark, Warm Neutral). Each background is reused across all
20 quotes in that palette by generate_wallpapers.py, exactly like the flat
gradient it replaces was reused before. Running this script again re-spends
money (3 more generations) — only rerun it if you want new/different
backgrounds, not as part of the normal catalog-render workflow.

Usage:
    source .venv/bin/activate
    python scripts/generate_backgrounds.py

Requires KIE_API_KEY in the project root .env (gitignored).
"""

import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from dotenv import load_dotenv
from PIL import Image
import os

ROOT = Path(__file__).resolve().parent.parent
BACKGROUNDS_DIR = Path(__file__).resolve().parent / "backgrounds"

load_dotenv(ROOT / ".env")
API_KEY = os.environ.get("KIE_API_KEY")
BASE_URL = "https://api.kie.ai/api/v1"

W, H = 1284, 2778

# One tailored prompt per palette, matching the exact hex values in
# project-brief.md. Same structure as the validated test-ai-background prompt:
# describe the gradient + accent-color blobs, explicitly forbid text/objects/
# people, and keep the vertical center calm so quote text stays legible.
PALETTE_PROMPTS = {
    "cream": (
        "Soft abstract phone wallpaper background, warm cream and beige tones, "
        "gentle gradient from off-white FBF6EC at the top to warm beige EEE2CE "
        "at the bottom, subtle soft-focus organic color blobs in muted sage "
        "green and warm terracotta near the corners, minimal and calm, smooth "
        "and uncluttered in the vertical center so text can be overlaid legibly, "
        "no text, no words, no letters, no people, no objects, tall portrait "
        "orientation, aesthetic lock-screen wallpaper aesthetic, soft light, "
        "gentle film grain"
    ),
    "dark": (
        "Soft abstract phone wallpaper background, warm near-black moody tones, "
        "gentle gradient from deep warm brown-black 221C18 at the top to warm "
        "dark brown 2E241D at the bottom, subtle soft-focus organic color blobs "
        "in muted antique gold and warm terracotta near the corners, minimal and "
        "calm, smooth and uncluttered in the vertical center so text can be "
        "overlaid legibly, no text, no words, no letters, no people, no objects, "
        "tall portrait orientation, aesthetic lock-screen wallpaper aesthetic, "
        "soft moody light, gentle film grain"
    ),
    "warm-neutral": (
        "Soft abstract phone wallpaper background, warm sand and blush tones, "
        "gentle gradient from warm sand E8D5C0 at the top to warm blush-tan "
        "D8BFA0 at the bottom, subtle soft-focus organic color blobs in deep "
        "olive green and warm rust near the corners, minimal and calm, smooth "
        "and uncluttered in the vertical center so text can be overlaid legibly, "
        "no text, no words, no letters, no people, no objects, tall portrait "
        "orientation, aesthetic lock-screen wallpaper aesthetic, soft light, "
        "gentle film grain"
    ),
}


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


def create_task(prompt):
    data = {
        "model": "gpt-image-2-text-to-image",
        "input": {
            "prompt": prompt,
            "aspect_ratio": "9:21",
            "resolution": "1K",  # 9:21 unsupported at 2K/4K per kie.ai docs
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
    print(f"Timeout after {max_wait}s", file=sys.stderr)
    sys.exit(1)


def download_image(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as response:
        dest.write_bytes(response.read())


def cover_resize(img, target_w, target_h):
    src_w, src_h = img.size
    scale = max(target_w / src_w, target_h / src_h)
    new_w, new_h = round(src_w * scale), round(src_h * scale)
    img = img.resize((new_w, new_h), Image.LANCZOS)
    left = (new_w - target_w) // 2
    top = (new_h - target_h) // 2
    return img.crop((left, top, left + target_w, top + target_h))


def main():
    if not API_KEY:
        print("Error: KIE_API_KEY not set in .env", file=sys.stderr)
        sys.exit(1)

    BACKGROUNDS_DIR.mkdir(exist_ok=True)

    for palette_name, prompt in PALETTE_PROMPTS.items():
        print(f"\n=== {palette_name} ===")
        print("Requesting background from kie.ai (gpt-image-2-text-to-image)...")
        task_id = create_task(prompt)
        print(f"Task ID: {task_id}")

        print("Waiting for completion...")
        image_url = wait_for_completion(task_id)

        raw_path = BACKGROUNDS_DIR / f"{palette_name}_raw.png"
        print(f"Downloading -> {raw_path}")
        download_image(image_url, raw_path)

        img = Image.open(raw_path).convert("RGB")
        img = cover_resize(img, W, H)
        final_path = BACKGROUNDS_DIR / f"{palette_name}.png"
        img.save(final_path, "PNG")
        print(f"Saved -> {final_path}")

    print(f"\nDone. 3 backgrounds saved in {BACKGROUNDS_DIR}/")
    print("Next: review them, then run scripts/generate_wallpapers.py to render")
    print("the full 60-image catalog on top of these (no further AI cost).")


if __name__ == "__main__":
    main()
