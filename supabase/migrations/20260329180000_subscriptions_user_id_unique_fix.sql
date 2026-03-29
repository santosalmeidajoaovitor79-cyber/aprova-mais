-- Drift: public.subscriptions sem UNIQUE(user_id) quebra PostgREST upsert(onConflict: user_id) e gera 42P10.
-- Mantém a linha mais recente por usuário e garante constraint única.

delete from public.subscriptions s
where s.id in (
  select id
  from (
    select
      id,
      row_number() over (
        partition by user_id
        order by updated_at desc nulls last, created_at desc
      ) as rn
    from public.subscriptions
  ) d
  where d.rn > 1
);

do $fix$
begin
  alter table public.subscriptions add constraint subscriptions_user_id_key unique (user_id);
exception
  when duplicate_object then
    null;
end
$fix$;
