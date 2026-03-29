export async function fetchContests(supabase) {
  return supabase
    .from("contests")
    .select("id, name, slug, owner_user_id, source_catalog_id")
    .order("name");
}

export async function fetchContestsCatalog(supabase) {
  return supabase.rpc("public_contests_catalog");
}

export async function searchContests(supabase, query) {
  const trimmed = query?.trim();
  if (!trimmed) {
    return { data: [], error: null };
  }

  return supabase.rpc("search_public_contests_catalog", { search_query: trimmed });
}

export async function getSuggestedContests(supabase, area) {
  const normalizedArea = typeof area === "string" ? area.trim().toLowerCase() : "";
  const response = await supabase.rpc("get_suggested_public_contests", {
    target_area: normalizedArea || "geral",
  });
  if (response.error || (response.data?.length ?? 0) > 0 || !normalizedArea || normalizedArea === "geral") {
    return response;
  }

  return supabase.rpc("get_suggested_public_contests", { target_area: "geral" });
}

export async function fetchPublicContestCatalogTree(supabase, contestCatalogId) {
  return supabase.rpc("public_contest_catalog_tree", { target_catalog_id: contestCatalogId });
}

export async function ensureRuntimeContestFromCatalog(supabase, contestCatalogId) {
  const { data: runtimeContestId, error } = await supabase.rpc("sync_runtime_contest_from_catalog", {
    target_catalog_id: contestCatalogId,
  });

  if (error || !runtimeContestId) {
    return { data: null, error: error || new Error("Nao foi possivel preparar esse concurso.") };
  }

  return supabase
    .from("contests")
    .select("id, name, slug, owner_user_id, source_catalog_id")
    .eq("id", runtimeContestId)
    .maybeSingle();
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
    .select("id, name, weight, display_order, source_catalog_subject_id")
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
    .select("id, name, description, difficulty, estimated_minutes, weight, display_order, source_catalog_topic_id")
    .maybeSingle();
}

export async function fetchSubjectsByContest(supabase, contestId) {
  return supabase
    .from("subjects")
    .select("id, name, weight, display_order, source_catalog_subject_id")
    .eq("contest_id", contestId)
    .order("display_order", { ascending: true })
    .order("weight", { ascending: false })
    .order("name", { ascending: true });
}

export async function fetchTopicsBySubject(supabase, subjectId) {
  return supabase
    .from("topics")
    .select("id, name, description, difficulty, estimated_minutes, weight, display_order, source_catalog_topic_id")
    .eq("subject_id", subjectId)
    .order("display_order", { ascending: true })
    .order("weight", { ascending: false })
    .order("name", { ascending: true });
}
