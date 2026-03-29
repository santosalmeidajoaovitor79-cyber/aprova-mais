create or replace function public.admin_yara_report_signals()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin_user() then
    raise exception 'Acesso negado ao relatorio estrategico da Yara.';
  end if;

  with profile_summary as (
    select
      count(*)::int as total_profiles,
      count(*) filter (where onboarding_done)::int as onboarded_profiles,
      count(*) filter (where not onboarding_done)::int as onboarding_pending,
      count(*) filter (where onboarding_done and main_exam_id is null)::int as onboarded_without_exam,
      count(*) filter (where last_topic_id is not null)::int as users_with_resume_signal
    from public.profiles
  ),
  active_users as (
    select count(distinct user_id)::int as active_users_14d
    from public.user_topic_visits
    where visited_at >= now() - interval '14 days'
  ),
  visit_summary as (
    select
      count(*) filter (where visited_at >= now() - interval '14 days')::int as total_visits_14d,
      count(*) filter (where visited_at >= now() - interval '30 days')::int as total_visits_30d
    from public.user_topic_visits
  ),
  attempt_summary as (
    select
      count(*) filter (where attempted_at >= now() - interval '14 days')::int as total_attempts_14d,
      count(*) filter (where attempted_at >= now() - interval '14 days' and not is_correct)::int as wrong_attempts_14d,
      round(
        coalesce(
          avg(case when attempted_at >= now() - interval '14 days' then case when is_correct then 100.0 else 0.0 end end),
          0
        )::numeric,
        1
      ) as accuracy_14d
    from public.topic_question_attempts
  ),
  selected_catalog_usage as (
    select
      c.source_catalog_id as catalog_id,
      count(*)::int as selected_users
    from public.profiles p
    join public.contests c on c.id = p.main_exam_id
    where p.main_exam_id is not null
      and c.source_catalog_id is not null
    group by c.source_catalog_id
  ),
  catalog_stats as (
    select
      cc.id as catalog_id,
      cc.name as contest_name,
      cc.area,
      cc.status,
      count(distinct cs.id)::int as subject_count,
      count(cst.id)::int as topic_count,
      coalesce(scu.selected_users, 0)::int as selected_users
    from public.contests_catalog cc
    left join public.contest_subjects cs on cs.contest_id = cc.id
    left join public.contest_subject_topics cst on cst.contest_subject_id = cs.id
    left join selected_catalog_usage scu on scu.catalog_id = cc.id
    group by cc.id, cc.name, cc.area, cc.status, scu.selected_users
  ),
  weak_topic_rows as (
    select
      c.id as contest_id,
      c.name as contest_name,
      s.id as subject_id,
      s.name as subject_name,
      t.id as topic_id,
      t.name as topic_name,
      count(*)::int as attempts,
      count(*) filter (where not qa.is_correct)::int as wrong,
      round(avg(case when qa.is_correct then 100.0 else 0.0 end)::numeric, 1) as accuracy_percent,
      count(*) filter (where qa.attempted_at >= now() - interval '14 days')::int as recent_attempts,
      count(*) filter (where qa.attempted_at >= now() - interval '14 days' and not qa.is_correct)::int as recent_wrong,
      count(distinct qa.user_id)::int as users_affected
    from public.topic_question_attempts qa
    join public.topics t on t.id = qa.topic_id
    join public.subjects s on s.id = t.subject_id
    join public.contests c on c.id = s.contest_id
    where qa.attempted_at >= now() - interval '45 days'
    group by c.id, c.name, s.id, s.name, t.id, t.name
    having count(*) >= 2
    order by
      count(*) filter (where qa.attempted_at >= now() - interval '14 days' and not qa.is_correct) desc,
      count(*) filter (where not qa.is_correct) desc,
      count(*) desc
    limit 12
  ),
  weak_subject_rows as (
    select
      c.id as contest_id,
      c.name as contest_name,
      s.id as subject_id,
      s.name as subject_name,
      count(*)::int as attempts,
      count(*) filter (where not qa.is_correct)::int as wrong,
      round(avg(case when qa.is_correct then 100.0 else 0.0 end)::numeric, 1) as accuracy_percent,
      count(distinct qa.user_id)::int as users_affected
    from public.topic_question_attempts qa
    join public.topics t on t.id = qa.topic_id
    join public.subjects s on s.id = t.subject_id
    join public.contests c on c.id = s.contest_id
    where qa.attempted_at >= now() - interval '45 days'
    group by c.id, c.name, s.id, s.name
    having count(*) >= 4
    order by count(*) filter (where not qa.is_correct) desc, count(*) desc
    limit 8
  ),
  weak_contest_rows as (
    select
      c.id as contest_id,
      c.name as contest_name,
      count(*)::int as attempts,
      count(*) filter (where not qa.is_correct)::int as wrong,
      round(avg(case when qa.is_correct then 100.0 else 0.0 end)::numeric, 1) as accuracy_percent,
      count(distinct qa.user_id)::int as users_affected
    from public.topic_question_attempts qa
    join public.topics t on t.id = qa.topic_id
    join public.subjects s on s.id = t.subject_id
    join public.contests c on c.id = s.contest_id
    where qa.attempted_at >= now() - interval '45 days'
    group by c.id, c.name
    having count(*) >= 6
    order by count(*) filter (where not qa.is_correct) desc, count(*) desc
    limit 8
  ),
  selected_contest_rows as (
    select
      c.id as contest_id,
      c.name as contest_name,
      coalesce(cc.name, c.name) as catalog_name,
      count(*)::int as selected_users
    from public.profiles p
    join public.contests c on c.id = p.main_exam_id
    left join public.contests_catalog cc on cc.id = c.source_catalog_id
    where p.main_exam_id is not null
    group by c.id, c.name, cc.name
    order by count(*) desc, coalesce(cc.name, c.name) asc
    limit 8
  ),
  stale_resume_rows as (
    select
      c.name as contest_name,
      s.name as subject_name,
      t.name as topic_name,
      count(*)::int as users_count
    from public.profiles p
    left join public.user_topic_visits v
      on v.user_id = p.id
     and v.topic_id = p.last_topic_id
    left join public.topics t on t.id = p.last_topic_id
    left join public.subjects s on s.id = p.last_subject_id
    left join public.contests c on c.id = p.last_contest_id
    where p.onboarding_done
      and p.last_topic_id is not null
      and (v.visited_at is null or v.visited_at < now() - interval '7 days')
    group by c.name, s.name, t.name
    order by count(*) desc, c.name asc nulls last
    limit 8
  ),
  recent_messages as (
    select
      tm.user_id,
      tm.topic_id,
      tm.role,
      left(tm.content, 700) as content,
      tm.created_at,
      t.name as topic_name,
      s.id as subject_id,
      s.name as subject_name,
      c.id as contest_id,
      c.name as contest_name
    from public.topic_messages tm
    join public.topics t on t.id = tm.topic_id
    join public.subjects s on s.id = t.subject_id
    join public.contests c on c.id = s.contest_id
    where tm.created_at >= now() - interval '45 days'
    order by tm.created_at desc
    limit 600
  ),
  assistant_pattern_rows as (
    select
      min(left(content, 220)) as content_preview,
      count(*)::int as occurrences,
      count(distinct user_id)::int as users_affected,
      count(distinct topic_id)::int as topics_affected
    from (
      select
        user_id,
        topic_id,
        left(content, 220) as content,
        regexp_replace(lower(trim(left(content, 180))), '\s+', ' ', 'g') as normalized_content
      from public.topic_messages
      where role = 'assistant'
        and created_at >= now() - interval '45 days'
        and length(trim(content)) >= 60
    ) base
    group by normalized_content
    having count(*) >= 3
    order by count(*) desc
    limit 8
  )
  select jsonb_build_object(
    'generatedAt', now(),
    'summary',
      jsonb_build_object(
        'totalProfiles', coalesce((select total_profiles from profile_summary), 0),
        'onboardedProfiles', coalesce((select onboarded_profiles from profile_summary), 0),
        'onboardingPending', coalesce((select onboarding_pending from profile_summary), 0),
        'onboardedWithoutExam', coalesce((select onboarded_without_exam from profile_summary), 0),
        'usersWithResumeSignal', coalesce((select users_with_resume_signal from profile_summary), 0),
        'activeUsers14d', coalesce((select active_users_14d from active_users), 0),
        'totalVisits14d', coalesce((select total_visits_14d from visit_summary), 0),
        'totalVisits30d', coalesce((select total_visits_30d from visit_summary), 0),
        'totalAttempts14d', coalesce((select total_attempts_14d from attempt_summary), 0),
        'wrongAttempts14d', coalesce((select wrong_attempts_14d from attempt_summary), 0),
        'accuracy14d', coalesce((select accuracy_14d from attempt_summary), 0)
      ),
    'weakTopics', coalesce((select jsonb_agg(to_jsonb(weak_topic_rows)) from weak_topic_rows), '[]'::jsonb),
    'weakSubjects', coalesce((select jsonb_agg(to_jsonb(weak_subject_rows)) from weak_subject_rows), '[]'::jsonb),
    'weakContests', coalesce((select jsonb_agg(to_jsonb(weak_contest_rows)) from weak_contest_rows), '[]'::jsonb),
    'selectedContests', coalesce((select jsonb_agg(to_jsonb(selected_contest_rows)) from selected_contest_rows), '[]'::jsonb),
    'catalogGaps',
      coalesce(
        (
          select jsonb_agg(to_jsonb(g))
          from (
            select *
            from catalog_stats
            where subject_count = 0
               or topic_count = 0
               or topic_count < greatest(subject_count * 2, 6)
            order by selected_users desc, topic_count asc, subject_count asc, contest_name asc
            limit 10
          ) g
        ),
        '[]'::jsonb
      ),
    'staleResumeTopics', coalesce((select jsonb_agg(to_jsonb(stale_resume_rows)) from stale_resume_rows), '[]'::jsonb),
    'recentMessages', coalesce((select jsonb_agg(to_jsonb(recent_messages)) from recent_messages), '[]'::jsonb),
    'assistantPatterns', coalesce((select jsonb_agg(to_jsonb(assistant_pattern_rows)) from assistant_pattern_rows), '[]'::jsonb)
  )
  into result;

  return coalesce(result, '{}'::jsonb);
end;
$$;

revoke all on function public.admin_yara_report_signals() from public;
grant execute on function public.admin_yara_report_signals() to authenticated;
