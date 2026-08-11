# Quote Wallpaper Shop (Vettos)

Aesthetic phone lock-screen wallpapers with short quotes, sold as 5-quote
packs (15 wallpapers — all 3 palettes included per quote). See
`project-brief.md` for the full concept, pricing, and architecture.

## What's built

- **Generation pipeline** (`scripts/generate_wallpapers.py`) — renders all 60
  wallpapers (20 quotes × 3 palettes) and uploads them to Supabase.
- **Storefront** (`web/`) — Next.js catalog, mobile App-Switcher-style pack
  builder + desktop grid, full-screen quote detail, language filter.
- **Checkout + fulfillment** — direct Stripe Checkout (you're the merchant of
  record — no Lemon Squeezy), a Supabase Edge Function webhook that logs the
  order and emails the download link, and an on-site `/order/success` page
  that zips and downloads the pack client-side. This is code-complete but
  needs your own Stripe + Resend accounts wired in before it actually works
  — see below.

## Setup: Supabase (generation pipeline)

1. Create a Supabase project at [supabase.com](https://supabase.com).
2. Open the SQL editor and run `supabase/migrations/0001_init.sql` — creates
   `quotes`, `palettes`, `wallpapers`, `orders` and seeds the 3 palettes.
3. In Storage, create a **public** bucket named `wallpapers`.
4. Copy `.env.example` to `.env` and fill in `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API).
5. `pip install -r scripts/requirements.txt`
6. `python scripts/generate_wallpapers.py` — renders all 60 wallpapers to
   `scripts/output/` and uploads them to Storage. Idempotent — safe to
   re-run after editing `quotes.csv` or the palette values.

   Without `.env` configured, it still renders everything locally to
   `scripts/output/` (skipping the upload/DB steps) — useful for checking
   visuals before a Supabase project exists.

## Setup: storefront (`web/`)

1. `cd web && npm install`
2. Copy `web/.env.local.example` to `web/.env.local` and fill in
   `NEXT_PUBLIC_SUPABASE_URL` (same project URL as above) and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Project Settings → API → "anon public"
   key — **not** the service-role key).
3. `npm run dev`, open `http://localhost:3000`.

## Setup: Stripe (checkout)

You are the merchant of record with this setup (not using a Merchant-of-
Record provider) — you're responsible for your own VAT/sales-tax
registration and filing. That's a deliberate choice made over Lemon
Squeezy's Managed Payments; worth knowing before you have real sales.

1. Create/use a Stripe account at [stripe.com](https://stripe.com).
2. Grab the **secret key** from the dashboard (Developers → API keys) and
   set it as `STRIPE_SECRET_KEY` in `web/.env.local`. No product/price needs
   pre-creating — the checkout session is built with an inline price
   (`web/src/app/api/create-checkout-session/route.ts`), currently **2.50€**.
3. Under Developers → Webhooks, add an endpoint pointed at your deployed
   Edge Function URL (see below), subscribed to the `checkout.session.completed`
   event. Copy its signing secret — you'll set it as `STRIPE_WEBHOOK_SECRET`
   on the Edge Function, not in the web app.

## Setup: Resend (confirmation email)

1. Create an account at [resend.com](https://resend.com).
2. Verify a sending domain (or use their shared test domain to start), and
   update the `from:` address in
   `supabase/functions/stripe-webhook/index.ts` to match.
3. Grab an API key — set it as `RESEND_API_KEY` on the Edge Function.

## Deploying the Edge Function

```
supabase functions deploy stripe-webhook
supabase secrets set STRIPE_WEBHOOK_SECRET=... RESEND_API_KEY=... SITE_URL=https://your-domain.com
```

`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by
Supabase — no need to set those yourself. Point the Stripe webhook (step 3
above) at the deployed function's URL, shown after `deploy`. Also run
`supabase/migrations/0002_rename_order_column.sql` in the SQL editor if
you already ran `0001_init.sql` before this switch from Lemon Squeezy.

## How checkout works

1. Buyer picks 5 quotes → "Checkout" calls a Next.js API route that creates
   a Stripe Checkout Session server-side (the secret key never touches the
   browser) with the 5 `wallpaper_id`s in its metadata, and redirects to
   Stripe's hosted checkout page.
2. On success, Stripe redirects to `/order/success?ids=...`, which fetches
   those wallpapers' public URLs and zips them client-side for download
   (`web/src/components/DownloadPack.tsx`) — no server-side zipping needed
   since the bucket is already public.
3. In parallel, Stripe's webhook hits the Edge Function, which logs the
   order in `orders` and emails the same download link via Resend — so the
   buyer has it even if they close the tab before downloading.

If `STRIPE_SECRET_KEY` isn't set, clicking Checkout shows a "store isn't
connected yet" toast instead of erroring.

## Editing quotes

`quotes.csv` holds the catalog. The `text` column uses `|` to mark line
breaks (2 or 3 segments per quote) — this is the "visual signature" line
treatment from the brief:

- 2 segments → line 1 Regular, line 2 Bold
- 3 segments → line 1 Regular, line 2 Italic, line 3 Bold

Add a new row with a new `id` and re-run the generation script to extend
the catalog.
