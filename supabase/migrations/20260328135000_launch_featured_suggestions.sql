create or replace function public.get_suggested_public_contests(target_area text default null)
returns setof public.contests_catalog
language sql
stable
security definer
set search_path = public
as $$
  with featured(name, featured_rank) as (
    values
      ('INSS', 1),
      ('Policia Penal MG', 2),
      ('PRF', 3),
      ('Banco do Brasil', 4),
      ('TJ SP', 5)
  ),
  candidate_pool as (
    select
      c.*,
      coalesce(f.featured_rank, 999) as featured_rank,
      case
        when coalesce(nullif(trim(target_area), ''), 'geral') = 'geral' then 0
        when c.area = lower(trim(target_area)) then 0
        else 1
      end as area_penalty
    from public.contests_catalog c
    left join featured f on f.name = c.name
    where f.featured_rank is not null
       or coalesce(nullif(trim(target_area), ''), 'geral') = 'geral'
       or c.area = lower(trim(target_area))
  )
  select id, name, organ, area, predicted_year, predicted_month, status, created_at
  from candidate_pool
  order by featured_rank asc, area_penalty asc, predicted_year asc, predicted_month asc, name asc
  limit 5;
$$;

revoke all on function public.get_suggested_public_contests(text) from public;
grant execute on function public.get_suggested_public_contests(text) to authenticated;
