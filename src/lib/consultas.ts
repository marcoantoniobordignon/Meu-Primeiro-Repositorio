import type { Appointment, AppointmentKind, AppointmentMeasures, AppointmentQuestion, ProviderRole } from "@/lib/dados/colecoes";
import { proximaConsulta } from "@dominio/consultas.ts";
import { dataNoFuso, diasEntreISO } from "@dominio/tempo.ts";

/**
 * Funcionalidade 04 · Cronograma de consultas (substitui as regras HG-05/06 da spec 05:
 * o card da próxima continua, e o "Foi bem?" virou o "Como foi a consulta?" da RN-07).
 */

export const tiposConsulta: Record<AppointmentKind, string> = {
  prenatal: "Pré-natal",
  ultrasound: "Ultrassom",
  other: "Outra",
};

export const papeisProfissional: Record<ProviderRole, string> = {
  obstetrician: "Obstetra",
  midwife: "Obstetriz ou parteira",
  nurse: "Enfermeira",
  nutritionist: "Nutricionista",
  dentist: "Dentista",
  other: "Outro",
};

const H24 = 86_400_000;

/** RN-01: data passada é permitida e já nasce concluída. */
export function statusInicial(startsAt: Date, agora: Date = new Date()): Appointment["status"] {
  return startsAt.getTime() < agora.getTime() ? "done" : "scheduled";
}

export type EstadoCardConsulta =
  | { tipo: "nenhuma" }
  | { tipo: "proxima"; consulta: Appointment; iminente: boolean }
  | { tipo: "como_foi"; consulta: Appointment };

/**
 * RN-07: do dia seguinte em diante, uma `scheduled` sem conclusão pergunta "Como foi a consulta?",
 * uma única vez cada (concluir, cancelar ou dispensar encerram). A mais antiga primeiro.
 */
export function consultaParaPerguntar(todas: Appointment[], agora: Date, tz: string): Appointment | undefined {
  const hoje = dataNoFuso(agora, tz);
  return todas
    .filter((c) => !c.apagado_em && c.status === "scheduled" && !c.followup_dismissed && diasEntreISO(dataNoFuso(new Date(c.starts_at), tz), hoje) >= 1)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
}

/** Card da home: "Como foi?" tem prioridade; senão a próxima, iminente a partir de 24 h antes (HG-05). */
export function estadoDoCard(todas: Appointment[], agora: Date, tz: string): EstadoCardConsulta {
  const comoFoi = consultaParaPerguntar(todas, agora, tz);
  if (comoFoi) return { tipo: "como_foi", consulta: comoFoi };
  const proxima = todas
    .filter((c) => !c.apagado_em && c.status === "scheduled" && new Date(c.starts_at).getTime() >= agora.getTime())
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  if (!proxima) return { tipo: "nenhuma" };
  return { tipo: "proxima", consulta: proxima, iminente: new Date(proxima.starts_at).getTime() - agora.getTime() <= H24 };
}

/** Linha do tempo: próxima em destaque, futuras (mais próxima primeiro) e passadas (mais recente primeiro). */
export function linhaDoTempo(todas: Appointment[], agora: Date, tz: string) {
  const vivas = todas.filter((c) => !c.apagado_em);
  const proxima = proximaConsulta(vivas, agora, tz);
  const t = agora.getTime();
  const futuras = vivas.filter((c) => c.id !== proxima?.id && c.status === "scheduled" && new Date(c.starts_at).getTime() >= t).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const passadas = vivas.filter((c) => c.id !== proxima?.id && !futuras.includes(c)).sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  return { proxima, futuras, passadas };
}

// ---------------------------------------------------------------------------
// Perguntas
// ---------------------------------------------------------------------------
export function perguntaValida(texto: string): boolean {
  const t = texto.trim();
  return t.length >= 3 && t.length <= 280;
}

export function proximaPosicao(perguntas: AppointmentQuestion[]): number {
  return perguntas.reduce((m, p) => Math.max(m, p.position), 0) + 1;
}

export interface RespostaPergunta {
  was_asked: boolean;
  answer: string | null;
}

/**
 * RN-02 ao concluir: as soltas e as vinculadas a esta consulta passam por aqui.
 * Feitas ficam vinculadas, com a resposta; não feitas voltam a ser soltas (seguem para a próxima).
 */
export function perguntasAoConcluir(consultaId: string, perguntas: AppointmentQuestion[], respostas: Record<string, RespostaPergunta>): AppointmentQuestion[] {
  return perguntas
    .filter((p) => !p.apagado_em && !p.was_asked && (p.appointment_id === null || p.appointment_id === consultaId))
    .map((p) => {
      const r = respostas[p.id];
      if (r?.was_asked) return { ...p, appointment_id: consultaId, was_asked: true, answer: r.answer?.trim().slice(0, 500) || null };
      return { ...p, appointment_id: null, was_asked: false };
    });
}

// ---------------------------------------------------------------------------
// Medidas (RN-04: faixas do modelo; o app não interpreta nem alerta)
// ---------------------------------------------------------------------------
export type CampoMedida = "weight_kg" | "bp_sys" | "bp_dia" | "fundal_height_cm" | "fetal_heart_rate";

export const FAIXAS: Record<CampoMedida, { min: number; max: number; inteiro: boolean; casas: number }> = {
  weight_kg: { min: 30, max: 250, inteiro: false, casas: 2 },
  bp_sys: { min: 60, max: 260, inteiro: true, casas: 0 },
  bp_dia: { min: 30, max: 160, inteiro: true, casas: 0 },
  fundal_height_cm: { min: 0, max: 60, inteiro: false, casas: 1 },
  fetal_heart_rate: { min: 60, max: 220, inteiro: true, casas: 0 },
};

/** "72,5" → 72.5; vazio → null; fora da faixa ou inválido → "erro". */
export function lerMedida(campo: CampoMedida, bruto: string): number | null | "erro" {
  const t = bruto.trim().replace(",", ".");
  if (!t) return null;
  if (!/^\d+(\.\d+)?$/.test(t)) return "erro";
  const n = Number(t);
  const f = FAIXAS[campo];
  if (f.inteiro && !Number.isInteger(n)) return "erro";
  if (n < f.min || n > f.max) return "erro";
  const p = 10 ** f.casas;
  return Math.round(n * p) / p;
}

export function temMedidas(m: Pick<AppointmentMeasures, CampoMedida> | null | undefined): boolean {
  return Boolean(m && (["weight_kg", "bp_sys", "bp_dia", "fundal_height_cm", "fetal_heart_rate"] as CampoMedida[]).some((c) => m[c] !== null && m[c] !== undefined));
}

/** "72,5 kg · 110/70 mmHg · 28 cm · 140 bpm" — só leitura, sem interpretação. */
export function resumoMedidas(m: Pick<AppointmentMeasures, CampoMedida> | null | undefined): string {
  if (!m) return "";
  const num = (n: number) => n.toLocaleString("pt-BR");
  const partes: string[] = [];
  if (m.weight_kg !== null) partes.push(`${num(m.weight_kg)} kg`);
  if (m.bp_sys !== null || m.bp_dia !== null) partes.push(`${m.bp_sys ?? "—"}/${m.bp_dia ?? "—"} mmHg`);
  if (m.fundal_height_cm !== null) partes.push(`altura uterina ${num(m.fundal_height_cm)} cm`);
  if (m.fetal_heart_rate !== null) partes.push(`batimentos ${m.fetal_heart_rate} bpm`);
  return partes.join(" · ");
}

/** Últimas medidas registradas (para "Levar para a consulta"): as da consulta concluída mais recente que tem alguma. */
export function ultimasMedidas(consultas: Appointment[], medidas: AppointmentMeasures[]): { consulta: Appointment; medidas: AppointmentMeasures } | null {
  const porId = new Map(medidas.filter((m) => !m.apagado_em).map((m) => [m.appointment_id, m]));
  const c = consultas
    .filter((x) => !x.apagado_em && x.status === "done" && temMedidas(porId.get(x.id)))
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at))[0];
  return c ? { consulta: c, medidas: porId.get(c.id)! } : null;
}

// ---------------------------------------------------------------------------
// Migração da antiga `consultas` (spec 05) para `appointments` (funcionalidade 04)
// ---------------------------------------------------------------------------
export interface ConsultaAntiga {
  id: string;
  data: string;
  tipo: "pre_natal" | "ultrassom" | "exame" | "outro";
  profissional?: string | null;
  local?: string | null;
  realizada: boolean;
  notas?: string | null;
  atualizado_em: string;
  apagado_em?: string | null;
}

const KIND_ANTIGO: Record<ConsultaAntiga["tipo"], AppointmentKind> = { pre_natal: "prenatal", ultrassom: "ultrasound", exame: "other", outro: "other" };

export function converterConsultaAntiga(c: ConsultaAntiga): { consulta: Appointment; medidas: AppointmentMeasures | null } {
  const consulta: Appointment = {
    id: c.id,
    starts_at: c.data,
    kind: KIND_ANTIGO[c.tipo] ?? "other",
    provider_name: c.profissional ?? null,
    provider_role: null,
    location: c.local ?? null,
    status: c.realizada ? "done" : "scheduled",
    followup_dismissed: false,
    atualizado_em: c.atualizado_em,
    apagado_em: c.apagado_em ?? null,
  };
  const medidas: AppointmentMeasures | null = c.notas
    ? { id: c.id, appointment_id: c.id, weight_kg: null, bp_sys: null, bp_dia: null, fundal_height_cm: null, fetal_heart_rate: null, notes_after: c.notas.slice(0, 1000), atualizado_em: c.atualizado_em, apagado_em: c.apagado_em ?? null }
    : null;
  return { consulta, medidas };
}
