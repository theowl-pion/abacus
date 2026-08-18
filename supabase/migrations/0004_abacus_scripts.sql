-- Server-side memory for Abacus's Claude-generated scripts. Holds enough
-- per-script metadata to build the anti-repetition prompt on the next
-- generation call (avoid the same rhetorical pattern, topic category, or
-- central image/metaphor as recent scripts).

create table if not exists abacus_scripts (
    id                          bigint generated always as identity primary key,
    title                       text not null,
    lines                       jsonb not null,
    word_count                  int not null,
    estimated_duration_seconds  int not null,
    pattern_used                text not null,
    topic_category              text not null,
    central_image               text not null,
    hook_score                  numeric not null,
    created_at                  timestamptz not null default now()
);

alter table abacus_scripts enable row level security;

-- No policies: only ever read/written server-side via the service-role
-- client (supabaseAdmin), which bypasses RLS. Nothing reads this table with
-- the anon key — it's a memory store for prompt-building, not a feature.
