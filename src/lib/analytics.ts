/**
 * track() tipado. Só nomes de evento definidos nas specs entram aqui.
 * ARQ-05: nunca mandar dado de saúde; só contagens, tipos e flags.
 */

type Modo = "gestacao" | "bebe";

export type Eventos = {
  // spec 01
  app_aberto: { modo: Modo; standalone: boolean; online: boolean };
  // spec 03
  tela_vista: { rota: string; modo: Modo };
  plus_aberto: { modo: Modo; origem: "tab" | "atalho" };
  tema_alterado: { tema: "auto" | "claro" | "escuro" };
  // spec 04
  onb_iniciado: Record<string, never>;
  onb_tela_vista: { n: number };
  onb_valor_visto: { semana: number };
  onb_pulou: { n: number };
  onb_instalacao_mostrada: { sistema: "ios" | "android" | "outro" };
  onb_push_permitido: { permitido: boolean };
  onb_cadastro: { metodo: "google" | "email" | "pulou" };
  onb_concluido: { segundos: number; telas_puladas: number };
  // spec 05
  home_gestacao_vista: { semana: number; trimestre: number };
  chutes_sessao: { total: number; minutos: number };
  contracoes_sessao: { n: number; alerta_padrao: boolean };
  // spec 06
  sintoma_registrado: { slug: string; intensidade: number; origem: "chip" | "sheet" | "onboarding" | "voz" };
  sintoma_removido: { slug: string };
  diario_visto: { dias_com_registro: number };
  resumo_copiado: { dias: number; sintomas: number };
  // spec 07
  story_vista: { id: string; categoria: string; semana: number; posicao: number };
  story_concluida: { id: string; cards: number; segundos: number };
  story_guardada: { id: string };
  story_bloqueada_premium: { id: string };
  // spec 08
  voz_iniciada: { modo: Modo; motor: "web_speech" | "gravacao" };
  voz_transcrita: { ms: number; chars: number };
  voz_interpretada: { tipos: string; n: number; confianca: number; ms: number };
  voz_aceita: { n: number };
  voz_corrigida: { tipo: string };
  voz_nao_entendida: { motivo: string };
  voz_sem_permissao: Record<string, never>;
  // spec 09
  home_bebe_vista: { bebes: number; sono_em_andamento: boolean };
  registro_criado: { tipo: string; origem: string; atraso_min: number; autor_papel?: string };
  registro_editado: { tipo: string; campo: string };
  registro_apagado: { tipo: string; desfeito: boolean };
  timer_iniciado: { tipo: string; lado?: string };
  timer_encerrado: { tipo: string; minutos: number };
  dia_visto: { registros: number };
  // spec 10
  previsao_vista: { estado: string; base: string };
  previsao_aviso_ligado: { ligado: boolean };
  previsao_acerto: { diff_min: number };
  // spec 11
  nascimento_registrado: { semanas_gestacao: number; prematuro: boolean; gemeos: boolean; dias_apos_dpp: number };
  nascimento_desfeito: Record<string, never>;
  cortesia_iniciada: Record<string, never>;
  cortesia_encerrada: { converteu: boolean };
  pos_parto_checkin: { dia: number; sinal_alerta: boolean };
  // spec 12
  convite_gerado: { papel: string };
  convite_aberto: { valido: boolean };
  convite_aceito: { papel: string; tinha_conta: boolean };
  membro_removido: { papel: string };
  // paywall (disparado pelas funcionalidades 02, 05 e 06)
  paywall_shown: { feature: "medications" | "belly_video" | "diary" | "exam_gallery"; trigger: "active_limit" | "hd_export" | "audio_limit" | "pages_limit" | "ai_reading" | "pdf_export" };
  // funcionalidade 01 · galeria de exames e ultrassons
  exam_doc_add_started: Record<string, never>;
  exam_doc_added: { kind: string; pages: number; source: "camera" | "gallery" | "pdf" | "mixed" };
  exam_doc_viewed: { kind: string };
  exam_doc_ai_consent_given: Record<string, never>;
  exam_doc_ai_read_requested: Record<string, never>;
  exam_doc_ai_read_done: { ok: boolean };
  exam_doc_exported: { docs: number; pages: number };
  exam_doc_deleted: Record<string, never>;
  exam_doc_linked_to_exam: Record<string, never>;
  // funcionalidade 02 · medicamentos
  med_added: { schedule_type: string };
  med_dose_taken: { source: "push" | "app" | "voice" | "backfill"; minutes_late: number };
  med_dose_skipped: Record<string, never>;
  med_dose_snoozed: Record<string, never>;
  med_adherence_viewed: Record<string, never>;
  med_voice_logged: { matched: boolean };
  med_list_shared: Record<string, never>;
  // funcionalidade 03 · exames
  exam_reminder_opened: { code: string };
  exam_scheduled: { code: string; days_to_window_end: number | null };
  exam_marked_done: { with_document: boolean };
  exam_dismissed: { code: string };
  exam_restored: Record<string, never>;
  exam_custom_added: Record<string, never>;
  exam_extra_added: { code: string };
  // funcionalidade 04 · consultas
  appt_created: { kind: string; source: "manual" | "suggestion" };
  appt_completed: { has_measures: boolean };
  appt_cancelled: Record<string, never>;
  appt_question_added: { source: "text" | "voice" | "partner" };
  appt_question_asked: Record<string, never>;
  appt_bring_opened: Record<string, never>;
  appt_share_tapped: Record<string, never>;
  appt_reminder_opened: Record<string, never>;
  // funcionalidade 05 · foto da barriga
  belly_photo_added: { source: "camera" | "gallery"; replaced: boolean; week: number };
  belly_photo_deleted: Record<string, never>;
  belly_reminder_opened: Record<string, never>;
  belly_timelapse_played: { photos: number };
  belly_video_export_started: { tier: "free" | "premium" };
  belly_video_exported: { tier: "free" | "premium"; ok: boolean };
  belly_photo_shared: Record<string, never>;
  // funcionalidade 06 · diário
  diary_entry_created: { kind: "free" | "milestone"; milestone_code: string | null; has_audio: boolean; photos: number; source: "text" | "dictation" };
  diary_milestone_shown: { code: string };
  diary_milestone_skipped: { code: string };
  diary_milestone_snoozed: { code: string };
  diary_entry_shared_partner: Record<string, never>;
  diary_search_used: Record<string, never>;
};

type Gtag = (comando: "event", nome: string, params?: Record<string, unknown>) => void;

declare global {
  interface Window {
    gtag?: Gtag;
  }
}

export function track<N extends keyof Eventos>(nome: N, params: Eventos[N]): void {
  if (typeof window === "undefined") return;
  if (window.gtag) {
    window.gtag("event", nome, params);
    return;
  }
  if (process.env.NODE_ENV === "development") {
    console.debug("[track]", nome, params);
  }
}
