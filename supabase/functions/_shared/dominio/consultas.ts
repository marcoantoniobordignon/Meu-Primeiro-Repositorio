/**
 * Funcionalidade 04 · Cronograma de consultas: regras puras usadas pelo app e pelo job de lembretes.
 */
import { dataNoFuso, idadeGestacional, inicioDoDia, somarDiasISO, type DataISO } from "./tempo.ts";

export type AppointmentKind = "prenatal" | "ultrasound" | "other";
export type AppointmentStatus = "scheduled" | "done" | "cancelled";

export interface ConsultaBase {
  id: string;
  starts_at: string;
  kind: AppointmentKind;
  status: AppointmentStatus;
  provider_name?: string | null;
  location?: string | null;
  apagado_em?: string | null;
}

export interface PerguntaBase {
  id: string;
  appointment_id: string | null;
  text: string;
  was_asked: boolean;
  answer?: string | null;
  position: number;
  apagado_em?: string | null;
}

/**
 * RN-02: a consulta `scheduled` mais próxima, a partir do começo de hoje (a de hoje,
 * mesmo já passada a hora, segura a pauta até ser concluída; as antigas sem conclusão, não).
 */
export function proximaConsulta<C extends ConsultaBase>(consultas: C[], agora: Date, tz: string): C | undefined {
  const inicioHoje = inicioDoDia(dataNoFuso(agora, tz), tz).getTime();
  return consultas
    .filter((c) => !c.apagado_em && c.status === "scheduled" && new Date(c.starts_at).getTime() >= inicioHoje)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
}

/** Pauta de uma consulta: as vinculadas e, se ela é a próxima, as soltas. Só as ainda não feitas, em ordem. */
export function pautaDaConsulta<P extends PerguntaBase>(consulta: ConsultaBase | undefined, proxima: ConsultaBase | undefined, perguntas: P[]): P[] {
  return perguntas
    .filter((p) => !p.apagado_em && !p.was_asked && ((consulta && p.appointment_id === consulta.id) || (p.appointment_id === null && (!consulta || consulta.id === proxima?.id))))
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}

/** RN-05: ritmo comum do pré-natal pela idade gestacional na data da consulta. */
export function diasDeRetorno(dpp: DataISO, dataConsulta: DataISO): 28 | 14 | 7 {
  const { semana } = idadeGestacional(dpp, dataConsulta);
  if (semana < 28) return 28;
  if (semana < 36) return 14;
  return 7;
}

export function dataDeRetorno(dpp: DataISO, dataConsulta: DataISO): DataISO {
  return somarDiasISO(dataConsulta, diasDeRetorno(dpp, dataConsulta));
}
