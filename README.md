# Vettos

Internal AI image-generation tools, single-user, no auth.

## What's built

- **Abacus** (`/abacus`) — batch image generation for short-form video
  content. N prompt slots, "Generate All", zip download at the end. Two
  interchangeable backends, switchable in the UI:
  - kie.ai's GPT Image 2 (async job + poll)
  - Direct OpenAI `gpt-image-2` (synchronous, concurrency-capped, requests
    1088×1920 — the closest size the API allows to 9:16 — then a negligible
    server-side crop down to exactly 1080×1920)

  Prompts can also be auto-generated from a one-line idea via a 3-step
  pipeline, each step its own Claude (`claude-sonnet-5`) call:
  1. **Generate Script** — writes a voiceover script in the active brand
     profile's voice (`web/src/lib/profiles/*.ts`), including a
     `thumbnail_caption`, `hook_line`/`opening_line`, and `insight` field
     surfaced in the review UI before approving.
  2. **Write Image Prompts** — translates the approved script into real
     per-line visual prompts (camera framing, scene type, exclusion rules,
     a style-lock sentence) via one system prompt shared across every
     profile (`web/src/lib/imagePromptWriterPrompt.ts`) — only the scene
     menu, palette names, character policy, and style-lock sentence are
     swapped per profile, not the document itself. Character policy is one
     of three types (LOCKED, VARIES, or DISTANT/UNLOCKED); LOCKED profiles
     also get a Supabase-backed anti-repetition avoid-list
     (`abacus_characters`) so a locked character doesn't repeat across
     scripts.
  3. **Generate All** — unchanged, generates images from those prompts.

  Two brand profiles exist today, switchable in the UI, each with its own
  Style guide, script voice, and independently-scoped anti-repetition
  history in Supabase (`abacus_scripts`, keyed by `profile_id` — Heartlines
  and Mindset Of The Wealthy never see each other's avoid-lists):
  - **Mindset Of The Wealthy** — cold "Modern Oracle" money-mindset voice,
    anime-influenced illustration, DISTANT/UNLOCKED character policy (no
    identifiable recurring character — figures default to
    small/distant/silhouetted/from-behind, message- and environment-led
    rather than character-led).
  - **Heartlines** — warm romantic/heartbreak voice for French/Italian
    markets, webtoon-style illustration, VARIES character policy (no locked
    character, people vary per image).

  Session state (active profile, script, image prompts, slots) persists
  client-side per profile in IndexedDB (`web/src/lib/abacusSession.ts`), so
  switching profiles or refreshing the page doesn't lose in-progress work;
  an explicit "Clear session" button wipes it.

  An approved script can also be **Translated** (French/Italian, extensible
  via `web/src/lib/translatePrompt.ts`) into a natural, non-literal version
  via a 4th Claude call — deliberately stateless and independent of the
  image pipeline, since neither profile bakes captions into generated
  images, so translating never regenerates images or image prompts. Nothing
  about a translation is persisted; like the base script and images, it
  only lives in the browser session.
- **Lab** (`/lab`) — experimental multi-model generator for Facebook profile
  pictures and cover photos, cropped to Facebook's real spec, with a
  generation history page (`/lab/history`) backed by Supabase.

The root `/` redirects to `/abacus`.

## Setup

1. `cd web && npm install`
2. Copy `web/.env.local.example` to `web/.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — used by
     Lab's history page and image storage. Project Settings → API in your
     Supabase project.
   - `SUPABASE_SERVICE_ROLE_KEY` — server-only, used to write generated
     images/history. Project Settings → API → service role key.
   - `KIE_API_KEY` — from [kie.ai](https://kie.ai), used by both tools'
     kie.ai backend.
   - `OPENAI_API_KEY` — from [platform.openai.com](https://platform.openai.com)
     (needs billing enabled), used by Abacus's OpenAI backend.
   - `OPENAI_IMAGE_QUALITY` — optional, `low` / `medium` / `high`, defaults
     to `medium`.
   - `ANTHROPIC_API_KEY` — from [console.anthropic.com](https://console.anthropic.com),
     used by Abacus's Generate Script / Write Image Prompts / Translate
     steps.
3. In your Supabase project, run `supabase/migrations/0003_lab_images.sql`
   through `0007_abacus_characters.sql` (in order) in the SQL editor, and
   create a **public** Storage bucket named `lab-images`.
4. `npm run dev`, open `http://localhost:3000`.

## Notes

- `supabase/migrations/0001_init.sql` and `0002_rename_order_column.sql` are
  left in place as historical migration history for the Supabase project
  this repo was originally linked to (an earlier wallpaper-shop product) —
  they're not needed for Abacus/Lab and can be ignored on a fresh project.
