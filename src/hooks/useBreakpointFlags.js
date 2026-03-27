import { useMediaQuery } from "./useMediaQuery.js";

/** Faixas: mobile ≤899 · notebook/tablet largo 900–1279 · desktop XL ≥1280 */
export function useBreakpointFlags() {
  const isDesktopXL = useMediaQuery("(min-width: 1280px)");
  const isDesktop = useMediaQuery("(min-width: 900px)");
  const isNotebook = isDesktop && !isDesktopXL;
  const isMobile = !isDesktop;

  return { isDesktopXL, isDesktop, isNotebook, isMobile };
}

/** Uso pontual (ex.: efeito sem hook) */
export function matchStudySplitXL() {
  return typeof window !== "undefined" && window.matchMedia("(min-width: 1280px)").matches;
}
