-- Texto da pergunta e alternativas no momento da revelação (revisão de erros na UI).
-- Linhas antigas permanecem com NULL nestes campos.

alter table public.topic_question_attempts
  add column if not exists question_stem text,
  add column if not exists selected_label text,
  add column if not exists correct_label text;

comment on column public.topic_question_attempts.question_stem is 'Enunciado salvo ao revelar a resposta no quiz.';
comment on column public.topic_question_attempts.selected_label is 'Texto da alternativa marcada pelo usuário.';
comment on column public.topic_question_attempts.correct_label is 'Texto da alternativa correta.';
