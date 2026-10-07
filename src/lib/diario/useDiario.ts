"use client";

import { useColecao } from "@/lib/dados/colecao";
import { diaryEntries, diaryMilestoneStates } from "@/lib/dados/colecoes";
import { useFamilia } from "@/lib/familia/useFamilia";
import { useFuso } from "@/lib/hooks/useFuso";
import { usePerfil } from "@/lib/perfil";
import { prefsCompletas } from "@dominio/prefs.ts";
import { dataNoFuso, idadeGestacional } from "@dominio/tempo.ts";

import { situacoes } from "./regras";

/** Tudo que as telas do diário precisam: entradas, quem sou, semana atual, modo fé e a situação dos marcos. */
export function useDiario() {
  const entradas = useColecao(diaryEntries);
  const estados = useColecao(diaryMilestoneStates);
  const perfil = usePerfil();
  // Funcionalidade 12 RN-06: o diário usa a lista com quem saiu, para o "Escrito por {nome}".
  const { meuId, papel, comQuemSaiu: membros, permissoes } = useFamilia();
  const tz = useFuso();
  const agora = new Date();
  const hoje = dataNoFuso(agora, tz);
  const semanaAtual = perfil?.dpp ? idadeGestacional(perfil.dpp, hoje).semana : 0;
  return {
    entradas,
    estados,
    perfil,
    eu: meuId,
    papel,
    membros,
    permissoes,
    tz,
    hoje,
    agora,
    semanaAtual,
    modoFe: prefsCompletas(perfil?.prefs).faith_mode,
    situacao: situacoes(entradas, estados, meuId),
  };
}
