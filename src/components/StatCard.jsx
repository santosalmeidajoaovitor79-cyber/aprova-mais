import { createElement, memo } from "react";
import { styles } from "../styles/appStyles.js";

function StatCardComponent({ icon: IconComponent, title, value, helper }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statTop}>
        <p style={styles.statLabel}>{title}</p>
        <div style={styles.iconBox}>{createElement(IconComponent, { size: 18 })}</div>
      </div>
      <p style={styles.statValue}>{value}</p>
      <p style={styles.statHelper}>{helper}</p>
    </div>
  );
}

export const StatCard = memo(StatCardComponent);
