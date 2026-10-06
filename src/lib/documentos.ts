"use client";

import { extensaoDoMime, guardarArquivo } from "@/lib/arquivos/arquivos";
import { novoId } from "@/lib/dados/colecao";
import { medicalDocuments, type MedicalDocument } from "@/lib/dados/colecoes";
import { processarFoto } from "@/lib/midia/imagem";
import type { DataISO } from "@dominio/tempo.ts";

/** Tipos aceitos no anexo de resultado: foto (vira JPEG sem EXIF) ou PDF. */
export const ACEITA_DOCUMENTO = "image/*,application/pdf";

/**
 * Ponte para a galeria (funcionalidade 01): guarda o arquivo (offline-first) e cria o
 * registro em `medical_documents`, que a galeria completa vai listar.
 */
export async function anexarDocumento(arquivo: File, dados: { kind: string; title: string; taken_on: DataISO }): Promise<MedicalDocument> {
  const id = novoId();
  let blob: Blob = arquivo;
  if (arquivo.type.startsWith("image/")) blob = (await processarFoto(arquivo)).blob;
  const mime = blob.type || arquivo.type || "application/octet-stream";
  const storage_path = `documentos/${id}.${extensaoDoMime(mime)}`;
  await guardarArquivo(storage_path, blob);
  return medicalDocuments.salvar({ id, kind: dados.kind, title: dados.title.slice(0, 120), storage_path, mime, taken_on: dados.taken_on });
}
