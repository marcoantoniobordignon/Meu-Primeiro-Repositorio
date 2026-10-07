import type { BellyPhoto } from "@/lib/dados/colecoes";
import { lembretesPausados, SEMANA_INICIO_LEMBRETE, SEMANA_MAX, SEMANA_MIN } from "@dominio/barriga.ts";
import { prefsCompletas, type Prefs } from "@dominio/prefs.ts";

/** Funcionalidade 05 · regras do lado do app: grade, fantasma, timelapse e exportação. */

export type EstadoSemana = "passada" | "atual" | "futura";

export interface SemanaDaGrade {
  semana: number;
  estado: EstadoSemana;
  foto?: BellyPhoto;
}

export function fotosVivas(fotos: BellyPhoto[]): BellyPhoto[] {
  return fotos.filter((f) => !f.apagado_em);
}

/** Tela 1: semanas 4 a 42, a atual destacada; futuras não aceitam foto (RN-02). */
export function gradeDeSemanas(fotos: BellyPhoto[], semanaAtual: number | null): SemanaDaGrade[] {
  const porSemana = new Map(fotosVivas(fotos).map((f) => [f.gest_week, f]));
  const lista: SemanaDaGrade[] = [];
  for (let s = SEMANA_MIN; s <= SEMANA_MAX; s++) {
    const estado: EstadoSemana = semanaAtual === null || s > semanaAtual ? "futura" : s === semanaAtual ? "atual" : "passada";
    lista.push({ semana: s, estado, foto: porSemana.get(s) });
  }
  return lista;
}

/** RN-03: o fantasma é a última foto antes da semana que ela vai fotografar. */
export function fotoFantasma(fotos: BellyPhoto[], semana: number): BellyPhoto | undefined {
  return fotosVivas(fotos)
    .filter((f) => f.gest_week < semana)
    .sort((a, b) => b.gest_week - a.gest_week)[0];
}

/** RN-07: timelapse com 3 fotos ou mais, em ordem de semana. */
export const MIN_FOTOS_TIMELAPSE = 3;
export const VELOCIDADES = [0.2, 0.4, 0.8] as const;
export type Velocidade = (typeof VELOCIDADES)[number];
export const VELOCIDADE_PADRAO: Velocidade = 0.4;

export function quadrosDoTimelapse(fotos: BellyPhoto[]): BellyPhoto[] {
  return fotosVivas(fotos).sort((a, b) => a.gest_week - b.gest_week);
}

export function timelapseDisponivel(fotos: BellyPhoto[]): boolean {
  return fotosVivas(fotos).length >= MIN_FOTOS_TIMELAPSE;
}

/** RN-08: o primeiro formato suportado, nesta ordem; nenhum, null. */
export const FORMATOS_VIDEO = ["video/mp4;codecs=avc1", "video/webm;codecs=vp9", "video/webm"] as const;

export function escolherFormatoVideo(suporta: (tipo: string) => boolean): (typeof FORMATOS_VIDEO)[number] | null {
  for (const f of FORMATOS_VIDEO) {
    try {
      if (suporta(f)) return f;
    } catch {
      /* navegador que lança em vez de responder false */
    }
  }
  return null;
}

export type Plano = "free" | "premium";

/** RN-08: free 720p com marca d'água "Ninho"; premium 1080p sem marca. Retrato 3:4, como a câmera. */
export function perfilDeExportacao(plano: Plano): { largura: number; altura: number; marca: boolean } {
  return plano === "premium" ? { largura: 1080, altura: 1440, marca: false } : { largura: 720, altura: 960, marca: true };
}

/** RN-09: PNG 1080 × 1350 com "Semana N" (sem nome do bebê). */
export const COMPARTILHAR = { largura: 1080, altura: 1350 } as const;

export function nomeDoArquivo(semana: number, extensao: string): string {
  return `ninho-semana-${semana}.${extensao}`;
}

/** Recorte "cover": a foto preenche o quadro sem distorcer. */
export function recorteCover(lw: number, lh: number, qw: number, qh: number): { sx: number; sy: number; sw: number; sh: number } {
  const escala = Math.max(qw / lw, qh / lh);
  const sw = qw / escala;
  const sh = qh / escala;
  return { sx: (lw - sw) / 2, sy: (lh - sh) / 2, sw, sh };
}

/** RN-05: card "Retomar as fotos?" só dentro do app, quando os lembretes pausaram. */
export function mostrarRetomar(semanaAtual: number | null, fotos: BellyPhoto[], prefs: Prefs | null | undefined): boolean {
  const p = prefsCompletas(prefs);
  if (semanaAtual === null || !p.belly_reminders || semanaAtual < SEMANA_INICIO_LEMBRETE) return false;
  return lembretesPausados(semanaAtual, new Set(fotosVivas(fotos).map((f) => f.gest_week)), p.belly_resumed_week);
}

/** Duas fotos da mesma semana (dois aparelhos): fica a mais recente; devolve as outras. */
export function duplicadasPorSemana(fotos: BellyPhoto[]): BellyPhoto[] {
  const porSemana = new Map<number, BellyPhoto[]>();
  for (const f of fotosVivas(fotos)) porSemana.set(f.gest_week, [...(porSemana.get(f.gest_week) ?? []), f]);
  const sobra: BellyPhoto[] = [];
  for (const lista of porSemana.values()) {
    if (lista.length < 2) continue;
    sobra.push(...[...lista].sort((a, b) => b.atualizado_em.localeCompare(a.atualizado_em) || a.id.localeCompare(b.id)).slice(1));
  }
  return sobra;
}
