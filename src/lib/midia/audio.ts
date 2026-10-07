"use client";

/**
 * Gravação de áudio do diário (funcionalidade 06 RN-05): MediaRecorder em audio/mp4 no Safari
 * e audio/webm no Chrome, 64 kbps, no máximo 180 segundos.
 */
export const AUDIO_BPS = 64_000;
export const AUDIO_MAX_S = 180;
/** WebM primeiro (Chrome); o Safari, que não grava WebM, cai no MP4. */
export const FORMATOS_AUDIO = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"] as const;

export function escolherFormatoAudio(suporta: (t: string) => boolean): string | null {
  for (const f of FORMATOS_AUDIO) {
    try {
      if (suporta(f)) return f;
    } catch {
      /* segue */
    }
  }
  return null;
}

export function suportaGravarAudio(): boolean {
  return typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
}

export interface Gravacao {
  parar(): void;
  cancelar(): void;
}

export interface Gravado {
  blob: Blob;
  segundos: number;
}

/**
 * Começa a gravar. `onFim` recebe o áudio ao parar (ou ao bater 180 s); `onSegundo` o tempo
 * corrido. Lança se não houver microfone ou permissão.
 */
export async function gravarAudio(handlers: { onSegundo: (s: number) => void; onFim: (g: Gravado) => void }): Promise<Gravacao> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const tipo = escolherFormatoAudio((t) => MediaRecorder.isTypeSupported(t));
  const rec = new MediaRecorder(stream, { ...(tipo ? { mimeType: tipo } : {}), audioBitsPerSecond: AUDIO_BPS });
  const pedacos: Blob[] = [];
  const inicio = Date.now();
  let cancelado = false;
  rec.ondataavailable = (e) => e.data.size && pedacos.push(e.data);
  const relogio = window.setInterval(() => {
    const s = Math.floor((Date.now() - inicio) / 1000);
    handlers.onSegundo(Math.min(s, AUDIO_MAX_S));
    if (s >= AUDIO_MAX_S && rec.state === "recording") rec.stop();
  }, 250);
  rec.onstop = () => {
    window.clearInterval(relogio);
    stream.getTracks().forEach((t) => t.stop());
    if (cancelado) return;
    const segundos = Math.min(AUDIO_MAX_S, Math.max(1, Math.round((Date.now() - inicio) / 1000)));
    handlers.onFim({ blob: new Blob(pedacos, { type: (rec.mimeType || tipo || "audio/webm").split(";")[0] }), segundos });
  };
  rec.start(1000);
  return {
    parar: () => rec.state === "recording" && rec.stop(),
    cancelar: () => {
      cancelado = true;
      if (rec.state === "recording") rec.stop();
    },
  };
}
