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
3. In your Supabase project, run `supabase/migrations/0003_lab_images.sql`
   in the SQL editor, and create a **public** Storage bucket named
   `lab-images`.
4. `npm run dev`, open `http://localhost:3000`.

## Notes

- `supabase/migrations/0001_init.sql` and `0002_rename_order_column.sql` are
  left in place as historical migration history for the Supabase project
  this repo was originally linked to (an earlier wallpaper-shop product) —
  they're not needed for Abacus/Lab and can be ignored on a fresh project.
