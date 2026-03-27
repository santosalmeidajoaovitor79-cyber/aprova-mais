-- Data alvo da prova no perfil do aluno (opcional).
alter table if exists public.profiles
  add column if not exists exam_date date;

comment on column public.profiles.exam_date is 'Data da prova alvo; usada para countdown e contexto nos prompts de IA.';
