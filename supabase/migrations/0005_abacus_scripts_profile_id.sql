-- Scopes each script's anti-repetition metadata to the brand profile that
-- generated it. Without this, Heartlines' avoid-list would be checked
-- against (and grow) Mindset Of The Wealthy's history and vice versa —
-- two unrelated pages that must never influence each other's output.
--
-- Default backfills every existing row to 'mindset-of-the-wealthy', since
-- that's the only profile that existed before this migration.

alter table abacus_scripts
  add column profile_id text not null default 'mindset-of-the-wealthy';
