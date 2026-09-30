/**
 * Cálculos de data do app (ARQ-08). Tudo aqui é puro e testado.
 * Datas de calendário (DPP, DUM, nascimento) circulam como "YYYY-MM-DD"
 * e são interpretadas no fuso local do aparelho.
 */

export const DIAS_GESTACAO = 280;
export const SEMANAS_GESTACAO = 40;
const MS_DIA = 86_400_000;

export type DataISO = string; // "YYYY-MM-DD"

export function paraISO(data: Date): DataISO {
  const a = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, "0");
  const d = String(data.getDate()).padStart(2, "0");
  return `${a}-${m}-${d}`;
}

/** Interpreta "YYYY-MM-DD" como meia-noite local. */
export function deISO(iso: DataISO): Date {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function ehISOValida(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = deISO(iso);
  return !Number.isNaN(d.getTime()) && paraISO(d) === iso;
}

export function somarDias(iso: DataISO, dias: number): DataISO {
  const d = deISO(iso);
  d.setDate(d.getDate() + dias);
  return paraISO(d);
}

/** Diferença inteira em dias (b - a), ignorando horas. */
export function diasEntre(a: DataISO, b: DataISO): number {
  const ua = Date.UTC(deISO(a).getFullYear(), deISO(a).getMonth(), deISO(a).getDate());
  const ub = Date.UTC(deISO(b).getFullYear(), deISO(b).getMonth(), deISO(b).getDate());
  return Math.round((ub - ua) / MS_DIA);
}

/** ONB-02: DPP = DUM + 280 dias. */
export function dppDaDum(dum: DataISO): DataISO {
  return somarDias(dum, DIAS_GESTACAO);
}

export function dumDaDpp(dpp: DataISO): DataISO {
  return somarDias(dpp, -DIAS_GESTACAO);
}

export interface SemanaGestacional {
  /** Semanas completas (0–42+). */
  semana: number;
  /** Dias além da semana completa (0–6). */
  dia: number;
  /** Dias corridos desde a DUM. */
  diasCorridos: number;
  /** Dias que faltam para a DPP (negativo depois dela). */
  diasParaDpp: number;
  semanasParaDpp: number;
  trimestre: 1 | 2 | 3;
  /** 0–1, para o anel. */
  progresso: number;
}

/** Semana gestacional a partir da DPP, na data informada (padrão hoje). */
export function semanaGestacional(dpp: DataISO, hoje: DataISO = paraISO(new Date())): SemanaGestacional {
  const diasCorridos = Math.max(0, diasEntre(dumDaDpp(dpp), hoje));
  const semana = Math.floor(diasCorridos / 7);
  const dia = diasCorridos % 7;
  const diasParaDpp = diasEntre(hoje, dpp);
  const trimestre: 1 | 2 | 3 = semana < 13 ? 1 : semana < 27 ? 2 : 3;
  return {
    semana,
    dia,
    diasCorridos,
    diasParaDpp,
    semanasParaDpp: Math.max(0, Math.ceil(diasParaDpp / 7)),
    trimestre,
    progresso: Math.min(1, diasCorridos / DIAS_GESTACAO),
  };
}

/** ONB-02: DPP mais de 2 semanas no passado pede confirmação "o bebê já nasceu?". */
export function dppNoPassado(dpp: DataISO, hoje: DataISO = paraISO(new Date())): boolean {
  return diasEntre(dpp, hoje) > 14;
}

/** Idade do bebê em dias, semanas e meses aproximados. */
export function idadeBebe(nascidoEm: DataISO, hoje: DataISO = paraISO(new Date())) {
  const dias = Math.max(0, diasEntre(nascidoEm, hoje));
  return { dias, semanas: Math.floor(dias / 7), meses: Math.floor(dias / 30.4375) };
}

const fmtLonga = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" });
const fmtCurta = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

export function formatarLonga(iso: DataISO): string {
  return fmtLonga.format(deISO(iso));
}

export function formatarCurta(iso: DataISO): string {
  return fmtCurta.format(deISO(iso));
}
