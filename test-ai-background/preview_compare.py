"""
Applies the full lock-screen mockup chrome (status bar, clock, date, Now
Playing widget, flashlight/camera, home indicator) to both the existing
reference wallpaper and the AI-background test wallpaper, then builds a
side-by-side comparison — so the two can be judged as realistic previews,
not just bare backgrounds.

Run after generate.py has already produced output/test_ai_cream_quote1.png.

Usage:
    source .venv/bin/activate
    python test-ai-background/preview_compare.py
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

from mockup import apply_mockup_chrome, PROJECT_ROOT, LORA_REGULAR

TEST_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = TEST_DIR / "output"
REFERENCE_IMAGE = PROJECT_ROOT / "scripts" / "output" / "1_cream.png"
AI_IMAGE = OUTPUT_DIR / "test_ai_cream_quote1.png"
CAPTION = "A goal without a deadline is a fantasy."
TEXT_COLOR = "#3A2C24"


def build_comparison(ref_mockup_path, ai_mockup_path, dest_path):
    ref = Image.open(ref_mockup_path).convert("RGB")
    ai = Image.open(ai_mockup_path).convert("RGB")

    label_h = 60
    gap = 12
    canvas_w = ref.width + ai.width + gap
    canvas_h = max(ref.height, ai.height) + label_h
    canvas = Image.new("RGB", (canvas_w, canvas_h), (20, 20, 20))
    canvas.paste(ref, (0, label_h))
    canvas.paste(ai, (ref.width + gap, label_h))

    draw = ImageDraw.Draw(canvas)
    try:
        font = ImageFont.truetype(str(LORA_REGULAR), 36)
    except Exception:
        font = ImageFont.load_default()
    draw.text((20, 12), "Reference (flat gradient) + mockup", font=font, fill=(255, 255, 255))
    draw.text((ref.width + gap + 20, 12), "AI background (GPT Image 2) + mockup", font=font, fill=(255, 255, 255))

    canvas.save(dest_path)


def main():
    if not AI_IMAGE.exists():
        raise SystemExit(f"Run generate.py first — {AI_IMAGE} not found")
    if not REFERENCE_IMAGE.exists():
        raise SystemExit(f"Reference image not found at {REFERENCE_IMAGE}")

    ref = Image.open(REFERENCE_IMAGE).convert("RGB")
    ai = Image.open(AI_IMAGE).convert("RGB")

    ref_mockup = apply_mockup_chrome(ref, CAPTION, TEXT_COLOR)
    ai_mockup = apply_mockup_chrome(ai, CAPTION, TEXT_COLOR)

    ref_mockup_path = OUTPUT_DIR / "reference_with_mockup.png"
    ai_mockup_path = OUTPUT_DIR / "ai_with_mockup.png"
    ref_mockup.save(ref_mockup_path)
    ai_mockup.save(ai_mockup_path)

    comparison_path = OUTPUT_DIR / "comparison_with_mockup.png"
    build_comparison(ref_mockup_path, ai_mockup_path, comparison_path)

    print("Done:")
    print(f"  - {ref_mockup_path.name}")
    print(f"  - {ai_mockup_path.name}")
    print(f"  - {comparison_path.name}  <- side by side")


if __name__ == "__main__":
    main()
