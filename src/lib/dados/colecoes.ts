import type { DataISO } from "@/lib/dates";
import type { PermissoesParceiro } from "@/lib/familia/regras";
import type { ResumoLaudo, TipoDocumento } from "@dominio/galeria.ts";
import type { DoseSource, DoseStatus, ScheduleType } from "@dominio/medicamentos.ts";

import { criarColecao, type Registro } from "./colecao";

/** Spec 06 */
export interface Sintoma extends Registro {
  data: DataISO;
  slug: string;
  intensidade: 1 | 2 | 3;
  nota?: string | null;
  origem: "chip" | "sheet" | "onboarding" | "voz";
}

/**
 * Specs das funcionalidades 02–06 (specs/funcionalidades): nomes de tabela, coluna e
 * valor como na spec; as colunas de infraestrutura seguem a régua do projeto
 * (familia_id no lugar de pregnancy_id, criado_por no lugar de created_by/author_id,
 * criado_em/atualizado_em/apagado_em no lugar de created_at/updated_at).
 */

/** Funcionalidade 04 · Cronograma de consultas (substitui a antiga `consultas` da spec 05). */
export type AppointmentKind = "prenatal" | "ultrasound" | "other";
export type ProviderRole = "obstetrician" | "midwife" | "nurse" | "nutritionist" | "dentist" | "other";
export type AppointmentStatus = "scheduled" | "done" | "cancelled";

export interface Appointment extends Registro {
  starts_at: string;
  kind: AppointmentKind;
  provider_name: string | null;
  provider_role: ProviderRole | null;
  location: string | null;
  status: AppointmentStatus;
  /** RN-07: "Como foi a consulta?" aparece uma única vez; dispensar grava aqui. */
  followup_dismissed: boolean;
}

export interface AppointmentQuestion extends Registro {
  /** null = "para a próxima consulta" (RN-02). */
  appointment_id: string | null;
  text: string;
  was_asked: boolean;
  answer: string | null;
  position: number;
  criado_por?: string;
}

/**
 * Medidas e orientações do pós-consulta. `notes_after` mora aqui (e não em
 * `appointments`) porque esta tabela é só da gestante: o parceiro nunca vê (RN-10).
 * `id` = `appointment_id`.
 */
export interface AppointmentMeasures extends Registro {
  appointment_id: string;
  weight_kg: number | null;
  bp_sys: number | null;
  bp_dia: number | null;
  fundal_height_cm: number | null;
  fetal_heart_rate: number | null;
  notes_after: string | null;
}

/** Funcionalidade 02 · Medicamentos */
export type CorMedicamento = "primaria" | "acento";

export interface Medication extends Registro {
  name: string;
  dose: string | null;
  instructions: string | null;
  schedule_type: ScheduleType;
  times: string[] | null;
  interval_hours: number | null;
  interval_anchor: string | null;
  weekdays: number[] | null;
  starts_on: DataISO;
  ends_on: DataISO | null;
  is_active: boolean;
  /** RN-15: lembrete desligado mantém o registro manual. */
  reminders_on: boolean;
  color_key: CorMedicamento;
}

export interface MedicationDose extends Registro {
  medication_id: string;
  scheduled_at: string | null;
  status: DoseStatus;
  taken_at: string | null;
  source: DoseSource | null;
  /** RN-05 */
  snooze_count: number;
  snoozed_until: string | null;
}

/** Funcionalidade 03 · Exames */
export type ExamStatus = "to_schedule" | "scheduled" | "done" | "dismissed";

export interface UserExam extends Registro {
  catalog_code: string | null;
  custom_name: string | null;
  status: ExamStatus;
  window_start_date: DataISO | null;
  window_end_date: DataISO | null;
  past_window: boolean;
  /** RN-09: janela opcional em semanas do exame personalizado (recalcula com a DUM). */
  window_start_week: number | null;
  window_end_week: number | null;
  scheduled_at: string | null;
  scheduled_all_day: boolean;
  location: string | null;
  notes: string | null;
  done_on: DataISO | null;
  document_id: string | null;
}

/** Funcionalidade 01 · Galeria de exames e ultrassons. A semana vem de `exam_date` (nunca gravada). */
export interface MedicalDocument extends Registro {
  kind: TipoDocumento;
  title: string | null;
  exam_date: DataISO;
  notes: string | null;
  is_favorite: boolean;
  shared_with_partner: boolean;
  /** RN-04 / spec 03: o exame agendado de que este é o resultado. */
  scheduled_exam_id: string | null;
  ai_status: "none" | "pending" | "done" | "failed";
  ai_summary: ResumoLaudo | null;
  criado_por?: string;
}

export interface DocumentPage extends Registro {
  document_id: string;
  position: number;
  storage_path: string;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
}

/** Funcionalidade 05 · Foto da barriga */
export interface BellyPhoto extends Registro {
  gest_week: number;
  taken_on: DataISO;
  storage_path: string;
  width: number;
  height: number;
  caption: string | null;
  criado_por?: string;
}

/** Funcionalidade 06 · Diário */
export interface DiaryEntry extends Registro {
  kind: "free" | "milestone";
  milestone_code: string | null;
  body: string | null;
  entry_date: DataISO;
  audio_path: string | null;
  audio_seconds: number | null;
  shared_with_partner: boolean;
  /** Permite ao banco checar "texto, áudio ou foto" (RN-01) sem depender da ordem de envio. */
  photo_count: number;
  criado_por?: string;
}

export interface DiaryPhoto extends Registro {
  entry_id: string;
  position: 1 | 2 | 3;
  storage_path: string;
}

/** RN-03: "Pular" e "Mais tarde" por autora e marco (id determinístico). */
export interface DiaryMilestoneState extends Registro {
  milestone_code: string;
  skipped_at: string | null;
  snoozed_until: string | null;
  criado_por?: string;
}

export interface SessaoChutes extends Registro {
  inicio: string;
  fim?: string | null;
  total: number;
}

export interface Contracao extends Registro {
  inicio: string;
  fim?: string | null;
}

/** Spec 07 */
export interface ConteudoLido extends Registro {
  conteudo_id: string;
  lido_em: string;
  guardado: boolean;
}

/** Spec 09/11 */
export interface Bebe extends Registro {
  nome: string;
  nascido_em: string; // ISO datetime
  prematuro_semanas?: number | null;
  ordem: number;
  aviso_soneca: boolean;
  /** VIR-06: "não nasceu ainda" só nas primeiras 24 h após registrar. */
  registrado_em: string;
}

export type TipoRegistroBebe = "sono" | "mamada" | "fralda" | "banho" | "outro";

export interface DadosMamada {
  tipo: "peito" | "mamadeira" | "formula" | "bomba";
  lado?: "E" | "D" | "ambos" | null;
  ml?: number | null;
  /** Segundos acumulados por lado (timer de peito). */
  segundos_E?: number;
  segundos_D?: number;
  /** Lado que está correndo e desde quando (timer em andamento). */
  lado_desde?: string | null;
}
export interface DadosFralda {
  conteudo: "xixi" | "coco" | "ambos" | "seca";
}
export interface DadosOutro {
  texto: string;
}
export type DadosRegistro = DadosMamada | DadosFralda | DadosOutro | Record<string, never>;

export interface RegistroBebe extends Registro {
  bebe_id: string;
  tipo: TipoRegistroBebe;
  inicio: string;
  fim: string | null;
  dados: DadosRegistro;
  origem: "voz" | "manual" | "timer";
  criado_por: string;
}

/** Spec 11 */
export interface PosPartoCheckin extends Registro {
  data: DataISO;
  dor: 0 | 1 | 2 | 3;
  sangramento: "leve" | "moderado" | "intenso" | null;
  humor: 1 | 2 | 3 | 4 | 5;
  nota?: string | null;
}

/** Spec 12 */
export type Papel = "mae" | "parceiro" | "avo" | "cuidador";

export interface Membro extends Registro {
  profile_id: string;
  nome: string;
  papel: Papel;
  convidado_por?: string | null;
  ultimo_acesso_em: string;
  /** Funcionalidades 04/05: o que a gestante liberou para o parceiro. */
  permissoes?: PermissoesParceiro;
}

export interface Convite extends Registro {
  token: string;
  papel: Exclude<Papel, "mae">;
  criado_por: string;
  expira_em: string;
  usado_por?: string | null;
  usado_em?: string | null;
}

/** Spec 08 */
export interface VozPendente extends Registro {
  transcricao: string;
  modo: "gestacao" | "bebe";
}

export const sintomas = criarColecao<Sintoma>("ninho.sintomas");
export const appointments = criarColecao<Appointment>("ninho.appointments");
export const appointmentQuestions = criarColecao<AppointmentQuestion>("ninho.appointment_questions");
export const appointmentMeasures = criarColecao<AppointmentMeasures>("ninho.appointment_measures");
export const medications = criarColecao<Medication>("ninho.medications");
export const medicationDoses = criarColecao<MedicationDose>("ninho.medication_doses");
export const userExams = criarColecao<UserExam>("ninho.user_exams");
export const medicalDocuments = criarColecao<MedicalDocument>("ninho.medical_documents");
export const documentPages = criarColecao<DocumentPage>("ninho.document_pages");
export const bellyPhotos = criarColecao<BellyPhoto>("ninho.belly_photos");
export const diaryEntries = criarColecao<DiaryEntry>("ninho.diary_entries");
export const diaryPhotos = criarColecao<DiaryPhoto>("ninho.diary_photos");
export const diaryMilestoneStates = criarColecao<DiaryMilestoneState>("ninho.diary_milestone_states");
export const sessoesChutes = criarColecao<SessaoChutes>("ninho.sessoes_chutes");
export const contracoes = criarColecao<Contracao>("ninho.contracoes");
export const conteudosLidos = criarColecao<ConteudoLido>("ninho.conteudos_lidos");
export const bebes = criarColecao<Bebe>("ninho.bebes");
export const registrosBebe = criarColecao<RegistroBebe>("ninho.registros");
export const posPartoCheckins = criarColecao<PosPartoCheckin>("ninho.pos_parto_checkins");
export const membros = criarColecao<Membro>("ninho.membros");
export const convites = criarColecao<Convite>("ninho.convites");
export const vozPendentes = criarColecao<VozPendente>("ninho.voz_pendentes");

/** Spec 07 + painel: conteúdos editados no servidor, mesclados ao bundle (só leitura, nunca vai para a outbox). */
export const conteudosRemotos = criarColecao<Registro & Record<string, unknown>>("ninho.conteudos");

export const todasColecoes = [
  sintomas,
  appointments,
  appointmentQuestions,
  appointmentMeasures,
  medications,
  medicationDoses,
  userExams,
  medicalDocuments,
  documentPages,
  bellyPhotos,
  diaryEntries,
  diaryPhotos,
  diaryMilestoneStates,
  sessoesChutes,
  contracoes,
  conteudosLidos,
  bebes,
  registrosBebe,
  posPartoCheckins,
  membros,
  convites,
  vozPendentes,
];
