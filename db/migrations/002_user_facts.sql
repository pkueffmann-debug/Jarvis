-- ─────────────────────────────────────────────────────────────────────────
-- public.user_facts
-- JARVIS's long-term memory of the user. Facts are short, atomic strings
-- ("Paul's main project is daylens.dev", "Paul prefers German over English").
-- The chat endpoint pulls relevant facts into the system prompt each turn.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.user_facts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  fact        text not null,
  category    text default 'general',         -- 'general' | 'preference' | 'project' | 'contact' | 'schedule' | ...
  importance  smallint not null default 5     -- 1 (trivia) .. 10 (load every turn)
                check (importance between 1 and 10),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists user_facts_user_id_idx     on public.user_facts (user_id);
create index if not exists user_facts_importance_idx  on public.user_facts (user_id, importance desc, created_at desc);
create index if not exists user_facts_category_idx    on public.user_facts (user_id, category);

-- Avoid storing the exact same fact twice for the same user.
create unique index if not exists user_facts_unique_per_user
  on public.user_facts (user_id, fact);

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.user_facts enable row level security;

-- Users may CRUD their own facts. Service role bypasses RLS by definition.
drop policy if exists "users CRUD own facts" on public.user_facts;
create policy "users CRUD own facts"
  on public.user_facts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- updated_at trigger
create or replace function public.handle_user_facts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_facts_updated_at on public.user_facts;
create trigger user_facts_updated_at
  before update on public.user_facts
  for each row execute function public.handle_user_facts_updated_at();
