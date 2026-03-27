function extractMessage(error) {
  if (!error) return "";
  if (typeof error === "string") return error.trim();
  if (typeof error.message === "string") return error.message.trim();
  return "";
}

export function normalizeAuthError(error, mode = "signup") {
  const raw = extractMessage(error);
  const lower = raw.toLowerCase();
  const defaultTitle = mode === "login" ? "Não consegui entrar na sua conta." : "Não consegui criar sua conta.";
  let message = raw || defaultTitle;

  if (lower.includes("invalid api key")) {
    message =
      "A chave pública do Supabase usada pelo app não foi aceita. Revise `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no `.env`.";
  } else if (lower.includes("fetch failed") || lower.includes("network")) {
    message = "Não foi possível falar com o Supabase agora. Confira sua conexão e as variáveis do projeto.";
  } else if (lower.includes("email not confirmed")) {
    message = "Seu e-mail ainda não foi confirmado. Abra o link enviado pelo Supabase e tente entrar de novo.";
  } else if (lower.includes("user already registered")) {
    message = "Este e-mail já está cadastrado. Entre com sua conta ou redefina a senha.";
  } else if (lower.includes("password should be at least")) {
    message = "A senha precisa ter pelo menos 6 caracteres.";
  } else if (lower.includes("invalid login credentials")) {
    message = "E-mail ou senha incorretos.";
  } else if (lower.includes("database error saving new user")) {
    message =
      "O Supabase não conseguiu salvar o novo usuário. Verifique logs de Auth/Postgres e a configuração da tabela `public.profiles`.";
  } else if (lower.includes("email rate limit exceeded")) {
    message = "O limite de envio de e-mails do Supabase foi atingido. Aguarde um pouco e tente novamente.";
  }

  return {
    kind: "error",
    title: defaultTitle,
    message,
    detail: raw && raw !== message ? raw : "",
  };
}

export function describeSignupResult(data) {
  const user = data?.user ?? null;
  const session = data?.session ?? null;

  if (user && session) {
    return {
      state: "signed_in",
      kind: "success",
      title: "Conta criada. A Yara vai ajustar seu começo.",
      message: "Seu acesso foi aberto e o onboarding pode começar agora.",
    };
  }

  if (user && !session && !user.email_confirmed_at) {
    return {
      state: "confirmation_pending",
      kind: "info",
      title: "Conta criada, mas a confirmação de e-mail ainda está pendente.",
      message:
        "Abra a mensagem enviada pelo Supabase, confirme seu e-mail e depois entre para continuar com a Yara.",
    };
  }

  if (user && !session) {
    return {
      state: "created_without_session",
      kind: "info",
      title: "Conta criada sem sessão automática.",
      message: "Sua conta existe, mas o Supabase não abriu a sessão agora. Entre para seguir com o onboarding.",
    };
  }

  return {
    state: "unknown",
    kind: "success",
    title: "Conta criada.",
    message: "Sua conta foi criada com sucesso.",
  };
}
