"use client";

import { guardarArquivo, removerArquivo } from "@/lib/arquivos/arquivos";
import { novoId } from "@/lib/dados/colecao";
import { birthChecklistItems, birthItemAttachments, birthPlans, type BirthChecklistItem, type BirthPlan } from "@/lib/dados/colecoes";
import { processarFoto } from "@/lib/midia/imagem";
import { concluirEtapa, idDoPlano, itensSemente, MAX_ANEXOS_ITEM, planoVazio, proximaPosicao, type Etapa, type Lista } from "@dominio/plano-parto.ts";

/**
 * RN-06: na primeira abertura (pela gestante), o plano nasce com as sementes. Ids determinísticos
 * pela gestante: outro aparelho dela abrindo junto não duplica. Se já existe um plano, nada muda.
 */
export function garantirPlano(semente: string, autor: string): { criado: boolean; plano: BirthPlan } {
  const existente = birthPlans.listarTodos()[0];
  if (existente) return { criado: false, plano: existente };
  const plano = birthPlans.salvar({ ...planoVazio(idDoPlano(semente)), criado_por: autor, apagado_em: null });
  const jaTem = new Set(birthChecklistItems.listarTodos().map((i) => i.id));
  for (const i of itensSemente(semente)) if (!jaTem.has(i.id)) birthChecklistItems.salvar({ ...i, criado_por: autor, apagado_em: null });
  return { criado: true, plano };
}

/** RN-01: cada campo salva sozinho (quem chama faz o debounce de 800 ms). */
export function salvarCampos(plano: BirthPlan, mudancas: Partial<BirthPlan>): BirthPlan {
  const atual = birthPlans.obter(plano.id) ?? plano;
  return birthPlans.salvar({ ...atual, ...mudancas });
}

export function concluir(plano: BirthPlan, etapa: Etapa): BirthPlan {
  const atual = birthPlans.obter(plano.id) ?? plano;
  return birthPlans.salvar({ ...atual, completed_steps: concluirEtapa(atual.completed_steps, etapa) });
}

export function alternarItem(item: BirthChecklistItem): BirthChecklistItem {
  return birthChecklistItems.salvar({ ...item, is_done: !item.is_done });
}

export function adicionarItem(lista: Lista, titulo: string, autor: string): BirthChecklistItem | null {
  const t = titulo.trim().slice(0, 80);
  if (!t) return null;
  return birthChecklistItems.salvar({ id: novoId(), list: lista, title: t, quantity: null, note: null, is_done: false, is_custom: true, position: proximaPosicao(birthChecklistItems.listar(), lista), criado_por: autor, apagado_em: null });
}

export function renomearItem(item: BirthChecklistItem, titulo: string): BirthChecklistItem {
  const t = titulo.trim().slice(0, 80);
  return t ? birthChecklistItems.salvar({ ...item, title: t }) : item;
}

export function mudarQuantidade(item: BirthChecklistItem, delta: number): BirthChecklistItem {
  const atual = item.quantity ?? 1;
  const nova = Math.min(99, Math.max(1, atual + delta));
  return birthChecklistItems.salvar({ ...item, quantity: nova === 1 && item.quantity === null ? null : nova });
}

export async function removerItem(item: BirthChecklistItem): Promise<void> {
  for (const a of birthItemAttachments.listar().filter((x) => x.item_id === item.id)) {
    birthItemAttachments.apagar(a.id);
    await removerArquivo(a.storage_path);
  }
  birthChecklistItems.apagar(item.id);
}

/** RN-09: foto do documento (sem EXIF), até 3 por item; o limite do free é conferido por quem chama. */
export async function anexarFoto(item: BirthChecklistItem, arquivo: File, autor: string): Promise<void> {
  const ocupadas = new Set(birthItemAttachments.listar().filter((a) => a.item_id === item.id).map((a) => a.position));
  const posicao = [1, 2, 3].find((p) => !ocupadas.has(p));
  if (!posicao || ocupadas.size >= MAX_ANEXOS_ITEM) throw new Error("item_cheio");
  const foto = await processarFoto(arquivo);
  const id = novoId();
  const caminho = `plano/${item.id}/${id}.jpg`;
  await guardarArquivo(caminho, foto.blob);
  birthItemAttachments.salvar({ id, item_id: item.id, storage_path: caminho, position: posicao, criado_por: autor, apagado_em: null });
}

export async function removerAnexo(id: string): Promise<void> {
  const a = birthItemAttachments.obter(id);
  if (!a) return;
  birthItemAttachments.apagar(id);
  await removerArquivo(a.storage_path);
}
