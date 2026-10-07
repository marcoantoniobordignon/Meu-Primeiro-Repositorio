"use client";

import { lerArquivo } from "@/lib/arquivos/arquivos";
import { escolherFormatoVideo } from "@/lib/barriga/regras";
import { abrirImagem } from "@/lib/midia/imagem";
import { SEGUNDOS_POR_SLIDE, type Slide } from "@dominio/retrospectiva.ts";

import { desenharSequencia, desenharSlide, type Estilo, type Imagem, type Recursos } from "./render";

/**
 * Funcionalidade 07 · fotos, vídeo e PNGs gerados no aparelho (nada sai para serviço de terceiros).
 * RN-07: 1080 × 1920, 5 s por slide, `MediaRecorder` com o mesmo critério de formato da funcionalidade 05.
 */
export const EXPORTAR = { largura: 1080, altura: 1920, fps: 30 } as const;

/** Lê as fotos (do aparelho ou do Storage, guardando em cache). `faltando` = as que não vieram (sem rede). */
export async function carregarRecursos(caminhos: string[], aoProgredir?: (feitas: number, total: number) => void): Promise<{ recursos: Recursos; faltando: string[] }> {
  const recursos: Recursos = new Map();
  const faltando: string[] = [];
  let feitas = 0;
  aoProgredir?.(0, caminhos.length);
  // Duas de cada vez: rápido sem estourar a memória do aparelho.
  const fila = [...caminhos];
  async function trabalhar() {
    for (let c = fila.shift(); c !== undefined; c = fila.shift()) {
      try {
        const blob = await lerArquivo(c);
        if (blob) recursos.set(c, (await abrirImagem(blob)) as Imagem);
        else faltando.push(c);
      } catch {
        faltando.push(c);
      }
      aoProgredir?.(++feitas, caminhos.length);
    }
  }
  await Promise.all([trabalhar(), trabalhar()]);
  return { recursos, faltando };
}

/** As fontes da página carregadas antes de desenhar (o canvas não espera a web font sozinho). */
export async function fontesProntas(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  try {
    await Promise.all([document.fonts.load(`400 30px ${getComputedStyle(document.documentElement).getPropertyValue("--fonte-serifa")}`), document.fonts.load(`italic 500 30px ${getComputedStyle(document.documentElement).getPropertyValue("--fonte-serifa")}`), document.fonts.ready]);
  } catch {
    /* a fonte reserva serve */
  }
}

export function formatoDeVideo(): string | null {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined" || typeof HTMLCanvasElement.prototype.captureStream !== "function") return null;
  return escolherFormatoVideo((t) => MediaRecorder.isTypeSupported(t));
}

function novoCanvas(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = EXPORTAR.largura;
  c.height = EXPORTAR.altura;
  return c;
}

/**
 * Grava o vídeo em tempo real: cada quadro é desenhado no instante exato da sequência (o mesmo renderizador do
 * player), então um aparelho lento perde quadros, nunca a duração nem o ritmo.
 */
export async function gravarVideo(slides: Slide[], rec: Recursos, e: Estilo, aoProgredir?: (segundos: number, total: number) => void, sinal?: AbortSignal): Promise<{ blob: Blob; extensao: string }> {
  const formato = formatoDeVideo();
  if (!formato) throw new Error("sem_formato");
  const canvas = novoCanvas();
  const apoio = novoCanvas();
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("sem_canvas");
  const total = slides.length * SEGUNDOS_POR_SLIDE;
  desenharSequencia(ctx, apoio, slides, 0, rec, e);

  const stream = canvas.captureStream(EXPORTAR.fps);
  const gravador = new MediaRecorder(stream, { mimeType: formato, videoBitsPerSecond: 10_000_000 });
  const pedacos: Blob[] = [];
  gravador.ondataavailable = (ev) => ev.data.size && pedacos.push(ev.data);
  const fim = new Promise<void>((res) => (gravador.onstop = () => res()));
  gravador.start(500);
  const t0 = performance.now();
  await new Promise<void>((res, rej) => {
    let ultimoSegundo = -1;
    const passo = () => {
      if (sinal?.aborted) return rej(new DOMException("cancelado", "AbortError"));
      const tempo = (performance.now() - t0) / 1000;
      desenharSequencia(ctx, apoio, slides, Math.min(tempo, total - 0.001), rec, e);
      const s = Math.floor(tempo);
      if (s !== ultimoSegundo) aoProgredir?.((ultimoSegundo = s), total);
      if (tempo >= total) return res();
      window.setTimeout(passo, 1000 / EXPORTAR.fps / 2);
    };
    passo();
  }).finally(() => {
    if (gravador.state !== "inactive") gravador.stop();
  });
  await fim;
  stream.getTracks().forEach((t) => t.stop());
  const tipo = formato.split(";")[0]!;
  return { blob: new Blob(pedacos, { type: tipo }), extensao: tipo === "video/mp4" ? "mp4" : "webm" };
}

/** Um PNG por slide, no quadro final dele (tudo já apareceu). */
export async function gerarPngs(slides: Slide[], rec: Recursos, e: Estilo): Promise<Blob[]> {
  const canvas = novoCanvas();
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("sem_canvas");
  const saida: Blob[] = [];
  for (const s of slides) {
    // No timelapse, o quadro final é a barriga mais recente.
    desenharSlide(ctx, s, SEGUNDOS_POR_SLIDE, rec, e);
    const png = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
    if (!png) throw new Error("falha");
    saida.push(png);
  }
  return saida;
}
