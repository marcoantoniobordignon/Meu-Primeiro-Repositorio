"use client";

import type { BirthPlan } from "@/lib/dados/colecoes";
import { secoesDoPdf } from "@dominio/plano-parto.ts";

const A4: [number, number] = [595.28, 841.89];

/** Fontes padrão do PDF cobrem o português (WinAnsi); o resto vira "?" para não quebrar. */
function seguro(t: string): string {
  return t.replace(/[^ -ÿ]/g, "?");
}

function quebrar(texto: string, largura: number, medir: (t: string) => number): string[] {
  const saida: string[] = [];
  let linha = "";
  for (const palavra of seguro(texto).split(" ")) {
    const tentativa = linha ? `${linha} ${palavra}` : palavra;
    if (medir(tentativa) > largura && linha) {
      saida.push(linha);
      linha = palavra;
    } else linha = tentativa;
  }
  if (linha) saida.push(linha);
  return saida;
}

/**
 * RN-05: A4 de uma página, gerado no aparelho (funciona offline). Se o texto passar de uma página,
 * a fonte diminui até caber. Free: rodapé "feito com Ninho"; premium: sem rodapé.
 */
export async function montarPdfDoPlano(o: { plano: BirthPlan; titulo: string; cabecalho: string[]; rodape: string | null; geradoEm: string }): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const secoes = secoesDoPdf(o.plano);
  for (let tamanho = 11; tamanho >= 7; tamanho -= 0.5) {
    const pdf = await PDFDocument.create();
    const fonte = await pdf.embedFont(StandardFonts.Helvetica);
    const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
    const p = pdf.addPage(A4);
    const margem = 48;
    const largura = A4[0] - 2 * margem;
    const escuro = rgb(0.15, 0.15, 0.15);
    const mudo = rgb(0.42, 0.42, 0.42);
    let y = A4[1] - margem - 22;
    p.drawText(seguro(o.titulo), { x: margem, y, size: 22, font: negrito, color: escuro });
    y -= 22;
    for (const l of o.cabecalho) {
      p.drawText(seguro(l), { x: margem, y, size: tamanho, font: fonte, color: mudo });
      y -= tamanho * 1.45;
    }
    y -= tamanho;
    let coube = true;
    for (const s of secoes) {
      p.drawText(seguro(s.titulo), { x: margem, y, size: tamanho + 3, font: negrito, color: escuro });
      y -= (tamanho + 3) * 1.5;
      for (const linha of s.linhas) {
        for (const parte of quebrar(linha, largura, (t) => fonte.widthOfTextAtSize(t, tamanho))) {
          p.drawText(parte, { x: margem, y, size: tamanho, font: fonte, color: escuro });
          y -= tamanho * 1.45;
        }
      }
      y -= tamanho * 0.8;
      if (y < margem + 30) coube = false;
    }
    p.drawText(seguro(o.geradoEm), { x: margem, y: margem - 12, size: 8, font: fonte, color: mudo });
    if (o.rodape) {
      const w = fonte.widthOfTextAtSize(o.rodape, 8);
      p.drawText(seguro(o.rodape), { x: A4[0] - margem - w, y: margem - 12, size: 8, font: fonte, color: mudo });
    }
    if (coube || tamanho <= 7) {
      const bytes = await pdf.save();
      return new Blob([bytes as BlobPart], { type: "application/pdf" });
    }
  }
  throw new Error("pdf");
}

/** Web Share API com arquivo; sem ela, baixa. */
export async function compartilharOuBaixar(blob: Blob, nome: string): Promise<"compartilhado" | "baixado"> {
  const arquivo = new File([blob], nome, { type: "application/pdf" });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.share && nav.canShare?.({ files: [arquivo] })) {
    try {
      await nav.share({ files: [arquivo] });
      return "compartilhado";
    } catch (e) {
      // Cancelar não é erro; qualquer outra falha cai para o download.
      if (e instanceof DOMException && e.name === "AbortError") throw e;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "baixado";
}
