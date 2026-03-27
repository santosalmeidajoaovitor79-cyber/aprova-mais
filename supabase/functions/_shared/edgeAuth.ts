import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";

export function jsonResponse(
  corsHeaders: Record<string, string>,
  body: unknown,
  status: number
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

const ENV_KEYS = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GROQ_API_KEY",
] as const;

/**
 * Valida presença das secrets necessárias e registra snapshot seguro no log.
 * Retorna Response 500 se faltar algo; caso contrário null.
 */
export function assertRequiredEnv(
  corsHeaders: Record<string, string>,
  logContext: string
): Response | null {
  const missing: string[] = [];
  const snapshot: Record<string, boolean> = {};

  for (const k of ENV_KEYS) {
    const v = Deno.env.get(k);
    snapshot[k] = Boolean(v);
    if (!v) missing.push(k);
  }

  let urlHost = "(n/a)";
  try {
    const u = Deno.env.get("SUPABASE_URL");
    if (u) urlHost = new URL(u).host;
  } catch {
    urlHost = "(parse_error)";
  }

  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  console.log(`[${logContext}] Deno.env.get — snapshot (somente presença / metadados seguros)`, {
    ...snapshot,
    supabaseUrlHost: urlHost,
    supabaseAnonKeyLength: anon?.length ?? 0,
    supabaseAnonKeyPrefix: anon?.slice(0, 4) ?? "",
  });

  if (missing.length > 0) {
    console.error(`[${logContext}] Variáveis de ambiente ausentes`, { missingEnv: missing });
    return jsonResponse(
      corsHeaders,
      {
        error: "Variáveis de ambiente não configuradas.",
        code: "ENV_MISSING",
        missingEnv: missing,
      },
      500
    );
  }

  return null;
}

export type AuthSuccess = {
  user: User;
  supabaseUser: SupabaseClient;
  supabaseUrl: string;
  supabaseAnonKey: string;
};

export type AuthFailure = { response: Response };

/**
 * Lê Authorization, cria client com Bearer repassado, chama auth.getUser().
 * Logs em cada etapa (sem JWT completo).
 */
export async function resolveAuthenticatedUser(
  req: Request,
  corsHeaders: Record<string, string>,
  logContext: string
): Promise<AuthSuccess | AuthFailure> {
  const rawAuth = req.headers.get("Authorization");

  console.log(`[${logContext}] Leitura do header Authorization`, {
    present: Boolean(rawAuth),
    length: rawAuth?.length ?? 0,
    startsWithBearer: rawAuth?.trimStart().startsWith("Bearer ") ?? false,
    schemePreview: rawAuth ? rawAuth.trim().split(/\s+/)[0]?.slice(0, 12) : null,
  });

  const authHeader = rawAuth?.trim();
  if (!authHeader) {
    return {
      response: jsonResponse(
        corsHeaders,
        {
          error: "Header Authorization ausente ou vazio.",
          code: "AUTH_HEADER_MISSING",
          details: { hint: "Esperado: Authorization: Bearer <access_token>" },
        },
        401
      ),
    };
  }

  let bearerHeader = authHeader;
  if (!authHeader.startsWith("Bearer ")) {
    const parts = authHeader.split(".");
    if (parts.length === 3 && authHeader.length > 20) {
      bearerHeader = `Bearer ${authHeader}`;
      console.log(`[${logContext}] Authorization normalizado: prefixo Bearer adicionado (JWT sem esquema)`);
    } else {
      return {
        response: jsonResponse(
          corsHeaders,
          {
            error: "Authorization deve usar o esquema Bearer.",
            code: "AUTH_HEADER_NOT_BEARER",
            details: {
              schemeReceived: authHeader.split(/\s+/)[0] ?? "(vazio)",
            },
          },
          401
        ),
      };
    }
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  console.log(`[${logContext}] createClient autenticado (usuário)`, {
    globalAuthorizationHeaderSet: true,
    authorizationHeaderLength: bearerHeader.length,
    supabaseUrlHost: (() => {
      try {
        return new URL(supabaseUrl).host;
      } catch {
        return "(parse_error)";
      }
    })(),
  });

  const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: bearerHeader,
      },
    },
  });

  console.log(`[${logContext}] auth.getUser() — iniciando`);
  const {
    data: { user },
    error: userError,
  } = await supabaseUser.auth.getUser();

  if (userError) {
    console.error(`[${logContext}] auth.getUser() — erro`, {
      name: userError.name,
      message: userError.message,
      status: (userError as { status?: number }).status,
      code: (userError as { code?: string }).code,
    });
    return {
      response: jsonResponse(
        corsHeaders,
        {
          error: "Falha ao validar sessão do usuário com o Auth.",
          code: "GET_USER_FAILED",
          details: {
            authErrorName: userError.name,
            authErrorMessage: userError.message,
            authErrorStatus: (userError as { status?: number }).status ?? null,
            authErrorCode: (userError as { code?: string }).code ?? null,
          },
        },
        401
      ),
    };
  }

  if (!user) {
    console.error(`[${logContext}] Validação final do user — user é null sem erro do Auth`);
    return {
      response: jsonResponse(
        corsHeaders,
        {
          error: "Usuário não identificado após validação do token.",
          code: "AUTH_USER_NULL",
          details: {},
        },
        401
      ),
    };
  }

  console.log(`[${logContext}] auth.getUser() — sucesso`, { userId: user.id });
  return { user, supabaseUser, supabaseUrl, supabaseAnonKey };
}
