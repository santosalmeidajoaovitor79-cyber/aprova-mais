-- Core catalog: contests → subjects → topics (runtime source for the app)
-- Normalized explanations and chat history

create extension if not exists "pgcrypto";

-- Contests (ENEM, INSS, etc.)
create table if not exists public.contests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (contest_id, name)
);

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  name text not null,
  description text,
  difficulty text,
  estimated_minutes integer default 30,
  created_at timestamptz not null default now(),
  unique (subject_id, name)
);

create table if not exists public.topic_explanations (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null unique references public.topics (id) on delete cascade,
  title text,
  content text not null,
  source_type text default 'ai_generated',
  created_at timestamptz not null default now()
);

create table if not exists public.topic_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists topic_messages_user_topic_idx
  on public.topic_messages (user_id, topic_id, created_at);

alter table public.contests enable row level security;
alter table public.subjects enable row level security;
alter table public.topics enable row level security;
alter table public.topic_explanations enable row level security;
alter table public.topic_messages enable row level security;

-- Authenticated users can read the public catalog and shared explanations
create policy "contests_select_authenticated"
  on public.contests for select
  to authenticated
  using (true);

create policy "subjects_select_authenticated"
  on public.subjects for select
  to authenticated
  using (true);

create policy "topics_select_authenticated"
  on public.topics for select
  to authenticated
  using (true);

create policy "topic_explanations_select_authenticated"
  on public.topic_explanations for select
  to authenticated
  using (true);

-- Chat history: users only see their own rows (Edge Functions use service role for writes)
create policy "topic_messages_select_own"
  on public.topic_messages for select
  to authenticated
  using (auth.uid() = user_id);
