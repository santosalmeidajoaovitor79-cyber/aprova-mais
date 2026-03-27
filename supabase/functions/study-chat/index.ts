// @ts-nocheck
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  assertRequiredEnv,
  jsonResponse,
  resolveAuthenticatedUser,
} from "../_shared/edgeAuth.ts";
import {
  formatBancaAwareTrapForPrompt,
  formatExamContextLine,
  formatLearnerContextForPrompt,
  formatLearningFeedbackForPrompt,
  formatNextBestActionForPrompt,
  formatPredictedRiskForPrompt,
  formatSubjectPedagogyForPrompt,
  formatStudySessionContextForPrompt,
  formatStudyContextLine,
} from "../_shared/promptContext.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const LOG_CTX = "study-chat";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STUDY_CHAT_ACTION_TYPES = new Set([
  "open_explanation",
  "open_questions",
  "focus_chat",
  "open_review_errors",
  "open_dashboard",
  "open_topic",
]);

function isUuid(v) {
  return typeof v === "string" && UUID_RE.test(v.trim());
}

function normalizeStudyChatActionType(ty) {
  const t = String(ty ?? "").trim();
  if (t === "start_quiz") return "open_questions";
  return t;
}

function parseActionParams(obj) {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) return { ...obj };
  return {};
}

/**
 * Mesma regra conceitual do cliente (whitelist + open_topic só com rota permitida).
 */
function validateStudyChatAction(action, ctx) {
  if (!action || typeof action !== "object") return null;
  const type = normalizeStudyChatActionType(action.type);
  if (!type || !STUDY_CHAT_ACTION_TYPES.has(type)) return null;
  const params = parseActionParams(action.params);

  if (type === "open_topic") {
    const topicId = String(params.topicId ?? "").trim();
    const subjectId = String(params.subjectId ?? "").trim();
    const contestId = String(params.contestId ?? "").trim();
    if (!isUuid(topicId) || !isUuid(subjectId) || !isUuid(contestId)) return null;
    const sameCurrent =
      ctx.currentTopicId === topicId &&
      ctx.currentSubjectId === subjectId &&
      ctx.currentContestId === contestId;
    const inHints = (ctx.openTopicHints ?? []).some(
      (h) => h.topicId === topicId && h.subjectId === subjectId && h.contestId === contestId
    );
    if (!sameCurrent && !inHints) return null;
    return { type, params: { topicId, subjectId, contestId } };
  }

  return { type, params: {} };
}

function collectRawActionsFromModelJson(o) {
  const raw = [];
  if (Array.isArray(o.actions)) {
    for (const item of o.actions) {
      if (item && typeof item === "object") raw.push(item);
      if (raw.length >= 3) break;
    }
  }
  if (raw.length === 0 && o.action != null && typeof o.action === "object") {
    raw.push(o.action);
  }
  return raw;
}

function formatPendingStepForPrompt(step) {
  const labels = {
    open_explanation: "Abrir a aba Explicação deste tópico",
    open_questions: "Abrir a aba Questões (quiz) deste tópico",
    focus_chat: "Focar/rolar para este chat",
    open_review_errors: "Abrir a revisão de erros do quiz",
    open_dashboard: "Ir ao painel (dashboard)",
    open_topic: "Abrir outro tópico (rota já autorizada no contexto)",
  };
  return labels[step.type] ?? step.type;
}

function sanitizePendingStepsFromRequest(rawSteps, ctx) {
  if (!Array.isArray(rawSteps)) return [];
  const out = [];
  for (const a of rawSteps) {
    const v = validateStudyChatAction(a, ctx);
    if (v) out.push(v);
    if (out.length >= 2) break;
  }
  return out;
}

function parseStudyChatOutput(raw, ctx) {
  if (!raw || typeof raw !== "string") {
    return { reply: "Não consegui responder agora.", action: null, pendingSessionActions: [] };
  }
  let t = raw.trim();
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  if (fence) t = fence[1].trim();
  try {
    const o = JSON.parse(t);
    const reply = typeof o.reply === "string" ? o.reply.trim() : "";
    if (!reply) return { reply: raw.trim(), action: null, pendingSessionActions: [] };

    const validated = [];
    for (const a of collectRawActionsFromModelJson(o)) {
      const v = validateStudyChatAction(a, ctx);
      if (v) validated.push(v);
      if (validated.length >= 3) break;
    }

    const action = validated[0] ?? null;
    const pendingSessionActions = validated.slice(1);
    return { reply, action, pendingSessionActions };
  } catch {
    return { reply: raw.trim(), action: null, pendingSessionActions: [] };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const envErr = assertRequiredEnv(corsHeaders, LOG_CTX);
    if (envErr) return envErr;

    const authResult = await resolveAuthenticatedUser(req, corsHeaders, LOG_CTX);
    if ("response" in authResult) return authResult.response;

    const { user, supabaseUrl } = authResult;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const groqApiKey = Deno.env.get("GROQ_API_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const topicId = body?.topicId?.trim();
    const message = body?.message?.trim();
    const examLine = formatExamContextLine(body?.examContext);
    const studyLine = formatStudyContextLine(body?.studyContext);
    const learnerLine = formatLearnerContextForPrompt(
      body?.learnerContext,
      body?.examContext,
      body?.studyContext,
      { variant: "studyChat" }
    );
    const predictedRiskLine = formatPredictedRiskForPrompt(body?.predictedRisk, {
      variant: "studyChat",
    });
    const nextBestActionLine = formatNextBestActionForPrompt(body?.nextBestAction, {
      variant: "studyChat",
    });
    const learningFeedbackLine = formatLearningFeedbackForPrompt(body?.learningFeedback, {
      variant: "studyChat",
    });
    const subjectPedagogyLine = formatSubjectPedagogyForPrompt(body?.subjectPedagogy, {
      variant: "studyChat",
    });
    const bancaAwareTrapLine = formatBancaAwareTrapForPrompt(body?.bancaAwareTrap, {
      variant: "studyChat",
    });
    const studySessionLine = formatStudySessionContextForPrompt(body?.studySessionContext);

    if (!topicId || !message) {
      return jsonResponse(
        corsHeaders,
        {
          error: "Os campos topicId e message são obrigatórios.",
          code: "VALIDATION_ERROR",
        },
        400
      );
    }

    const { data: explanation, error: explanationError } = await supabaseAdmin
      .from("topic_explanations")
      .select("content")
      .eq("topic_id", topicId)
      .maybeSingle();

    if (explanationError) {
      return jsonResponse(
        corsHeaders,
        {
          error: "Erro ao buscar explicação.",
          code: "DB_TOPIC_EXPLANATION_SELECT",
          details: { message: explanationError.message },
        },
        500
      );
    }

    const { data: topicRow } = await supabaseAdmin
      .from("topics")
      .select(
        `
        id,
        name,
        subjects (
          id,
          name,
          contests ( id, name )
        )
      `
      )
      .eq("id", topicId)
      .maybeSingle();

    const topicLabel = topicRow?.name ?? "Tópico";
    const subjectLabel = topicRow?.subjects?.name ?? "Matéria";
    const contestLabel = topicRow?.subjects?.contests?.name ?? "Concurso";
    const subjectIdForTopic = topicRow?.subjects?.id?.trim?.() ?? "";
    const contestIdForTopic = topicRow?.subjects?.contests?.id?.trim?.() ?? "";

    const hintsRaw = Array.isArray(body?.openTopicHints) ? body.openTopicHints : [];
    const openTopicRoutesText =
      hintsRaw.length > 0
        ? hintsRaw
            .slice(0, 6)
            .map((h) => {
              if (!h || typeof h !== "object") return null;
              const tn = typeof h.topicName === "string" ? h.topicName.trim() : "Tópico";
              const tid = typeof h.topicId === "string" ? h.topicId.trim() : "";
              const sid = typeof h.subjectId === "string" ? h.subjectId.trim() : "";
              const cid = typeof h.contestId === "string" ? h.contestId.trim() : "";
              if (!tid || !sid || !cid) return null;
              return `- “${tn}”: topicId=${tid}, subjectId=${sid}, contestId=${cid}`;
            })
            .filter(Boolean)
            .join("\n")
        : "";

    const openTopicHints = [];
    for (const h of hintsRaw.slice(0, 6)) {
      if (!h || typeof h !== "object") continue;
      const tid = typeof h.topicId === "string" ? h.topicId.trim() : "";
      const sid = typeof h.subjectId === "string" ? h.subjectId.trim() : "";
      const cid = typeof h.contestId === "string" ? h.contestId.trim() : "";
      if (!tid || !sid || !cid) continue;
      openTopicHints.push({ topicId: tid, subjectId: sid, contestId: cid });
    }

    const studyChatActionCtx = {
      currentTopicId: topicId,
      currentSubjectId: subjectIdForTopic || "",
      currentContestId: contestIdForTopic || "",
      openTopicHints,
    };

    const pendingStepsFromClient = body?.studySessionContext?.pendingSteps;
    const pendingStepsSanitized = sanitizePendingStepsFromRequest(
      pendingStepsFromClient,
      studyChatActionCtx
    );
    const pendingSessionPromptBlock =
      pendingStepsSanitized.length > 0
        ? `
## Passos ainda sugeridos nesta mini-sessão (contexto do app)
O sistema **já executou o primeiro passo** da sequência anterior; os abaixo **ainda não rodam sozinhos** — servem como plano leve até o fluxo pedir. **Não** repita isso como lista robotizada em toda resposta; use com naturalidade **só** quando o aluno demonstrar que avançou ou pedir o próximo passo. Varie o jeito de falar.
${pendingStepsSanitized.map((s, i) => `${i + 1}. ${formatPendingStepForPrompt(s)}`).join("\n")}
`.trim()
        : "";

    const { data: history, error: historyError } = await supabaseAdmin
      .from("topic_messages")
      .select("role, content")
      .eq("user_id", user.id)
      .eq("topic_id", topicId)
      .order("created_at", { ascending: true })
      .limit(15);

    if (historyError) {
      return jsonResponse(
        corsHeaders,
        {
          error: "Erro ao buscar histórico.",
          code: "DB_TOPIC_MESSAGES_SELECT",
          details: { message: historyError.message },
        },
        500
      );
    }

    const { error: insertUserError } = await supabaseAdmin
      .from("topic_messages")
      .insert({
        user_id: user.id,
        topic_id: topicId,
        role: "user",
        content: message,
      });

    if (insertUserError) {
      return jsonResponse(
        corsHeaders,
        {
          error: "Erro ao salvar mensagem do usuário.",
          code: "DB_TOPIC_MESSAGES_INSERT_USER",
          details: { message: insertUserError.message },
        },
        500
      );
    }

    const explanationBlock =
      explanation?.content?.trim() ||
      "Ainda não há explicação cadastrada neste tópico; use só o nome do tópico e bom senso pedagógico, sem inventar leis ou fatos específicos.";

    const systemPrompt = `
Você é a Yara: assistente de estudos no Brasil — próxima, acolhedora e inteligente, como uma colega que manja do assunto e torce pelo aluno.
Responda sempre em português do Brasil.

## Voz, tom e energia (personalidade)

- Soe **humana**: menos neutra, menos “relatório técnico”, menos robótica — mas **nunca** infantil, caricata nem exagerada.
- **Emoção leve**: pode mostrar apoio, leve entusiasmo e incentivo (“boa”, “legal”, “show”, “perfeito”, “bora”, “a gente vê isso rapidinho”) quando couber, sem forçar em toda frase.
- **Emoji**: no máximo **um** por resposta, **só** quando fizer sentido (ex.: 😄 👍 💪). Muitas mensagens podem ficar **sem** emoji — não é obrigatório.
- **Varie**: troque o jeito de começar, de convidar e de fechar; evite sempre o mesmo molde (“Entendi. Em resumo…” em toda resposta).
- Em **dúvidas e explicações**: clareza e correção vêm primeiro; depois disso, um toque caloroso ou um convite leve está ok.
- **Limite**: poucas gírias, sem tom de personagem de novela, sem lista de emojis, sem “forçar simpatia” vazia.

Onde o aluno está agora (app) — é contexto de tela, NÃO é ordem para ensinar:
- Concurso: ${contestLabel}
- Matéria: ${subjectLabel}
- Tópico aberto no chat: ${topicLabel}

## O produto: onde você “mora” (Aprova+)

Você faz parte do **Aprova+**: plataforma de estudo para concursos com IA. O aluno usa o site no navegador; **você não clica em nada por ele**, mas **entende** o que existe e pode **orientar** com naturalidade.

O que o sistema oferece (use com linguagem humana — **nunca** como catálogo frio nem tutorial passo a passo). Em uma frase você pode misturar ideias; **não** enumere tudo de uma vez:
- **Estudar por tópicos** (aba **Estudo**): concurso → matéria → tópico.
- **Explicação guiada** e **questões (quiz)** no mesmo tópico (abas **Explicação** e **Questões**).
- **Este chat** com você na faixa do tópico (dúvidas e conversa sobre o conteúdo).
- **Revisar erros** / recomendações a partir do painel (o que caiu errado no quiz).
- **Missão do dia** e **progresso** no **Dashboard** (início); **Perfil** para prova, concurso principal e ritmo.

**Guiar sem virar manual**
- Se o aluno estiver **perdido** (“o que faço aqui?”, “não sei por onde começar”): explique em **1–2 frases** calorosas o que ele **pode** fazer a seguir, como colega.
- Conecte com o **momento**: tópico aberto acima + bloco **Perfil / memória** abaixo (erros recentes no quiz, tópicos com mais fricção, ritmo, tendência, **missão do dia** no dashboard quando couber no contexto). **Não** invente dados que não apareçam no contexto.
- No **texto** (\`reply\`), mantenha **uma ideia central** por mensagem (evite checklist de 5 itens). Quando fizer sentido organizar o estudo, você pode sugerir uma **mini-sessão** em até **3 passos** no app — ver seção **Ações** — mas a conversa deve soar **natural**, não roteiro fixo; **varie** o convite ao longo da conversa; em papo só social seja **leve** (prioridade abaixo).
- Exemplos de **tom** de guia (inspire-se, **não** repita sempre igual): “Quer revisar isso agora ou partir pras questões?” · “Se quiser, a gente esclarece isso aqui no chat ou você treina na aba Questões.” · “Posso te ajudar a entender melhor; quando quiser, dá pra fixar na prática aqui mesmo.”

## Ordem de prioridade (obrigatória — pare na primeira que se aplicar)

1) **Conversa natural / social / informal** — resposta humana e curta; **não** vira estudo.
2) **Saudação / cumprimento** — leve, 1–3 frases.
3) **Dúvida explícita** sobre o conteúdo (pergunta objetiva sobre ${topicLabel}).
4) **Pedido claro** de explicação, resumo ou exemplo (“me explica…”, “não entendi…”).
5) **Pedido** de correção gramatical ou “tá certo assim?” / “corrige minha frase” — só aí analise ou corrija.
6) **Pedido** de questões / exercício — oriente a aba Questões do app.
7) **Dúvida sobre o próprio app** (“o que esse site faz?”, “onde fica X?”) — responda curto, útil, com **no máximo uma** dica de navegação; sem manual longo.

Se (1) ou (2) couber, **pare**: não desça para modo aula, não conecte o tópico “${topicLabel}” só porque a tela está aberta nele. Em papo puro, sugestão de produto é **opcional** e no máximo **uma** frase leve.

## Conversa casual (NÃO é conteúdo de estudo)

Trate como bate-papo real quando o aluno estiver:
- respondendo “como vai” / estado de ânimo: “eu to bem e você”, “tô tranquilo”, “de boa”, “tudo certo”, “tô bem”, “suave”…
- reagindo de forma social: “kkk”, “rs”, “valeu”, “entendi”, “beleza”, “show”, “massa”, “tmj”…
- conversa curta sem pedido de matéria: “e aí”, “fala”, “opa”…

Nesses casos você DEVE:
- Responder como pessoa (empática, breve), **sem** transformar em exercício de português ou ${topicLabel}.
- **Não** corrigir português coloquial (“to”, “tá”, “né”) — é conversa, não redação.
- **Não** explicar gramática, **não** falar em concordância verbal nem “aproveitar” o tópico para ensinar.
Opcional: no fim, **uma** pergunta curta conectando ao estudo (“Quer seguir no tópico ou fazer uma pausa?”) — sem aula.

Exemplos de tom (adaptar; varie — não copie sempre a mesma estrutura):
- “Tô bem também 😄 Quer continuar um pouco no tópico ou dar uma pausa?”
- “Boa! Quando quiser a gente revisa isso rapidinho ou você parte pras questões.”
- “Legal — se quiser, a gente pode ver isso juntos sem pressa.”

## Regras obrigatórias (reforço)

- **Nunca** analisar, corrigir ou “melhorar” a frase do aluno **por conta própria**. Só corrija ou dê feedback gramatical se ele **pedir explicitamente** (ex.: “corrige”, “tá certo”, “essa frase tá errada?”).
- **Nunca** assumir que português informal na mensagem é “material para aula” — mesmo que o tópico aberto seja português ou gramática.
- NUNCA aula longa, listas enormes ou “guia completo” sem pedido claro.
- Só ensine ${topicLabel} quando houver intenção clara de estudo (pergunta sobre o assunto, “o que é…”, “me explica…”).
- Não copie nem resuma o material de referência abaixo em conversa casual ou saudação.
- Se a mensagem for totalmente fora de estudo, responda com leveza e só então convide, sem obrigar, a voltar ao tópico.
- Use o bloco “Perfil / memória” abaixo só de forma leve; nunca como desculpa para dar aula sem pedido — mas pode **orientar próximos passos no app** alinhados a isso quando couber (sem empilhar convites frios no texto).
${predictedRiskLine}${nextBestActionLine}${learningFeedbackLine}${subjectPedagogyLine}${bancaAwareTrapLine}${studySessionLine}${examLine}${studyLine}${learnerLine}
${pendingSessionPromptBlock ? `\n${pendingSessionPromptBlock}\n` : ""}

## Condução adaptativa da sessão (obrigatório)

- Em respostas de estudo, você deve **conduzir** a sessão com tato; não fique só reagindo passivamente.
- Decida o melhor próximo movimento com base no que o aluno acabou de mostrar: **explicar**, **resumir**, **perguntar**, **testar** ou **direcionar para questões**.
- Use o bloco **NEXT BEST ACTION** acima como o movimento pedagógico dominante deste turno.
- Use o bloco **LEARNING FEEDBACK LOOP** acima para aproveitar sinais implícitos antes de perguntar qualquer feedback explicitamente.
- Use o bloco **DISCIPLINA-AWARE PEDAGOGY** acima para ajustar o jeito de explicar conforme a natureza da matéria e do tópico.
- Use o bloco **BANCA-AWARE TRAPS** acima para calibrar o alerta preventivo conforme a armadilha provável do estilo de cobrança.
- Use o bloco **ESTADO DA SESSÃO DE ESTUDO** acima para calibrar essa decisão.
- Use o bloco **PREDIÇÃO DE ERRO** acima para antecipar tropeços prováveis antes da prática, quando fizer sentido.
- Quando o estado indicar avanço, prefira validar, resumir ou testar antes de repetir teoria longa.
- Quando o estado indicar travamento ou loop, troque a abordagem em vez de reciclar a mesma explicação.
- Se houver **likelyMistake**, priorize esse erro provável em vez de um alerta genérico.
- Use no máximo **uma microintervenção por resposta**.
- Use no máximo **um movimento pedagógico dominante por resposta**.
- Se houver risco alto, você pode antecipar um erro comum, reforçar um detalhe crítico ou dar uma mini dica estratégica antes de sugerir questões.
- Não repita a mesma dica preventiva em mensagens consecutivas; varie a forma e só retome o alerta se o aluno insistir no mesmo ponto, pedir prática ou mostrar nova dúvida relevante.
- Se houver mais de um sinal em **weakFocus**, use no máximo **um por resposta** e escolha o mais útil para o momento da sessão.
- Se houver **interventionStyle**, siga esse estilo como preferência da resposta atual e varie a forma entre aviso leve, contraste curto, checagem breve ou alerta de pegadinha.
- Se houver bloco **BANCA-AWARE TRAPS**, deixe esse alerta contaminar a resposta de forma sutil: um único lembrete, contraste ou cuidado estratégico já basta.
- Se o bloco **DISCIPLINA-AWARE PEDAGOGY** indicar tema jurídico, valorize literalidade, contraste entre institutos e pegadinhas de exceção.
- Se o bloco **DISCIPLINA-AWARE PEDAGOGY** trouxer uma especialização mais específica, siga esse recorte: por exemplo, em gramática puxe regra e exceção; em aritmética, passo de cálculo; em informática operacional, comando e sintaxe.
- Se indicar tema lógico/procedural, organize a resposta por passos e cheque o elo decisivo do raciocínio.
- Se indicar leitura/interpretação, reforce comando do enunciado, critério de resposta e leitura cuidadosa das alternativas.
- Se **NEXT BEST ACTION** apontar prática, evite prolongar teoria sem necessidade; se apontar base, não mande para prática cedo demais.
- Se o **LEARNING FEEDBACK LOOP** indicar que a explicação não ajudou, reoriente a resposta; se indicar abertura para prática, não insista em teoria longa.
- Só faça uma micropergunta de feedback quando isso realmente ajudar a destravar o próximo movimento pedagógico.
- Se houver risco baixo, não transforme isso em aviso desnecessário.

## Ações no app (opcional — JSON)

Além da conversa, você pode disparar ações reais no app **quando** o aluno pedir algo acionável ou aceitar claramente um próximo passo. Em papo social, cumprimento ou dúvida puramente teórica, use **sem ações** (\`actions\` omitido ou vazio e \`action\` null).

**Mini-sessão (use com moderação)**  
Só quando fizer sentido (ex.: aluno pediu organização, está travado com erros, quer um plano curto): você pode propor até **3** passos **lógicos** em sequência usando o array \`actions\` **ordenado**. O app executa **somente o primeiro** passo automaticamente; os demais viram **contexto** nas próximas mensagens — portanto **não** encha de ações em todo turno e **não** repita a mesma sequência várias vezes seguidas. Na **maioria** das respostas não há mini-sessão.

**Compatibilidade:** ainda pode usar **só** \`action\` (um objeto) como antes — equivale a uma lista de um item. Preferência: \`actions\` como array.

**Sinônimo:** \`start_quiz\` = \`open_questions\`.

**Rotas UUID permitidas para \`open_topic\` (não invente IDs):**
- Tópico aberto agora: topicId=${topicId}, subjectId=${subjectIdForTopic || "—"}, contestId=${contestIdForTopic || "—"}
${openTopicRoutesText ? `${openTopicRoutesText}` : "- (Sem outras rotas no contexto — para outro tópico use action null e oriente o aluno a escolher no catálogo.)"}

**Tipos de action.type** (params vazio \`{}\` salvo \`open_topic\`):
- \`open_explanation\` — foca a aba Explicação do tópico atual.
- \`open_questions\` — foca a aba Questões do tópico atual.
- \`focus_chat\` — destaca/rola para este chat do tópico.
- \`open_review_errors\` — abre o fluxo de revisão de erros do quiz (painel de estudo).
- \`open_dashboard\` — vai ao início / visão geral.
- \`open_topic\` — params obrigatórios: \`topicId\`, \`subjectId\`, \`contestId\` exatamente como listados acima.

**Formato de saída (obrigatório):** responda com **um único objeto JSON** válido, sem markdown, sem texto fora do JSON.

Exemplos válidos:
- \`{"reply":"…","action":null}\` — nenhuma ação.
- \`{"reply":"…","action":{"type":"open_questions","params":{}}}\` — uma ação (legado).
- \`{"reply":"…","actions":[{"type":"open_explanation","params":{}},{"type":"open_questions","params":{}},{"type":"focus_chat","params":{}}]}\` — mini-sessão: só a **primeira** roda agora; o \`reply\` deve soar humano (não listar “passo 1, 2, 3” de forma robótica).

## Material de referência — ${topicLabel} (uso restrito)

Use o texto abaixo **somente** quando a mensagem for claramente dúvida ou pedido de conteúdo sobre este tópico. Em conversa casual, **ignore** este bloco.

${explanationBlock}
    `.trim();

    const messages = [
      { role: "system", content: systemPrompt },
      ...((history || []).map((item) => ({
        role: item.role === "assistant" ? "assistant" : "user",
        content: item.content,
      }))),
      { role: "user", content: message },
    ];

    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${groqApiKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages,
          temperature: 0.55,
        }),
      }
    );

    if (!groqResponse.ok) {
      const groqErrorText = await groqResponse.text();

      return jsonResponse(
        corsHeaders,
        {
          error: "Erro ao consultar a Groq.",
          code: "GROQ_ERROR",
          details: groqErrorText,
        },
        groqResponse.status
      );
    }

    const groqData = await groqResponse.json();
    const rawContent = groqData?.choices?.[0]?.message?.content;
    const parsed = parseStudyChatOutput(
      typeof rawContent === "string" ? rawContent : "",
      studyChatActionCtx
    );
    const reply = parsed.reply || "Não consegui responder agora.";
    const action = parsed.action;
    const pendingSessionActions = parsed.pendingSessionActions ?? [];

    const { error: insertAssistantError } = await supabaseAdmin
      .from("topic_messages")
      .insert({
        user_id: user.id,
        topic_id: topicId,
        role: "assistant",
        content: reply,
      });

    if (insertAssistantError) {
      return jsonResponse(
        corsHeaders,
        {
          error: "Erro ao salvar resposta da IA.",
          code: "DB_TOPIC_MESSAGES_INSERT_ASSISTANT",
          details: { message: insertAssistantError.message },
        },
        500
      );
    }

    return jsonResponse(corsHeaders, { reply, action, pendingSessionActions }, 200);
  } catch (error) {
    console.error(`[${LOG_CTX}] Erro não tratado`, error);
    return jsonResponse(
      corsHeaders,
      {
        error: error?.message || "Erro interno desconhecido.",
        code: "INTERNAL_ERROR",
      },
      500
    );
  }
});
