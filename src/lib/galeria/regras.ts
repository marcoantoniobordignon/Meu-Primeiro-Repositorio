import type { DocumentPage, MedicalDocument, Membro, Papel, UserExam } from "@/lib/dados/colecoes";
import { tipoDoExame, type TipoDocumento } from "@dominio/galeria.ts";
import { diasEntreISO, idadeGestacional, type DataISO } from "@dominio/tempo.ts";

/** Funcionalidade 01 · regras do lado do app (limites e validação da IA em `@dominio/galeria.ts`). */

export function vivos<T extends { apagado_em?: string | null }>(l: T[]): T[] {
  return l.filter((x) => !x.apagado_em);
}

/** A semana não é gravada: `ga_week(exam_date)`. Antes da DUM, null. */
export function semanaDoDocumento(dpp: DataISO | null | undefined, examDate: DataISO): number | null {
  if (!dpp) return null;
  const s = idadeGestacional(dpp, examDate).semana;
  return s >= 0 && s <= 45 ? s : null;
}

/** Páginas vivas de um documento, em ordem. */
export function paginasDo(docId: string, paginas: DocumentPage[]): DocumentPage[] {
  return vivos(paginas)
    .filter((p) => p.document_id === docId)
    .sort((a, b) => a.position - b.position);
}

/** RN-02: total de páginas guardadas nos documentos vivos. */
export function paginasGuardadas(docs: MedicalDocument[], paginas: DocumentPage[]): number {
  const ids = new Set(vivos(docs).map((d) => d.id));
  return vivos(paginas).filter((p) => ids.has(p.document_id)).length;
}

/** RN-10 (espelho da RLS): a gestante vê tudo; o parceiro, só o compartilhado; os demais, nada. */
export function visivelPara(d: MedicalDocument, eu: string, papel: Papel): boolean {
  if (d.apagado_em) return false;
  if (papel === "mae" || d.criado_por === eu) return true;
  return papel === "parceiro" && d.shared_with_partner;
}

/** RN-10: compartilhar só tem efeito se o parceiro existe. */
export function temParceiro(membros: Membro[]): boolean {
  return membros.some((m) => m.papel === "parceiro" && !m.apagado_em);
}

export type Filtro = TipoDocumento | "us" | "todos";

export function filtrar(docs: MedicalDocument[], filtro: Filtro): MedicalDocument[] {
  if (filtro === "todos") return docs;
  if (filtro === "us") return docs.filter((d) => d.kind.startsWith("us_"));
  return docs.filter((d) => d.kind === filtro);
}

/** Linha do tempo: mais recente primeiro (data do exame, depois quando foi guardado). */
export function ordenar(docs: MedicalDocument[]): MedicalDocument[] {
  return [...docs].sort((a, b) => b.exam_date.localeCompare(a.exam_date) || (b.atualizado_em ?? "").localeCompare(a.atualizado_em ?? ""));
}

/**
 * RN-04: sem vínculo, procura um exame marcado (pendente) do mesmo tipo; havendo vários, o mais
 * perto da data do documento.
 */
export function exameParaVincular(exames: UserExam[], kind: TipoDocumento, examDate: DataISO): UserExam | undefined {
  return vivos(exames)
    .filter((e) => e.status === "scheduled" && e.scheduled_at && tipoDoExame(e.catalog_code) === kind)
    .sort((a, b) => Math.abs(diasEntreISO(examDate, a.scheduled_at!.slice(0, 10))) - Math.abs(diasEntreISO(examDate, b.scheduled_at!.slice(0, 10))))[0];
}
