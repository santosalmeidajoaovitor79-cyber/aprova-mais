import { memo } from "react";
import { styles } from "../styles/appStyles.js";

function LoadingScreenComponent({ embedded = false }) {
  const box = (
    <div className="aprova-loading-pulse" style={styles.loadingBox}>
      Carregando…
    </div>
  );

  if (embedded) {
    return box;
  }

  return <div style={styles.centerScreen}>{box}</div>;
}

export const LoadingScreen = memo(LoadingScreenComponent);
