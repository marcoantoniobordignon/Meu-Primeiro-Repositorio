/**
 * Spec 02 · Medicamentos: regras puras de agenda e doses. O app e o job do servidor
 * usam as mesmas funções, com ids determinísticos, então as doses geradas nos dois
 * lados convergem num registro só.
 */
import { idDeterministico } from "./id.ts";
import { dataNoFuso, diaSemanaISO, instanteLocal, MS_DIA, MS_HORA, MS_MIN, normalizarHora, somarDiasISO, type DataISO, type HoraISO } from "./tempo.ts";

export type ScheduleType = "fixed_times" | "interval" | "weekdays" | "as_needed";
export type DoseStatus = "pending" | "taken" | "skipped" | "missed";
export type DoseSource = "push" | "app" | "voice" | "backfill";

export interface MedicamentoAgenda {
  id: string;
  schedule_type: ScheduleType;
  times?: HoraISO[] | null;
  interval_hours?: number | null;
  interval_anchor?: HoraISO | null;
  weekdays?: number[] | null;
  starts_on: DataISO;
  ends_on?: DataISO | null;
  is_active: boolean;
  /** RN-15: lembrete desligado mantém as doses para registro manual. */
  reminders_on?: boolean;
  atualizado_em: string;
  apagado_em?: string | null;
}

export interface DoseBase {
  id: string;
  medication_id: string;
  scheduled_at: string | null;
  status: DoseStatus;
  taken_at?: string | null;
  source?: DoseSource | null;
  snooze_count?: number;
  snoozed_until?: string | null;
  atualizado_em?: string;
  apagado_em?: string | null;
}

/** Materialização: hoje e os próximos 6 dias. */
export const DIAS_MATERIALIZADOS = 7;
/** RN-04: passadas 2 h do horário, a dose pendente vira "Sem registro". */
export const SEM_REGISTRO_APOS_MS = 2 * MS_HORA;
/** RN-04: um único reforço 30 min depois. */
export const REFORCO_APOS_MS = 30 * MS_MIN;
/** RN-05: "Adiar" empurra 15 min, no máximo 2 vezes por dose. */
export const ADIAR_MS = 15 * MS_MIN;
export const MAX_ADIAMENTOS = 2;
/** RN-08: registro retroativo até 7 dias atrás. */
export const DIAS_RETROATIVO = 7;
/** Volta depois de dias fora: recria no máximo 30 dias de doses passadas (janela da adesão). */
export const DIAS_RECUPERACAO = 30;
/** RN-11: limite do plano free. */
export const LIMITE_ATIVOS_FREE = 3;

export function idDaDose(medicationId: string, instante: Date): string {
  return idDeterministico(`dose:${medicationId}:${instante.toISOString()}`);
}

export function validaAgenda(m: Pick<MedicamentoAgenda, "schedule_type" | "times" | "interval_hours" | "interval_anchor" | "weekdays" | "starts_on" | "ends_on">): string | null {
  const horarios = m.times ?? [];
  switch (m.schedule_type) {
    case "fixed_times":
      if (horarios.length < 1 || horarios.length > 4) return "horarios";
      break;
    case "weekdays":
      if (horarios.length < 1 || horarios.length > 4) return "horarios";
      if (!m.weekdays?.length || m.weekdays.some((d) => d < 0 || d > 6)) return "dias";
      break;
    case "interval":
      if (!m.interval_hours || m.interval_hours < 4 || m.interval_hours > 24) return "intervalo";
      if (!m.interval_anchor) return "ancora";
      break;
    case "as_needed":
      break;
  }
  if (m.ends_on && m.ends_on < m.starts_on) return "fim";
  return null;
}

/** Horários locais de um dia (sem fuso): "08:00", ou "08:00+16h" para intervalo. */
function instantesDoDia(m: MedicamentoAgenda, data: DataISO, tz: string): Date[] {
  if (data < m.starts_on || (m.ends_on && data > m.ends_on)) return [];
  switch (m.schedule_type) {
    case "as_needed":
      return [];
    case "fixed_times":
      return unicos((m.times ?? []).map((h) => instanteLocal(data, normalizarHora(h), tz)));
    case "weekdays":
      if (!(m.weekdays ?? []).includes(diaSemanaISO(data))) return [];
      return unicos((m.times ?? []).map((h) => instanteLocal(data, normalizarHora(h), tz)));
    case "interval": {
      const n = m.interval_hours ?? 0;
      if (!m.interval_anchor || n < 4) return [];
      // "Primeira dose do dia": âncora e a cada N horas dentro das 24 h seguintes.
      const ancora = instanteLocal(data, normalizarHora(m.interval_anchor), tz).getTime();
      const lista: Date[] = [];
      for (let k = 0; k * n < 24; k++) lista.push(new Date(ancora + k * n * MS_HORA));
      return lista;
    }
  }
}

function unicos(lista: Date[]): Date[] {
  const vistos = new Set<number>();
  return lista.filter((d) => (vistos.has(d.getTime()) ? false : (vistos.add(d.getTime()), true))).sort((a, b) => a.getTime() - b.getTime());
}

/** Todos os horários programados entre duas datas de calendário (inclusive), no fuso. */
export function horariosProgramados(m: MedicamentoAgenda, de: DataISO, ate: DataISO, tz: string): Date[] {
  const lista: Date[] = [];
  for (let d = de; d <= ate; d = somarDiasISO(d, 1)) lista.push(...instantesDoDia(m, d, tz));
  return unicos(lista);
}

export function medicamentoVivo(m: MedicamentoAgenda): boolean {
  return m.is_active && !m.apagado_em;
}

export interface Reconciliacao<D extends DoseBase> {
  criar: D[];
  /** Ids de doses pendentes futuras que saíram da agenda (soft delete). */
  apagar: string[];
}

/**
 * Materialização (modelo de dados da spec):
 * - futuro: a agenda atual dos próximos 7 dias; pendentes futuras fora dela são apagadas
 *   (edição, troca de fuso RN-03, medicamento arquivado);
 * - passado: dias que nunca foram materializados (app fechado, job parado) ganham as
 *   doses que faltam, desde a última edição do medicamento, no máximo 30 dias;
 * - estados finais (taken, skipped, missed) nunca são tocados.
 */
export function reconciliarDoses<D extends DoseBase>(
  m: MedicamentoAgenda,
  doses: D[],
  agora: Date,
  tz: string,
  nova: (base: DoseBase) => D,
): Reconciliacao<D> {
  const t = agora.getTime();
  const daMed = doses.filter((d) => d.medication_id === m.id);
  const vivas = daMed.filter((d) => !d.apagado_em);
  const porId = new Map(daMed.map((d) => [d.id, d]));
  const vivasPorInstante = new Map(vivas.filter((d) => d.scheduled_at).map((d) => [new Date(d.scheduled_at!).getTime(), d]));

  const hoje = dataNoFuso(agora, tz);
  const ate = somarDiasISO(hoje, DIAS_MATERIALIZADOS - 1);
  const desejadas = medicamentoVivo(m) ? horariosProgramados(m, somarDiasISO(hoje, -DIAS_RECUPERACAO), ate, tz) : [];
  const desejadasFuturas = new Set(desejadas.filter((d) => d.getTime() > t).map((d) => d.getTime()));
  const editadoEm = new Date(m.atualizado_em).getTime();

  const criar: D[] = [];
  for (const instante of desejadas) {
    const ms = instante.getTime();
    if (vivasPorInstante.has(ms)) continue;
    const id = idDaDose(m.id, instante);
    if (ms > t) {
      criar.push(nova({ id, medication_id: m.id, scheduled_at: instante.toISOString(), status: "pending", taken_at: null, source: null, snooze_count: 0, snoozed_until: null, apagado_em: null }));
      continue;
    }
    // Passado: só o que nunca existiu e veio depois da última edição.
    if (porId.has(id) || ms <= editadoEm || ms < t - DIAS_RECUPERACAO * MS_DIA) continue;
    criar.push(nova({ id, medication_id: m.id, scheduled_at: instante.toISOString(), status: ms + SEM_REGISTRO_APOS_MS <= t ? "missed" : "pending", taken_at: null, source: null, snooze_count: 0, snoozed_until: null, apagado_em: null }));
  }

  const apagar = vivas
    .filter((d) => d.status === "pending" && d.scheduled_at && new Date(d.scheduled_at).getTime() > t && !desejadasFuturas.has(new Date(d.scheduled_at).getTime()))
    .map((d) => d.id);

  return { criar, apagar };
}

/** RN-04: pendentes com mais de 2 h do horário viram "missed". Devolve as que mudam. */
export function dosesSemRegistro<D extends DoseBase>(doses: D[], agora: Date): D[] {
  const t = agora.getTime();
  return doses.filter((d) => !d.apagado_em && d.status === "pending" && d.scheduled_at && new Date(d.scheduled_at).getTime() + SEM_REGISTRO_APOS_MS <= t);
}

/** RN-11: passou de ends_on (no fuso), vira inativo sozinho. */
export function deveArquivar(m: MedicamentoAgenda, agora: Date, tz: string): boolean {
  return m.is_active && !m.apagado_em && Boolean(m.ends_on) && dataNoFuso(agora, tz) > m.ends_on!;
}

/** RN-05: pode adiar enquanto pendente e com menos de 2 adiamentos. */
export function podeAdiar(d: DoseBase): boolean {
  return d.status === "pending" && (d.snooze_count ?? 0) < MAX_ADIAMENTOS;
}

export function adiar<D extends DoseBase>(d: D, agora: Date): D {
  if (!podeAdiar(d)) return d;
  return { ...d, snooze_count: (d.snooze_count ?? 0) + 1, snoozed_until: new Date(agora.getTime() + ADIAR_MS).toISOString() };
}

/** Lembretes de uma dose pendente (RN-04/05): na hora, um reforço em 30 min; adiada, só no horário adiado. */
export function horariosDeLembrete(d: DoseBase): { tipo: "principal" | "reforco" | "adiada"; em: Date }[] {
  if (d.apagado_em || d.status !== "pending" || !d.scheduled_at) return [];
  const t0 = new Date(d.scheduled_at).getTime();
  if ((d.snooze_count ?? 0) > 0 && d.snoozed_until) {
    return [
      { tipo: "principal", em: new Date(t0) },
      { tipo: "adiada", em: new Date(d.snoozed_until) },
    ];
  }
  return [
    { tipo: "principal", em: new Date(t0) },
    { tipo: "reforco", em: new Date(t0 + REFORCO_APOS_MS) },
  ];
}
