"""
Second test: image-to-image, guided by the user's real phone-screenshot
reference, to see if it gets closer to that specific warm/rich look than
the plain text-to-image attempt.

The reference photo is uploaded to kie.ai's own temporary file storage
(auto-deleted after 24h there) to get a URL the API can use as input_urls
- kie.ai requires a public HTTPS URL, not a local file or base64 inline.

Important: the prompt explicitly tells the model to use the reference only
for background color/lighting/mood, and to exclude any UI, text, status
bar, or widget — those stay as our own separately-drawn mockup overlay,
never baked into the actual product background. Text is still drawn
afterwards with the exact same tested typography code, same as generate.py.

Usage:
    source .venv/bin/activate
    python test-ai-background/generate_img2img.py
"""

import base64
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

from PIL import Image

from generate import (
    API_KEY,
    CREAM_PALETTE,
    OUTPUT_DIR,
    QUOTE_TEXT,
    W,
    H,
    api_request,
    cover_resize,
    download_image,
    draw_quote,
    split_lines,
    wait_for_completion,
)
from mockup import apply_mockup_chrome

REFERENCE_PHOTO = Path("/Users/fouadliady/Downloads/IMG_7581.PNG")

IMG2IMG_PROMPT = (
    "Use this reference image only as a style guide for its warm cream and "
    "beige background lighting, color mood, and soft organic sage-green and "
    "terracotta color blobs. Generate a new, completely blank abstract "
    "background in that same warm cream/beige palette and lighting mood. "
    "Do NOT include any of the following from the reference: no status bar, "
    "no clock, no time, no numbers, no app icons, no music widget, no "
    "buttons, no UI elements of any kind, no text, no words, no letters, no "
    "people, no objects. Just a smooth, soft-focus abstract color-gradient "
    "background suitable as a phone wallpaper, tall portrait orientation, "
    "uncluttered in the vertical center."
)


def upload_reference():
    """The file-upload API lives on a different host (kieai.redpandaai.co),
    not api.kie.ai like the jobs/generation endpoints."""
    with open(REFERENCE_PHOTO, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("ascii")
    data = {
        "base64Data": f"data:image/png;base64,{b64}",
        "uploadPath": "vettos-test",
        "fileName": "reference.png",
    }
    req = urllib.request.Request(
        "https://kieai.redpandaai.co/api/file-base64-upload",
        data=json.dumps(data).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print(f"Upload error {e.code}: {e.read().decode('utf-8')}", file=sys.stderr)
        sys.exit(1)
    if not result.get("success"):
        print(f"Upload failed: {result.get('msg')}", file=sys.stderr)
        sys.exit(1)
    return result["data"]["downloadUrl"]


def create_img2img_task(reference_url):
    data = {
        "model": "gpt-image-2-image-to-image",
        "input": {
            "prompt": IMG2IMG_PROMPT,
            "input_urls": [reference_url],
            "aspect_ratio": "9:21",
            "resolution": "1K",
        },
    }
    result = api_request("POST", "/jobs/createTask", data)
    if result.get("code") != 200:
        print(f"Error creating task: {result.get('msg')}", file=sys.stderr)
        sys.exit(1)
    return result["data"]["taskId"]


def main():
    if not REFERENCE_PHOTO.exists():
        raise SystemExit(f"Reference photo not found: {REFERENCE_PHOTO}")

    print(f"Uploading reference photo to kie.ai temp storage...")
    reference_url = upload_reference()
    print(f"Uploaded -> {reference_url}")

    print("Requesting image-to-image background (gpt-image-2-image-to-image)...")
    task_id = create_img2img_task(reference_url)
    print(f"Task ID: {task_id}")

    print("Waiting for completion...")
    image_url = wait_for_completion(task_id)

    raw_path = OUTPUT_DIR / "ai_background_img2img_raw.png"
    print(f"Downloading -> {raw_path}")
    download_image(image_url, raw_path)

    print(f"Resizing/cropping to {W}x{H}...")
    bg = Image.open(raw_path).convert("RGB")
    bg = cover_resize(bg, W, H)

    print("Drawing quote #1 with the tested typography...")
    lines = split_lines(QUOTE_TEXT)
    result = draw_quote(bg.copy(), lines, CREAM_PALETTE["text_color"])
    result_path = OUTPUT_DIR / "test_ai_img2img_cream_quote1.png"
    result.save(result_path)

    print("Applying full mockup chrome...")
    mockup_path = OUTPUT_DIR / "ai_img2img_with_mockup.png"
    apply_mockup_chrome(result, "A goal without a deadline is a fantasy.", CREAM_PALETTE["text_color"]).save(mockup_path)

    print("\nDone:")
    print(f"  - {result_path.name}")
    print(f"  - {mockup_path.name}")


if __name__ == "__main__":
    main()
