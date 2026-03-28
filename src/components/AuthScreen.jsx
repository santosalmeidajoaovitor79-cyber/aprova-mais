import { memo, useMemo } from "react";
import { ArrowRight, CheckCircle2, CircleAlert, Lock, Mail, MailCheck, Shield, Sparkles, User } from "lucide-react";
import { styles } from "../styles/appStyles.js";

const benefitCards = [
  {
    eyebrow: "FOCO CERTO",
    title: "Pare de estudar no escuro.",
    text: "A Yara organiza seu próximo passo, mostra o que merece atenção agora e evita que você perca tempo com esforço mal direcionado.",
  },
  {
    eyebrow: "EXPLICAÇÃO VIVA",
    title: "Entenda sem travar.",
    text: "Explicações, exemplos e prática no ritmo certo para o seu momento, sem despejar teoria fria.",
  },
  {
    eyebrow: "EVOLUÇÃO REAL",
    title: "Retome sem perder tempo.",
    text: "Seu plano continua do ponto exato onde você parou, com clareza para seguir sem recomeçar do zero.",
  },
];

const trustPoints = [
  "Plano de estudo com direção real",
  "Retomada inteligente do ponto certo",
  "Questões, revisão e Yara no mesmo fluxo",
];

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
  const isLogin = mode === "login";
  const feedback = authFeedback || (error ? { kind: "error", title: "Algo travou aqui.", message: error } : null);

  const formTitle = useMemo(
    () =>
      isLogin
        ? "Volte exatamente para o ponto onde seu avanço parou."
        : "Comece já com um plano feito para você.",
    [isLogin]
  );

  const helperText = useMemo(
    () =>
      isLogin
        ? "A Yara mantém seu foco vivo, entende seu momento e te coloca de volta no estudo com direção, clareza e continuidade."
        : "A Yara entende sua prova, sua rotina e o jeito que você aprende para te colocar no caminho certo desde o primeiro passo.",
    [isLogin]
  );

  const actionDisabled =
    saving ||
    !email ||
    !password ||
    (!isLogin &&
      (!name.trim() || !passwordConfirm.trim() || password.length < 6 || password !== passwordConfirm));

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
    <div className="aprova-auth-shell" style={{ fontFamily: styles.page.fontFamily }}>
      <div className="aprova-auth-bg" />

      <div className="aprova-auth-grid">
        <section className="aprova-auth-hero">
          <div className="aprova-auth-hero-topbar">
            {onBackToLanding ? (
              <button type="button" onClick={onBackToLanding} className="aprova-auth-back-link">
                ← Voltar ao início
              </button>
            ) : null}
          </div>

          <div className="aprova-brand-row">
            <div className="aprova-brand-badge">A</div>
            <div>
              <div className="aprova-brand-name">Aprova+</div>
              <div className="aprova-brand-sub">IA, questões e direção até a prova</div>
            </div>
          </div>

          <div className="aprova-hero-copy">
            <span className="aprova-kicker">
              <Sparkles size={14} />
              YARA GUIA SEU ESTUDO EM TEMPO REAL
            </span>
            <h1>Passe com uma IA que guia seu estudo de verdade.</h1>
            <p>
              A Yara organiza seu foco, explica do seu jeito, antecipa erros e te conduz com mais
              clareza até a prova.
            </p>
          </div>

          <div className="aprova-trust-line">
            {trustPoints.map((item) => (
              <span key={item} className="aprova-trust-pill">
                {item}
              </span>
            ))}
          </div>

          <div className="aprova-value-grid">
            {benefitCards.map((card) => (
              <article key={card.title} className="aprova-value-card">
                <span className="aprova-card-eyebrow">{card.eyebrow}</span>
                <h3>{card.title}</h3>
                <p>{card.text}</p>
              </article>
            ))}
          </div>

          <div className="aprova-hero-proof">
            <div className="aprova-proof-highlight">
              <strong>A Yara não é só um chat.</strong>
              <span>
                Ela organiza seu foco, antecipa tropeços, ajusta explicações e te conduz com mais
                constância até a prova.
              </span>
            </div>
          </div>
        </section>

        <aside className="aprova-auth-panel">
          <div className="aprova-auth-card">
            <div className="aprova-mode-switch">
              <button className={isLogin ? "active" : ""} onClick={() => setMode("login")} type="button">
                Entrar
              </button>
              <button className={!isLogin ? "active" : ""} onClick={() => setMode("register")} type="button">
                Criar conta
              </button>
            </div>

            <div className="aprova-auth-intro">
              <span className="aprova-auth-badge">
                {isLogin ? "RETOME SUA JORNADA" : "COMEÇO INTELIGENTE COM A YARA"}
              </span>
              <h2>{formTitle}</h2>
              <p>{helperText}</p>
            </div>

            <form
              className="aprova-auth-form-real"
              onSubmit={(event) => {
                event.preventDefault();
                if (!actionDisabled) onSubmit();
              }}
            >
              {!isLogin ? (
                <label className="aprova-auth-field-real">
                  <span>Seu nome</span>
                  <div className="aprova-auth-input-shell">
                    <User size={16} />
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      style={styles.input}
                      placeholder="Como a Yara pode te chamar?"
                      autoComplete="name"
                    />
                  </div>
                </label>
              ) : null}

              <label className="aprova-auth-field-real">
                <span>E-mail</span>
                <div className="aprova-auth-input-shell">
                  <Mail size={16} />
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={styles.input}
                    placeholder="voce@email.com"
                    type="email"
                    autoComplete="email"
                  />
                </div>
              </label>

              <label className="aprova-auth-field-real">
                <span>Senha</span>
                <div className="aprova-auth-input-shell">
                  <Lock size={16} />
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={styles.input}
                    placeholder="Digite sua senha"
                    type="password"
                    autoComplete={!isLogin ? "new-password" : "current-password"}
                  />
                </div>
              </label>

              {!isLogin ? (
                <label className="aprova-auth-field-real">
                  <span>Confirmar senha</span>
                  <div className="aprova-auth-input-shell">
                    <Shield size={16} />
                    <input
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      style={styles.input}
                      placeholder="Repita sua senha"
                      type="password"
                      autoComplete="new-password"
                    />
                  </div>
                </label>
              ) : null}

              {!isLogin ? (
                <div className="aprova-auth-form-note">
                  <strong>Eu vou montar seu começo com você.</strong>
                  <p>
                    Depois da conta criada, a Yara organiza seus primeiros passos em uma conversa
                    curta, humana e já alinhada com a sua prova.
                  </p>
                </div>
              ) : null}

              {feedback ? (
                <div className="aprova-auth-feedback" style={statusTone}>
                  <div className="aprova-auth-feedback-row">
                    <StatusIcon size={18} style={{ marginTop: 1, flexShrink: 0 }} />
                    <div>
                      <p className="aprova-auth-feedback-title">{feedback.title}</p>
                      <p className="aprova-auth-feedback-text">{feedback.message}</p>
                      {feedback.detail ? (
                        <p className="aprova-auth-feedback-detail">Detalhe técnico: {feedback.detail}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              {!feedback && message ? <p style={{ ...styles.successText, marginTop: 0 }}>{message}</p> : null}

              <button className="aprova-auth-cta" disabled={actionDisabled} type="submit">
                <Lock size={16} />
                {saving ? "Abrindo..." : isLogin ? "Retomar meu plano" : "Começar com a Yara"}
                {!saving ? <ArrowRight size={16} /> : null}
              </button>

              <div className="aprova-auth-form-footer">
                <div className="aprova-auth-yara-callout">
                  <span className="aprova-auth-yara-dot" />
                  <div>
                    <strong>Yara ao seu lado desde o começo</strong>
                    <p>
                      {isLogin
                        ? "Seu contexto, seu foco e sua continuidade ficam prontos para voltar com força."
                        : "Seu início já nasce com direção, clareza e um plano que faz sentido para você."}
                    </p>
                  </div>
                </div>

                {isLogin ? (
                  <p className="aprova-auth-smallprint">
                    Se o Supabase pedir confirmação de e-mail, entre depois de validar o link recebido.
                  </p>
                ) : (
                  <p className="aprova-auth-smallprint">
                    Você cria a conta agora e a Yara assume a partir daí com um começo guiado.
                  </p>
                )}
              </div>
            </form>
          </div>
        </aside>
      </div>
    </div>
  );
}

export const AuthScreen = memo(AuthScreenComponent);
