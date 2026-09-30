/** Web Speech API (pt-BR) com tipos mínimos; o fallback por gravação entra com a Edge Function. */

interface ResultadoAlternativa {
  transcript: string;
}
interface ResultadoLista {
  length: number;
  [i: number]: { isFinal: boolean; 0: ResultadoAlternativa };
}
interface EventoResultado extends Event {
  resultIndex: number;
  results: ResultadoLista;
}
interface Reconhecedor extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: EventoResultado) => void) | null;
  onerror: ((e: Event & { error?: string }) => void) | null;
  onend: (() => void) | null;
}

type Construtor = new () => Reconhecedor;

export function suportaReconhecimento(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { SpeechRecognition?: Construtor; webkitSpeechRecognition?: Construtor };
  return Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition);
}

export interface SessaoVoz {
  parar(): void;
  cancelar(): void;
}

/**
 * Inicia o reconhecimento; `onParcial` recebe a transcrição enquanto fala e
 * `onFinal` o texto final ao parar (ou "" se nada foi ouvido). VOZ-02: se não
 * vier resultado em 2 s após parar, resolve com o parcial que tiver.
 */
export function ouvir(handlers: { onParcial: (t: string) => void; onFinal: (t: string) => void; onErro: (motivo: string) => void }): SessaoVoz | null {
  const w = window as unknown as { SpeechRecognition?: Construtor; webkitSpeechRecognition?: Construtor };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;

  const rec = new Ctor();
  rec.lang = "pt-BR";
  rec.interimResults = true;
  rec.continuous = true;
  rec.maxAlternatives = 1;

  let final = "";
  let parcial = "";
  let encerrado = false;
  let timeout: number | null = null;

  const concluir = () => {
    if (encerrado) return;
    encerrado = true;
    if (timeout) window.clearTimeout(timeout);
    handlers.onFinal((final || parcial).trim());
  };

  rec.onresult = (e) => {
    let f = "";
    let p = "";
    for (let i = 0; i < e.results.length; i++) {
      const r = e.results[i]!;
      if (r.isFinal) f += r[0].transcript;
      else p += r[0].transcript;
    }
    final = f;
    parcial = p;
    handlers.onParcial((f + " " + p).trim());
  };
  rec.onerror = (e) => {
    const motivo = e.error ?? "erro";
    if (motivo === "not-allowed" || motivo === "service-not-allowed") handlers.onErro("sem_permissao");
    else if (motivo !== "aborted" && motivo !== "no-speech") handlers.onErro(motivo);
    concluir();
  };
  rec.onend = concluir;

  try {
    rec.start();
  } catch {
    handlers.onErro("erro");
    return null;
  }

  return {
    parar() {
      try {
        rec.stop();
      } catch {
        /* já parado */
      }
      timeout = window.setTimeout(concluir, 2000);
    },
    cancelar() {
      encerrado = true;
      if (timeout) window.clearTimeout(timeout);
      try {
        rec.abort();
      } catch {
        /* nada */
      }
    },
  };
}
