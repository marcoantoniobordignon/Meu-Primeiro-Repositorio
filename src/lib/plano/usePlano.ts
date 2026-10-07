"use client";

import { useEffect } from "react";

import { track } from "@/lib/analytics";
import { useColecao } from "@/lib/dados/colecao";
import { birthChecklistItems, birthItemAttachments, birthPlans } from "@/lib/dados/colecoes";
import { useFamilia } from "@/lib/familia/useFamilia";
import { useFuso } from "@/lib/hooks/useFuso";
import { usePerfil } from "@/lib/perfil";
import { dataNoFuso, idadeGestacional } from "@dominio/tempo.ts";

import { garantirPlano } from "./acoes";

/** Plano, listas e anexos do aparelho (leitura total offline, RN-12); a gestante cria o plano ao abrir. */
export function usePlano() {
  const perfil = usePerfil();
  const { papel, permissoes, meuId, membros } = useFamilia();
  const tz = useFuso();
  const planos = useColecao(birthPlans);
  const itens = useColecao(birthChecklistItems);
  const anexos = useColecao(birthItemAttachments);
  const ehMae = papel === "mae";
  const semente = membros.find((m) => m.papel === "mae")?.profile_id ?? meuId;

  useEffect(() => {
    if (!ehMae || !perfil) return;
    if (garantirPlano(semente, meuId).criado) track("bp_started", {});
  }, [ehMae, perfil, semente, meuId]);

  const hoje = dataNoFuso(new Date(), tz);
  const semana = perfil?.dpp ? idadeGestacional(perfil.dpp, hoje).semana : null;
  return {
    perfil,
    plano: planos[0] ?? null,
    itens,
    anexos,
    tz,
    hoje,
    semana,
    meuId,
    papel,
    ver: permissoes.verPlanoParto,
    editar: permissoes.editarPlanoParto,
  };
}
