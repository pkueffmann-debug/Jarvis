-- ─────────────────────────────────────────────────────────────────────────
-- public.subscriptions
-- One row per JARVIS user. Stripe events write here via the webhook;
-- the /brain auth gate reads it to decide access.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade unique,
  email                   text not null,
  plan                    text not null,                         -- 'pro' | 'team' | 'enterprise'
  status                  text not null check (status in (
                            'trialing',
                            'active',
                            'past_due',
                            'canceled',
                            'incomplete',
                            'incomplete_expired',
                            'unpaid',
                            'paused'
                          )),
  stripe_customer_id      text,
  stripe_subscription_id  text,
  current_period_end      timestamptz,
  cancel_at_period_end    boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists subscriptions_stripe_customer_id_idx on public.subscriptions (stripe_customer_id);
create index if not exists subscriptions_status_idx             on public.subscriptions (status);

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.subscriptions enable row level security;

-- Users read their own subscription. No client writes — only the service
-- role (used by the Stripe webhook) can insert/update/delete.
drop policy if exists "users read own subscription" on public.subscriptions;
create policy "users read own subscription"
  on public.subscriptions
  for select
  using (auth.uid() = user_id);

-- ── updated_at trigger ───────────────────────────────────────────────────
create or replace function public.handle_subscriptions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists subscriptions_updated_at on public.subscriptions;
create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.handle_subscriptions_updated_at();

-- ── Helper view: "is the current user entitled?" ─────────────────────────
-- Returns one row of booleans for the calling auth.uid().
create or replace view public.my_entitlement
with (security_invoker = on) as
select
  user_id,
  plan,
  status,
  status in ('trialing', 'active')                       as is_active,
  (current_period_end is null or current_period_end > now()) as in_period,
  current_period_end
from public.subscriptions
where user_id = auth.uid();
