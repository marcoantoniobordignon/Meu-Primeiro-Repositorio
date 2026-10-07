"use client";

import { novoId } from "@/lib/dados/colecao";
import { birthChecklistItems, faithFavoritos } from "@/lib/dados/colecoes";
import { meuId } from "@/lib/familia/useFamilia";
import { atualizarPerfil, perfilAtual } from "@/lib/perfil";
import { itensDoBatismo } from "@dominio/fe.ts";

import { contarAnonimo } from "./contadores";

/** RN-02: liga e desliga sem apagar nada (favoritos, entradas e a lista do batismo ficam). */
export function definirModoFe(ligado: boolean): void {
  const p = perfilAtual();
  if (!p) return;
  if (Boolean(p.prefs?.faith_mode) === ligado) return;
  atualizarPerfil({ prefs: { ...p.prefs, faith_mode: ligado } });
  contarAnonimo(ligado ? "faith_on" : "faith_off");
}

export function definirOracaoNoPush(ligado: boolean): void {
  const p = perfilAtual();
  if (p) atualizarPerfil({ prefs: { ...p.prefs, faith_weekly_push: ligado } });
}

/** Favoritos valem sem rede (fila offline) e sobrevivem a desligar o modo. Devolve o estado novo. */
export function alternarFavoritoOracao(prayerId: string): boolean {
  const atual = faithFavoritos.listar().find((f) => f.prayer_id === prayerId);
  if (atual) {
    faithFavoritos.apagar(atual.id);
    return false;
  }
  const antigo = faithFavoritos.listarTodos().find((f) => f.prayer_id === prayerId);
  faithFavoritos.salvar({ id: antigo?.id ?? novoId(), prayer_id: prayerId, criado_por: meuId(), apagado_em: null });
  return true;
}

/**
 * RN-07: os 6 itens do batismo (lista `baptism` do plano de parto). Ids determinísticos pela gestante:
 * registrar o nascimento de novo, ou em outro aparelho, não duplica; item apagado não volta.
 */
export function garantirBatismo(semente: string = meuId()): number {
  const existentes = new Set(birthChecklistItems.listarTodos().map((i) => i.id));
  let criados = 0;
  for (const item of itensDoBatismo(semente)) {
    if (existentes.has(item.id)) continue;
    birthChecklistItems.salvar({ ...item, criado_por: meuId(), apagado_em: null });
    criados++;
  }
  return criados;
}
