-- Quote Wallpaper Shop — initial schema
-- Run this once in the Supabase SQL editor (or via `supabase db push`) on a fresh project.

create table if not exists quotes (
    id          bigint primary key,
    text        text not null,
    language    text not null check (language in ('en', 'it')),
    created_at  timestamptz not null default now()
);

create table if not exists palettes (
    id          bigint generated always as identity primary key,
    name        text not null unique,       -- 'cream' | 'dark' | 'warm-neutral'
    bg_top      text not null,               -- hex, gradient start
    bg_bottom   text not null,               -- hex, gradient end
    text_color  text not null,               -- hex, main text
    accent1     text not null,               -- hex, e.g. sage / gold / olive
    accent2     text not null                -- hex, e.g. terracotta / rust
);

create table if not exists wallpapers (
    id          bigint generated always as identity primary key,
    quote_id    bigint not null references quotes(id) on delete cascade,
    palette_id  bigint not null references palettes(id) on delete cascade,
    image_path  text not null,               -- Storage path within the `wallpapers` bucket
    created_at  timestamptz not null default now(),
    unique (quote_id, palette_id)
);

create table if not exists orders (
    id                      bigint generated always as identity primary key,
    lemon_squeezy_order_id  text not null unique,
    wallpaper_ids           bigint[] not null,
    status                  text not null default 'pending',
    download_url            text,
    created_at              timestamptz not null default now()
);

-- Row Level Security — a fresh Supabase table has no RLS by default, which
-- means the public anon key (used client-side by the future storefront) would
-- otherwise get full read/write access to every table below.
alter table quotes enable row level security;
alter table palettes enable row level security;
alter table wallpapers enable row level security;
alter table orders enable row level security;

-- Catalog tables: readable by anyone (anon or authenticated), the storefront
-- needs this to list quotes/palettes/wallpapers. No insert/update/delete
-- policies are defined, so writes are only possible via the service_role key
-- (used by generate_wallpapers.py and, later, the Edge Function) — service_role
-- bypasses RLS entirely.
create policy "Public read access" on quotes for select using (true);
create policy "Public read access" on palettes for select using (true);
create policy "Public read access" on wallpapers for select using (true);

-- orders: intentionally has zero policies. RLS is enabled with no grants, so
-- anon/authenticated get no access at all — only the Edge Function's
-- service_role key can read or write order rows.

-- Fixed v1 palettes (hex values from project-brief.md, "Palettes" section)
insert into palettes (name, bg_top, bg_bottom, text_color, accent1, accent2) values
    ('cream',        '#FBF6EC', '#EEE2CE', '#3A2C24', '#5A684E', '#A85238'),
    ('dark',         '#221C18', '#2E241D', '#F2E9DC', '#C9A468', '#B5654A'),
    ('warm-neutral', '#E8D5C0', '#D8BFA0', '#4A3826', '#6B7052', '#9C4E33')
on conflict (name) do nothing;
