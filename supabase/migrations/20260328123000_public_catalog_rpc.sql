drop policy if exists contests_catalog_select_authenticated on public.contests_catalog;

create policy contests_catalog_select_admin_only
  on public.contests_catalog for select
  to authenticated
  using (public.is_admin_user());

create or replace function public.public_contests_catalog()
returns setof public.contests_catalog
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.contests_catalog
  order by predicted_year asc, predicted_month asc, name asc;
$$;

create or replace function public.search_public_contests_catalog(search_query text)
returns setof public.contests_catalog
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.contests_catalog
  where coalesce(search_query, '') <> ''
    and name ilike '%' || search_query || '%'
  order by predicted_year asc, predicted_month asc, name asc
  limit 8;
$$;

create or replace function public.get_suggested_public_contests(target_area text default null)
returns setof public.contests_catalog
language sql
stable
security definer
set search_path = public
as $$
  with filtered as (
    select *
    from public.contests_catalog
    where coalesce(nullif(trim(target_area), ''), 'geral') = 'geral'
       or area = lower(trim(target_area))
  )
  select *
  from filtered
  order by predicted_year asc, predicted_month asc, name asc
  limit 6;
$$;

revoke all on function public.public_contests_catalog() from public;
revoke all on function public.search_public_contests_catalog(text) from public;
revoke all on function public.get_suggested_public_contests(text) from public;

grant execute on function public.public_contests_catalog() to authenticated;
grant execute on function public.search_public_contests_catalog(text) to authenticated;
grant execute on function public.get_suggested_public_contests(text) to authenticated;
