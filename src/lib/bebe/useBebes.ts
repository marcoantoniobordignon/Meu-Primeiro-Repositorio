"use client";

import { useEffect } from "react";

import { novoId, useColecao } from "@/lib/dados/colecao";
import { bebes as colecao, type Bebe } from "@/lib/dados/colecoes";
import { atualizarPerfil, usePerfil } from "@/lib/perfil";

/**
 * Bebês da família e o bebê ativo (BEB-11). Modo derivado (ARQ-07): 'bebe' se
 * existe ao menos um bebê nascido. Quem entrou pelo onboarding "já com o bebê"
 * ganha o registro do bebê aqui, uma vez.
 */
export function useBebes() {
  const perfil = usePerfil();
  const lista = useColecao(colecao);
  const ordenados = [...lista].sort((a, b) => a.ordem - b.ordem);

  useEffect(() => {
    if (perfil?.modo === "bebe" && perfil.nascidoEm && lista.length === 0) {
      colecao.salvar({
        id: novoId(),
        nome: "Bebê",
        nascido_em: new Date(`${perfil.nascidoEm}T12:00:00`).toISOString(),
        prematuro_semanas: null,
        ordem: 0,
        aviso_soneca: false,
        registrado_em: perfil.onboardingConcluidoEm,
      });
    }
  }, [perfil?.modo, perfil?.nascidoEm, perfil?.onboardingConcluidoEm, lista.length]);

  const ativo = ordenados.find((b) => b.id === perfil?.bebeAtivoId) ?? ordenados[0];
  const modo: "gestacao" | "bebe" = ordenados.length > 0 ? "bebe" : "gestacao";

  return {
    bebes: ordenados,
    ativo,
    modo,
    selecionar(id: string) {
      atualizarPerfil({ bebeAtivoId: id });
    },
  };
}

export type { Bebe };
