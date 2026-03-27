export async function fetchContests(supabase) {
  return supabase.from("contests").select("id, name, slug, owner_user_id").order("name");
}

/**
 * Concurso personalizado (slug único gerado).
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {{ name: string, ownerUserId: string }} p
 */
export async function createUserContest(supabase, { name, ownerUserId }) {
  const slug = `u-${crypto.randomUUID()}`;
  return supabase
    .from("contests")
    .insert({ name: name.trim(), slug, owner_user_id: ownerUserId })
    .select("id, name, slug, owner_user_id")
    .maybeSingle();
}

export async function createSubject(supabase, { contestId, name }) {
  return supabase
    .from("subjects")
    .insert({ contest_id: contestId, name: name.trim() })
    .select("id, name")
    .maybeSingle();
}

export async function createTopic(supabase, { subjectId, name, description }) {
  return supabase
    .from("topics")
    .insert({
      subject_id: subjectId,
      name: name.trim(),
      description: description?.trim() || null,
    })
    .select("id, name, description, difficulty, estimated_minutes")
    .maybeSingle();
}

export async function fetchSubjectsByContest(supabase, contestId) {
  return supabase
    .from("subjects")
    .select("id, name")
    .eq("contest_id", contestId)
    .order("name");
}

export async function fetchTopicsBySubject(supabase, subjectId) {
  return supabase
    .from("topics")
    .select("id, name, description, difficulty, estimated_minutes")
    .eq("subject_id", subjectId)
    .order("name");
}
