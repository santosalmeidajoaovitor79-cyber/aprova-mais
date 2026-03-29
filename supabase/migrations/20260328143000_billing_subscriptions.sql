create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  plan_key text,
  billing_cycle text,
  status text not null default 'inactive',
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id),
  constraint subscriptions_plan_key_check
    check (plan_key is null or plan_key in ('inicial', 'pro')),
  constraint subscriptions_billing_cycle_check
    check (billing_cycle is null or billing_cycle in ('monthly', 'yearly')),
  constraint subscriptions_status_check
    check (
      status in (
        'inactive',
        'checkout_pending',
        'trialing',
        'active',
        'past_due',
        'canceled',
        'unpaid',
        'incomplete',
        'incomplete_expired',
        'paused'
      )
    )
);

create unique index if not exists subscriptions_stripe_customer_unique_idx
  on public.subscriptions (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists subscriptions_stripe_subscription_unique_idx
  on public.subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

create index if not exists subscriptions_status_idx
  on public.subscriptions (status, plan_key, billing_cycle);

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;

create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row
execute function public.set_row_updated_at();

alter table public.subscriptions enable row level security;

do $migration$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'subscriptions' and policyname = 'subscriptions_select_own'
  ) then
    create policy subscriptions_select_own
      on public.subscriptions for select
      to authenticated
      using (user_id = auth.uid());
  end if;
end
$migration$;

comment on table public.subscriptions is 'Estado consolidado da assinatura do usuario, sincronizado via webhook Stripe.';
comment on column public.subscriptions.stripe_customer_id is 'Customer Stripe do usuario.';
comment on column public.subscriptions.stripe_subscription_id is 'Subscription Stripe atual do usuario.';
