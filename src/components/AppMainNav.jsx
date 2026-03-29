import { memo } from "react";
import { BookOpen, LayoutDashboard, Shield, UserRound } from "lucide-react";

function AppMainNavComponent({ activeTab, onTabChange, isAdmin = false, onOpenAdmin }) {
  return (
    <nav className="aprova-nav-pills aprova-main-nav-track" aria-label="Navegação principal">
      <button
        type="button"
        onClick={() => onTabChange("dashboard")}
        className={`aprova-nav-pill aprova-main-nav-pill${activeTab === "dashboard" ? " is-active" : ""}`}
      >
        <LayoutDashboard size={18} strokeWidth={2.2} aria-hidden />
        Painel
      </button>
      <button
        type="button"
        onClick={() => onTabChange("study")}
        className={`aprova-nav-pill aprova-main-nav-pill${activeTab === "study" ? " is-active" : ""}`}
      >
        <BookOpen size={18} strokeWidth={2.2} aria-hidden />
        Estudo
      </button>
      <button
        type="button"
        onClick={() => onTabChange("profile")}
        className={`aprova-nav-pill aprova-main-nav-pill${activeTab === "profile" ? " is-active" : ""}`}
      >
        <UserRound size={18} strokeWidth={2.2} aria-hidden />
        Perfil
      </button>
      {isAdmin ? (
        <button type="button" onClick={onOpenAdmin} className="aprova-nav-pill aprova-main-nav-pill">
          <Shield size={18} strokeWidth={2.2} aria-hidden />
          Admin
        </button>
      ) : null}
    </nav>
  );
}

export const AppMainNav = memo(AppMainNavComponent);
