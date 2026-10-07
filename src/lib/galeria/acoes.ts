"use client";

import { guardarArquivo, removerArquivo } from "@/lib/arquivos/arquivos";
import { novoId } from "@/lib/dados/colecao";
import { documentPages, medicalDocuments, userExams, type DocumentPage, type MedicalDocument } from "@/lib/dados/colecoes";
import { concluirExame } from "@/lib/exames/acoes";
import { ehUltrassom, MAX_PAGINAS_DOCUMENTO, type TipoDocumento } from "@dominio/galeria.ts";
import type { DataISO } from "@dominio/tempo.ts";

import type { PaginaNova } from "./paginas";
import { paginasDo } from "./regras";

export type PaginaDoForm = { tipo: "existente"; pagina: DocumentPage } | { tipo: "nova"; pagina: PaginaNova };

export interface DadosDocumento {
  kind: TipoDocumento;
  exam_date: DataISO;
  title: string;
  notes: string;
  scheduled_exam_id: string | null;
}

/**
 * Salva (ou edita) o documento: a linha vai para a outbox e as páginas para a fila de arquivos
 * (RN-11: sem rede, fica "Aguardando envio" e sobe depois). Com exame vinculado, conclui o exame (spec 03 RN-08).
 */
export async function salvarDocumento(d: DadosDocumento, paginas: PaginaDoForm[], autor: string, existente?: MedicalDocument | null): Promise<MedicalDocument> {
  if (!paginas.length) throw new Error("sem_paginas");
  const id = existente?.id ?? novoId();
  const lista = paginas.slice(0, MAX_PAGINAS_DOCUMENTO);
  for (const p of lista) if (p.tipo === "nova") await guardarArquivo(`documentos/${id}/${p.pagina.id}.jpg`, p.pagina.blob);

  const doc = medicalDocuments.salvar({
    id,
    kind: d.kind,
    exam_date: d.exam_date,
    title: d.title.trim().slice(0, 80) || null,
    notes: d.notes.trim().slice(0, 1000) || null,
    is_favorite: Boolean(existente?.is_favorite && ehUltrassom(d.kind)),
    shared_with_partner: existente?.shared_with_partner ?? false,
    scheduled_exam_id: d.scheduled_exam_id,
    ai_status: existente?.ai_status ?? "none",
    ai_summary: existente?.ai_summary ?? null,
    criado_por: existente?.criado_por ?? autor,
    apagado_em: null,
  });

  const ficam = new Set(lista.flatMap((p) => (p.tipo === "existente" ? [p.pagina.id] : [])));
  for (const p of paginasDo(id, documentPages.listar()).filter((x) => !ficam.has(x.id))) {
    documentPages.apagar(p.id);
    await removerArquivo(p.storage_path);
  }
  let pos = 0;
  for (const p of lista) {
    pos++;
    if (p.tipo === "existente") {
      if (p.pagina.position !== pos) documentPages.salvar({ ...p.pagina, position: pos });
      continue;
    }
    const n = p.pagina;
    documentPages.salvar({ id: n.id, document_id: id, position: pos, storage_path: `documentos/${id}/${n.id}.jpg`, mime: n.mime, bytes: n.bytes, width: n.width, height: n.height });
  }

  // RN-04: aceitar o vínculo marca o exame como feito, com o documento.
  if (d.scheduled_exam_id && d.scheduled_exam_id !== existente?.scheduled_exam_id) {
    const exame = userExams.obter(d.scheduled_exam_id);
    if (exame && !exame.apagado_em) concluirExame(exame, d.exam_date, id);
  }
  return doc;
}

/** RN-03: definitivo; os arquivos saem do aparelho já e do Storage pela fila (e pelo job, em até 24 h). */
export async function excluirDocumento(d: MedicalDocument): Promise<void> {
  const paginas = paginasDo(d.id, documentPages.listar());
  for (const p of paginas) documentPages.apagar(p.id);
  medicalDocuments.apagar(d.id);
  for (const p of paginas) await removerArquivo(p.storage_path);
  for (const e of userExams.listar().filter((x) => x.document_id === d.id)) userExams.salvar({ ...e, document_id: null });
}

/** RN-12: só ultrassom. */
export function favoritar(d: MedicalDocument, ligado: boolean): MedicalDocument {
  if (ligado && !ehUltrassom(d.kind)) return d;
  return medicalDocuments.salvar({ ...d, is_favorite: ligado });
}

export function compartilharComParceiro(d: MedicalDocument, ligado: boolean): MedicalDocument {
  return medicalDocuments.salvar({ ...d, shared_with_partner: ligado });
}
