-- Experimental "Image Lab" feature: AI-generated Facebook profile/cover
-- images, tracked separately from the wallpaper catalog so the two never mix.

create table if not exists lab_images (
    id          bigint generated always as identity primary key,
    type        text not null check (type in ('profile', 'cover')),
    model       text not null,
    prompt      text not null,
    image_path  text not null,               -- Storage path within the `lab-images` bucket
    width       int not null,
    height      int not null,
    created_at  timestamptz not null default now()
);

alter table lab_images enable row level security;

-- Public read (the /lab/history page reads with the anon key), no public
-- write — inserts only happen server-side via the service_role key, which
-- bypasses RLS entirely.
create policy "Public read access" on lab_images for select using (true);

-- Public bucket, same reasoning as `wallpapers`: nothing sensitive in the
-- generated images themselves, and the download button needs a public URL.
insert into storage.buckets (id, name, public)
values ('lab-images', 'lab-images', true)
on conflict (id) do nothing;
