export async function fetchContests(supabase) {
  return supabase.from("contests").select("id, name, slug, owner_user_id").order("name");
}

function buildAuthRequiredError(message) {
  return Object.assign(new Error(message), { code: "AUTH_REQUIRED" });
}

function buildRlsError(message, cause) {
  return Object.assign(new Error(message), { code: cause?.code ?? "42501", cause });
}

/**
 * Concurso personalizado (slug único gerado).
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {{ name: string, ownerUserId: string }} p
 */
export async function createUserContest(supabase, { name, ownerUserId }) {
  const trimmedName = name?.trim();
  if (!trimmedName) {
    return { data: null, error: new Error("Nome inválido") };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    return { data: null, error: userError };
  }

  const resolvedOwnerUserId = user?.id ?? ownerUserId ?? null;
  if (!resolvedOwnerUserId) {
    return {
      data: null,
      error: buildAuthRequiredError("Sua sessão expirou. Entre novamente para criar um concurso."),
    };
  }

  const slug = `u-${crypto.randomUUID()}`;
  const insertPayload = {
    name: trimmedName,
    slug,
    owner_user_id: resolvedOwnerUserId,
  };

  // Evita depender de RETURNING na mesma chamada do insert em ambientes com RLS mais rígido.
  const insertResponse = await supabase.from("contests").insert(insertPayload);
  if (insertResponse.error) {
    const isRlsError =
      insertResponse.error.code === "42501" ||
      /row-level security/i.test(insertResponse.error.message || "");

    if (isRlsError) {
      return {
        data: null,
        error: buildRlsError(
          "Seu usuário autenticado não conseguiu gravar este concurso. Faça login novamente e tente de novo.",
          insertResponse.error
        ),
      };
    }

    return { data: null, error: insertResponse.error };
  }

  return supabase
    .from("contests")
    .select("id, name, slug, owner_user_id")
    .eq("slug", slug)
    .eq("owner_user_id", resolvedOwnerUserId)
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
