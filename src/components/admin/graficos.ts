"use client";

import { useEffect, useState, type RefObject } from "react";

/** Cores de série: sempre um token do design system, nunca hex. */
export type CorSerie = "primaria" | "acento" | "sono" | "mamada" | "fralda" | "banho";

export const varDaCor: Record<CorSerie, string> = {
  primaria: "var(--cor-primaria)",
  acento: "var(--cor-acento)",
  sono: "var(--reg-sono)",
  mamada: "var(--reg-mamada)",
  fralda: "var(--reg-fralda)",
  banho: "var(--reg-banho)",
};

export const classeDaCor: Record<CorSerie, string> = {
  primaria: "bg-primaria",
  acento: "bg-acento",
  sono: "bg-sono",
  mamada: "bg-mamada",
  fralda: "bg-fralda",
  banho: "bg-banho",
};

/** Largura do contêiner, para o SVG ter pixels de verdade (texto sem distorção). */
export function useLargura(ref: RefObject<HTMLElement | null>, inicial = 600): number {
  const [largura, setLargura] = useState(inicial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setLargura(Math.max(120, Math.floor(el.getBoundingClientRect().width)));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return largura;
}
