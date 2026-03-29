-- PostgREST: chamadas RPC sem corpo procuram função com 0 parâmetros.
-- Permite compatibilidade com clientes antigos além de get_my_daily_usage(date).

create or replace function public.get_my_daily_usage()
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
  select * from public.get_my_daily_usage(current_date);
$$;

revoke all on function public.get_my_daily_usage() from public;
grant execute on function public.get_my_daily_usage() to authenticated;
