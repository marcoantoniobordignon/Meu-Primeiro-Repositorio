"use client";

import { abrirImagem } from "@/lib/midia/imagem";

import { COMPARTILHAR, escolherFormatoVideo, perfilDeExportacao, recorteCover, type Plano } from "./regras";

/**
 * Funcionalidade 05 · vídeo e imagem gerados no aparelho (RN-08/09): nada sai para serviço de terceiros.
 * Cores vêm dos tokens (lidas do CSS), nunca de hex solto.
 */

function token(nome: string): string {
  if (typeof document === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
}

type Fonte = Awaited<ReturnType<typeof abrirImagem>>;

function tamanho(f: Fonte): { w: number; h: number } {
  if (typeof HTMLImageElement !== "undefined" && f instanceof HTMLImageElement) return { w: f.naturalWidth, h: f.naturalHeight };
  return { w: (f as ImageBitmap).width, h: (f as ImageBitmap).height };
}

/** Desenha a foto (cover), o selo "Semana N" no canto e, se pedido, a marca "Ninho". */
export function desenharQuadro(ctx: CanvasRenderingContext2D, foto: Fonte, semana: number, rotuloSemana: string, opcoes: { marca: boolean; marcaTexto: string }): void {
  const { width: W, height: H } = ctx.canvas;
  const { w, h } = tamanho(foto);
  const r = recorteCover(w, h, W, H);
  ctx.globalAlpha = 1;
  ctx.fillStyle = token("--texto") || "black";
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(foto, r.sx, r.sy, r.sw, r.sh, 0, 0, W, H);

  const u = W / 360;
  const fonte = token("--fonte") || "system-ui, sans-serif";
  ctx.font = `500 ${Math.round(16 * u)}px ${fonte}`;
  const texto = rotuloSemana.replace("{n}", String(semana));
  const largura = ctx.measureText(texto).width + 24 * u;
  const altura = 32 * u;
  const x = 14 * u;
  const y = 14 * u;
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = token("--texto") || "black";
  ctx.beginPath();
  ctx.roundRect(x, y, largura, altura, altura / 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = token("--superficie") || "white";
  ctx.textBaseline = "middle";
  ctx.fillText(texto, x + 12 * u, y + altura / 2);

  if (opcoes.marca) {
    ctx.font = `600 ${Math.round(18 * u)}px ${fonte}`;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = token("--superficie") || "white";
    ctx.textAlign = "right";
    ctx.fillText(opcoes.marcaTexto, W - 14 * u, H - 22 * u);
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;
  }
}

export function suportaExportarVideo(): string | null {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined" || typeof HTMLCanvasElement.prototype.captureStream !== "function") return null;
  return escolherFormatoVideo((t) => MediaRecorder.isTypeSupported(t));
}

const espera = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

/**
 * RN-08: canvas + MediaRecorder no formato suportado. Free: 720p com "Ninho"; premium: 1080p sem marca.
 * `segundosPorFoto` segue a velocidade escolhida no player.
 */
export async function exportarTimelapse(
  quadros: { blob: Blob; semana: number }[],
  opcoes: { plano: Plano; segundosPorFoto: number; rotuloSemana: string; marcaTexto: string },
): Promise<{ blob: Blob; extensao: string }> {
  const formato = suportaExportarVideo();
  if (!formato) throw new Error("sem_formato");
  const { largura, altura, marca } = perfilDeExportacao(opcoes.plano);
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("sem_canvas");
  const fontes = await Promise.all(quadros.map((q) => abrirImagem(q.blob)));

  const stream = canvas.captureStream(30);
  const gravador = new MediaRecorder(stream, { mimeType: formato, videoBitsPerSecond: opcoes.plano === "premium" ? 6_000_000 : 3_000_000 });
  const pedacos: Blob[] = [];
  gravador.ondataavailable = (e) => e.data.size && pedacos.push(e.data);
  const fim = new Promise<void>((res) => (gravador.onstop = () => res()));

  desenharQuadro(ctx, fontes[0]!, quadros[0]!.semana, opcoes.rotuloSemana, { marca, marcaTexto: opcoes.marcaTexto });
  gravador.start(250);
  for (let i = 0; i < fontes.length; i++) {
    desenharQuadro(ctx, fontes[i]!, quadros[i]!.semana, opcoes.rotuloSemana, { marca, marcaTexto: opcoes.marcaTexto });
    // Redesenha durante a duração do quadro: alguns navegadores só emitem quadro quando o canvas muda.
    const t0 = performance.now();
    while (performance.now() - t0 < opcoes.segundosPorFoto * 1000) {
      await espera(1000 / 15);
      desenharQuadro(ctx, fontes[i]!, quadros[i]!.semana, opcoes.rotuloSemana, { marca, marcaTexto: opcoes.marcaTexto });
    }
  }
  gravador.stop();
  await fim;
  stream.getTracks().forEach((t) => t.stop());
  const tipo = formato.split(";")[0]!;
  return { blob: new Blob(pedacos, { type: tipo }), extensao: tipo === "video/mp4" ? "mp4" : "webm" };
}

/** RN-09: PNG 1080 × 1350 com "Semana N", sem nome do bebê. */
export async function imagemParaCompartilhar(blob: Blob, semana: number, rotuloSemana: string): Promise<Blob> {
  const foto = await abrirImagem(blob);
  const canvas = document.createElement("canvas");
  canvas.width = COMPARTILHAR.largura;
  canvas.height = COMPARTILHAR.altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("sem_canvas");
  desenharQuadro(ctx, foto, semana, rotuloSemana, { marca: false, marcaTexto: "" });
  const png = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
  if (!png) throw new Error("falha");
  return png;
}
