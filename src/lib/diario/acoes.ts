"use client";

import { extensaoDoMime, guardarArquivo, removerArquivo } from "@/lib/arquivos/arquivos";
import { novoId } from "@/lib/dados/colecao";
import { diaryEntries, diaryMilestoneStates, diaryPhotos, type DiaryEntry, type DiaryPhoto } from "@/lib/dados/colecoes";
import { ADIAMENTO_MS, idDaEntradaDoMarco, idDoEstadoDoMarco } from "@dominio/diario.ts";
import type { DataISO } from "@dominio/tempo.ts";

import { entradaValida, marcosDuplicados, MAX_FOTOS } from "./regras";

/** Foto no editor: já guardada (caminho) ou nova (blob ainda não salvo). */
export type FotoDoEditor = { tipo: "existente"; foto: DiaryPhoto } | { tipo: "nova"; id: string; blob: Blob };

export interface DadosEntrada {
  milestone_code: string | null;
  body: string;
  entry_date: DataISO;
  /** `undefined` mantém o áudio que já existe; `null` remove; um blob troca. */
  audio?: { blob: Blob; segundos: number } | null;
  fotos: FotoDoEditor[];
}

function sufixo(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Cria ou edita uma entrada (offline-first: a linha vai para a outbox; áudio e fotos para a fila
 * de arquivos). RN-02: o marco tem id por autora, então reabrir edita a mesma entrada.
 */
export async function salvarEntrada(d: DadosEntrada, autor: string, existente?: DiaryEntry | null): Promise<DiaryEntry> {
  const id = existente?.id ?? (d.milestone_code ? idDaEntradaDoMarco(autor, d.milestone_code) : novoId());
  const anterior = existente ?? diaryEntries.obter(id);
  const fotos = d.fotos.slice(0, MAX_FOTOS);
  const body = d.body.trim().slice(0, 5000) || null;

  let audio_path = anterior && !anterior.apagado_em ? anterior.audio_path : null;
  let audio_seconds = anterior && !anterior.apagado_em ? anterior.audio_seconds : null;
  const audioAntigo = audio_path;
  if (d.audio === null) {
    audio_path = null;
    audio_seconds = null;
  } else if (d.audio) {
    audio_path = `diario/${id}/audio-${sufixo()}.${extensaoDoMime(d.audio.blob.type)}`;
    audio_seconds = Math.min(180, Math.max(0, Math.round(d.audio.segundos)));
  }
  if (!entradaValida({ body, temAudio: Boolean(audio_path), fotos: fotos.length })) throw new Error("vazia");

  if (d.audio) await guardarArquivo(audio_path!, d.audio.blob);

  const entrada = diaryEntries.salvar({
    id,
    kind: d.milestone_code ? "milestone" : "free",
    milestone_code: d.milestone_code,
    body,
    entry_date: d.entry_date,
    audio_path,
    audio_seconds,
    shared_with_partner: anterior && !anterior.apagado_em ? anterior.shared_with_partner : false,
    photo_count: fotos.length,
    criado_por: anterior?.criado_por ?? autor,
    apagado_em: null,
  });
  if (audioAntigo && audioAntigo !== audio_path) await removerArquivo(audioAntigo);

  // Fotos: as que saíram somem (com o arquivo); as novas entram nas posições livres, em ordem.
  const ficam = new Set(fotos.flatMap((f) => (f.tipo === "existente" ? [f.foto.id] : [])));
  for (const f of diaryPhotos.listar().filter((x) => x.entry_id === id && !ficam.has(x.id))) {
    diaryPhotos.apagar(f.id);
    await removerArquivo(f.storage_path);
  }
  let posicao = 0;
  for (const f of fotos) {
    posicao++;
    if (f.tipo === "existente") {
      if (f.foto.position !== posicao) diaryPhotos.salvar({ ...f.foto, position: posicao as 1 | 2 | 3 });
      continue;
    }
    const storage_path = `diario/${id}/${f.id}.jpg`;
    await guardarArquivo(storage_path, f.blob);
    diaryPhotos.salvar({ id: f.id, entry_id: id, position: posicao as 1 | 2 | 3, storage_path, criado_por: autor });
  }
  return entrada;
}

/** RN-08: excluir é definitivo e apaga áudio e fotos. */
export async function excluirEntrada(e: DiaryEntry): Promise<void> {
  const fotos = diaryPhotos.listar().filter((f) => f.entry_id === e.id);
  for (const f of fotos) diaryPhotos.apagar(f.id);
  diaryEntries.apagar(e.id);
  await removerArquivo(e.audio_path);
  for (const f of fotos) await removerArquivo(f.storage_path);
}

/** Tela 4: "Compartilhar com meu parceiro" liga e desliga (RN-09). */
export function alternarCompartilhamento(e: DiaryEntry, ligado: boolean): DiaryEntry {
  return diaryEntries.salvar({ ...e, shared_with_partner: ligado });
}

function salvarEstado(autor: string, code: string, mudancas: { skipped_at?: string | null; snoozed_until?: string | null }) {
  const id = idDoEstadoDoMarco(autor, code);
  const atual = diaryMilestoneStates.obter(id);
  return diaryMilestoneStates.salvar({ id, milestone_code: code, skipped_at: atual?.skipped_at ?? null, snoozed_until: atual?.snoozed_until ?? null, ...mudancas, criado_por: autor, apagado_em: null });
}

/** RN-03: "Pular" some de vez. */
export function pularMarco(autor: string, code: string, agora = new Date()) {
  return salvarEstado(autor, code, { skipped_at: agora.toISOString() });
}

/** RN-03: "Mais tarde" some por 3 dias. */
export function adiarMarco(autor: string, code: string, agora = new Date()) {
  return salvarEstado(autor, code, { snoozed_until: new Date(agora.getTime() + ADIAMENTO_MS).toISOString() });
}

/** Desfaz "Pular" (na lista de marcos, para responder depois). */
export function reabrirMarco(autor: string, code: string) {
  return salvarEstado(autor, code, { skipped_at: null, snoozed_until: null });
}

/** Dois aparelhos com o mesmo marco: fica o mais recente. */
export function manterDiario(): void {
  for (const e of marcosDuplicados(diaryEntries.listar())) diaryEntries.apagar(e.id);
}
