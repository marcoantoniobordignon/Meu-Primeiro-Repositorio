"use client";

import { BUCKET, lerArquivo } from "@/lib/arquivos/arquivos";
import type { DocumentPage, MedicalDocument } from "@/lib/dados/colecoes";
import { sessaoAtual } from "@/lib/sessao";
import { supabase } from "@/lib/supabase/client";
import { MAX_PAGINAS_EXPORTACAO, VALIDADE_EXPORTACAO_S } from "@dominio/galeria.ts";

import { paginasDo } from "./regras";

export interface Capa {
  titulo: string;
  linhas: string[];
}

export interface SecaoExportada {
  documento: MedicalDocument;
  cabecalho: string[];
}

/** RN-09: até 50 páginas somadas. */
export function paginasSelecionadas(docs: MedicalDocument[], paginas: DocumentPage[]): number {
  return docs.reduce((n, d) => n + paginasDo(d.id, paginas).length, 0);
}

export function cabeNaExportacao(docs: MedicalDocument[], paginas: DocumentPage[]): boolean {
  return paginasSelecionadas(docs, paginas) <= MAX_PAGINAS_EXPORTACAO;
}

const A4: [number, number] = [595.28, 841.89];
const MARGEM = 40;

/**
 * Monta o PDF no aparelho (pdf-lib carregado só aqui): capa com nome, DPP e semana; uma seção por
 * documento (cabeçalho e as páginas). Nada é interpretado: só o que ela guardou.
 */
export async function montarPdf(capa: Capa, secoes: SecaoExportada[], paginas: DocumentPage[]): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const fonte = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const escuro = rgb(0.17, 0.16, 0.16);
  const mudo = rgb(0.48, 0.46, 0.44);

  const escrever = (titulo: string, linhas: string[]) => {
    const p = pdf.addPage(A4);
    let y = A4[1] - MARGEM - 24;
    p.drawText(titulo, { x: MARGEM, y, size: 22, font: negrito, color: escuro });
    y -= 32;
    for (const l of linhas) {
      for (const parte of quebrar(l, 90)) {
        p.drawText(parte, { x: MARGEM, y, size: 12, font: fonte, color: mudo });
        y -= 18;
      }
    }
  };

  escrever(capa.titulo, capa.linhas);
  for (const s of secoes) {
    escrever(s.cabecalho[0] ?? "", s.cabecalho.slice(1));
    for (const pg of paginasDo(s.documento.id, paginas)) {
      const blob = await lerArquivo(pg.storage_path);
      if (!blob) continue;
      const img = await pdf.embedJpg(new Uint8Array(await blob.arrayBuffer()));
      const p = pdf.addPage(A4);
      const larg = A4[0] - 2 * MARGEM;
      const alt = A4[1] - 2 * MARGEM;
      const f = Math.min(larg / img.width, alt / img.height);
      p.drawImage(img, { x: (A4[0] - img.width * f) / 2, y: (A4[1] - img.height * f) / 2, width: img.width * f, height: img.height * f });
    }
  }
  const bytes = await pdf.save();
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}

/** Fontes padrão do PDF não cobrem tudo: troca o que não é Latin-1 por "?" e quebra linhas longas. */
function quebrar(texto: string, max: number): string[] {
  const limpo = texto.replace(/[^ -ÿ]/g, "?");
  const saida: string[] = [];
  let linha = "";
  for (const palavra of limpo.split(" ")) {
    if ((linha + " " + palavra).trim().length > max) {
      saida.push(linha.trim());
      linha = palavra;
    } else linha += ` ${palavra}`;
  }
  if (linha.trim()) saida.push(linha.trim());
  return saida.length ? saida : [""];
}

/** RN-09: com servidor, sobe para a pasta da pessoa e devolve um link de 24 h; sem, só o arquivo. */
export async function publicarExportacao(pdf: Blob): Promise<string | null> {
  const s = sessaoAtual();
  const sb = await supabase();
  if (!sb || !s?.remota || (typeof navigator !== "undefined" && !navigator.onLine)) return null;
  const caminho = `exportacoes/${s.uid}/${crypto.randomUUID()}.pdf`;
  const { error } = await sb.storage.from(BUCKET).upload(caminho, pdf, { contentType: "application/pdf" });
  if (error) return null;
  const { data } = await sb.storage.from(BUCKET).createSignedUrl(caminho, VALIDADE_EXPORTACAO_S, { download: "ninho-exames.pdf" });
  return data?.signedUrl ?? null;
}
