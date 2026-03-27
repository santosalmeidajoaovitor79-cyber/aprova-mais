import { memo } from "react";
import { LogOut } from "lucide-react";
import { styles } from "../styles/appStyles.js";

function DashboardHeaderComponent({ onLogout, children, studyFocusMode, onExitStudyFocus }) {
  return (
    <header className="aprova-topbar aprova-app-header">
      <div className="aprova-topbar-inner">
        <div className="aprova-topbar-brand">
          <div className="aprova-topbar-logo" aria-hidden="true">
            A
          </div>
          <div className="aprova-topbar-brand-copy">
            <strong>Aprova+</strong>
            {!studyFocusMode ? <span>IA, questões e progresso até a prova</span> : null}
          </div>
        </div>

        <div className="aprova-topbar-nav">
          {studyFocusMode ? (
            <div className="aprova-topbar-focus-strip" style={styles.studyFocusHeaderBar}>
              <span style={styles.studyFocusHeaderLabel}>
                <span style={styles.studyFocusLiveDot} aria-hidden />
                ⚡ Modo foco ativado
              </span>
            </div>
          ) : (
            children
          )}
        </div>

        <div className="aprova-topbar-actions">
          {studyFocusMode ? (
            <button
              type="button"
              onClick={onExitStudyFocus}
              className="aprova-btn-interactive"
              style={styles.studyFocusExitButton}
            >
              Sair do foco
            </button>
          ) : null}
          <button
            type="button"
            onClick={onLogout}
            className="aprova-btn-interactive aprova-topbar-logout"
            style={styles.logoutButton}
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}

export const DashboardHeader = memo(DashboardHeaderComponent);
