"use client";

import { useEffect } from "react";

import { useAgora } from "@/lib/hooks/useAgora";
import { useFuso } from "@/lib/hooks/useFuso";
import type { Perfil } from "@/lib/perfil";
import { dataNoFuso, idadeGestacional } from "@dominio/tempo.ts";
import { trimestreDaSemana } from "@dominio/trimestre.ts";

/**
 * RN-01/07: `data-trimestre` no <html> troca as cores do anel (tokens.css). Confere a cada minuto, então
 * vira à meia-noite local sem recarregar; a transição de 400 ms fica nos próprios tokens. Fora da gestação, some.
 */
export function useTemaDoTrimestre(perfil: Perfil | null | undefined) {
  const tz = useFuso();
  const agora = useAgora(60_000);
  const dpp = perfil?.modo === "gestacao" ? perfil.dpp : undefined;
  const tri = dpp ? trimestreDaSemana(idadeGestacional(dpp, dataNoFuso(agora, tz)).semana) : null;
  useEffect(() => {
    const raiz = document.documentElement;
    if (tri) raiz.dataset.trimestre = String(tri);
    else delete raiz.dataset.trimestre;
  }, [tri]);
  return tri;
}
