import type { DiaryEntry, DiaryMilestoneState, Papel } from "@/lib/dados/colecoes";
import { normalizarTexto } from "@/lib/texto";
import { CATALOGO_MARCOS, cardsDeMarco, estadoDoMarco, marcoDoCatalogo, marcoVisivel, type EstadoMarco, type Marco, type SituacaoMarco } from "@dominio/diario.ts";
import { idadeGestacional, type DataISO } from "@dominio/tempo.ts";

/** Funcionalidade 06 · regras do lado do app (o catálogo e os cards estão em `@dominio/diario.ts`). */

export const MAX_FOTOS = 3;
export const MAX_AUDIO_S = 180;
export const MAX_TEXTO = 5000;
/** RN-06: free guarda até 10 entradas com áudio (decisão reversível). */
export const LIMITE_AUDIO_FREE = 10;

export interface Conteudo {
  body: string | null;
  temAudio: boolean;
  fotos: number;
}

/** RN-01: a entrada precisa de texto, áudio ou foto. */
export function entradaValida(c: Conteudo): boolean {
  return Boolean(c.body?.trim()) || c.temAudio || c.fotos > 0;
}

/** RN-07: a data não pode ser futura. */
export function dataValida(data: DataISO, hoje: DataISO): boolean {
  return Boolean(data) && data <= hoje;
}

/** RN-07: a semana exibida é calculada pela data da entrada. */
export function semanaDaEntrada(dpp: DataISO | null | undefined, data: DataISO): number | null {
  if (!dpp) return null;
  const s = idadeGestacional(dpp, data).semana;
  return s >= 0 && s <= 45 ? s : null;
}

export function vivas(entradas: DiaryEntry[]): DiaryEntry[] {
  return entradas.filter((e) => !e.apagado_em);
}

/** RN-06: entradas com áudio da autora. */
export function entradasComAudio(entradas: DiaryEntry[], autor: string): number {
  return vivas(entradas).filter((e) => e.criado_por === autor && e.audio_path).length;
}

/** RN-06: salvar com áudio novo passa do limite? (editar uma que já tinha áudio não conta de novo). */
export function audioPassaDoLimite(entradas: DiaryEntry[], autor: string, temPlano: boolean, editando?: DiaryEntry | null): boolean {
  if (temPlano) return false;
  if (editando?.audio_path) return false;
  return entradasComAudio(entradas, autor) >= LIMITE_AUDIO_FREE;
}

/** RN-09 (espelho da RLS no aparelho): o parceiro só vê as compartilhadas e as dele; a gestante vê todas. */
export function visivelPara(e: DiaryEntry, eu: string, papel: Papel): boolean {
  if (e.apagado_em) return false;
  if (e.criado_por === eu || !e.criado_por) return true;
  if (papel === "mae") return true;
  if (papel === "parceiro") return e.shared_with_partner;
  return false;
}

/** RN-09: só quem escreveu edita (e exclui). */
export function podeEditar(e: DiaryEntry, eu: string): boolean {
  return !e.criado_por || e.criado_por === eu;
}

/** RN-12: cartas para o bebê (spec 14) não entram aqui; só `free` e `milestone`. */
export function linhaDoTempo(entradas: DiaryEntry[], eu: string, papel: Papel, filtro: { marco?: string | null; busca?: string }): DiaryEntry[] {
  const q = normalizarTexto(filtro.busca ?? "");
  return entradas
    .filter((e) => visivelPara(e, eu, papel) && (e.kind === "free" || e.kind === "milestone"))
    .filter((e) => (filtro.marco ? e.milestone_code === filtro.marco : true))
    // RN-10: busca simples, normalizada, só nas entradas da própria usuária.
    .filter((e) => !q || (e.criado_por === eu && normalizarTexto(`${e.body ?? ""} ${marcoDoCatalogo(e.milestone_code)?.title ?? ""}`).includes(q)))
    .sort((a, b) => b.entry_date.localeCompare(a.entry_date) || (b.atualizado_em ?? "").localeCompare(a.atualizado_em ?? ""));
}

/** Situação de cada marco para a autora (resposta, "Pular", "Mais tarde"). */
export function situacoes(entradas: DiaryEntry[], estados: DiaryMilestoneState[], autor: string): (code: string) => SituacaoMarco {
  const respondidos = new Set(vivas(entradas).filter((e) => e.criado_por === autor && e.milestone_code).map((e) => e.milestone_code!));
  const porCode = new Map(estados.filter((s) => !s.apagado_em && s.criado_por === autor).map((s) => [s.milestone_code, s]));
  return (code) => ({ respondido: respondidos.has(code), skipped_at: porCode.get(code)?.skipped_at ?? null, snoozed_until: porCode.get(code)?.snoozed_until ?? null });
}

export function cardsDoDiario(semana: number, modoFe: boolean, situacao: (code: string) => SituacaoMarco, agora: Date): Marco[] {
  return cardsDeMarco(semana, modoFe, situacao, agora);
}

/** Tela 5 "Marcos": todos (os de fé só com o modo ligado) com o estado de cada um. */
export function listaDeMarcos(semana: number, modoFe: boolean, situacao: (code: string) => SituacaoMarco, agora: Date): { marco: Marco; estado: EstadoMarco }[] {
  return CATALOGO_MARCOS.filter((m) => marcoVisivel(m, modoFe)).map((m) => ({ marco: m, estado: estadoDoMarco(m, semana, situacao(m.code), agora) }));
}

/** Duas entradas do mesmo marco e autora (dois aparelhos): fica a mais recente. */
export function marcosDuplicados(entradas: DiaryEntry[]): DiaryEntry[] {
  const grupos = new Map<string, DiaryEntry[]>();
  for (const e of vivas(entradas)) {
    if (!e.milestone_code) continue;
    const k = `${e.criado_por ?? ""}|${e.milestone_code}`;
    grupos.set(k, [...(grupos.get(k) ?? []), e]);
  }
  const sobra: DiaryEntry[] = [];
  for (const l of grupos.values()) if (l.length > 1) sobra.push(...[...l].sort((a, b) => b.atualizado_em.localeCompare(a.atualizado_em) || a.id.localeCompare(b.id)).slice(1));
  return sobra;
}
