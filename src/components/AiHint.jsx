import { memo } from "react";

/** Frase curta de orientação IA (tom premium lilás). */
function AiHintComponent({ children, className = "" }) {
  if (children == null || children === "") return null;
  return <p className={`aprova-ai-hint${className ? ` ${className}` : ""}`}>{children}</p>;
}

export const AiHint = memo(AiHintComponent);
