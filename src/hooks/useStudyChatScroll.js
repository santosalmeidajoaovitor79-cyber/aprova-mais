import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const NEAR_BOTTOM_PX = 100;

function isNearBottom(el) {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX;
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Scroll inteligente estilo chat: cola no fim quando o usuário envia/recebe mensagens;
 * ao trocar de tópico, começa no topo (leitura da explicação inicial no fluxo unificado).
 * @param {{
 *   scrollRef: React.RefObject<HTMLElement | null>,
 *   topicId?: string | null,
 *   messages: Array<{ role?: string, content?: string }>,
 *   chatSending: boolean,
 *   chatHistoryClearing: boolean,
 *   threadPrefaceActive?: boolean,
 *   progressiveAssistTicks?: number,
 *   explanationLoading?: boolean,
 * }} opts
 */
export function useStudyChatScroll({
  scrollRef,
  topicId,
  messages,
  chatSending,
  chatHistoryClearing,
  threadPrefaceActive = false,
  progressiveAssistTicks = 0,
  explanationLoading = false,
}) {
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const stickToBottomRef = useRef(true);
  const prevTopicIdRef = useRef(undefined);
  const prevMessagesSigRef = useRef("");
  const prevMessageLengthRef = useRef(0);
  const prevProgRef = useRef(0);
  const scrollRafRef = useRef(null);

  const scrollToBottomInstant = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    stickToBottomRef.current = true;
    setShowJumpToBottom(false);
  }, [scrollRef]);

  const scrollToBottomSmooth = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottomRef.current = true;
    setShowJumpToBottom(false);
    if (prefersReducedMotion()) {
      el.scrollTop = el.scrollHeight;
      return;
    }
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [scrollRef]);

  useEffect(() => {
    if (chatSending) stickToBottomRef.current = true;
  }, [chatSending]);

  const hasThreadBody = messages.length > 0 || threadPrefaceActive;

  const onScrollContainerScroll = useCallback(() => {
    if (scrollRafRef.current != null) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const el = scrollRef.current;
      if (!el) return;
      const near = isNearBottom(el);
      stickToBottomRef.current = near;
      setShowJumpToBottom(!near && hasThreadBody);
    });
  }, [scrollRef, hasThreadBody]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || chatHistoryClearing) return;

    const tid = topicId ?? "";

    if (prevTopicIdRef.current !== tid) {
      prevTopicIdRef.current = tid;
      prevMessagesSigRef.current = "";
      prevMessageLengthRef.current = 0;
      prevProgRef.current = 0;
      stickToBottomRef.current = false;
      el.scrollTop = 0;
      setShowJumpToBottom(false);
      return;
    }

    if (explanationLoading) {
      prevProgRef.current = 0;
    }

    const tick = progressiveAssistTicks ?? 0;
    if (!explanationLoading && tick > prevProgRef.current && threadPrefaceActive) {
      prevProgRef.current = tick;
      stickToBottomRef.current = true;
      el.scrollTop = el.scrollHeight;
      setShowJumpToBottom(false);
      return;
    }

    if (messages.length === 0) {
      prevMessagesSigRef.current = "";
      prevMessageLengthRef.current = 0;
      if (!threadPrefaceActive) {
        setShowJumpToBottom(false);
      }
      return;
    }

    const len = messages.length;
    const prevLen = prevMessageLengthRef.current;
    if (len > prevLen && messages[len - 1]?.role === "user") {
      stickToBottomRef.current = true;
    }
    prevMessageLengthRef.current = len;

    const last = messages[len - 1];
    const sig = `${tid}:${len}:${last?.role}:${(last?.content || "").length}`;

    if (sig === prevMessagesSigRef.current) return;
    prevMessagesSigRef.current = sig;

    if (stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
      setShowJumpToBottom(false);
    }
  }, [
    scrollRef,
    topicId,
    messages,
    chatHistoryClearing,
    threadPrefaceActive,
    progressiveAssistTicks,
    explanationLoading,
  ]);

  return {
    onScrollContainerScroll,
    showJumpToBottom,
    scrollToBottomSmooth,
    scrollToBottomInstant,
  };
}
