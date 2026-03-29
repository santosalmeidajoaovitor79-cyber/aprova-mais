create table if not exists public.contest_subjects (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests_catalog (id) on delete cascade,
  name text not null,
  weight numeric(6,2) not null default 1,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (contest_id, name)
);

create table if not exists public.contest_subject_topics (
  id uuid primary key default gen_random_uuid(),
  contest_subject_id uuid not null references public.contest_subjects (id) on delete cascade,
  name text not null,
  weight numeric(6,2) not null default 1,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (contest_subject_id, name)
);

-- Drift: tabelas podem ter sido criadas antes sem weight/display_order/created_at.
alter table public.contest_subjects
  add column if not exists weight numeric(6,2) not null default 1,
  add column if not exists display_order integer not null default 0,
  add column if not exists created_at timestamptz not null default now();

alter table public.contest_subject_topics
  add column if not exists weight numeric(6,2) not null default 1,
  add column if not exists display_order integer not null default 0,
  add column if not exists created_at timestamptz not null default now();

-- Drift: tabela antiga pode existir sem UNIQUE (contest_id, name) / (contest_subject_id, name) para ON CONFLICT.
do $migration$
begin
  if not exists (
    select 1
    from information_schema.table_constraints tc
    where tc.table_schema = 'public'
      and tc.table_name = 'contest_subjects'
      and tc.constraint_type = 'UNIQUE'
      and (
        select array_agg(kcu.column_name::text order by kcu.ordinal_position)
        from information_schema.key_column_usage kcu
        where kcu.constraint_schema = tc.constraint_schema
          and kcu.constraint_name = tc.constraint_name
          and kcu.table_schema = tc.table_schema
          and kcu.table_name = tc.table_name
      ) = array['contest_id', 'name']::text[]
  ) then
    create unique index contest_subjects_contest_id_name_uidx
      on public.contest_subjects (contest_id, name);
  end if;

  if not exists (
    select 1
    from information_schema.table_constraints tc
    where tc.table_schema = 'public'
      and tc.table_name = 'contest_subject_topics'
      and tc.constraint_type = 'UNIQUE'
      and (
        select array_agg(kcu.column_name::text order by kcu.ordinal_position)
        from information_schema.key_column_usage kcu
        where kcu.constraint_schema = tc.constraint_schema
          and kcu.constraint_name = tc.constraint_name
          and kcu.table_schema = tc.table_schema
          and kcu.table_name = tc.table_name
      ) = array['contest_subject_id', 'name']::text[]
  ) then
    create unique index contest_subject_topics_sid_name_uidx
      on public.contest_subject_topics (contest_subject_id, name);
  end if;
exception
  when unique_violation then
    raise notice 'contest_subjects/topics: ha linhas duplicadas; remova duplicatas antes de criar indice unico.';
  when duplicate_object then
    null;
end
$migration$;

create index if not exists contest_subjects_contest_idx
  on public.contest_subjects (contest_id, display_order, weight desc, name);

create index if not exists contest_subject_topics_subject_idx
  on public.contest_subject_topics (contest_subject_id, display_order, weight desc, name);

alter table public.contest_subjects enable row level security;
alter table public.contest_subject_topics enable row level security;

do $migration$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'contest_subjects' and policyname = 'contest_subjects_select_admin_only'
  ) then
    create policy contest_subjects_select_admin_only
      on public.contest_subjects for select
      to authenticated
      using (public.is_admin_user());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'contest_subjects' and policyname = 'contest_subjects_insert_admin_only'
  ) then
    create policy contest_subjects_insert_admin_only
      on public.contest_subjects for insert
      to authenticated
      with check (public.is_admin_user());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'contest_subjects' and policyname = 'contest_subjects_update_admin_only'
  ) then
    create policy contest_subjects_update_admin_only
      on public.contest_subjects for update
      to authenticated
      using (public.is_admin_user())
      with check (public.is_admin_user());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'contest_subjects' and policyname = 'contest_subjects_delete_admin_only'
  ) then
    create policy contest_subjects_delete_admin_only
      on public.contest_subjects for delete
      to authenticated
      using (public.is_admin_user());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'contest_subject_topics' and policyname = 'contest_subject_topics_select_admin_only'
  ) then
    create policy contest_subject_topics_select_admin_only
      on public.contest_subject_topics for select
      to authenticated
      using (public.is_admin_user());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'contest_subject_topics' and policyname = 'contest_subject_topics_insert_admin_only'
  ) then
    create policy contest_subject_topics_insert_admin_only
      on public.contest_subject_topics for insert
      to authenticated
      with check (public.is_admin_user());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'contest_subject_topics' and policyname = 'contest_subject_topics_update_admin_only'
  ) then
    create policy contest_subject_topics_update_admin_only
      on public.contest_subject_topics for update
      to authenticated
      using (public.is_admin_user())
      with check (public.is_admin_user());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'contest_subject_topics' and policyname = 'contest_subject_topics_delete_admin_only'
  ) then
    create policy contest_subject_topics_delete_admin_only
      on public.contest_subject_topics for delete
      to authenticated
      using (public.is_admin_user());
  end if;
end
$migration$;

alter table public.contests
  add column if not exists source_catalog_id uuid references public.contests_catalog (id) on delete cascade;

create unique index if not exists contests_source_catalog_unique_idx
  on public.contests (source_catalog_id)
  where source_catalog_id is not null and owner_user_id is null;

alter table public.subjects
  add column if not exists source_catalog_subject_id uuid references public.contest_subjects (id) on delete cascade,
  add column if not exists weight numeric(6,2) not null default 1,
  add column if not exists display_order integer not null default 0;

create unique index if not exists subjects_source_catalog_subject_unique_idx
  on public.subjects (source_catalog_subject_id)
  where source_catalog_subject_id is not null;

alter table public.topics
  add column if not exists source_catalog_topic_id uuid references public.contest_subject_topics (id) on delete cascade,
  add column if not exists weight numeric(6,2) not null default 1,
  add column if not exists display_order integer not null default 0;

create unique index if not exists topics_source_catalog_topic_unique_idx
  on public.topics (source_catalog_topic_id)
  where source_catalog_topic_id is not null;

create or replace function public.sync_runtime_contest_from_catalog(target_catalog_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  catalog_row public.contests_catalog%rowtype;
  runtime_contest_id uuid;
  subject_row record;
  runtime_subject_id uuid;
  topic_row record;
begin
  select * into catalog_row from public.contests_catalog where id = target_catalog_id;
  if catalog_row.id is null then
    raise exception 'Catalog contest not found';
  end if;

  select id
    into runtime_contest_id
  from public.contests
  where source_catalog_id = catalog_row.id
    and owner_user_id is null
  limit 1;

  if runtime_contest_id is null then
    insert into public.contests (name, slug, owner_user_id, source_catalog_id)
    values (catalog_row.name, 'catalog-' || replace(catalog_row.id::text, '-', ''), null, catalog_row.id)
    returning id into runtime_contest_id;
  else
    update public.contests
      set name = catalog_row.name
    where id = runtime_contest_id;
  end if;

  for subject_row in
    select id, name, weight, display_order
    from public.contest_subjects
    where contest_id = catalog_row.id
    order by display_order asc, weight desc, name asc
  loop
    insert into public.subjects (contest_id, name, source_catalog_subject_id, weight, display_order)
    values (runtime_contest_id, subject_row.name, subject_row.id, subject_row.weight, subject_row.display_order)
    on conflict (source_catalog_subject_id) do update
      set contest_id = excluded.contest_id,
          name = excluded.name,
          weight = excluded.weight,
          display_order = excluded.display_order
    returning id into runtime_subject_id;

    for topic_row in
      select id, name, weight, display_order
      from public.contest_subject_topics
      where contest_subject_id = subject_row.id
      order by display_order asc, weight desc, name asc
    loop
      insert into public.topics (
        subject_id,
        name,
        description,
        source_catalog_topic_id,
        weight,
        display_order,
        estimated_minutes
      )
      values (runtime_subject_id, topic_row.name, null, topic_row.id, topic_row.weight, topic_row.display_order, 30)
      on conflict (source_catalog_topic_id) do update
        set subject_id = excluded.subject_id,
            name = excluded.name,
            weight = excluded.weight,
            display_order = excluded.display_order;
    end loop;
  end loop;

  delete from public.topics
  where subject_id in (
    select s.id
    from public.subjects s
    where s.contest_id = runtime_contest_id
      and s.source_catalog_subject_id is not null
  )
    and source_catalog_topic_id is not null
    and source_catalog_topic_id not in (
      select t.id
      from public.contest_subject_topics t
      join public.contest_subjects s on s.id = t.contest_subject_id
      where s.contest_id = catalog_row.id
    );

  delete from public.subjects
  where contest_id = runtime_contest_id
    and source_catalog_subject_id is not null
    and source_catalog_subject_id not in (
      select id from public.contest_subjects where contest_id = catalog_row.id
    );

  return runtime_contest_id;
end;
$$;

create or replace function public.sync_all_runtime_contests_from_catalog()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  catalog_entry record;
begin
  for catalog_entry in select id from public.contests_catalog
  loop
    perform public.sync_runtime_contest_from_catalog(catalog_entry.id);
  end loop;
end;
$$;

create or replace function public.public_contest_catalog_tree(target_catalog_id uuid)
returns table (
  contest_id uuid,
  subject_id uuid,
  subject_name text,
  subject_weight numeric,
  subject_display_order integer,
  topic_id uuid,
  topic_name text,
  topic_weight numeric,
  topic_display_order integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.contest_id,
    s.id,
    s.name,
    s.weight,
    s.display_order,
    t.id,
    t.name,
    t.weight,
    t.display_order
  from public.contest_subjects s
  left join public.contest_subject_topics t on t.contest_subject_id = s.id
  where s.contest_id = target_catalog_id
  order by s.display_order asc, s.weight desc, s.name asc, t.display_order asc, t.weight desc, t.name asc;
$$;

revoke all on function public.sync_runtime_contest_from_catalog(uuid) from public;
revoke all on function public.sync_all_runtime_contests_from_catalog() from public;
revoke all on function public.public_contest_catalog_tree(uuid) from public;

grant execute on function public.sync_runtime_contest_from_catalog(uuid) to authenticated;
grant execute on function public.public_contest_catalog_tree(uuid) to authenticated;

insert into public.contest_subjects (contest_id, name, weight, display_order)
select c.id, v.name, v.weight, v.display_order
from public.contests_catalog c
join (
  values
    ('INSS 2025', 'Direito Previdenciario', 10, 1),
    ('INSS 2025', 'Portugues', 8, 2),
    ('INSS 2025', 'Raciocinio Logico', 7, 3),
    ('INSS 2025', 'Etica no Servico Publico', 5, 4),
    ('PRF 2026', 'Legislacao de Transito', 10, 1),
    ('PRF 2026', 'Portugues', 8, 2),
    ('PRF 2026', 'Raciocinio Logico', 7, 3),
    ('PRF 2026', 'Direitos Humanos e Cidadania', 6, 4),
    ('Policia Penal MG 2025', 'Legislacao Especial', 10, 1),
    ('Policia Penal MG 2025', 'Portugues', 8, 2),
    ('Policia Penal MG 2025', 'Direitos Humanos', 7, 3),
    ('Policia Penal MG 2025', 'Informatica', 6, 4),
    ('TJ SP 2025', 'Direito Civil', 10, 1),
    ('TJ SP 2025', 'Direito Processual Civil', 9, 2),
    ('TJ SP 2025', 'Portugues', 7, 3),
    ('TJ SP 2025', 'Normas da Corregedoria', 6, 4),
    ('Banco do Brasil 2026', 'Conhecimentos Bancarios', 10, 1),
    ('Banco do Brasil 2026', 'Matematica Financeira', 8, 2),
    ('Banco do Brasil 2026', 'Portugues', 7, 3),
    ('Banco do Brasil 2026', 'Atualidades do Mercado Financeiro', 6, 4)
) as v(contest_name, name, weight, display_order)
  on c.name = v.contest_name
on conflict (contest_id, name) do update
  set weight = excluded.weight,
      display_order = excluded.display_order;

insert into public.contest_subject_topics (contest_subject_id, name, weight, display_order)
select s.id, v.name, v.weight, v.display_order
from public.contest_subjects s
join public.contests_catalog c on c.id = s.contest_id
join (
  values
    ('INSS 2025', 'Direito Previdenciario', 'Segurados e dependentes', 10, 1),
    ('INSS 2025', 'Direito Previdenciario', 'Beneficios previdenciarios', 9, 2),
    ('INSS 2025', 'Direito Previdenciario', 'Carencia e qualidade de segurado', 8, 3),
    ('INSS 2025', 'Portugues', 'Interpretacao de texto', 10, 1),
    ('INSS 2025', 'Portugues', 'Concordancia verbal e nominal', 8, 2),
    ('INSS 2025', 'Raciocinio Logico', 'Proposicoes e conectivos', 9, 1),
    ('INSS 2025', 'Raciocinio Logico', 'Equivalencias logicas', 8, 2),
    ('PRF 2026', 'Legislacao de Transito', 'Codigo de Transito Brasileiro', 10, 1),
    ('PRF 2026', 'Legislacao de Transito', 'Infracoes e penalidades', 9, 2),
    ('PRF 2026', 'Portugues', 'Interpretacao de texto', 10, 1),
    ('PRF 2026', 'Portugues', 'Reescrita de frases', 8, 2),
    ('PRF 2026', 'Raciocinio Logico', 'Tabela-verdade', 8, 1),
    ('PRF 2026', 'Direitos Humanos e Cidadania', 'Direitos fundamentais', 7, 1),
    ('Policia Penal MG 2025', 'Legislacao Especial', 'Lei de Execucao Penal', 10, 1),
    ('Policia Penal MG 2025', 'Legislacao Especial', 'Rotinas do sistema prisional', 8, 2),
    ('Policia Penal MG 2025', 'Portugues', 'Interpretacao de texto', 9, 1),
    ('Policia Penal MG 2025', 'Direitos Humanos', 'Regras minimas de tratamento', 7, 1),
    ('Policia Penal MG 2025', 'Informatica', 'Seguranca da informacao', 6, 1),
    ('TJ SP 2025', 'Direito Civil', 'Parte geral', 9, 1),
    ('TJ SP 2025', 'Direito Civil', 'Obrigacoes', 8, 2),
    ('TJ SP 2025', 'Direito Processual Civil', 'Atos processuais', 10, 1),
    ('TJ SP 2025', 'Direito Processual Civil', 'Recursos', 8, 2),
    ('TJ SP 2025', 'Portugues', 'Interpretacao de texto juridico', 7, 1),
    ('TJ SP 2025', 'Normas da Corregedoria', 'Servicos cartorarios', 7, 1),
    ('Banco do Brasil 2026', 'Conhecimentos Bancarios', 'Sistema Financeiro Nacional', 10, 1),
    ('Banco do Brasil 2026', 'Conhecimentos Bancarios', 'Produtos e servicos bancarios', 9, 2),
    ('Banco do Brasil 2026', 'Matematica Financeira', 'Juros simples e compostos', 9, 1),
    ('Banco do Brasil 2026', 'Matematica Financeira', 'Descontos e taxas', 8, 2),
    ('Banco do Brasil 2026', 'Portugues', 'Compreensao textual', 8, 1),
    ('Banco do Brasil 2026', 'Atualidades do Mercado Financeiro', 'Open finance e Pix', 7, 1)
) as v(contest_name, subject_name, name, weight, display_order)
  on c.name = v.contest_name and s.name = v.subject_name
on conflict (contest_subject_id, name) do update
  set weight = excluded.weight,
      display_order = excluded.display_order;

select public.sync_all_runtime_contests_from_catalog();
