-- Bootstrap de profiles + data alvo da prova no perfil do aluno (opcional).
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  name text,
  goal text default 'Polícia Penal',
  hours_per_day integer default 2,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.profiles
  add column if not exists exam_date date;

comment on column public.profiles.exam_date is 'Data da prova alvo; usada para countdown e contexto nos prompts de IA.';
