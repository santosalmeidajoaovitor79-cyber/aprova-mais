create table if not exists public.daily_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  date_key date not null default current_date,
  yara_chat_count integer not null default 0,
  questions_count integer not null default 0,
  recovery_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date_key),
  constraint daily_usage_yara_chat_non_negative check (yara_chat_count >= 0),
  constraint daily_usage_questions_non_negative check (questions_count >= 0),
  constraint daily_usage_recovery_non_negative check (recovery_count >= 0)
);

create index if not exists daily_usage_user_date_idx
  on public.daily_usage (user_id, date_key desc);

drop trigger if exists daily_usage_set_updated_at on public.daily_usage;

create trigger daily_usage_set_updated_at
before update on public.daily_usage
for each row
execute function public.set_row_updated_at();

alter table public.daily_usage enable row level security;

do $migration$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'daily_usage' and policyname = 'daily_usage_select_own'
  ) then
    create policy daily_usage_select_own
      on public.daily_usage for select
      to authenticated
      using (user_id = auth.uid());
  end if;
end
$migration$;

create or replace function public.resolve_effective_usage_plan()
returns text
language sql
stable
security definer
set search_path = public
as $$
  with active_subscription as (
    select plan_key
    from public.subscriptions
    where user_id = auth.uid()
      and status in ('trialing', 'active', 'past_due')
    limit 1
  )
  select coalesce((select plan_key from active_subscription), 'inicial');
$$;

create or replace function public.resolve_daily_usage_limit(counter_name text)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  plan_key_var text;
begin
  plan_key_var := public.resolve_effective_usage_plan();

  if plan_key_var = 'pro' then
    return null;
  end if;

  case counter_name
    when 'yara_chat_count' then return 12;
    when 'questions_count' then return 18;
    when 'recovery_count' then return 1;
    else return 0;
  end case;
end;
$$;

create or replace function public.get_my_daily_usage(target_date date default current_date)
returns table (
  date_key date,
  plan_key text,
  yara_chat_count integer,
  questions_count integer,
  recovery_count integer,
  yara_chat_limit integer,
  questions_limit integer,
  recovery_limit integer,
  remaining_chat integer,
  remaining_questions integer,
  remaining_recovery integer
)
language sql
stable
security definer
set search_path = public
as $$
  with usage_row as (
    select *
    from public.daily_usage
    where user_id = auth.uid()
      and date_key = target_date
    limit 1
  ),
  limits as (
    select
      public.resolve_effective_usage_plan() as plan_key,
      public.resolve_daily_usage_limit('yara_chat_count') as yara_chat_limit,
      public.resolve_daily_usage_limit('questions_count') as questions_limit,
      public.resolve_daily_usage_limit('recovery_count') as recovery_limit
  )
  select
    target_date as date_key,
    limits.plan_key,
    coalesce(usage_row.yara_chat_count, 0) as yara_chat_count,
    coalesce(usage_row.questions_count, 0) as questions_count,
    coalesce(usage_row.recovery_count, 0) as recovery_count,
    limits.yara_chat_limit,
    limits.questions_limit,
    limits.recovery_limit,
    case
      when limits.yara_chat_limit is null then null
      else greatest(limits.yara_chat_limit - coalesce(usage_row.yara_chat_count, 0), 0)
    end as remaining_chat,
    case
      when limits.questions_limit is null then null
      else greatest(limits.questions_limit - coalesce(usage_row.questions_count, 0), 0)
    end as remaining_questions,
    case
      when limits.recovery_limit is null then null
      else greatest(limits.recovery_limit - coalesce(usage_row.recovery_count, 0), 0)
    end as remaining_recovery
  from limits
  left join usage_row on true;
$$;

create or replace function public.consume_daily_usage(counter_name text, consume_amount integer default 1)
returns table (
  allowed boolean,
  date_key date,
  plan_key text,
  used_count integer,
  limit_count integer,
  remaining_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  usage_date date := current_date;
  plan_key_var text;
  limit_value integer;
  current_value integer;
  next_value integer;
  safe_amount integer := greatest(1, least(coalesce(consume_amount, 1), 20));
begin
  if auth.uid() is null then
    raise exception 'Usuário autenticado é obrigatório para consumir quota.';
  end if;

  if counter_name not in ('yara_chat_count', 'questions_count', 'recovery_count') then
    raise exception 'Contador de quota inválido: %', counter_name;
  end if;

  plan_key_var := public.resolve_effective_usage_plan();
  limit_value := public.resolve_daily_usage_limit(counter_name);

  insert into public.daily_usage (user_id, date_key)
  values (auth.uid(), usage_date)
  on conflict (user_id, date_key) do nothing;

  execute format(
    'select %I from public.daily_usage where user_id = auth.uid() and date_key = $1 for update',
    counter_name
  )
  into current_value
  using usage_date;

  current_value := coalesce(current_value, 0);

  if limit_value is not null and current_value + safe_amount > limit_value then
    return query
    select
      false,
      usage_date,
      plan_key_var,
      current_value,
      limit_value,
      greatest(limit_value - current_value, 0);
    return;
  end if;

  next_value := current_value + safe_amount;

  execute format(
    'update public.daily_usage set %I = %I + $1 where user_id = auth.uid() and date_key = $2',
    counter_name,
    counter_name
  )
  using safe_amount, usage_date;

  return query
  select
    true,
    usage_date,
    plan_key_var,
    next_value,
    limit_value,
    case
      when limit_value is null then null
      else greatest(limit_value - next_value, 0)
    end;
end;
$$;

create or replace function public.consume_yara_chat_quota(consume_amount integer default 1)
returns table (
  allowed boolean,
  date_key date,
  plan_key text,
  used_count integer,
  limit_count integer,
  remaining_count integer
)
language sql
security definer
set search_path = public
as $$
  select * from public.consume_daily_usage('yara_chat_count', consume_amount);
$$;

create or replace function public.consume_questions_quota(consume_amount integer default 1)
returns table (
  allowed boolean,
  date_key date,
  plan_key text,
  used_count integer,
  limit_count integer,
  remaining_count integer
)
language sql
security definer
set search_path = public
as $$
  select * from public.consume_daily_usage('questions_count', consume_amount);
$$;

create or replace function public.consume_recovery_quota(consume_amount integer default 1)
returns table (
  allowed boolean,
  date_key date,
  plan_key text,
  used_count integer,
  limit_count integer,
  remaining_count integer
)
language sql
security definer
set search_path = public
as $$
  select * from public.consume_daily_usage('recovery_count', consume_amount);
$$;

revoke all on function public.resolve_effective_usage_plan() from public;
revoke all on function public.resolve_daily_usage_limit(text) from public;
revoke all on function public.get_my_daily_usage(date) from public;
revoke all on function public.consume_daily_usage(text, integer) from public;
revoke all on function public.consume_yara_chat_quota(integer) from public;
revoke all on function public.consume_questions_quota(integer) from public;
revoke all on function public.consume_recovery_quota(integer) from public;

grant execute on function public.get_my_daily_usage(date) to authenticated;
grant execute on function public.consume_yara_chat_quota(integer) to authenticated;
grant execute on function public.consume_questions_quota(integer) to authenticated;
grant execute on function public.consume_recovery_quota(integer) to authenticated;

comment on table public.daily_usage is 'Contadores diários confiáveis para limites de uso por plano.';
