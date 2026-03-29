export async function isAdminUser(supabase) {
  return supabase.rpc("is_admin_user");
}

export async function fetchAdminUsers(supabase) {
  return supabase.from("admin_users").select("id, email, created_at").order("email", { ascending: true });
}

export async function createAdminUser(supabase, email) {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) {
    return { data: null, error: new Error("Email invalido.") };
  }

  return supabase
    .from("admin_users")
    .insert({ email: normalizedEmail })
    .select("id, email, created_at")
    .maybeSingle();
}

export async function deleteAdminUser(supabase, adminId) {
  return supabase.from("admin_users").delete().eq("id", adminId);
}

export async function fetchCatalogEntries(supabase) {
  return supabase
    .from("contests_catalog")
    .select("id, name, organ, area, predicted_year, predicted_month, status, created_at")
    .order("predicted_year", { ascending: true })
    .order("predicted_month", { ascending: true })
    .order("name", { ascending: true });
}

export async function createCatalogEntry(supabase, payload) {
  return supabase
    .from("contests_catalog")
    .insert(payload)
    .select("id, name, organ, area, predicted_year, predicted_month, status, created_at")
    .maybeSingle();
}

export async function updateCatalogEntry(supabase, contestId, payload) {
  return supabase
    .from("contests_catalog")
    .update(payload)
    .eq("id", contestId)
    .select("id, name, organ, area, predicted_year, predicted_month, status, created_at")
    .maybeSingle();
}

export async function deleteCatalogEntry(supabase, contestId) {
  return supabase.from("contests_catalog").delete().eq("id", contestId);
}

export async function fetchCatalogSubjects(supabase, contestId) {
  return supabase
    .from("contest_subjects")
    .select("id, contest_id, name, weight, display_order, created_at")
    .eq("contest_id", contestId)
    .order("display_order", { ascending: true })
    .order("weight", { ascending: false })
    .order("name", { ascending: true });
}

export async function createCatalogSubject(supabase, payload) {
  return supabase
    .from("contest_subjects")
    .insert(payload)
    .select("id, contest_id, name, weight, display_order, created_at")
    .maybeSingle();
}

export async function updateCatalogSubject(supabase, subjectId, payload) {
  return supabase
    .from("contest_subjects")
    .update(payload)
    .eq("id", subjectId)
    .select("id, contest_id, name, weight, display_order, created_at")
    .maybeSingle();
}

export async function deleteCatalogSubject(supabase, subjectId) {
  return supabase.from("contest_subjects").delete().eq("id", subjectId);
}

export async function fetchCatalogSubjectTopics(supabase, contestSubjectId) {
  return supabase
    .from("contest_subject_topics")
    .select("id, contest_subject_id, name, weight, display_order, created_at")
    .eq("contest_subject_id", contestSubjectId)
    .order("display_order", { ascending: true })
    .order("weight", { ascending: false })
    .order("name", { ascending: true });
}

export async function createCatalogSubjectTopic(supabase, payload) {
  return supabase
    .from("contest_subject_topics")
    .insert(payload)
    .select("id, contest_subject_id, name, weight, display_order, created_at")
    .maybeSingle();
}

export async function updateCatalogSubjectTopic(supabase, topicId, payload) {
  return supabase
    .from("contest_subject_topics")
    .update(payload)
    .eq("id", topicId)
    .select("id, contest_subject_id, name, weight, display_order, created_at")
    .maybeSingle();
}

export async function deleteCatalogSubjectTopic(supabase, topicId) {
  return supabase.from("contest_subject_topics").delete().eq("id", topicId);
}

export async function syncRuntimeContest(supabase, contestCatalogId) {
  return supabase.rpc("sync_runtime_contest_from_catalog", { target_catalog_id: contestCatalogId });
}

export async function fetchAdminYaraReportSignals(supabase) {
  const response = await supabase.rpc("admin_yara_report_signals");
  const message = String(response?.error?.message ?? "").toLowerCase();
  const details = String(response?.error?.details ?? "").toLowerCase();
  const code = String(response?.error?.code ?? "").toUpperCase();

  const missingFunction =
    code === "PGRST202" ||
    message.includes("schema cache") ||
    message.includes("could not find the function") ||
    details.includes("schema cache");

  if (missingFunction) {
    return {
      data: null,
      error: new Error(
        "A função SQL do relatório ainda não foi publicada no Supabase. Rode `supabase db push` para aplicar a migration `20260328140000_admin_yara_report_signals.sql` e atualize a página."
      ),
    };
  }

  return response;
}
