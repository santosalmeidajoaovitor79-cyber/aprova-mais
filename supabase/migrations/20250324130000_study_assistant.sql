-- Concurso personalizado, perfil estendido, visitas a tópicos (métricas reais)

alter table public.contests
  add column if not exists owner_user_id uuid references auth.users (id) on delete cascade;

comment on column public.contests.owner_user_id is 'Null = catálogo global; preenchido = concurso criado pelo usuário.';

create index if not exists contests_owner_user_id_idx on public.contests (owner_user_id);

alter table if exists public.profiles
  add column if not exists main_exam_id uuid references public.contests (id) on delete set null;

alter table if exists public.profiles
  add column if not exists last_contest_id uuid references public.contests (id) on delete set null;

alter table if exists public.profiles
  add column if not exists last_subject_id uuid references public.subjects (id) on delete set null;

alter table if exists public.profiles
  add column if not exists last_topic_id uuid references public.topics (id) on delete set null;

-- default true: usuários já existentes não são forçados ao onboarding; novos inserts definem false no app
alter table if exists public.profiles
  add column if not exists onboarding_done boolean not null default true;

create table if not exists public.user_topic_visits (
  user_id uuid not null references auth.users (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete cascade,
  contest_id uuid references public.contests (id) on delete set null,
  subject_id uuid references public.subjects (id) on delete set null,
  visited_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);

create index if not exists user_topic_visits_user_time_idx
  on public.user_topic_visits (user_id, visited_at desc);

alter table public.user_topic_visits enable row level security;

create policy "user_topic_visits_select_own"
  on public.user_topic_visits for select
  to authenticated
  using (auth.uid() = user_id);

create policy "user_topic_visits_insert_own"
  on public.user_topic_visits for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "user_topic_visits_update_own"
  on public.user_topic_visits for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Concurso próprio
create policy "contests_insert_own"
  on public.contests for insert
  to authenticated
  with check (owner_user_id = auth.uid());

create policy "contests_update_own"
  on public.contests for update
  to authenticated
  using (owner_user_id = auth.uid() and owner_user_id is not null)
  with check (owner_user_id = auth.uid());

create policy "contests_delete_own"
  on public.contests for delete
  to authenticated
  using (owner_user_id = auth.uid() and owner_user_id is not null);

-- Matérias/tópicos só em concursos do usuário
create policy "subjects_insert_owned_contest"
  on public.subjects for insert
  to authenticated
  with check (
    exists (
      select 1 from public.contests c
      where c.id = contest_id and c.owner_user_id = auth.uid()
    )
  );

create policy "topics_insert_owned_subject"
  on public.topics for insert
  to authenticated
  with check (
    exists (
      select 1 from public.subjects s
      join public.contests c on c.id = s.contest_id
      where s.id = subject_id and c.owner_user_id = auth.uid()
    )
  );

-- Leitura de concursos: globais OU meus
drop policy if exists "contests_select_authenticated" on public.contests;

create policy "contests_select_authenticated"
  on public.contests for select
  to authenticated
  using (owner_user_id is null or owner_user_id = auth.uid());
