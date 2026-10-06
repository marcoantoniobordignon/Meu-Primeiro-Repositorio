"use client";

import { useEffect, useState } from "react";

import { idbApagar, idbObter, idbSalvar, idbTodos, STORE_ARQUIVOS, STORE_REMOCOES } from "@/lib/offline/idb";
import { esperaParaTentativa } from "@/lib/offline/outbox";
import { supabase, supabaseConfigurado, type Cliente } from "@/lib/supabase/client";

/**
 * Fotos e áudios offline-first (fundação RN-F10, specs 05 e 06): o arquivo nasce no
 * IndexedDB e a tela já mostra; a fila sobe para o Storage do projeto (bucket privado)
 * depois que a linha que o referencia sincronizou. Nenhum arquivo sai do Supabase do projeto.
 */
export const BUCKET = "ninho-privado";

export interface ArquivoLocal {
  id: string; // caminho no bucket
  blob: Blob;
  mime: string;
  enviado: boolean;
  tentativas: number;
  proximaEm: number;
  criadoEm: number;
}

interface Remocao {
  id: string;
  criadoEm: number;
}

const ouvintes = new Set<() => void>();
function avisar() {
  ouvintes.forEach((cb) => cb());
}
export function assinarArquivos(cb: () => void): () => void {
  ouvintes.add(cb);
  return () => ouvintes.delete(cb);
}

/** Extensão a partir do MIME (áudio do Safari é mp4; do Chrome, webm). */
export function extensaoDoMime(mime: string): string {
  if (mime.includes("jpeg")) return "jpg";
  if (mime.includes("png")) return "png";
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("mp4") || mime.includes("aac") || mime.includes("m4a")) return "m4a";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("ogg")) return "ogg";
  return "bin";
}

export async function guardarArquivo(caminho: string, blob: Blob, agora = Date.now()): Promise<void> {
  await idbSalvar<ArquivoLocal>(STORE_ARQUIVOS, { id: caminho, blob, mime: blob.type || "application/octet-stream", enviado: false, tentativas: 0, proximaEm: agora, criadoEm: agora });
  avisar();
}

/** Apaga daqui e, se já pode ter subido, enfileira a remoção no Storage (RN-08 do diário, RN-01/10 da barriga). */
export async function removerArquivo(caminho: string | null | undefined, agora = Date.now()): Promise<void> {
  if (!caminho) return;
  await idbApagar(STORE_ARQUIVOS, caminho);
  if (supabaseConfigurado()) await idbSalvar<Remocao>(STORE_REMOCOES, { id: caminho, criadoEm: agora });
  avisar();
}

export async function arquivosPendentes(): Promise<number> {
  const todos = await idbTodos<ArquivoLocal>(STORE_ARQUIVOS);
  return todos.filter((a) => !a.enviado).length;
}

/** O blob do aparelho; sem ele, baixa do Storage e guarda como cache para ler sem rede. */
export async function lerArquivo(caminho: string): Promise<Blob | null> {
  const local = await idbObter<ArquivoLocal>(STORE_ARQUIVOS, caminho);
  if (local) return local.blob;
  const sb = await supabase();
  if (!sb || (typeof navigator !== "undefined" && !navigator.onLine)) return null;
  try {
    const { data, error } = await sb.storage.from(BUCKET).download(caminho);
    if (error || !data) return null;
    await idbSalvar<ArquivoLocal>(STORE_ARQUIVOS, { id: caminho, blob: data, mime: data.type, enviado: true, tentativas: 0, proximaEm: 0, criadoEm: Date.now() });
    return data;
  } catch {
    return null;
  }
}

/**
 * Sobe o que está pendente e apaga o que foi removido. Roda depois do push das linhas
 * (a policy do Storage exige a linha que referencia o arquivo). Backoff igual ao da outbox.
 */
export async function sincronizarArquivos(sb: Cliente, agora = Date.now()): Promise<void> {
  const todos = await idbTodos<ArquivoLocal>(STORE_ARQUIVOS);
  for (const a of todos.filter((x) => !x.enviado && x.proximaEm <= agora)) {
    const { error } = await sb.storage.from(BUCKET).upload(a.id, a.blob, { contentType: a.mime, upsert: true });
    if (error) {
      const tentativas = a.tentativas + 1;
      await idbSalvar<ArquivoLocal>(STORE_ARQUIVOS, { ...a, tentativas, proximaEm: agora + esperaParaTentativa(tentativas) });
    } else {
      await idbSalvar<ArquivoLocal>(STORE_ARQUIVOS, { ...a, enviado: true });
    }
  }
  const remocoes = await idbTodos<Remocao>(STORE_REMOCOES);
  if (remocoes.length) {
    const { error } = await sb.storage.from(BUCKET).remove(remocoes.map((r) => r.id));
    if (!error) for (const r of remocoes) await idbApagar(STORE_REMOCOES, r.id);
  }
  avisar();
}

/** URL de objeto para <img>/<audio>; revoga ao trocar ou desmontar. `null` enquanto carrega ou sem arquivo. */
export function useUrlArquivo(caminho: string | null | undefined): { url: string | null; carregando: boolean } {
  const [estado, setEstado] = useState<{ url: string | null; carregando: boolean }>({ url: null, carregando: Boolean(caminho) });
  useEffect(() => {
    if (!caminho) {
      setEstado({ url: null, carregando: false });
      return;
    }
    let vivo = true;
    let url: string | null = null;
    setEstado({ url: null, carregando: true });
    void lerArquivo(caminho).then((blob) => {
      if (!vivo) return;
      url = blob ? URL.createObjectURL(blob) : null;
      setEstado({ url, carregando: false });
    });
    return () => {
      vivo = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [caminho]);
  return estado;
}
