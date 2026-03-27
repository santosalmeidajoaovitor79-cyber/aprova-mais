import { memo } from "react";
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Lock,
  Mail,
  MailCheck,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import { styles } from "../styles/appStyles.js";
import { Field } from "./Field.jsx";

function AuthScreenComponent({
  mode,
  setMode,
  name,
  setName,
  email,
  setEmail,
  password,
  setPassword,
  passwordConfirm,
  setPasswordConfirm,
  error,
  message,
  authFeedback,
  saving,
  onSubmit,
  onBackToLanding,
}) {
  const feedback = authFeedback || (error ? { kind: "error", title: "Algo travou aqui.", message: error } : null);
  const benefitItems =
    mode === "login"
      ? [
          { icon: Clock3, title: "Retome sem atrito", text: "volte para o tópico exato" },
          { icon: Brain, title: "Memória da Yara", text: "continua do seu contexto" },
          { icon: ShieldCheck, title: "Seu histórico", text: "questões e chat preservados" },
        ]
      : [
          { icon: Sparkles, title: "Plano vivo", text: "a Yara ajusta ao seu ritmo" },
          { icon: Brain, title: "Explicação do seu jeito", text: "mais teoria, exemplo ou prática" },
          { icon: ShieldCheck, title: "Entrada leve", text: "sem formulário grande e frio" },
        ];

  const statusTone =
    feedback?.kind === "success"
      ? {
          border: "1px solid rgba(74,222,128,0.28)",
          background: "rgba(22,163,74,0.12)",
          color: "#dcfce7",
          icon: CheckCircle2,
        }
      : feedback?.kind === "info"
        ? {
            border: "1px solid rgba(96,165,250,0.28)",
            background: "rgba(59,130,246,0.12)",
            color: "#dbeafe",
            icon: MailCheck,
          }
        : feedback?.kind === "warning"
          ? {
              border: "1px solid rgba(250,204,21,0.28)",
              background: "rgba(250,204,21,0.12)",
              color: "#fef3c7",
              icon: CircleAlert,
            }
          : {
              border: "1px solid rgba(251,113,133,0.28)",
              background: "rgba(190,24,93,0.12)",
              color: "#ffe4e6",
              icon: CircleAlert,
            };
  const StatusIcon = statusTone.icon;

  return (
    <div className="aprova-auth-page-root" style={styles.page}>
      <div className="aprova-auth-shell-cosmic" style={styles.authShellCompact}>
        <div
          className="aprova-auth-form-cosmic"
          style={{
            ...styles.authFormSolo,
            maxWidth: 520,
            padding: "30px 28px 34px",
            background:
              "linear-gradient(180deg, rgba(12,12,18,0.88), rgba(10,10,16,0.78) 58%, rgba(11,11,17,0.92))",
          }}
        >
          {onBackToLanding ? (
            <button type="button" onClick={onBackToLanding} style={styles.authBackLink}>
              ← Voltar ao início
            </button>
          ) : null}

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid rgba(196,181,253,0.18)",
              background: "rgba(139,92,246,0.12)",
              color: "#e9d5ff",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            <Sparkles size={14} />
            Aprova+ com Yara
          </div>

          <p style={{ ...styles.landingBrand, marginTop: 18, marginBottom: 10 }}>Aprova+</p>
          <h1 style={{ ...styles.formTitle, fontSize: 28, lineHeight: 1.08, marginTop: 0 }}>
            {mode === "login"
              ? "Volte para o ponto exato em que a Yara parou com você."
              : "Comece com um plano que já nasce no seu ritmo."}
          </h1>
          <p style={{ ...styles.formText, fontSize: 15, marginTop: 10, lineHeight: 1.7 }}>
            {mode === "login"
              ? "Login rápido, histórico preservado e continuidade real nas explicações, questões e trilha até a prova."
              : "Crie sua conta e deixe a Yara montar um começo inteligente: prova alvo, rotina, dificuldades e estilo de explicação em poucas etapas."}
          </p>

          <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
            {benefitItems.map(({ icon: IconComponent, title, text }) => (
              <div
                key={title}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.04)",
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 12,
                    display: "grid",
                    placeItems: "center",
                    background: "rgba(139,92,246,0.16)",
                    color: "#e9d5ff",
                    flexShrink: 0,
                  }}
                >
                  <IconComponent size={16} />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#fafafa" }}>{title}</p>
                  <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#b4b4bf", lineHeight: 1.55 }}>{text}</p>
                </div>
              </div>
            ))}
          </div>

          <div style={styles.tabWrap}>
            <button
              type="button"
              onClick={() => setMode("login")}
              className="aprova-btn-interactive"
              style={{
                ...styles.tabButton,
                ...(mode === "login" ? styles.tabActive : styles.tabInactive),
              }}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => setMode("register")}
              className="aprova-btn-interactive"
              style={{
                ...styles.tabButton,
                ...(mode === "register" ? styles.tabActive : styles.tabInactive),
              }}
            >
              Criar conta
            </button>
          </div>

          <h2 style={{ ...styles.formTitle, fontSize: 20, marginTop: 16 }}>
            {mode === "login" ? "Acessar" : "Cadastro"}
          </h2>

          <p style={{ ...styles.formText, fontSize: 13, marginTop: 8 }}>
            {mode === "login"
              ? "Entre para retomar sua trilha e o contexto que a Yara já conhece."
              : "Primeiro o acesso. Logo depois, a Yara conduz um onboarding curto e conversacional."}
          </p>

          <div style={{ ...styles.formFields, marginTop: 16, gap: 14 }}>
            <Field label="Nome" icon={User}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={styles.input}
                placeholder="Como podemos te chamar?"
                disabled={mode === "login"}
              />
            </Field>

            <Field label="E-mail" icon={Mail}>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.input}
                placeholder="seu@email.com"
                type="email"
              />
            </Field>

            <Field label="Senha" icon={Lock}>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
                placeholder="••••••••"
                type="password"
                autoComplete={mode === "register" ? "new-password" : "current-password"}
              />
            </Field>

            {mode === "register" ? (
              <Field label="Confirmar senha" icon={Lock}>
                <input
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  style={styles.input}
                  placeholder="Repita a senha"
                  type="password"
                  autoComplete="new-password"
                />
              </Field>
            ) : null}

            {mode === "register" ? (
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: 18,
                  border: "1px solid rgba(168,85,247,0.18)",
                  background: "rgba(139,92,246,0.08)",
                }}
              >
                <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#f5f3ff" }}>
                  A Yara ajusta o resto com você
                </p>
                <p style={{ margin: "6px 0 0 0", fontSize: 13, lineHeight: 1.6, color: "#d4d4d8" }}>
                  Depois do cadastro, ela vai perguntar em etapas curtas sobre concurso, data da prova,
                  horas por dia, dificuldades e o jeito de explicar que mais rende para você.
                </p>
              </div>
            ) : null}
          </div>

          {feedback ? (
            <div
              style={{
                marginTop: 16,
                padding: "14px 16px",
                borderRadius: 18,
                ...statusTone,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <StatusIcon size={18} style={{ marginTop: 1, flexShrink: 0 }} />
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>{feedback.title}</p>
                  <p style={{ margin: "6px 0 0 0", fontSize: 13, lineHeight: 1.6 }}>{feedback.message}</p>
                  {feedback.detail ? (
                    <p style={{ margin: "8px 0 0 0", fontSize: 12, lineHeight: 1.5, opacity: 0.8 }}>
                      Detalhe técnico: {feedback.detail}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
          {!feedback && message ? <p style={{ ...styles.successText, marginTop: 16 }}>{message}</p> : null}

          <button
            type="button"
            onClick={onSubmit}
            disabled={
              saving ||
              !email ||
              !password ||
              (mode === "register" &&
                (!name.trim() ||
                  !passwordConfirm.trim() ||
                  password.length < 6 ||
                  password !== passwordConfirm))
            }
            className="aprova-btn-interactive"
            style={{
              ...styles.primaryButton,
              borderRadius: 16,
              marginTop: 18,
              background: "linear-gradient(135deg, #f5f3ff 0%, #e9d5ff 50%, #ddd6fe 100%)",
              boxShadow: "0 14px 38px rgba(139,92,246,0.24)",
            }}
          >
            <Lock size={16} />
            {saving ? "Abrindo…" : mode === "login" ? "Entrar no Aprova+" : "Criar conta e começar"}
            {!saving ? <ArrowRight size={16} /> : null}
          </button>

          {mode === "login" ? (
            <p style={{ margin: "14px 0 0 0", fontSize: 12, color: "#8f90a6", lineHeight: 1.6 }}>
              Se o Supabase pedir confirmação de e-mail, entre depois de validar o link recebido.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export const AuthScreen = memo(AuthScreenComponent);
