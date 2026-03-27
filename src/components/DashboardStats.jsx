import { memo } from "react";
import { Brain, CalendarDays, CheckCircle2, Target } from "lucide-react";
import { StatCard } from "./StatCard.jsx";
import { styles } from "../styles/appStyles.js";

function DashboardStatsComponent({ completedCount, visibleCompletedCount, filteredTasksLength }) {
  return (
    <section style={styles.statsGrid}>
      <StatCard icon={CalendarDays} title="Dias seguidos" value="7" helper="Boa consistência" />
      <StatCard
        icon={CheckCircle2}
        title="Tarefas concluídas"
        value={String(completedCount)}
        helper="Total concluído no painel"
      />
      <StatCard icon={Brain} title="Aproveitamento" value="82%" helper="Baseado nas questões" />
      <StatCard
        icon={Target}
        title="Meta semanal"
        value={`${visibleCompletedCount}/${filteredTasksLength || 0}`}
        helper="Do filtro atual"
      />
    </section>
  );
}

export const DashboardStats = memo(DashboardStatsComponent);
