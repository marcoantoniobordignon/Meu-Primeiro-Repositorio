import type { Colecao, Registro } from "@/lib/dados/colecao";
import {
  appointmentMeasures,
  appointmentQuestions,
  avisos,
  birthChecklistItems,
  birthItemAttachments,
  birthPlans,
  calendarEvents,
  faqFavoritos,
  articleReads,
  faithFavoritos,
  rightsFavoritos,
  nameVotes,
  cartas,
  retrospectivas,
  appointments,
  bebes,
  bellyPhotos,
  conteudosLidos,
  contracoes,
  diaryEntries,
  diaryMilestoneStates,
  diaryPhotos,
  documentPages,
  medicalDocuments,
  medicationDoses,
  medications,
  posPartoCheckins,
  registrosBebe,
  sessoesChutes,
  sintomas,
  userExams,
} from "@/lib/dados/colecoes";
import { normalizarHora } from "@dominio/tempo.ts";
import type { NomeTabela } from "@/lib/supabase/types.generated";

/**
 * Coleção local ↔ tabela no Supabase. Os campos já têm o mesmo nome dos dois
 * lados (snake_case nas duas pontas), então o mapeamento é só a tabela e a
 * chave de conflito do upsert.
 */
export interface Mapeamento {
  colecao: Colecao<Registro>;
  tabela: NomeTabela;
  /** Coluna(s) do ON CONFLICT do upsert. */
  conflito: string;
  /** Ajuste do que vem do Postgres para o formato local (ex.: `time` volta como "08:00:00"). */
  doServidor?: (linha: Record<string, unknown>) => Record<string, unknown>;
  /** Funcionalidade 14: escrita por função (que valida as regras) em vez de upsert na tabela. */
  rpcEscrita?: string;
  /** Funcionalidade 14: leitura por uma view (a tabela não é lida direto). */
  leitura?: string;
  /** Campos que só existem no aparelho (ex.: `criado_por` em tabelas pessoais, que usam `user_id`). */
  soLocal?: string[];
}

/** `time` e `time[]` do Postgres voltam com segundos; o app usa "HH:MM". */
export function normalizarMedicamento(linha: Record<string, unknown>): Record<string, unknown> {
  const times = Array.isArray(linha.times) ? (linha.times as string[]).map(normalizarHora) : linha.times;
  const anchor = typeof linha.interval_anchor === "string" ? normalizarHora(linha.interval_anchor) : linha.interval_anchor;
  return { ...linha, times, interval_anchor: anchor };
}

/** `numeric` pode voltar como texto conforme o driver; o app usa número. */
export function normalizarMedidas(linha: Record<string, unknown>): Record<string, unknown> {
  const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));
  return { ...linha, weight_kg: num(linha.weight_kg), fundal_height_cm: num(linha.fundal_height_cm) };
}

export const mapeamentos: Mapeamento[] = [
  { colecao: bebes as Colecao<Registro>, tabela: "bebes", conflito: "id" },
  { colecao: registrosBebe as Colecao<Registro>, tabela: "registros", conflito: "id" },
  { colecao: sintomas as Colecao<Registro>, tabela: "sintomas", conflito: "id" },
  { colecao: appointments as Colecao<Registro>, tabela: "appointments", conflito: "id" },
  { colecao: appointmentQuestions as Colecao<Registro>, tabela: "appointment_questions", conflito: "id" },
  { colecao: appointmentMeasures as Colecao<Registro>, tabela: "appointment_measures", conflito: "id", doServidor: normalizarMedidas },
  { colecao: medications as Colecao<Registro>, tabela: "medications", conflito: "id", doServidor: normalizarMedicamento },
  { colecao: medicationDoses as Colecao<Registro>, tabela: "medication_doses", conflito: "id" },
  // Documento antes do exame (user_exams.document_id) e antes das páginas (FKs).
  { colecao: medicalDocuments as Colecao<Registro>, tabela: "medical_documents", conflito: "id" },
  { colecao: documentPages as Colecao<Registro>, tabela: "document_pages", conflito: "id" },
  { colecao: userExams as Colecao<Registro>, tabela: "user_exams", conflito: "id" },
  { colecao: bellyPhotos as Colecao<Registro>, tabela: "belly_photos", conflito: "id" },
  { colecao: diaryEntries as Colecao<Registro>, tabela: "diary_entries", conflito: "id" },
  { colecao: diaryPhotos as Colecao<Registro>, tabela: "diary_photos", conflito: "id" },
  { colecao: diaryMilestoneStates as Colecao<Registro>, tabela: "diary_milestone_states", conflito: "id" },
  { colecao: sessoesChutes as Colecao<Registro>, tabela: "sessoes_chutes", conflito: "id" },
  { colecao: contracoes as Colecao<Registro>, tabela: "contracoes", conflito: "id" },
  { colecao: posPartoCheckins as Colecao<Registro>, tabela: "pos_parto_checkins", conflito: "id" },
  { colecao: conteudosLidos as Colecao<Registro>, tabela: "conteudos_lidos", conflito: "id" },
  // Funcionalidade 12: só o "lido" sai daqui; os avisos nascem no servidor.
  { colecao: avisos as Colecao<Registro>, tabela: "avisos", conflito: "id" },
  { colecao: calendarEvents as Colecao<Registro>, tabela: "calendar_events", conflito: "id" },
  // Funcionalidade 10: o item antes do anexo (a FK e a policy do Storage pedem a linha).
  { colecao: birthPlans as Colecao<Registro>, tabela: "birth_plans", conflito: "id" },
  { colecao: birthChecklistItems as Colecao<Registro>, tabela: "birth_checklist_items", conflito: "id" },
  { colecao: birthItemAttachments as Colecao<Registro>, tabela: "birth_item_attachments", conflito: "id" },
  { colecao: faqFavoritos as Colecao<Registro>, tabela: "faq_favorites", conflito: "id", soLocal: ["criado_por"] },
  { colecao: articleReads as Colecao<Registro>, tabela: "article_reads", conflito: "id", soLocal: ["criado_por"] },
  { colecao: faithFavoritos as Colecao<Registro>, tabela: "faith_favorites", conflito: "id", soLocal: ["criado_por"] },
  { colecao: rightsFavoritos as Colecao<Registro>, tabela: "rights_favorites", conflito: "id", soLocal: ["criado_por"] },
  // Funcionalidade 15: o voto é da pessoa (user_id); a família vem do trigger.
  { colecao: nameVotes as Colecao<Registro>, tabela: "name_votes", conflito: "id", soLocal: ["criado_por"] },
  // Funcionalidade 14: a carta sobe por `salvar_carta` e volta por `letters_visible` (o lacre vale no banco).
  { colecao: cartas as Colecao<Registro>, tabela: "letters", conflito: "id", soLocal: ["criado_por"], rpcEscrita: "salvar_carta", leitura: "letters_visible" },
  // Funcionalidade 07: só a gestante (RLS); família e autor vêm dos triggers.
  { colecao: retrospectivas as Colecao<Registro>, tabela: "retrospectives", conflito: "id" },
];

export function mapeamentoDaColecao(chave: string): Mapeamento | undefined {
  return mapeamentos.find((m) => m.colecao.chave === chave);
}

/** Colunas que só existem no servidor e não devem ir no upsert. */
const SO_SERVIDOR = new Set(["familia_id", "criado_em"]);

export function paraServidor(registro: Registro, soLocal: string[] = []): Record<string, unknown> {
  const saida: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(registro)) {
    if (!SO_SERVIDOR.has(k) && !soLocal.includes(k)) saida[k] = v;
  }
  return saida;
}
