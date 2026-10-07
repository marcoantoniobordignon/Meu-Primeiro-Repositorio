"use client";

import { novoId } from "@/lib/dados/colecao";
import { exportarJpeg, processarFoto } from "@/lib/midia/imagem";
import { MAX_BYTES_ARQUIVO, MAX_PAGINAS_DOCUMENTO } from "@dominio/galeria.ts";

/**
 * Páginas novas da galeria: foto (câmera ou galeria) vira JPEG sem EXIF; PDF vira uma imagem por
 * página (pdf.js, carregado só aqui), para folhear, dar zoom e ler por IA do mesmo jeito.
 * Laudo precisa de letra legível: até 2000 px no maior lado.
 */
export const LADO_DOCUMENTO = 2000;

export interface PaginaNova {
  id: string;
  blob: Blob;
  mime: string;
  bytes: number;
  width: number;
  height: number;
}

export type ErroPagina = "muitas_paginas" | "grande_demais" | "ilegivel";

export class ErroDePagina extends Error {
  constructor(public motivo: ErroPagina) {
    super(motivo);
  }
}

function pagina(blob: Blob, w: number, h: number): PaginaNova {
  if (blob.size > MAX_BYTES_ARQUIVO) throw new ErroDePagina("grande_demais");
  return { id: novoId(), blob, mime: blob.type || "image/jpeg", bytes: blob.size, width: w, height: h };
}

async function paginasDoPdf(arquivo: File, livres: number): Promise<PaginaNova[]> {
  // Build "legacy": traz os polyfills que celulares com navegador mais antigo precisam.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
  const tarefa = pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) });
  const doc = await tarefa.promise;
  if (doc.numPages > livres) throw new ErroDePagina("muitas_paginas");
  const saida: PaginaNova[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const p = await doc.getPage(n);
    const base = p.getViewport({ scale: 1 });
    const escala = Math.min(3, LADO_DOCUMENTO / Math.max(base.width, base.height));
    const vp = p.getViewport({ scale: escala });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    await p.render({ canvas, viewport: vp }).promise;
    const foto = await exportarJpeg(canvas, { ladoMax: LADO_DOCUMENTO });
    saida.push(pagina(foto.blob, foto.largura, foto.altura));
  }
  await tarefa.destroy();
  return saida;
}

/** Prepara os arquivos escolhidos (fotos ou PDFs) respeitando o limite de páginas do documento. */
export async function prepararPaginas(arquivos: File[], jaTem: number): Promise<PaginaNova[]> {
  const saida: PaginaNova[] = [];
  for (const a of arquivos) {
    const livres = MAX_PAGINAS_DOCUMENTO - jaTem - saida.length;
    if (livres <= 0) throw new ErroDePagina("muitas_paginas");
    try {
      if (a.type === "application/pdf" || a.name.toLowerCase().endsWith(".pdf")) saida.push(...(await paginasDoPdf(a, livres)));
      else {
        const f = await processarFoto(a, { ladoMax: LADO_DOCUMENTO });
        saida.push(pagina(f.blob, f.largura, f.altura));
      }
    } catch (e) {
      if (e instanceof ErroDePagina) throw e;
      console.warn("galeria: arquivo ilegível", e instanceof Error ? e.message : e);
      throw new ErroDePagina("ilegivel");
    }
  }
  return saida;
}
