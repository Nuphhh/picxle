-- Server-side guess log. Every guess (and skip) is recorded here, so the server
-- — not the browser — knows how many guesses a player has used on a puzzle and
-- whether they've solved it. /api/guess refuses a 6th guess, and
-- /api/puzzle/reveal only hands out today's answer once the player is done.
--
-- The UNIQUE constraint is the important bit: if two guesses arrive at the same
-- moment, both might read "4 used" and try to insert guess #5. The database
-- lets only one of them in, so nobody can sneak in extra guesses by racing.
--
-- RLS on with no policies = only the server (service-role key) can read/write.
-- Run once in the Supabase SQL editor.

create table public.guesses (
  id bigserial primary key,
  puzzle_id uuid not null references public.puzzles(id) on delete cascade,
  player_id uuid not null,
  guess_number smallint not null check (guess_number between 1 and 5),
  guess text,               -- null for a skip
  correct boolean not null,
  created_at timestamptz not null default now(),
  unique (puzzle_id, player_id, guess_number)
);

alter table public.guesses enable row level security;
