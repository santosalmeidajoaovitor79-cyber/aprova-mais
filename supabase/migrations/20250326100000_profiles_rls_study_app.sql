-- Garante que o app possa ler/inserir/atualizar apenas a própria linha em profiles
-- (idempotente: só cria políticas com nomes exclusivos do app)

do $migration$
begin
  if to_regclass('public.profiles') is null then
    raise notice 'profiles: tabela ausente — crie-a pelo template Auth do Supabase antes de depender desta migration.';
    return;
  end if;

  alter table public.profiles enable row level security;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'study_app_profiles_select_own'
  ) then
    create policy study_app_profiles_select_own
      on public.profiles for select
      to authenticated
      using (id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'study_app_profiles_insert_own'
  ) then
    create policy study_app_profiles_insert_own
      on public.profiles for insert
      to authenticated
      with check (id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'study_app_profiles_update_own'
  ) then
    create policy study_app_profiles_update_own
      on public.profiles for update
      to authenticated
      using (id = auth.uid())
      with check (id = auth.uid());
  end if;
end
$migration$;
