import { useEffect, useState } from "react";

/**
 * Parallax suave compartilhado: um único listener + um RAF para todo o app
 * (vários componentes podem chamar o hook sem multiplicar custo).
 */
let targetX = 0;
let targetY = 0;
let smoothX = 0;
let smoothY = 0;
let rafId = null;
let listening = false;
const subscribers = new Set();

function notify() {
  const p = { x: smoothX, y: smoothY };
  subscribers.forEach((set) => set(p));
}

function tick() {
  if (subscribers.size === 0) {
    rafId = null;
    return;
  }
  smoothX += (targetX - smoothX) * 0.08;
  smoothY += (targetY - smoothY) * 0.08;
  notify();
  rafId = window.requestAnimationFrame(tick);
}

function onMove(event) {
  const w = window.innerWidth || 1;
  const h = window.innerHeight || 1;
  targetX = event.clientX / w - 0.5;
  targetY = event.clientY / h - 0.5;
}

function ensureLoop() {
  if (rafId == null) {
    rafId = window.requestAnimationFrame(tick);
  }
  if (!listening) {
    window.addEventListener("mousemove", onMove, { passive: true });
    listening = true;
  }
}

function stopIfIdle() {
  if (subscribers.size > 0) return;
  if (rafId != null) {
    window.cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (listening) {
    window.removeEventListener("mousemove", onMove);
    listening = false;
  }
}

export function useMouseParallax() {
  const [smooth, setSmooth] = useState(() => ({ x: smoothX, y: smoothY }));

  useEffect(() => {
    subscribers.add(setSmooth);
    ensureLoop();
    return () => {
      subscribers.delete(setSmooth);
      stopIfIdle();
    };
  }, []);

  return smooth;
}
