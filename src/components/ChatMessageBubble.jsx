import { memo } from "react";
import { Sparkles, User } from "lucide-react";

/** Assistente do Aprova+ — identidade fixa do chat. */
export const YARA_NAME = "Yara";
export const YARA_ROLE_LABEL = "IA do Aprova+";

function getInitials(name = "") {
  const s = name.trim();
  if (!s || s === "Você") return "V";
  return (
    s
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "V"
  );
}

function ChatMessageBubbleComponent({ role, content, timestamp, userName = "Você", bubbleChildren }) {
  const isAssistant = role === "assistant";
  const displayName = isAssistant ? YARA_NAME : (userName?.trim() || "Você");
  const metaLabel = isAssistant ? YARA_ROLE_LABEL : "Você";
  const userInitials = getInitials(displayName);
  const rich = bubbleChildren != null;

  return (
    <div
      className={`aprova-chat-row aprova-chat-row-enter ${isAssistant ? "aprova-chat-row-assistant" : "aprova-chat-row-user"}${rich ? " aprova-chat-row--rich" : ""}`}
    >
      {isAssistant ? (
        <div className="aprova-chat-avatar aprova-chat-avatar-yara" aria-hidden="true">
          <Sparkles size={18} strokeWidth={2.2} />
        </div>
      ) : null}

      <div className="aprova-chat-bubble-wrap">
        <div className="aprova-chat-meta">
          <strong className="aprova-chat-name">{displayName}</strong>
          <span className="aprova-chat-role">{metaLabel}</span>
        </div>

        <div
          className={`aprova-chat-bubble ${isAssistant ? "aprova-chat-bubble-assistant" : "aprova-chat-bubble-user"}${rich ? " aprova-chat-bubble--rich-body" : ""}`}
        >
          {rich ? bubbleChildren : <p className="aprova-chat-text">{content}</p>}
        </div>

        {timestamp ? <div className="aprova-chat-time">{timestamp}</div> : null}
      </div>

      {!isAssistant ? (
        <div className="aprova-chat-avatar aprova-chat-avatar-user" aria-hidden="true" title={displayName}>
          {displayName === "Você" || userInitials === "V" ? (
            <User size={17} strokeWidth={2.2} />
          ) : (
            <span className="aprova-chat-avatar-initials">{userInitials}</span>
          )}
        </div>
      ) : null}
    </div>
  );
}

export const ChatMessageBubble = memo(ChatMessageBubbleComponent);
