export async function selectProfileId(supabase, userId) {
  return supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
}

export async function insertProfile(supabase, row) {
  return supabase.from("profiles").insert(row);
}

export async function selectProfileFields(supabase, userId) {
  return supabase
    .from("profiles")
    .select(
      "name, email, goal, hours_per_day, exam_date, main_exam_id, last_contest_id, last_subject_id, last_topic_id, onboarding_done"
    )
    .eq("id", userId)
    .maybeSingle();
}

export async function updateStudySessionOnProfile(supabase, userId, row) {
  return supabase.from("profiles").update(row).eq("id", userId);
}

/** Atualiza só campos do onboarding (não apaga last_* nem nome). */
export async function patchProfileOnboarding(
  supabase,
  userId,
  { examDate, hoursPerDay, mainExamId, goalLabel }
) {
  return supabase
    .from("profiles")
    .update({
      exam_date: examDate?.trim() || null,
      hours_per_day: hoursPerDay,
      main_exam_id: mainExamId ?? null,
      ...(goalLabel?.trim() ? { goal: goalLabel.trim() } : {}),
      onboarding_done: true,
    })
    .eq("id", userId);
}

export async function upsertProfile(supabase, row) {
  return supabase.from("profiles").upsert(row);
}
