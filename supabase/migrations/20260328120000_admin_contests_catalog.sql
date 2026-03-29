create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists admin_users_email_unique_idx
  on public.admin_users (lower(email));

create table if not exists public.contests_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  organ text not null,
  area text not null check (area in ('administrativa', 'policial', 'tribunais', 'controle', 'fiscal', 'educacao')),
  predicted_year integer not null check (predicted_year between 2025 and 2035),
  predicted_month integer not null check (predicted_month between 1 and 12),
  status text not null check (status in ('planned', 'expected', 'confirmed')),
  created_at timestamptz not null default now()
);

create index if not exists contests_catalog_area_year_idx
  on public.contests_catalog (area, predicted_year, predicted_month, name);

-- Bancos com drift: a tabela pode existir sem UNIQUE em name; seed usa ON CONFLICT (name).
do $migration$
declare
  has_unique_name boolean;
begin
  select exists (
    select 1
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_schema = kcu.constraint_schema
     and tc.constraint_name = kcu.constraint_name
    where tc.table_schema = 'public'
      and tc.table_name = 'contests_catalog'
      and tc.constraint_type = 'UNIQUE'
      and kcu.column_name = 'name'
  )
  or exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'contests_catalog'
      and indexdef ilike '%unique%'
      and indexdef ~ '\(name\)'
  )
  into has_unique_name;

  if not has_unique_name then
    create unique index contests_catalog_name_unique_idx on public.contests_catalog (name);
  end if;
exception
  when unique_violation then
    raise notice 'contests_catalog: nao foi possivel criar indice unico em name (valores duplicados).';
  when duplicate_object then
    null;
end
$migration$;

create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_admin_user() from public;
grant execute on function public.is_admin_user() to authenticated;

alter table public.admin_users enable row level security;
alter table public.contests_catalog enable row level security;

do $migration$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'admin_users' and policyname = 'admin_users_select_admin_only'
  ) then
    create policy admin_users_select_admin_only
      on public.admin_users for select
      to authenticated
      using (public.is_admin_user());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'admin_users' and policyname = 'admin_users_insert_admin_only'
  ) then
    create policy admin_users_insert_admin_only
      on public.admin_users for insert
      to authenticated
      with check (public.is_admin_user());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'admin_users' and policyname = 'admin_users_delete_admin_only'
  ) then
    create policy admin_users_delete_admin_only
      on public.admin_users for delete
      to authenticated
      using (public.is_admin_user());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'contests_catalog' and policyname = 'contests_catalog_select_authenticated'
  ) then
    create policy contests_catalog_select_authenticated
      on public.contests_catalog for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'contests_catalog' and policyname = 'contests_catalog_insert_admin_only'
  ) then
    create policy contests_catalog_insert_admin_only
      on public.contests_catalog for insert
      to authenticated
      with check (public.is_admin_user());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'contests_catalog' and policyname = 'contests_catalog_update_admin_only'
  ) then
    create policy contests_catalog_update_admin_only
      on public.contests_catalog for update
      to authenticated
      using (public.is_admin_user())
      with check (public.is_admin_user());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'contests_catalog' and policyname = 'contests_catalog_delete_admin_only'
  ) then
    create policy contests_catalog_delete_admin_only
      on public.contests_catalog for delete
      to authenticated
      using (public.is_admin_user());
  end if;
end
$migration$;

create or replace function public.seed_contests_catalog()
returns void
language plpgsql
set search_path = public
as $$
begin
  insert into public.contests_catalog (name, organ, area, predicted_year, predicted_month, status)
  values
    ('INSS 2025', 'INSS', 'administrativa', 2025, 10, 'expected'),
    ('IBGE 2025', 'IBGE', 'administrativa', 2025, 8, 'expected'),
    ('Banco do Brasil 2026', 'Banco do Brasil', 'administrativa', 2026, 3, 'planned'),
    ('Caixa Economica Federal 2026', 'Caixa Economica Federal', 'administrativa', 2026, 4, 'planned'),
    ('INCRA 2025', 'INCRA', 'administrativa', 2025, 11, 'expected'),
    ('Ministerio da Fazenda 2026', 'Ministerio da Fazenda', 'administrativa', 2026, 5, 'planned'),
    ('Receita Federal Administrativo 2025', 'Receita Federal', 'administrativa', 2025, 9, 'expected'),
    ('PRF 2026', 'Policia Rodoviaria Federal', 'policial', 2026, 3, 'planned'),
    ('Policia Federal Agente 2026', 'Policia Federal', 'policial', 2026, 4, 'planned'),
    ('Policia Civil MG 2025', 'Policia Civil MG', 'policial', 2025, 9, 'expected'),
    ('Policia Civil SP 2025', 'Policia Civil SP', 'policial', 2025, 10, 'expected'),
    ('Policia Civil RJ 2026', 'Policia Civil RJ', 'policial', 2026, 2, 'planned'),
    ('Policia Penal MG 2025', 'SEJUSP MG', 'policial', 2025, 11, 'expected'),
    ('Policia Penal SP 2026', 'SAP SP', 'policial', 2026, 4, 'planned'),
    ('PM MG 2026', 'Policia Militar MG', 'policial', 2026, 5, 'planned'),
    ('PM SP 2025', 'Policia Militar SP', 'policial', 2025, 8, 'expected'),
    ('TJ SP 2025', 'TJ SP', 'tribunais', 2025, 8, 'confirmed'),
    ('TJ MG 2025', 'TJ MG', 'tribunais', 2025, 9, 'expected'),
    ('TJ RJ 2026', 'TJ RJ', 'tribunais', 2026, 3, 'planned'),
    ('TRF 1 2026', 'TRF 1', 'tribunais', 2026, 4, 'planned'),
    ('TRT 2 2025', 'TRT 2', 'tribunais', 2025, 10, 'expected'),
    ('CGU 2026', 'Controladoria-Geral da Uniao', 'controle', 2026, 5, 'planned'),
    ('TCU 2025', 'Tribunal de Contas da Uniao', 'controle', 2025, 8, 'confirmed'),
    ('TCE MG 2025', 'Tribunal de Contas de Minas Gerais', 'controle', 2025, 11, 'expected'),
    ('TCE SP 2026', 'Tribunal de Contas de Sao Paulo', 'controle', 2026, 2, 'planned'),
    ('SEFAZ SP 2026', 'SEFAZ SP', 'fiscal', 2026, 5, 'planned'),
    ('SEFAZ MG 2025', 'SEFAZ MG', 'fiscal', 2025, 10, 'expected'),
    ('SEFAZ RJ 2026', 'SEFAZ RJ', 'fiscal', 2026, 6, 'planned'),
    ('Receita Federal Auditor 2026', 'Receita Federal', 'fiscal', 2026, 4, 'planned'),
    ('Secretaria de Educacao SP 2025', 'SEDUC SP', 'educacao', 2025, 9, 'expected'),
    ('Secretaria de Educacao MG 2026', 'SEE MG', 'educacao', 2026, 3, 'planned'),
    ('Secretaria de Educacao RJ 2026', 'SEEDUC RJ', 'educacao', 2026, 5, 'planned'),
    ('IFSP 2025', 'Instituto Federal de Sao Paulo', 'educacao', 2025, 11, 'expected'),
    ('IFMG 2026', 'Instituto Federal de Minas Gerais', 'educacao', 2026, 2, 'planned')
  on conflict (name) do update
    set organ = excluded.organ,
        area = excluded.area,
        predicted_year = excluded.predicted_year,
        predicted_month = excluded.predicted_month,
        status = excluded.status;
end;
$$;

select public.seed_contests_catalog();

comment on table public.admin_users is 'Emails autorizados a acessar o painel admin.';
comment on table public.contests_catalog is 'Catalogo editorial de concursos usado nas sugestoes e busca do onboarding.';
