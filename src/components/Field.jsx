import { createElement, memo } from "react";
import { styles } from "../styles/appStyles.js";

function FieldComponent({ label, icon: IconComponent, children }) {
  return (
    <label style={styles.labelBlock}>
      <span style={styles.labelText}>{label}</span>
      <div style={styles.fieldBox}>
        {createElement(IconComponent, { size: 16, color: "#9ca3af" })}
        <div style={{ width: "100%" }}>{children}</div>
      </div>
    </label>
  );
}

export const Field = memo(FieldComponent);
