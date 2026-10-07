/**
 * Funcionalidade 05 · Foto semanal da barriga: semanas válidas e a régua dos lembretes.
 * Puro: o app (grade, card "Retomar as fotos?") e o job de lembretes usam o mesmo.
 */
import { idDeterministico } from "./id.ts";
import { idadeGestacional, inicioDaSemana, somarDiasISO, type DataISO } from "./tempo.ts";

export const SEMANA_MIN = 4;
export const SEMANA_MAX = 42;
/** RN-06: começa a lembrar a partir da semana 8. */
export const SEMANA_INICIO_LEMBRETE = 8;
/** RN-05: três semanas seguidas sem foto pausam os lembretes. */
export const SEMANAS_PARA_PAUSAR = 3;
export const HORA_LEMBRETE = "10:00";
export const HORA_REFORCO = "19:00";
export const DIAS_ATE_REFORCO = 2;

/** RN-02: `ga_week(hoje)`, limitada à grade (4..42). Antes da semana 4, null. */
export function semanaDaFoto(dpp: DataISO, hoje: DataISO): number | null {
  const { semana } = idadeGestacional(dpp, hoje);
  if (semana < SEMANA_MIN) return null;
  return Math.min(SEMANA_MAX, semana);
}

/** RN-02: pela grade, qualquer semana de 4 até a atual; semana futura não. */
export function semanaPermitida(semana: number, semanaAtual: number | null): boolean {
  return semanaAtual !== null && Number.isInteger(semana) && semana >= SEMANA_MIN && semana <= Math.min(SEMANA_MAX, semanaAtual);
}

/** RN-01: uma foto por semana: o id é da semana (substituir reaproveita o registro). */
export function idDaFotoDaSemana(autor: string, semana: number): string {
  return idDeterministico(`barriga:${autor}:${semana}`);
}

/**
 * RN-05: pausado quando as 3 semanas anteriores à atual (todas a partir da 8 e
 * depois de um "Retomar") ficaram sem foto. A foto de qualquer uma delas, ou retomar, desfaz.
 */
export function lembretesPausados(semanaAtual: number, semanasComFoto: Set<number>, retomadaNaSemana: number | null = null): boolean {
  const piso = Math.max(SEMANA_INICIO_LEMBRETE, retomadaNaSemana ?? 0);
  const anteriores = [1, 2, 3].map((k) => semanaAtual - k);
  if (anteriores.some((w) => w < piso)) return false;
  return anteriores.every((w) => !semanasComFoto.has(w));
}

export interface LembreteBarriga {
  semana: number;
  tipo: "virada" | "reforco";
  data: DataISO;
  hora: string;
}

/**
 * RN-05/06: na virada da semana gestacional (10:00) e um reforço 2 dias depois (19:00),
 * só se a semana ainda não tem foto, a partir da semana 8, com os lembretes ligados e sem pausa.
 */
export function lembretesDaSemana(dpp: DataISO, hoje: DataISO, semanasComFoto: Set<number>, opcoes: { ligados: boolean; retomadaNaSemana?: number | null }): LembreteBarriga[] {
  const { semana } = idadeGestacional(dpp, hoje);
  if (!opcoes.ligados || semana < SEMANA_INICIO_LEMBRETE || semana > SEMANA_MAX) return [];
  if (semanasComFoto.has(semana)) return [];
  if (lembretesPausados(semana, semanasComFoto, opcoes.retomadaNaSemana ?? null)) return [];
  const virada = inicioDaSemana(dpp, semana);
  return [
    { semana, tipo: "virada", data: virada, hora: HORA_LEMBRETE },
    { semana, tipo: "reforco", data: somarDiasISO(virada, DIAS_ATE_REFORCO), hora: HORA_REFORCO },
  ];
}
