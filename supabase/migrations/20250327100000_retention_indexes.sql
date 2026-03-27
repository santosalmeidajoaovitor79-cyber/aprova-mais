-- Índices para streak, missões do dia e evolução (consultas por usuário + tempo)

create index if not exists topic_question_attempts_user_attempted_at_idx
  on public.topic_question_attempts (user_id, attempted_at desc);

comment on index public.topic_question_attempts_user_attempted_at_idx is
  'Suporta agregações de taxa de acerto por dia e filtros recentes por usuário.';
