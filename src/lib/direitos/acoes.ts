"use client";

import { novoId } from "@/lib/dados/colecao";
import { rightsFavoritos } from "@/lib/dados/colecoes";
import { meuId } from "@/lib/familia/useFamilia";
import { atualizarPerfil, perfilAtual } from "@/lib/perfil";

/** Favoritos valem sem rede (fila offline). Devolve o estado novo. */
export function alternarFavoritoDireito(cardId: string): boolean {
  const atual = rightsFavoritos.listar().find((f) => f.card_id === cardId);
  if (atual) {
    rightsFavoritos.apagar(atual.id);
    return false;
  }
  const antigo = rightsFavoritos.listarTodos().find((f) => f.card_id === cardId);
  // `criado_em` local guarda quando ela favoritou (o selo "Atualizado" compara com a mudança do texto).
  rightsFavoritos.salvar({ id: antigo?.id ?? novoId(), card_id: cardId, criado_em: new Date().toISOString(), criado_por: meuId(), apagado_em: null });
  return true;
}

/** RN-03: dispensar da home (vai no perfil, que sincroniza). */
export function dispensarDaHome(slug: string): void {
  const p = perfilAtual();
  if (!p) return;
  const atuais = p.prefs?.rights_dismissed ?? [];
  if (!atuais.includes(slug)) atualizarPerfil({ prefs: { ...p.prefs, rights_dismissed: [...atuais, slug] } });
}
