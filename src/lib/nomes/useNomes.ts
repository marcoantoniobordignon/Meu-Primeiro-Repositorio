"use client";

import { useColecao } from "@/lib/dados/colecao";
import { nameMatches, nameVotes } from "@/lib/dados/colecoes";
import { useFamilia } from "@/lib/familia/useFamilia";
import { chaveDoVoto, ranking } from "@dominio/nomes.ts";

/** Votos deste aparelho (só os meus: RN-06), matches do casal e se há parceiro ativo. Não carrega o catálogo. */
export function useNomes() {
  const { meuId, membros, papel } = useFamilia();
  const todos = useColecao(nameVotes);
  const votos = todos.filter((v) => !v.criado_por || v.criado_por === meuId);
  const matches = useColecao(nameMatches).sort((a, b) => b.criado_em.localeCompare(a.criado_em));
  const temParceiro = membros.some((m) => m.papel === "parceiro" && !m.apagado_em);
  const porChave = new Map(votos.map((v) => [chaveDoVoto(v), v]));
  return {
    meuId,
    papel,
    votos,
    porChave,
    curtidos: votos.filter((v) => v.vote === "like"),
    descartados: votos.filter((v) => v.vote === "dislike"),
    top: ranking(votos),
    matches,
    chavesDeMatch: new Set(matches.map((m) => m.chave)),
    temParceiro,
  };
}
