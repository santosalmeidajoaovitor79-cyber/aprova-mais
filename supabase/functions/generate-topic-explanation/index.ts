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
  formatStudyContextLine,
  formatSubjectPedagogyForPrompt,
  formatTopicExplanationAdaptiveDepth,
  formatTopicExplanationAdaptiveRhythm,
  formatTopicExplanationDidacticStyle,
} from "../_shared/promptContext.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const LOG_CTX = "generate-topic-explanation";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const envErr = assertRequiredEnv(corsHeaders, LOG_CTX);
    if (envErr) return envErr;

    const authResult = await resolveAuthenticatedUser(req, corsHeaders, LOG_CTX);
    if ("response" in authResult) return authResult.response;

    const { supabaseUrl } = authResult;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const groqApiKey = Deno.env.get("GROQ_API_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const topicId = body?.topicId?.trim();
    const examLine = formatExamContextLine(body?.examContext);
    const studyLine = formatStudyContextLine(body?.studyContext);
    const learnerLine = formatLearnerContextForPrompt(
      body?.learnerContext,
      body?.examContext,
      body?.studyContext,
      { variant: "topicExplanation" }
    );
    const predictedRiskLine = formatPredictedRiskForPrompt(body?.predictedRisk, {
      variant: "topicExplanation",
    });
    const nextBestActionLine = formatNextBestActionForPrompt(body?.nextBestAction, {
      variant: "topicExplanation",
    });
    const learningFeedbackLine = formatLearningFeedbackForPrompt(body?.learningFeedback, {
      variant: "topicExplanation",
    });
    const subjectPedagogyLine = formatSubjectPedagogyForPrompt(body?.subjectPedagogy, {
      variant: "topicExplanation",
    });
    const bancaAwareTrapLine = formatBancaAwareTrapForPrompt(body?.bancaAwareTrap, {
      variant: "topicExplanation",
    });
    const adaptiveDepthLine = formatTopicExplanationAdaptiveDepth(
      body?.learnerContext,
      body?.studyContext
    );

    if (!topicId) {
      return jsonResponse(
        corsHeaders,
        {
          error: "O campo topicId é obrigatório.",
          code: "VALIDATION_ERROR",
        },
        400
      );
    }

    const { data: existingExplanation, error: existingError } = await supabaseAdmin
      .from("topic_explanations")
      .select("id, title, content, source_type")
      .eq("topic_id", topicId)
      .maybeSingle();

    if (existingError) {
      return jsonResponse(
        corsHeaders,
        {
          error: "Erro ao verificar explicação existente.",
          code: "DB_TOPIC_EXPLANATION_SELECT",
          details: { message: existingError.message },
        },
        500
      );
    }

    if (existingExplanation?.content) {
      return jsonResponse(
        corsHeaders,
        {
          title: existingExplanation.title,
          content: existingExplanation.content,
          reused: true,
        },
        200
      );
    }

    const { data: topic, error: topicError } = await supabaseAdmin
      .from("topics")
      .select(`
        id,
        name,
        description,
        difficulty,
        estimated_minutes,
        subjects (
          id,
          name,
          contests (
            id,
            name,
            slug
          )
        )
      `)
      .eq("id", topicId)
      .single();

    if (topicError || !topic) {
      return jsonResponse(
        corsHeaders,
        {
          error: "Tópico não encontrado.",
          code: "TOPIC_NOT_FOUND",
          details: topicError ? { message: topicError.message } : {},
        },
        404
      );
    }

    const contestName = topic.subjects?.contests?.name ?? "Concurso";
    const subjectName = topic.subjects?.name ?? "Matéria";
    const topicName = topic.name ?? "Conteúdo";
    const description = topic.description ?? "Sem descrição";
    const difficulty = topic.difficulty ?? "não definida";
    const estimatedMinutes = topic.estimated_minutes ?? 30;

    const didacticStyleLine = formatTopicExplanationDidacticStyle(
      body?.learnerContext,
      body?.studyContext,
      { topicId, difficulty, description }
    );

    const adaptiveRhythmLine = formatTopicExplanationAdaptiveRhythm(
      body?.learnerContext,
      body?.studyContext,
      { topicId, difficulty, description }
    );

    const prompt = `
Crie uma explicação de estudo em português do Brasil para um aluno. O texto será lido em partes no app,
como se você estivesse explicando em mensagens curtas — cada bloco "## " vira um passo da conversa.

Contexto:
- Concurso: ${contestName}
- Matéria: ${subjectName}
- Conteúdo: ${topicName}
- Descrição: ${description}
- Dificuldade: ${difficulty}
- Tempo estimado de estudo: ${estimatedMinutes} minutos${examLine}${studyLine}${learnerLine}${predictedRiskLine}${nextBestActionLine}${learningFeedbackLine}${subjectPedagogyLine}${bancaAwareTrapLine}${adaptiveDepthLine}${didacticStyleLine}${adaptiveRhythmLine}

ESTRUTURA PEDAGÓGICA (siga esta ordem sempre que fizer sentido; seja natural, não engessado):

Use seções com título em linha própria começando com "## " (dois cerquilhas e um espaço), exatamente estes nomes:

## Introdução
(2–5 frases: contextualize o tema, desperte interesse, diga por que vale a pena dominar isso agora)

## Conceito
(núcleo didático em linguagem clara; parágrafos curtos ou listas com traço quando ajudarem; progressivo: ideia base antes do refinamento)

## Exemplo
(um exemplo concreto e simples, próximo do que aparece em prova objetiva — sem inventar enunciado real)

## Como cai na prova
(padrões de cobrança, pegadinhas comuns, distratores típicos em provas desse tipo de concurso — sem citar edital, banca ou prova específica inventada)

Opcional, só se agregar valor (cada uma com "## " na linha do título):

## Erros comuns
(breve: 2–4 confusões que os alunos costumam ter)

## Resumo rápido
(bem telegráfico: bullets curtos ou frases para revisão rápida)

Regras de formato e tom:
- Português do Brasil; tom de professora particular: acolhedor, leve, conversacional, mas preciso
- Cada bloco após um "## " deve ser curto a moderado (evite parede de texto; prefira 1–3 parágrafos por seção principal)
- Use apenas "## " para títulos de seção (não use ### nem # solto)
- Nas seções obrigatórias (Introdução, Conceito, Exemplo, Como cai na prova), não pule nenhuma — mesmo que uma fique um pouco mais enxuta
- Não invente leis, datas ou fatos específicos sem base no contexto
- Se houver bloco de **PREDIÇÃO DE ERRO**, integre-o com naturalidade: se houver **likelyMistake** e o risco for médio/alto, antecipe essa confusão sem mencionar sistema interno; em risco alto, reforce o contraste ou detalhe crítico ainda no conceito antes do exemplo; em risco médio, faça um reforço leve e pontual.
- Se houver bloco de **NEXT BEST ACTION**, ele indica o movimento pedagógico dominante desta explicação: explicar núcleo, recuperar base, contrastar conceitos ou resumir antes de prática. Use isso para decidir a ênfase da explicação sem soar mecânico.
- Se houver bloco de **LEARNING FEEDBACK LOOP**, use-o para ajustar clareza, ênfase e linguagem com base no que já ajudou ou não ajudou o aluno nesta sessão, sem transformar a explicação em conversa de formulário.
- Se houver bloco de **DISCIPLINA-AWARE PEDAGOGY**, ajuste a explicação ao tipo de conteúdo: em temas jurídicos, destaque literalidade, exceções e institutos próximos; em temas lógicos/procedurais, organize por sequência; em leitura/interpretação, destaque comando e critério do enunciado; em conteúdo de precisão, reforce o detalhe crítico com síntese.
- Se houver especialização de domínio no bloco de **DISCIPLINA-AWARE PEDAGOGY**, siga esse recorte com prioridade: por exemplo, em constitucional destaque competência e garantia; em gramática destaque regra e exceção; em aritmética destaque operação e unidade; em informática operacional destaque comando, atalho e sintaxe.
- Se houver bloco de **BANCA-AWARE TRAPS**, use-o para escolher qual pegadinha preventiva vale antecipar dentro da explicação, sem empilhar alertas demais nem citar lógica interna.
- Observe o bloco "Perfil e progresso", "NÍVEL ADAPTATIVO DESTA EXPLICAÇÃO", "ESTILO DIDÁTICO ADAPTATIVO", "RITMO ADAPTATIVO DA EXPLICAÇÃO" e "Como ajustar sua resposta" acima: profundidade, estilo e ritmo se complementam; em conflito, priorize clareza e o nível adaptativo, depois estilo, depois ritmo — sem fragmentação exagerada
    `.trim();

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
          messages: [
            {
              role: "system",
              content:
                "Você é a Yara, professora particular experiente: didática leve e conversacional, como mensagens de estudo — cada seção ## é um passo que o aluno lê em sequência. Calibre profundidade, jeito de ensinar e ritmo de leitura conforme os blocos adaptativos do pedido, sem soar artificial nem fragmentar em excesso. Motive sem exagerar, seja clara e progressiva. Respeite rigorosamente os títulos ## e as regras do pedido do usuário.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.5,
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
    const content =
      groqData?.choices?.[0]?.message?.content?.trim() ||
      "Não foi possível gerar a explicação agora.";

    const payload = {
      topic_id: topicId,
      title: topicName,
      content,
      source_type: "ai_generated",
      created_at: new Date().toISOString(),
    };

    const { error: saveError } = await supabaseAdmin
      .from("topic_explanations")
      .upsert(payload, { onConflict: "topic_id" });

    if (saveError) {
      return jsonResponse(
        corsHeaders,
        {
          error: "Erro ao salvar explicação.",
          code: "DB_TOPIC_EXPLANATION_UPSERT",
          details: { message: saveError.message },
        },
        500
      );
    }

    return jsonResponse(
      corsHeaders,
      {
        title: topicName,
        content,
        reused: false,
      },
      200
    );
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
