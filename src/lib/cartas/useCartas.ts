"use client";

import { useColecao } from "@/lib/dados/colecao";
import { bebes, cartas } from "@/lib/dados/colecoes";
import { useFamilia } from "@/lib/familia/useFamilia";
import { temPlano, usePerfil } from "@/lib/perfil";
import { referenciaDasCartas } from "@dominio/cartas.ts";

/** As minhas cartas (RN-09), o plano, o nome de quem vai ler e a referência das datas (nascimento ou DPP). */
export function useCartas() {
  const perfil = usePerfil();
  const { meuId } = useFamilia();
  const todas = useColecao(cartas).filter((c) => !c.criado_por || c.criado_por === meuId);
  const listaBebes = useColecao(bebes);
  const nascimento = perfil?.nascidoEm ?? (listaBebes.map((b) => b.nascido_em.slice(0, 10)).sort()[0] || null);
  return {
    perfil,
    cartas: todas,
    rascunhos: todas.filter((c) => c.status === "draft"),
    lacradas: todas.filter((c) => c.status === "sealed").sort((a, b) => (a.open_on ?? "").localeCompare(b.open_on ?? "")),
    abertas: todas.filter((c) => c.status === "opened"),
    premium: temPlano(perfil),
    nomeDoBebe: perfil?.nomeDoBebe ?? listaBebes[0]?.nome ?? null,
    nascido: Boolean(nascimento),
    referencia: referenciaDasCartas(nascimento, perfil?.dpp),
  };
}
