-- Anti-repetition tracking for the image-prompt-writer step's character
-- choice (LOCKED-per-script profiles only, e.g. Mindset Of The Wealthy).
-- Separate from abacus_scripts because this is written by the
-- generate-image-prompts call, not generate-script, and there's no script
-- row id available to update against — this is its own append-only avoid
-- list, scoped per profile the same way abacus_scripts.central_image is.

create table abacus_characters (
  id bigint generated always as identity primary key,
  profile_id text not null,
  character_summary text not null,
  created_at timestamptz not null default now()
);

create index abacus_characters_profile_id_idx
  on abacus_characters (profile_id, created_at desc);
