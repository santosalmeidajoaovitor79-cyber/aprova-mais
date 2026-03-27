import { useEffect, useRef, useState } from "react";

const BASE_GAP_MS = 520;
const JITTER_MS = 200;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function countUserMessages(messages) {
  if (!Array.isArray(messages)) return 0;
  return messages.filter((m) => m?.role === "user").length;
}

/**
 * Revela trechos da explicação inicial com pequenas pausas; o usuário pode enviar mensagem e ver o restante de uma vez.
 * @param {{
 *   topicId?: string | null,
 *   parts: { id: string }[],
 *   explanationLoading: boolean,
 *   partsSignature: string,
 *   topicChatMessages: Array<{ role?: string }>,
 * }} opts
 */
export function useProgressiveExplanationReveal({
  topicId,
  parts,
  explanationLoading,
  partsSignature,
  topicChatMessages,
}) {
  const [visibleCount, setVisibleCount] = useState(0);
  const timersRef = useRef([]);
  const baselineUserRef = useRef(0);
  const lastScheduleSigRef = useRef("");

  const clearTimers = () => {
    timersRef.current.forEach((id) => clearTimeout(id));
    timersRef.current = [];
  };

  useEffect(() => {
    clearTimers();
    setVisibleCount(0);
    baselineUserRef.current = countUserMessages(topicChatMessages);
    lastScheduleSigRef.current = "";
  }, [topicId]);

  useEffect(() => {
    const n = countUserMessages(topicChatMessages);
    if (n > baselineUserRef.current && parts.length > 0) {
      baselineUserRef.current = n;
      clearTimers();
      setVisibleCount(parts.length);
    }
  }, [topicChatMessages, parts.length]);

  useEffect(() => {
    if (explanationLoading) {
      clearTimers();
      setVisibleCount(0);
      lastScheduleSigRef.current = "";
      return;
    }

    if (!parts.length) {
      clearTimers();
      setVisibleCount(0);
      return;
    }

    const scheduleKey = `${topicId ?? ""}|${partsSignature}`;
    if (scheduleKey === lastScheduleSigRef.current) return;
    lastScheduleSigRef.current = scheduleKey;

    baselineUserRef.current = countUserMessages(topicChatMessages);
    clearTimers();

    if (prefersReducedMotion()) {
      setVisibleCount(parts.length);
      return;
    }

    setVisibleCount(0);
    let delayAcc = 0;
    parts.forEach((_, i) => {
      const id = window.setTimeout(() => {
        setVisibleCount((c) => Math.max(c, i + 1));
      }, delayAcc);
      timersRef.current.push(id);
      delayAcc += BASE_GAP_MS + Math.floor(Math.random() * JITTER_MS);
    });

    return clearTimers;
  }, [explanationLoading, parts.length, partsSignature, topicId]);

  return { visibleCount };
}
