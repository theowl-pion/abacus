# test-ai-background

One-off test: does an AI-generated background (kie.ai, model
`gpt-image-2-text-to-image`) look better than the current flat gradient?
**Not part of the real pipeline** — doesn't touch `scripts/generate_wallpapers.py`
or `quotes.csv`, doesn't upload anything to Supabase, doesn't regenerate the
catalog. Just renders one test image and puts it next to the current
reference wallpaper for comparison.

## What it does

1. Calls kie.ai to generate one Cream-palette-style background image.
2. Resizes/crops it (cover-fit) to the real canvas size, 1284×2778.
3. Draws quote #1 ("A goal without a deadline is a fantasy.") on top of it
   using the **exact same** tested font/sizing/positioning code imported
   directly from `scripts/generate_wallpapers.py` — the AI model is never
   asked to render any text itself.
4. Builds `output/comparison.png`: the existing flat-gradient reference next
   to the new AI-background version, side by side.

## Run it

```
source .venv/bin/activate
python test-ai-background/generate.py
```

(from the project root — the venv already has Pillow + python-dotenv
installed from the main pipeline setup).

## Output

Everything lands in `test-ai-background/output/` (gitignored):
- `ai_background_raw.png` — the raw image kie.ai returned
- `ai_background_cream.png` — resized/cropped to 1284×2778
- `test_ai_cream_quote1.png` — that background with quote #1 drawn on top
- `comparison.png` — reference vs. AI, side by side — **look at this one**

## Config

`test-ai-background/.env` (gitignored) holds `KIE_API_KEY`. Nothing else
needed — the prompt and quote are hardcoded in `generate.py` for this test;
edit them there if you want to try a different quote or tweak the prompt
before re-running.
