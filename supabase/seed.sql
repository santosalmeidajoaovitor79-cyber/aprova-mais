-- Seed catalog (run via `supabase db reset` or SQL editor). Safe to re-run.

insert into public.contests (name, slug)
values
  ('ENEM', 'enem'),
  ('INSS', 'inss'),
  ('Polícia Penal', 'policia-penal'),
  ('Outro concurso', 'outro')
on conflict (slug) do nothing;

insert into public.subjects (contest_id, name)
select c.id, s.name
from public.contests c
cross join (values
  ('enem', 'Português'),
  ('enem', 'Matemática'),
  ('enem', 'Redação'),
  ('inss', 'Português'),
  ('inss', 'Direito Previdenciário'),
  ('inss', 'Raciocínio Lógico'),
  ('policia-penal', 'Português'),
  ('policia-penal', 'Legislação Específica'),
  ('policia-penal', 'Informática'),
  ('outro', 'Conhecimentos Gerais')
) as s(slug, name)
where c.slug = s.slug
on conflict (contest_id, name) do nothing;

-- Topics (no explanations here — geradas sob demanda ou via Edge Function)
insert into public.topics (subject_id, name, description, difficulty, estimated_minutes)
select sub.id, t.name, t.description, t.difficulty, t.minutes
from public.subjects sub
join public.contests c on c.id = sub.contest_id
cross join (values
  ('enem', 'Português', 'Crase', 'Uso da crase: fusão de preposição a + artigo a em contextos femininos.', 'média', 45),
  ('enem', 'Português', 'Interpretação de texto', 'Ideia principal, inferência e coesão em textos.', 'média', 50),
  ('enem', 'Matemática', 'Porcentagem', 'Aumentos, descontos e problemas contextualizados.', 'média', 40),
  ('enem', 'Redação', 'Estrutura da dissertação', 'Introdução, desenvolvimento, conclusão e P.I.', 'alta', 60),
  ('inss', 'Português', 'Concordância verbal', 'Relação sujeito-verbo e casos especiais.', 'média', 40),
  ('inss', 'Direito Previdenciário', 'Segurados e dependentes', 'Qualidade de segurado e regras de manutenção.', 'alta', 55),
  ('inss', 'Raciocínio Lógico', 'Proposições e equivalências', 'Tabelas verdade, negação e equivalências lógicas.', 'média', 45),
  ('policia-penal', 'Português', 'Interpretação de texto', 'Compreensão e inferência para concursos.', 'média', 45),
  ('policia-penal', 'Legislação Específica', 'Lei de Execução Penal', 'Direitos do preso, disciplina e órgãos da execução.', 'alta', 60),
  ('policia-penal', 'Informática', 'Segurança da informação', 'Malware, phishing, senhas e backup.', 'baixa', 30),
  ('outro', 'Conhecimentos Gerais', 'Atualidades', 'Leitura de notícias e temas recorrentes em provas.', 'média', 35)
) as t(cslug, subj, name, description, difficulty, minutes)
where c.slug = t.cslug and sub.name = t.subj
on conflict (subject_id, name) do nothing;

-- Catalogo editorial para onboarding e painel admin
select public.seed_contests_catalog();
select public.seed_launch_contest_tree();
select public.sync_all_runtime_contests_from_catalog();

-- Primeiro admin: execute manualmente no SQL Editor apos a migration, trocando pelo seu email real.
-- insert into public.admin_users (email) values ('seu-email@dominio.com')
-- on conflict do nothing;
