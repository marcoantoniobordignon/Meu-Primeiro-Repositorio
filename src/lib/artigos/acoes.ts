"use client";

import { articleReads } from "@/lib/dados/colecoes";
import { meuId } from "@/lib/familia/useFamilia";
import { idDaLeitura } from "@dominio/trimestre.ts";

import { leiturasPorArtigo } from "./useArtigos";

function leituraDe(artigoId: string) {
  return leiturasPorArtigo(articleReads.listar()).get(artigoId);
}

/** Primeira abertura: guarda `first_opened_at` (vale sem rede: vai pela fila). */
export function registrarAbertura(artigoId: string): void {
  if (leituraDe(artigoId)) return;
  articleReads.salvar({ id: idDaLeitura(meuId(), artigoId), article_id: artigoId, first_opened_at: new Date().toISOString(), read_at: null, is_favorite: false, criado_por: meuId(), apagado_em: null });
}

/** RN-04: marca `read_at` uma vez; devolve true só na primeira. */
export function marcarLido(artigoId: string): boolean {
  const l = leituraDe(artigoId);
  if (l?.read_at) return false;
  const agora = new Date().toISOString();
  articleReads.salvar({ id: l?.id ?? idDaLeitura(meuId(), artigoId), article_id: artigoId, first_opened_at: l?.first_opened_at ?? agora, read_at: agora, is_favorite: l?.is_favorite ?? false, criado_por: meuId(), apagado_em: null });
  return true;
}

/** Favoritos valem sem rede. Devolve o estado novo. */
export function alternarFavoritoArtigo(artigoId: string): boolean {
  const l = leituraDe(artigoId);
  const novo = !l?.is_favorite;
  const agora = new Date().toISOString();
  articleReads.salvar({ id: l?.id ?? idDaLeitura(meuId(), artigoId), article_id: artigoId, first_opened_at: l?.first_opened_at ?? agora, read_at: l?.read_at ?? null, is_favorite: novo, criado_por: meuId(), apagado_em: null });
  return novo;
}
