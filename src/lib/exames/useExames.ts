"use client";

import { meuId } from "@/lib/familia/useFamilia";
import { useFuso } from "@/lib/hooks/useFuso";
import { usePerfil } from "@/lib/perfil";
import { dataNoFuso } from "@dominio/tempo.ts";

import type { ContextoExames } from "./acoes";

/** Contexto da gestação para gerar e recalcular exames; null fora da gestação ou sem DPP. */
export function useContextoExames(): ContextoExames | null {
  const perfil = usePerfil();
  const tz = useFuso();
  if (!perfil?.dpp || perfil.modo !== "gestacao") return null;
  return { dpp: perfil.dpp, criadaEm: dataNoFuso(new Date(perfil.onboardingConcluidoEm), tz), semente: meuId(), tz };
}
