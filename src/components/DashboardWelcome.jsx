import { memo } from "react";
import { styles } from "../styles/appStyles.js";

function DashboardWelcomeComponent({ displayName, goal, hours, examCountdownText }) {
  return (
    <section style={styles.welcomeCard}>
      <p style={styles.welcomeMini}>Bem-vindo de volta</p>
      <h2 style={styles.welcomeTitle}>
        {displayName}, seu foco atual é {goal}.
      </h2>
      {examCountdownText ? (
        <p
          style={{
            ...styles.welcomeText,
            marginTop: 16,
            padding: "12px 16px",
            borderRadius: 16,
            background: "rgba(59,130,246,0.12)",
            border: "1px solid rgba(59,130,246,0.3)",
            color: "#bfdbfe",
            fontWeight: 600,
          }}
        >
          {examCountdownText}
        </p>
      ) : null}
      <p style={styles.welcomeText}>
        Com {hours} hora{hours === "1" ? "" : "s"} por dia, seu painel foi organizado para manter constância,
        revisão e prática sem confundir você durante o estudo.
      </p>
    </section>
  );
}

export const DashboardWelcome = memo(DashboardWelcomeComponent);
