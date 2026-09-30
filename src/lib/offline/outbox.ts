import type { NomeTabela } from "@/lib/supabase/types.generated";

import { idbApagar, idbSalvar, idbTodos, STORE_OUTBOX } from "./idb";

/**
 * Outbox (ARQ-01): toda escrita entra aqui e a UI já reflete o dado. A fila envia
 * em segundo plano com retry exponencial: 1 s, 4 s, 16 s, 60 s, depois a cada 5 min.
 */
export interface ItemOutbox {
  id: string; // `${tabela}:${registro.id}` — uma entrada por registro, a última escrita vence
  tabela: NomeTabela;
  payload: Record<string, unknown>;
  tentativas: number;
  proximaEm: number; // epoch ms
  criadoEm: number;
  ultimoErro?: string;
}

export const BACKOFF_MS = [1_000, 4_000, 16_000, 60_000];
export const BACKOFF_MAX_MS = 5 * 60_000;

/** Espera antes da tentativa número `tentativas` (1 = primeira falha). */
export function esperaParaTentativa(tentativas: number): number {
  return BACKOFF_MS[tentativas - 1] ?? BACKOFF_MAX_MS;
}

export function chaveOutbox(tabela: NomeTabela, id: string): string {
  return `${tabela}:${id}`;
}

export async function enfileirar(tabela: NomeTabela, payload: Record<string, unknown>, agora = Date.now()): Promise<ItemOutbox> {
  const id = String(payload.id ?? payload.token ?? payload.slug);
  const item: ItemOutbox = { id: chaveOutbox(tabela, id), tabela, payload, tentativas: 0, proximaEm: agora, criadoEm: agora };
  await idbSalvar(STORE_OUTBOX, item);
  ouvintes.forEach((cb) => cb());
  return item;
}

export async function pendentes(): Promise<ItemOutbox[]> {
  const todos = await idbTodos<ItemOutbox>(STORE_OUTBOX);
  return todos.sort((a, b) => a.criadoEm - b.criadoEm);
}

export async function concluir(item: ItemOutbox): Promise<void> {
  await idbApagar(STORE_OUTBOX, item.id);
  ouvintes.forEach((cb) => cb());
}

export async function falhou(item: ItemOutbox, erro: string, agora = Date.now()): Promise<ItemOutbox> {
  const tentativas = item.tentativas + 1;
  const novo: ItemOutbox = { ...item, tentativas, proximaEm: agora + esperaParaTentativa(tentativas), ultimoErro: erro };
  await idbSalvar(STORE_OUTBOX, novo);
  ouvintes.forEach((cb) => cb());
  return novo;
}

/** Itens prontos para envio agora (respeitando o backoff), na ordem de criação. */
export function prontos(lista: ItemOutbox[], agora = Date.now()): ItemOutbox[] {
  return lista.filter((i) => i.proximaEm <= agora);
}

/** Spec 01, limites: avisar quando há itens pendentes há mais de 24 h. */
export function temPendenteAntigo(lista: ItemOutbox[], agora = Date.now()): boolean {
  return lista.some((i) => agora - i.criadoEm > 24 * 3_600_000);
}

const ouvintes = new Set<() => void>();
export function assinarOutbox(cb: () => void): () => void {
  ouvintes.add(cb);
  return () => ouvintes.delete(cb);
}
