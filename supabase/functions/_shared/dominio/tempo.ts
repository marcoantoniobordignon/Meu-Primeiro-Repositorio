/**
 * Tempo com fuso explícito. Puro e sem dependências: roda no app (Next/Vitest, via
 * `@dominio/tempo`) e nas Edge Functions (Deno), que montam os lembretes no fuso de
 * `profiles.tz` mesmo quando o servidor está em UTC.
 *
 * Datas de calendário circulam como "YYYY-MM-DD"; horários como "HH:MM" (24 h).
 */

export type DataISO = string;
export type HoraISO = string;

export const FUSO_PADRAO = "America/Sao_Paulo";
export const MS_MIN = 60_000;
export const MS_HORA = 3_600_000;
export const MS_DIA = 86_400_000;

const formatadores = new Map<string, Intl.DateTimeFormat>();

function formatador(tz: string): Intl.DateTimeFormat {
  let f = formatadores.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    formatadores.set(tz, f);
  }
  return f;
}

export function fusoValido(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    formatador(tz);
    return true;
  } catch {
    return false;
  }
}

/** O fuso pedido, ou o padrão quando vier vazio ou inválido. */
export function fusoOuPadrao(tz: string | null | undefined): string {
  return fusoValido(tz) ? tz : FUSO_PADRAO;
}

const DIAS_SEMANA: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export interface PartesLocais {
  ano: number;
  mes: number; // 1..12
  dia: number;
  hora: number;
  minuto: number;
  segundo: number;
  diaSemana: number; // 0 = domingo
}

export function partesNoFuso(instante: Date, tz: string): PartesLocais {
  const p: Record<string, string> = {};
  for (const parte of formatador(tz).formatToParts(instante)) p[parte.type] = parte.value;
  return {
    ano: Number(p.year),
    mes: Number(p.month),
    dia: Number(p.day),
    hora: Number(p.hour) % 24,
    minuto: Number(p.minute),
    segundo: Number(p.second),
    diaSemana: DIAS_SEMANA[p.weekday ?? "Sun"] ?? 0,
  };
}

const dois = (n: number) => String(n).padStart(2, "0");

/** Data de calendário do instante no fuso. */
export function dataNoFuso(instante: Date, tz: string): DataISO {
  const p = partesNoFuso(instante, tz);
  return `${p.ano}-${dois(p.mes)}-${dois(p.dia)}`;
}

/** "HH:MM" do instante no fuso. */
export function horaNoFuso(instante: Date, tz: string): HoraISO {
  const p = partesNoFuso(instante, tz);
  return `${dois(p.hora)}:${dois(p.minuto)}`;
}

/** Minutos a somar ao UTC para chegar na hora local (−180 em São Paulo). */
export function deslocamentoMin(instante: Date, tz: string): number {
  const p = partesNoFuso(instante, tz);
  const comoUtc = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
  return Math.round((comoUtc - Math.floor(instante.getTime() / 1000) * 1000) / MS_MIN);
}

function partesData(data: DataISO): [number, number, number] {
  const [a, m, d] = data.split("-").map(Number);
  return [a ?? 1970, m ?? 1, d ?? 1];
}

export function normalizarHora(hora: string): HoraISO {
  const [h, m] = hora.split(":");
  return `${dois(Number(h ?? 0))}:${dois(Number(m ?? 0))}`;
}

export function horaValida(hora: string): boolean {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(hora);
  return Boolean(m && Number(m[1]) < 24 && Number(m[2]) < 60);
}

/**
 * Instante em que o relógio do fuso marca `data hora`. Num buraco de horário de
 * verão (hora que não existe), cai no primeiro minuto válido depois dele.
 */
export function instanteLocal(data: DataISO, hora: HoraISO, tz: string): Date {
  const [a, m, d] = partesData(data);
  const [h, min] = normalizarHora(hora).split(":").map(Number);
  const alvo = Date.UTC(a, m - 1, d, h ?? 0, min ?? 0);
  let palpite = alvo - deslocamentoMin(new Date(alvo), tz) * MS_MIN;
  for (let i = 0; i < 3; i++) {
    const corrigido = alvo - deslocamentoMin(new Date(palpite), tz) * MS_MIN;
    if (corrigido === palpite) break;
    palpite = corrigido;
  }
  return new Date(palpite);
}

/** Meia-noite local da data no fuso. */
export function inicioDoDia(data: DataISO, tz: string): Date {
  return instanteLocal(data, "00:00", tz);
}

export function somarDiasISO(data: DataISO, dias: number): DataISO {
  const [a, m, d] = partesData(data);
  const t = new Date(Date.UTC(a, m - 1, d + dias));
  return `${t.getUTCFullYear()}-${dois(t.getUTCMonth() + 1)}-${dois(t.getUTCDate())}`;
}

/** b − a em dias de calendário. */
export function diasEntreISO(a: DataISO, b: DataISO): number {
  const [aa, am, ad] = partesData(a);
  const [ba, bm, bd] = partesData(b);
  return Math.round((Date.UTC(ba, bm - 1, bd) - Date.UTC(aa, am - 1, ad)) / MS_DIA);
}

/** 0 = domingo. */
export function diaSemanaISO(data: DataISO): number {
  const [a, m, d] = partesData(data);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

export function dataISOValida(data: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  return somarDiasISO(data, 0) === data;
}

// ---------------------------------------------------------------------------
// Idade gestacional (a DUM é a DPP − 280 dias; ARQ-08)
// ---------------------------------------------------------------------------
export const DIAS_GESTACAO = 280;

export function dumDaDpp(dpp: DataISO): DataISO {
  return somarDiasISO(dpp, -DIAS_GESTACAO);
}

export interface IdadeGestacional {
  semana: number;
  dia: number;
  /** Dias desde a DUM (pode ser negativo antes dela). */
  dias: number;
}

/** `ga_week(data)`: semanas completas desde a DUM na data informada. */
export function idadeGestacional(dpp: DataISO, data: DataISO): IdadeGestacional {
  const dias = diasEntreISO(dumDaDpp(dpp), data);
  const semana = Math.floor(dias / 7);
  return { semana, dia: dias - semana * 7, dias };
}

/** Primeiro dia da semana gestacional `semana` (dia em que ela "vira"). */
export function inicioDaSemana(dpp: DataISO, semana: number): DataISO {
  return somarDiasISO(dumDaDpp(dpp), semana * 7);
}
