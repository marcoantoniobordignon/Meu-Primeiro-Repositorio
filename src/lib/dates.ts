/**
 * Cálculos de data do app (ARQ-08). Tudo aqui é puro e testado.
 * Datas de calendário (DPP, DUM, nascimento) circulam como "YYYY-MM-DD"
 * e são interpretadas no fuso local do aparelho.
 */

import { trimestreDaSemana } from "@dominio/trimestre.ts";

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
  // Funcionalidade 11 RN-01: as viradas são em 14s0d e 28s0d (a mesma regra dos artigos e do job).
  const trimestre = trimestreDaSemana(semana);
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

/** HG-01: semana exibida fica entre 1 e 42. */
export function semanaExibida(semana: number): number {
  return Math.min(42, Math.max(1, semana));
}

/** HG-02/03: legenda sob o anel. */
export function legendaSemana(g: SemanaGestacional): { texto: string; tom: "normal" | "acento" } {
  if (g.diasParaDpp < 0) {
    const d = -g.diasParaDpp;
    return { texto: d === 1 ? "1 dia além da data" : `${d} dias além da data`, tom: "acento" };
  }
  if (g.semana >= 37) return { texto: "pode ser a qualquer momento", tom: "acento" };
  if (g.diasParaDpp < 14) return { texto: g.diasParaDpp === 1 ? "1 dia para o parto" : `${g.diasParaDpp} dias para o parto`, tom: "normal" };
  return { texto: g.semanasParaDpp === 1 ? "1 semana para o parto" : `${g.semanasParaDpp} semanas para o parto`, tom: "normal" };
}

/** HG-04: saudação por hora local. */
export function saudacaoPorHora(hora: number): "Bom dia" | "Boa tarde" | "Boa noite" {
  if (hora >= 5 && hora <= 11) return "Bom dia";
  if (hora >= 12 && hora <= 17) return "Boa tarde";
  return "Boa noite";
}

/**
 * SIN-05: a data do registro é o dia local; entre 0h e 4h, pode contar para ontem
 * se a pessoa confirmar. Aqui só dizemos se a pergunta cabe.
 */
export function dataDoRegistro(agora: Date = new Date()): { hoje: DataISO; ontem: DataISO; madrugada: boolean } {
  const hoje = paraISO(agora);
  return { hoje, ontem: somarDias(hoje, -1), madrugada: agora.getHours() < 4 };
}

/** "hoje às 14:30", "amanhã às 14:30", "sex., 3 de out. às 14:30". */
export function formatarQuando(isoDataHora: string, agora: Date = new Date()): string {
  const d = new Date(isoDataHora);
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const dias = diasEntre(paraISO(agora), paraISO(d));
  if (dias === 0) return `hoje às ${hora}`;
  if (dias === 1) return `amanhã às ${hora}`;
  if (dias === -1) return `ontem às ${hora}`;
  const data = d.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" });
  return `${data} às ${hora}`;
}

/** "há 2 min", "há 1 h", "agora". */
export function haQuantoTempo(iso: string, agora: Date = new Date()): string {
  const min = Math.floor((agora.getTime() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  return h < 24 ? `há ${h} h` : `há ${Math.floor(h / 24)} d`;
}

/** "3 min 20 s", "45 s". */
export function formatarDuracao(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `${r} s`;
  return r === 0 ? `${m} min` : `${m} min ${r} s`;
}

/** "Hoje", "Ontem", "seg., 28 de set.". */
export function rotuloDia(iso: DataISO, hoje: DataISO = paraISO(new Date())): string {
  const dias = diasEntre(iso, hoje);
  if (dias === 0) return "Hoje";
  if (dias === 1) return "Ontem";
  return deISO(iso).toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" });
}

/** ONB-02: DPP mais de 2 semanas no passado pede confirmação "o bebê já nasceu?". */
export function dppNoPassado(dpp: DataISO, hoje: DataISO = paraISO(new Date())): boolean {
  return diasEntre(dpp, hoje) > 14;
}

/** Idade do bebê em dias, semanas e meses aproximados. Aceita "YYYY-MM-DD" ou ISO com hora. */
export function idadeBebe(nascidoEm: string, hoje: DataISO = paraISO(new Date())) {
  const dias = Math.max(0, diasEntre(nascidoEm.slice(0, 10), hoje));
  return { dias, semanas: Math.floor(dias / 7), meses: Math.floor(dias / 30.4375) };
}

/**
 * BEB-10: "3 meses e 2 semanas" com meses completos de calendário e semanas restantes.
 * Retorna também o progresso no primeiro ano (0–1) para o anel.
 */
export function idadeDetalhada(nascidoEm: string, hoje: DataISO = paraISO(new Date())) {
  const nasc = deISO(nascidoEm.slice(0, 10));
  const h = deISO(hoje);
  let meses = (h.getFullYear() - nasc.getFullYear()) * 12 + (h.getMonth() - nasc.getMonth());
  const marco = new Date(nasc);
  marco.setMonth(nasc.getMonth() + meses);
  if (marco > h) {
    meses--;
    marco.setMonth(nasc.getMonth() + meses);
  }
  meses = Math.max(0, meses);
  const diasRestantes = Math.max(0, diasEntre(paraISO(marco), hoje));
  const semanas = Math.floor(diasRestantes / 7);
  const dias = Math.max(0, diasEntre(nascidoEm.slice(0, 10), hoje));
  return { meses, semanas, dias, progressoAno: Math.min(1, dias / 365) };
}

/** Idade corrigida para prematuro: desconta as semanas que faltaram para 40. */
export function idadeCorrigida(nascidoEm: string, prematuroSemanas: number, hoje: DataISO = paraISO(new Date())) {
  const ajuste = Math.max(0, 40 - prematuroSemanas) * 7;
  return idadeDetalhada(somarDias(nascidoEm.slice(0, 10), ajuste), hoje);
}

/** "3 meses e 2 semanas", "2 semanas", "5 dias". */
export function textoIdade(i: { meses: number; semanas: number; dias: number }): string {
  if (i.meses === 0 && i.semanas === 0) return i.dias === 1 ? "1 dia" : `${i.dias} dias`;
  const m = i.meses === 1 ? "1 mês" : `${i.meses} meses`;
  const s = i.semanas === 1 ? "1 semana" : `${i.semanas} semanas`;
  if (i.meses === 0) return s;
  return i.semanas === 0 ? m : `${m} e ${s}`;
}

/** "há 1 h 12", "há 5 min", "agora" — para os tiles (BEB-01). */
export function haTempoCurto(iso: string, agora: Date = new Date()): string {
  const min = Math.max(0, Math.floor((agora.getTime() - new Date(iso).getTime()) / 60_000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  if (h >= 24) return `há ${Math.floor(h / 24)} d`;
  return r === 0 ? `há ${h} h` : `há ${h} h ${String(r).padStart(2, "0")}`;
}

export function formatarHora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** "1 h 12", "12 min" — duração em minutos, para timers e linha do tempo. */
export function formatarMinutos(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h} h` : `${h} h ${String(r).padStart(2, "0")}`;
}

const fmtLonga = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" });
const fmtCurta = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
const fmtComAno = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric" });

/** "8 de março de 2045": para datas fora deste ano (abertura de carta, data de revisão). */
export function formatarComAno(iso: DataISO): string {
  return fmtComAno.format(deISO(iso));
}

export function formatarLonga(iso: DataISO): string {
  return fmtLonga.format(deISO(iso));
}

export function formatarCurta(iso: DataISO): string {
  return fmtCurta.format(deISO(iso));
}
