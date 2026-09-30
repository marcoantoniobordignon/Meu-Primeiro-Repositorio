"use client";

import { useCallback, useState } from "react";

import { dataDoRegistro, type DataISO } from "@/lib/dates";

const CHAVE = "ninho.madrugada-decidida";

/**
 * SIN-05: entre 0h e 4h, o primeiro registro pergunta "ainda é ontem?".
 * A resposta vale para a sessão (sessionStorage).
 */
export function useDiaDoRegistro() {
  const [pendente, setPendente] = useState<((data: DataISO) => void) | null>(null);

  const decidir = useCallback((continuar: (data: DataISO) => void) => {
    const { hoje, ontem, madrugada } = dataDoRegistro();
    if (!madrugada) return continuar(hoje);
    let decidida: string | null = null;
    try {
      decidida = sessionStorage.getItem(CHAVE);
    } catch {
      /* sem storage */
    }
    if (decidida === "hoje") return continuar(hoje);
    if (decidida === "ontem") return continuar(ontem);
    setPendente(() => continuar);
  }, []);

  const responder = useCallback(
    (escolha: "hoje" | "ontem") => {
      const { hoje, ontem } = dataDoRegistro();
      try {
        sessionStorage.setItem(CHAVE, escolha);
      } catch {
        /* sem storage */
      }
      const cb = pendente;
      setPendente(null);
      cb?.(escolha === "hoje" ? hoje : ontem);
    },
    [pendente],
  );

  return { decidir, perguntando: pendente !== null, responder, cancelar: () => setPendente(null) };
}
