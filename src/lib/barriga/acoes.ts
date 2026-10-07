"use client";

import { guardarArquivo, removerArquivo } from "@/lib/arquivos/arquivos";
import { bellyPhotos, type BellyPhoto } from "@/lib/dados/colecoes";
import { atualizarPerfil, type Perfil } from "@/lib/perfil";
import { idDaFotoDaSemana } from "@dominio/barriga.ts";
import type { DataISO } from "@dominio/tempo.ts";

import { duplicadasPorSemana } from "./regras";

function sufixo(): string {
  return Math.random().toString(36).slice(2, 10);
}

export interface NovaFoto {
  blob: Blob;
  largura: number;
  altura: number;
  semana: number;
  takenOn: DataISO;
  caption: string | null;
}

/**
 * RN-01/13: uma foto por semana. Substituir reaproveita o registro da semana (id
 * determinístico) e apaga o arquivo antigo; sem rede, a foto fica na fila e sobe depois.
 */
export async function salvarFotoDaSemana(f: NovaFoto, autor: string): Promise<{ foto: BellyPhoto; substituiu: boolean }> {
  const viva = bellyPhotos.listar().find((x) => x.gest_week === f.semana);
  const id = viva?.id ?? idDaFotoDaSemana(autor, f.semana);
  const storage_path = `barriga/${id}-${sufixo()}.jpg`;
  await guardarArquivo(storage_path, f.blob);
  const foto = bellyPhotos.salvar({
    id,
    gest_week: f.semana,
    taken_on: f.takenOn,
    storage_path,
    width: f.largura,
    height: f.altura,
    caption: f.caption?.trim().slice(0, 100) || null,
    criado_por: viva?.criado_por ?? autor,
    apagado_em: null,
  });
  if (viva) await removerArquivo(viva.storage_path);
  return { foto, substituiu: Boolean(viva) };
}

export function editarLegenda(f: BellyPhoto, legenda: string): BellyPhoto {
  return bellyPhotos.salvar({ ...f, caption: legenda.trim().slice(0, 100) || null });
}

/** RN-10: excluir libera a semana (e o arquivo sai do aparelho e do Storage). */
export async function excluirFoto(f: BellyPhoto): Promise<void> {
  bellyPhotos.apagar(f.id);
  await removerArquivo(f.storage_path);
}

/** Dois aparelhos com foto na mesma semana: fica a mais recente. */
export function manterFotos(): void {
  for (const f of duplicadasPorSemana(bellyPhotos.listar())) bellyPhotos.apagar(f.id);
}

/** RN-05: "Retomar as fotos?" — a pausa recomeça a contar desta semana. */
export function retomarLembretes(perfil: Perfil, semanaAtual: number): void {
  atualizarPerfil({ prefs: { ...perfil.prefs, belly_reminders: true, belly_resumed_week: semanaAtual } });
}
