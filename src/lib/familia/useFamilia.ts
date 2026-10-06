"use client";

import { useEffect } from "react";

import { novoId, useColecao } from "@/lib/dados/colecao";
import { membros as colecao, type Papel } from "@/lib/dados/colecoes";
import { usePerfil } from "@/lib/perfil";
import { sessaoAtual } from "@/lib/sessao";

import { permissoes } from "./regras";

export function meuId(): string {
  return sessaoAtual()?.uid ?? "local";
}

/** Membros da família, quem sou eu e o que posso fazer (spec 12). */
export function useFamilia() {
  const perfil = usePerfil();
  const lista = useColecao(colecao);
  const id = meuId();
  const eu = lista.find((m) => m.profile_id === id);
  const papel: Papel = eu?.papel ?? perfil?.papel ?? "mae";

  // Quem passou pelo onboarding é a dona da família até ser convidada para outra.
  useEffect(() => {
    if (perfil && !eu) {
      colecao.salvar({ id: novoId(), profile_id: id, nome: perfil.nome ?? "Você", papel: perfil.papel ?? "mae", ultimo_acesso_em: new Date().toISOString() });
    }
  }, [perfil, eu, id]);

  return { membros: lista, meuId: id, papel, permissoes: permissoes(papel, eu?.permissoes) };
}
