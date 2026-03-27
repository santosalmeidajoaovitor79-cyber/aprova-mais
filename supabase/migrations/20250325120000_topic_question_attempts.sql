-- Respostas reais às questões geradas (por tópico), para métricas e sugestões

create table if not exists public.topic_question_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete cascade,
  question_key text not null,
  selected_index integer not null,
  correct_index integer not null,
  is_correct boolean not null,
  attempted_at timestamptz not null default now()
);

create index if not exists topic_question_attempts_user_topic_idx
  on public.topic_question_attempts (user_id, topic_id);

create index if not exists topic_question_attempts_user_time_idx
  on public.topic_question_attempts (user_id, attempted_at desc);

comment on table public.topic_question_attempts is 'Cada linha = uma revelação de resposta no quiz do tópico (dados reais para dashboard).';

alter table public.topic_question_attempts enable row level security;

create policy "topic_question_attempts_select_own"
  on public.topic_question_attempts for select
  to authenticated
  using (auth.uid() = user_id);

create policy "topic_question_attempts_insert_own"
  on public.topic_question_attempts for insert
  to authenticated
  with check (auth.uid() = user_id);
