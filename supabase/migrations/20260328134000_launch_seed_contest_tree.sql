alter table public.contests_catalog
  drop constraint if exists contests_catalog_area_check;

alter table public.contests_catalog
  add constraint contests_catalog_area_check
  check (area in ('administrativa', 'policial', 'tribunais', 'controle', 'fiscal', 'educacao', 'bancaria'));

create or replace function public.seed_launch_contest_tree()
returns void
language plpgsql
set search_path = public
as $$
declare
  contest_id_var uuid;
  subject_id_var uuid;
begin
  update public.contests_catalog
    set name = 'INSS',
        organ = 'Instituto Nacional do Seguro Social',
        area = 'administrativa',
        predicted_year = 2026,
        predicted_month = 3,
        status = 'expected'
  where name = 'INSS 2025'
    and not exists (select 1 from public.contests_catalog where name = 'INSS');

  update public.contests_catalog
    set name = 'PRF',
        organ = 'Policia Rodoviaria Federal',
        area = 'policial',
        predicted_year = 2026,
        predicted_month = 6,
        status = 'planned'
  where name = 'PRF 2026'
    and not exists (select 1 from public.contests_catalog where name = 'PRF');

  update public.contests_catalog
    set name = 'Policia Penal MG',
        organ = 'Secretaria de Justica e Seguranca Publica de Minas Gerais',
        area = 'policial',
        predicted_year = 2026,
        predicted_month = 4,
        status = 'expected'
  where name = 'Policia Penal MG 2025'
    and not exists (select 1 from public.contests_catalog where name = 'Policia Penal MG');

  update public.contests_catalog
    set name = 'TJ SP',
        organ = 'Tribunal de Justica de Sao Paulo',
        area = 'tribunais',
        predicted_year = 2026,
        predicted_month = 2,
        status = 'expected'
  where name = 'TJ SP 2025'
    and not exists (select 1 from public.contests_catalog where name = 'TJ SP');

  update public.contests_catalog
    set name = 'Banco do Brasil',
        organ = 'Banco do Brasil',
        area = 'bancaria',
        predicted_year = 2026,
        predicted_month = 5,
        status = 'planned'
  where name = 'Banco do Brasil 2026'
    and not exists (select 1 from public.contests_catalog where name = 'Banco do Brasil');

  insert into public.contests_catalog (name, organ, area, predicted_year, predicted_month, status)
  values
    ('INSS', 'Instituto Nacional do Seguro Social', 'administrativa', 2026, 3, 'expected'),
    ('PRF', 'Policia Rodoviaria Federal', 'policial', 2026, 6, 'planned'),
    ('Policia Penal MG', 'Secretaria de Justica e Seguranca Publica de Minas Gerais', 'policial', 2026, 4, 'expected'),
    ('TJ SP', 'Tribunal de Justica de Sao Paulo', 'tribunais', 2026, 2, 'expected'),
    ('Banco do Brasil', 'Banco do Brasil', 'bancaria', 2026, 5, 'planned')
  on conflict (name) do update
    set organ = excluded.organ,
        area = excluded.area,
        predicted_year = excluded.predicted_year,
        predicted_month = excluded.predicted_month,
        status = excluded.status;

  select id into contest_id_var from public.contests_catalog where name = 'INSS';
  delete from public.contest_subjects where contest_id = contest_id_var;

  insert into public.contest_subjects (contest_id, name, weight, display_order)
  values
    (contest_id_var, 'Portugues', 5, 1),
    (contest_id_var, 'Direito Previdenciario', 5, 2),
    (contest_id_var, 'Raciocinio Logico', 3, 3),
    (contest_id_var, 'Informatica', 2, 4);

  select id into subject_id_var from public.contest_subjects where contest_id = contest_id_var and name = 'Portugues';
  insert into public.contest_subject_topics (contest_subject_id, name, weight, display_order) values
    (subject_id_var, 'Interpretacao de texto', 5, 1),
    (subject_id_var, 'Ortografia oficial', 3, 2),
    (subject_id_var, 'Concordancia verbal e nominal', 4, 3),
    (subject_id_var, 'Regencia verbal e nominal', 4, 4),
    (subject_id_var, 'Crase', 3, 5),
    (subject_id_var, 'Pontuacao', 4, 6);

  select id into subject_id_var from public.contest_subjects where contest_id = contest_id_var and name = 'Direito Previdenciario';
  insert into public.contest_subject_topics (contest_subject_id, name, weight, display_order) values
    (subject_id_var, 'Seguridade social', 5, 1),
    (subject_id_var, 'Regime geral de previdencia social', 5, 2),
    (subject_id_var, 'Beneficios previdenciarios', 5, 3),
    (subject_id_var, 'Carencia e qualidade de segurado', 4, 4),
    (subject_id_var, 'Dependentes e segurados', 4, 5);

  select id into subject_id_var from public.contest_subjects where contest_id = contest_id_var and name = 'Raciocinio Logico';
  insert into public.contest_subject_topics (contest_subject_id, name, weight, display_order) values
    (subject_id_var, 'Proposicoes', 4, 1),
    (subject_id_var, 'Conectivos logicos', 4, 2),
    (subject_id_var, 'Equivalencias e negacoes', 5, 3),
    (subject_id_var, 'Argumentacao logica', 4, 4);

  select id into subject_id_var from public.contest_subjects where contest_id = contest_id_var and name = 'Informatica';
  insert into public.contest_subject_topics (contest_subject_id, name, weight, display_order) values
    (subject_id_var, 'Sistema operacional Windows', 3, 1),
    (subject_id_var, 'Pacote Office', 4, 2),
    (subject_id_var, 'Internet e navegacao', 3, 3),
    (subject_id_var, 'Seguranca da informacao', 4, 4);

  select id into contest_id_var from public.contests_catalog where name = 'PRF';
  delete from public.contest_subjects where contest_id = contest_id_var;

  insert into public.contest_subjects (contest_id, name, weight, display_order)
  values
    (contest_id_var, 'Portugues', 5, 1),
    (contest_id_var, 'Direito Constitucional', 5, 2),
    (contest_id_var, 'Direito Penal', 4, 3),
    (contest_id_var, 'Legislacao de Transito', 5, 4),
    (contest_id_var, 'Raciocinio Logico', 3, 5);

  select id into subject_id_var from public.contest_subjects where contest_id = contest_id_var and name = 'Portugues';
  insert into public.contest_subject_topics (contest_subject_id, name, weight, display_order) values
    (subject_id_var, 'Interpretacao de texto', 5, 1),
    (subject_id_var, 'Coesao e coerencia', 4, 2),
    (subject_id_var, 'Concordancia', 4, 3),
    (subject_id_var, 'Regencia', 4, 4),
    (subject_id_var, 'Pontuacao', 4, 5);

  select id into subject_id_var from public.contest_subjects where contest_id = contest_id_var and name = 'Direito Constitucional';
  insert into public.contest_subject_topics (contest_subject_id, name, weight, display_order) values
    (subject_id_var, 'Direitos e garantias fundamentais', 5, 1),
    (subject_id_var, 'Administracao publica', 4, 2),
    (subject_id_var, 'Seguranca publica', 4, 3),
    (subject_id_var, 'Poder Executivo', 3, 4);

  select id into subject_id_var from public.contest_subjects where contest_id = contest_id_var and name = 'Direito Penal';
  insert into public.contest_subject_topics (contest_subject_id, name, weight, display_order) values
    (subject_id_var, 'Aplicacao da lei penal', 4, 1),
    (subject_id_var, 'Crime', 5, 2),
    (subject_id_var, 'Imputabilidade penal', 3, 3),
    (subject_id_var, 'Crimes contra a administracao publica', 4, 4);

  select id into subject_id_var from public.contest_subjects where contest_id = contest_id_var and name = 'Legislacao de Transito';
  insert into public.contest_subject_topics (contest_subject_id, name, weight, display_order) values
    (subject_id_var, 'Sistema nacional de transito', 4, 1),
    (subject_id_var, 'Normas gerais de circulacao', 5, 2),
    (subject_id_var, 'Infracoes e penalidades', 5, 3),
    (subject_id_var, 'Crimes de transito', 4, 4);

  select id into subject_id_var from public.contest_subjects where contest_id = contest_id_var and name = 'Raciocinio Logico';
  insert into public.contest_subject_topics (contest_subject_id, name, weight, display_order) values
    (subject_id_var, 'Proposicoes', 4, 1),
    (subject_id_var, 'Tabela verdade', 4, 2),
    (subject_id_var, 'Equivalencias', 4, 3),
    (subject_id_var, 'Problemas logicos', 3, 4);

  select id into contest_id_var from public.contests_catalog where name = 'Policia Penal MG';
  delete from public.contest_subjects where contest_id = contest_id_var;

  insert into public.contest_subjects (contest_id, name, weight, display_order)
  values
    (contest_id_var, 'Portugues', 5, 1),
    (contest_id_var, 'Direitos Humanos', 4, 2),
    (contest_id_var, 'Legislacao Especial', 5, 3),
    (contest_id_var, 'Nocoes de Direito Penal', 4, 4);

  select id into subject_id_var from public.contest_subjects where contest_id = contest_id_var and name = 'Portugues';
  insert into public.contest_subject_topics (contest_subject_id, name, weight, display_order) values
    (subject_id_var, 'Interpretacao de texto', 5, 1),
    (subject_id_var, 'Pontuacao', 4, 2),
    (subject_id_var, 'Concordancia', 4, 3),
    (subject_id_var, 'Regencia', 3, 4);

  select id into subject_id_var from public.contest_subjects where contest_id = contest_id_var and name = 'Direitos Humanos';
  insert into public.contest_subject_topics (contest_subject_id, name, weight, display_order) values
    (subject_id_var, 'Conceito e evolucao historica', 3, 1),
    (subject_id_var, 'Tratados internacionais', 4, 2),
    (subject_id_var, 'Direitos fundamentais da pessoa presa', 5, 3);

  select id into subject_id_var from public.contest_subjects where contest_id = contest_id_var and name = 'Legislacao Especial';
  insert into public.contest_subject_topics (contest_subject_id, name, weight, display_order) values
    (subject_id_var, 'Lei de Execucao Penal', 5, 1),
    (subject_id_var, 'Direitos e deveres do preso', 5, 2),
    (subject_id_var, 'Assistencia ao preso', 4, 3),
    (subject_id_var, 'Disciplina e sancoes', 4, 4);

  select id into subject_id_var from public.contest_subjects where contest_id = contest_id_var and name = 'Nocoes de Direito Penal';
  insert into public.contest_subject_topics (contest_subject_id, name, weight, display_order) values
    (subject_id_var, 'Crime', 5, 1),
    (subject_id_var, 'Pena', 4, 2),
    (subject_id_var, 'Concurso de pessoas', 3, 3);

  select id into contest_id_var from public.contests_catalog where name = 'TJ SP';
  delete from public.contest_subjects where contest_id = contest_id_var;

  insert into public.contest_subjects (contest_id, name, weight, display_order)
  values
    (contest_id_var, 'Portugues', 5, 1),
    (contest_id_var, 'Direito Constitucional', 4, 2),
    (contest_id_var, 'Direito Administrativo', 4, 3),
    (contest_id_var, 'Informatica', 3, 4);

  select id into subject_id_var from public.contest_subjects where contest_id = contest_id_var and name = 'Portugues';
  insert into public.contest_subject_topics (contest_subject_id, name, weight, display_order) values
    (subject_id_var, 'Interpretacao textual', 5, 1),
    (subject_id_var, 'Pontuacao', 4, 2),
    (subject_id_var, 'Concordancia', 4, 3),
    (subject_id_var, 'Crase', 3, 4);

  select id into subject_id_var from public.contest_subjects where contest_id = contest_id_var and name = 'Direito Constitucional';
  insert into public.contest_subject_topics (contest_subject_id, name, weight, display_order) values
    (subject_id_var, 'Direitos fundamentais', 5, 1),
    (subject_id_var, 'Administracao publica', 4, 2),
    (subject_id_var, 'Poder Judiciario', 5, 3);

  select id into subject_id_var from public.contest_subjects where contest_id = contest_id_var and name = 'Direito Administrativo';
  insert into public.contest_subject_topics (contest_subject_id, name, weight, display_order) values
    (subject_id_var, 'Atos administrativos', 5, 1),
    (subject_id_var, 'Poderes administrativos', 4, 2),
    (subject_id_var, 'Servidores publicos', 4, 3);

  select id into subject_id_var from public.contest_subjects where contest_id = contest_id_var and name = 'Informatica';
  insert into public.contest_subject_topics (contest_subject_id, name, weight, display_order) values
    (subject_id_var, 'Windows', 3, 1),
    (subject_id_var, 'Word', 4, 2),
    (subject_id_var, 'Excel', 4, 3),
    (subject_id_var, 'Internet', 3, 4);

  select id into contest_id_var from public.contests_catalog where name = 'Banco do Brasil';
  delete from public.contest_subjects where contest_id = contest_id_var;

  insert into public.contest_subjects (contest_id, name, weight, display_order)
  values
    (contest_id_var, 'Portugues', 5, 1),
    (contest_id_var, 'Matematica Financeira', 5, 2),
    (contest_id_var, 'Conhecimentos Bancarios', 5, 3),
    (contest_id_var, 'Informatica', 3, 4);

  select id into subject_id_var from public.contest_subjects where contest_id = contest_id_var and name = 'Portugues';
  insert into public.contest_subject_topics (contest_subject_id, name, weight, display_order) values
    (subject_id_var, 'Interpretacao de texto', 5, 1),
    (subject_id_var, 'Redacao oficial', 3, 2),
    (subject_id_var, 'Pontuacao', 4, 3),
    (subject_id_var, 'Concordancia', 4, 4);

  select id into subject_id_var from public.contest_subjects where contest_id = contest_id_var and name = 'Matematica Financeira';
  insert into public.contest_subject_topics (contest_subject_id, name, weight, display_order) values
    (subject_id_var, 'Juros simples', 4, 1),
    (subject_id_var, 'Juros compostos', 5, 2),
    (subject_id_var, 'Descontos', 3, 3),
    (subject_id_var, 'Taxas equivalentes', 4, 4);

  select id into subject_id_var from public.contest_subjects where contest_id = contest_id_var and name = 'Conhecimentos Bancarios';
  insert into public.contest_subject_topics (contest_subject_id, name, weight, display_order) values
    (subject_id_var, 'Sistema financeiro nacional', 5, 1),
    (subject_id_var, 'Produtos bancarios', 5, 2),
    (subject_id_var, 'Mercado financeiro', 4, 3),
    (subject_id_var, 'Atendimento ao cliente', 3, 4);

  select id into subject_id_var from public.contest_subjects where contest_id = contest_id_var and name = 'Informatica';
  insert into public.contest_subject_topics (contest_subject_id, name, weight, display_order) values
    (subject_id_var, 'Seguranca da informacao', 4, 1),
    (subject_id_var, 'Internet', 3, 2),
    (subject_id_var, 'Pacote Office', 4, 3);

  perform public.sync_all_runtime_contests_from_catalog();
end;
$$;

select public.seed_launch_contest_tree();
