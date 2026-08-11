# Quote Wallpaper Shop — Project Brief

## Concept
A small side-project selling aesthetic phone lock-screen wallpapers with short quotes on them.
Discovery happens on TikTok (short posts, 3-4/day, lock-screen mockup + trending sound).
Traffic goes to a custom-built, mobile-first website where people browse a visual catalog and buy 5-wallpaper packs (freely chosen, not fixed bundles — see Architecture).

Not aiming for "life changing income" — aiming for a fast, consistent, low-overhead side business.

## Product spec (the wallpaper images themselves)

**Canvas:** 1284 x 2778 px (tall "universal" portrait size — reads correctly across most modern iPhone and Android aspect ratios without per-device exports).

**Safe zone:** all text must stay within the middle ~60-70% of the height and clear of the left/right ~10% margins, so nothing gets clipped when a phone crops/scales it differently.

**Typography:** Lora (Google Font, variable — has Regular/Medium/SemiBold/Bold + matching Italic). Each quote is split into 2-3 lines with mixed treatment for visual interest, e.g.:
- Line 1 — Regular weight
- Line 2 — Italic
- Line 3 — Bold

This mixed-weight styling is the visual signature — keep the *pattern* consistent across every quote so the catalog reads as one cohesive brand, even though the specific line breaks change per quote.

**Generation:** images are pre-generated in batch with a script (Python + Pillow), not rendered live. See "Image & quote generation" below for who owns this script and how it plugs into the backend.

## Palettes (max 3 per quote)

Keep it to 3 fixed palettes — covers light/dark system aesthetic preference without overproducing:

1. **Cream** (light) — background gradient ~`#FBF6EC` → `#EEE2CE`, text `#3A2C24` (espresso), accents sage `#5A684E` and terracotta `#A85238`. *(This is the palette already built and tested.)*
2. **Dark** (moody) — background gradient ~`#221C18` → `#2E241D` (warm near-black, not pure black), text `#F2E9DC` (warm off-white), accents muted gold `#C9A468` and terracotta `#B5654A`.
3. **Warm Neutral** (mid-tone) — background ~`#E8D5C0` → `#D8BFA0` (sand/blush), text `#4A3826`, accents deep olive `#6B7052` and rust `#9C4E33`.

*(Exact hex values are a starting proposal — nudge for contrast/readability once test-rendered, especially the Dark palette against the Bold line.)*

## Quote catalog
See `quotes.csv` (id, text, language) — 20 quotes for v1, 10 English / 10 Italian, all in the same "goal-setting / discipline / mindset" lane as the reference quote ("A goal without a deadline is a fantasy.") so the catalog feels cohesive. Matches the `quotes` table shape below, ready to import into Supabase directly. If you want other emotional lanes later (self-worth, gratitude, relationships, etc.), flag it — this v1 batch is deliberately narrow so the first drop has a consistent voice.

**Action item before launch:** the Italian lines were written natively (not translated line-by-line from the English), but should still get a quick native-speaker read-through before going live — worth a final pass by a native ear for tone/slang.

## Catalog size
20 quotes x 3 palettes = 60 pregenerated static images for v1.

## Packs & pricing
- **Do not sell single wallpapers or show a per-image price.** Only sell 5-quote packs (15 wallpapers — all 3 palettes per quote) — bundle framing avoids "is this worth 2€" hesitation, and the Italian market impulse-buy ceiling is low.
- Price: **2.50€ per 5-quote pack** to start.
- Treat this price as a live test, not a final answer — try a second price point once there's a week of real traffic, and see which earns more per visitor.
- **Users pick any 5 of the full catalog freely** (not fixed bundles) — the Supabase backend makes this possible from day one instead of needing a curated-packs fallback.

## Payment provider
**Stripe, direct** — not going through a Merchant-of-Record provider (Lemon Squeezy was the original plan; switched to direct Stripe). This means **you are the merchant of record**: you're responsible for your own VAT/sales-tax registration and remittance in the countries you sell to (EU digital-goods VAT is owed from the first sale, no threshold) — that overhead is the tradeoff for avoiding a MoR's cut and using Stripe directly.

Stripe Checkout (hosted page, session created server-side) handles the checkout UI and payment; Supabase is the backend that makes the custom pack selection and delivery work (see below).

## Architecture — full backend (Supabase)

Going full backend is what unlocks the free-pick pack builder ("choose any 5 of the catalog") instead of settling for fixed bundles.

**Database (Postgres via Supabase):**
- `quotes` — id, text, language (it/en), created_at
- `palettes` — id, name (cream / dark / warm-neutral), hex values
- `wallpapers` — id, quote_id (FK), palette_id (FK), image_path (Storage path)
- `orders` — id, stripe_session_id, wallpaper_ids (array or join table), status, download_url, created_at

**Storage (Supabase Storage):** one bucket holding the pregenerated wallpaper PNGs (60 for v1: 20 quotes x 3 palettes, grows over time as new quotes are added). Can be a public bucket — the previews being visible isn't the issue, the paid part is getting the clean file for your own phone.

**Payment + delivery flow:**
1. Frontend reads the live catalog from Supabase (`wallpapers` joined with `quotes`/`palettes`) — no hardcoded list, so adding a new quote to the DB makes it appear on the site automatically.
2. User picks any 5. Checkout goes through Stripe (session created server-side), with the 5 chosen `wallpaper_id`s passed as checkout session metadata.
3. On successful payment, Stripe's webhook fires → hits a **Supabase Edge Function**.
4. The Edge Function reads the wallpaper IDs from the metadata, pulls those exact files from Storage, zips them, and returns/emails a download link.
5. The order is logged in the `orders` table (useful later for "which combos actually sell" analysis, on top of the TikTok saves signal).

No server for you to run — Supabase Edge Functions are the entire "backend," which is why this is still a fast build despite being "full backend."

## Image & quote generation — who builds it
Claude Code should own the generation script inside the project, not something handled separately and handed over as loose files — it needs to both render the PNG *and* upload it to Supabase Storage *and* insert the matching row into `quotes`/`wallpapers`. That's one pipeline, so it belongs in the codebase.

What I'm handing over is the **working generator script from this session** (`make_wallpaper.py`, Python + Pillow) as the reference implementation — it already has the tested visual recipe: Lora font, the mixed regular/italic/bold line treatment, the cream palette's exact gradient and safe-zone math, all approved and rendered. Point Claude Code at it with something like: *"extend this script to loop over a quotes table x the 3 palettes, upload each PNG to Supabase Storage, and insert a row per combo"* — that carries the exact approved look forward instead of Claude Code re-guessing the design from a text description.

## Out of scope for v1 (future ideas)
- Personalization upsell (buyer's own name/goal baked into the wallpaper) — higher price point, proven popular in this niche
- Subscription-style monthly "drops"
- Cross-listing on Etsy

## Marketing (for reference — separate conversation)
TikTok, 3-4 posts/day, lock-screen + Spotify-widget mockup format using TikTok's built-in sound picker (not recorded audio — watch for Business-account commercial sound library restrictions). Track *saves* per post as the signal for which quotes/palettes to actually turn into packs, not views/likes.
