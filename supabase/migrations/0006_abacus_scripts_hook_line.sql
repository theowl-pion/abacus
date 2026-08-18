-- Adds a second, dedicated anti-repetition column: the script's hook line
-- (Mindset Of The Wealthy) or opening line (Heartlines) — one shared column
-- since both are the same concept (this script's first/hook line) under a
-- profile-specific name. Scoped per-profile the same way central_image
-- already is, via the existing profile_id column.
--
-- Nullable: existing rows predate this field and have no hook_line value.

alter table abacus_scripts
  add column hook_line text;
