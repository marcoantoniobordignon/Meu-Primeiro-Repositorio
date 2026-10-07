/**
 * Tipos do banco. Gere com `pnpm supabase:types` (precisa do Supabase local rodando);
 * esta versão foi escrita à mão a partir de supabase/migrations/*.sql e
 * o teste em src/lib/supabase/types.test.ts confere que as tabelas (e as colunas das 0003) batem.
 */
type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

interface Tabela<Row, Insert = Partial<Row>, Update = Partial<Row>> {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
}

interface Base {
  id: string;
  familia_id: string | null;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
  apagado_em: string | null;
}

export interface Database {
  public: {
    Tables: {
      profiles: Tabela<{
        id: string;
        nome: string | null;
        modo: "gestacao" | "bebe";
        dpp: string | null;
        tema: "auto" | "claro" | "escuro";
        bebe_ativo_id: string | null;
        telefone_equipe: string | null;
        push_preferencias: Json;
        onboarding_concluido_em: string | null;
        ultimo_acesso_em: string | null;
        tz: string;
        prefs: Json;
        consents: Json;
        criado_em: string;
        atualizado_em: string;
      }>;
      familias: Tabela<{
        id: string;
        dona_id: string;
        plano: "free" | "trial" | "ativo" | "expirado";
        trial_fim: string | null;
        cortesia_fim: string | null;
        stripe_customer_id: string | null;
        criado_em: string;
        atualizado_em: string;
      }>;
      membros_familia: Tabela<{
        familia_id: string;
        profile_id: string;
        papel: "mae" | "parceiro" | "avo" | "cuidador";
        convidado_por: string | null;
        ultimo_acesso_em: string;
        permissoes: Json;
        criado_em: string;
        removido_em: string | null;
      }>;
      admins: Tabela<{ email: string }>;
      bebes: Tabela<Base & { nome: string; nascido_em: string; prematuro_semanas: number | null; ordem: number; aviso_soneca: boolean; registrado_em: string }>;
      registros: Tabela<Base & { bebe_id: string; tipo: "sono" | "mamada" | "fralda" | "banho" | "outro"; inicio: string; fim: string | null; dados: Json; origem: "voz" | "manual" | "timer" }>;
      sintomas_catalogo: Tabela<{ slug: string; nome: string; grupo: string; cor_token: string | null; semanas_frequentes: number[]; especial: string | null }>;
      sintomas: Tabela<Base & { data: string; slug: string; intensidade: number; nota: string | null; origem: "chip" | "sheet" | "onboarding" | "voz" }>;
      sessoes_chutes: Tabela<Base & { inicio: string; fim: string | null; total: number }>;
      contracoes: Tabela<Base & { inicio: string; fim: string | null }>;
      pos_parto_checkins: Tabela<Base & { data: string; dor: number; sangramento: "leve" | "moderado" | "intenso" | null; humor: number; nota: string | null }>;
      conteudos: Tabela<{
        id: string;
        slug: string;
        titulo: string;
        corpo_md: string;
        cards: string[];
        categoria: string;
        cor_token: string;
        semana_min: number | null;
        semana_max: number | null;
        mes_bebe_min: number | null;
        mes_bebe_max: number | null;
        dia_da_semana: number | null;
        minutos_leitura: number;
        premium: boolean;
        publicado: boolean;
        atualizado_em: string;
      }>;
      conteudos_lidos: Tabela<Base & { conteudo_id: string; lido_em: string | null; guardado: boolean }>;
      convites: Tabela<{ token: string; familia_id: string; papel: "parceiro" | "avo" | "cuidador"; criado_por: string; expira_em: string; usado_por: string | null; usado_em: string | null; criado_em: string }>;
      voz_interpretacoes: Tabela<{ id: string; familia_id: string | null; transcricao: string | null; resposta: Json; confianca: number | null; aceita: boolean | null; corrigida: boolean; ms_total: number | null; criado_por: string | null; criado_em: string }>;
      // 0003_funcionalidades.sql
      appointments: Tabela<Base & { starts_at: string; kind: "prenatal" | "ultrasound" | "other"; provider_name: string | null; provider_role: "obstetrician" | "midwife" | "nurse" | "nutritionist" | "dentist" | "other" | null; location: string | null; status: "scheduled" | "done" | "cancelled"; followup_dismissed: boolean }>;
      appointment_questions: Tabela<Base & { appointment_id: string | null; text: string; was_asked: boolean; answer: string | null; position: number }>;
      appointment_measures: Tabela<Base & { appointment_id: string; weight_kg: number | null; bp_sys: number | null; bp_dia: number | null; fundal_height_cm: number | null; fetal_heart_rate: number | null; notes_after: string | null }>;
      medications: Tabela<
        Base & {
          name: string;
          dose: string | null;
          instructions: string | null;
          schedule_type: "fixed_times" | "interval" | "weekdays" | "as_needed";
          times: string[] | null;
          interval_hours: number | null;
          interval_anchor: string | null;
          weekdays: number[] | null;
          starts_on: string;
          ends_on: string | null;
          is_active: boolean;
          reminders_on: boolean;
          color_key: string;
        }
      >;
      medication_doses: Tabela<Base & { medication_id: string; scheduled_at: string | null; status: "pending" | "taken" | "skipped" | "missed"; taken_at: string | null; source: "push" | "app" | "voice" | "backfill" | null; snooze_count: number; snoozed_until: string | null }>;
      exam_catalog: Tabela<{ code: string; name: string; short_desc: string; window_start_day: number; window_end_day: number; trimester: number; doc_kind: string; is_default_on: boolean }>;
      user_exams: Tabela<
        Base & {
          catalog_code: string | null;
          custom_name: string | null;
          status: "to_schedule" | "scheduled" | "done" | "dismissed";
          window_start_date: string | null;
          window_end_date: string | null;
          past_window: boolean;
          window_start_week: number | null;
          window_end_week: number | null;
          scheduled_at: string | null;
          scheduled_all_day: boolean;
          location: string | null;
          notes: string | null;
          done_on: string | null;
          document_id: string | null;
        }
      >;
      belly_photos: Tabela<Base & { gest_week: number; taken_on: string; storage_path: string; width: number | null; height: number | null; caption: string | null }>;
      milestone_catalog: Tabela<{ code: string; title: string; prompt_text: string; prompt_text_faith: string | null; faith_only: boolean; window_start_week: number | null; window_end_week: number | null; push_on_open: boolean; position: number }>;
      diary_entries: Tabela<Base & { kind: "free" | "milestone"; milestone_code: string | null; body: string | null; entry_date: string; audio_path: string | null; audio_seconds: number | null; shared_with_partner: boolean; photo_count: number }>;
      diary_photos: Tabela<Base & { entry_id: string; position: number; storage_path: string }>;
      diary_milestone_states: Tabela<Base & { milestone_code: string; skipped_at: string | null; snoozed_until: string | null }>;
      push_subscriptions: Tabela<{ endpoint: string; profile_id: string; p256dh: string; auth: string; criado_em: string; atualizado_em: string }>;
      // 0004_galeria.sql
      medical_documents: Tabela<
        Base & {
          kind: "us_obstetric" | "us_nuchal" | "us_morpho" | "us_other" | "blood" | "urine" | "glucose" | "serology" | "culture_gbs" | "other";
          title: string | null;
          exam_date: string;
          notes: string | null;
          is_favorite: boolean;
          shared_with_partner: boolean;
          scheduled_exam_id: string | null;
          ai_status: "none" | "pending" | "done" | "failed";
          ai_summary: Json | null;
        }
      >;
      document_pages: Tabela<Base & { document_id: string; position: number; storage_path: string; mime: string; bytes: number; width: number | null; height: number | null }>;
      ai_document_reads: Tabela<{ id: string; familia_id: string; document_id: string | null; ok: boolean; criado_em: string }>;
      reminders_sent: Tabela<{ familia_id: string; chave: string; categoria: "med" | "exam" | "appt" | "belly" | "diary" | "partner" | "calendar" | "birth_plan" | "faq"; tipo: string; ref: string; essencial: boolean; enviado_em: string }>;
      // Funcionalidade 12 (0005_parceiro.sql)
      avisos: Tabela<{ id: string; familia_id: string | null; para: string; tipo: string; titulo: string; corpo: string | null; url: string | null; lido_em: string | null; criado_em: string; atualizado_em: string; apagado_em: string | null; push_pendente: boolean }>;
      partner_invites: Tabela<{ id: string; familia_id: string; criado_por: string; token_hash: string; code: string; expires_at: string; accepted_by: string | null; accepted_at: string | null; revoked_at: string | null; criado_em: string }>;
      partner_tips: Tabela<{ id: string; week_from: number; week_to: number; trimester: number; feeling_text: string; help_tips: string[]; reviewed_on: string | null; atualizado_em: string }>;
      // Funcionalidade 08 (0006_calendario.sql)
      calendar_events: Tabela<
        Base & {
          title: string;
          category: "exam" | "appointment" | "course" | "purchase" | "other";
          starts_at: string | null;
          all_day: boolean;
          all_day_date: string | null;
          notes: string | null;
          remind_offset_minutes: 0 | 60 | 1440 | null;
          visible_to_partner: boolean;
        }
      >;
      // Funcionalidade 10 (0007_plano_parto.sql)
      birth_plans: Tabela<
        Base & {
          maternity_name: string | null;
          maternity_address: string | null;
          maternity_phone: string | null;
          maternity_maps_url: string | null;
          coverage: "sus" | "private" | "unknown" | null;
          insurer_name: string | null;
          doctor_name: string | null;
          doctor_phone: string | null;
          wished_delivery: "vaginal" | "cesarean" | "open" | "undecided";
          prefs: Json;
          notes: string | null;
          companion_name: string | null;
          companion_phone: string | null;
          doula_name: string | null;
          doula_phone: string | null;
          emergency_name: string | null;
          emergency_phone: string | null;
          completed_steps: number[];
        }
      >;
      birth_checklist_items: Tabela<Base & { list: "documents" | "bag_mother" | "bag_baby" | "bag_companion" | "layette" | "baptism"; title: string; quantity: number | null; note: string | null; is_done: boolean; is_custom: boolean; position: number }>;
      birth_item_attachments: Tabela<Base & { item_id: string; storage_path: string; position: number }>;
      // Funcionalidade 09 (0008_faq.sql)
      faq_foods: Tabela<{
        id: string;
        slug: string;
        name: string;
        aliases: string[];
        category: "meat" | "fish" | "dairy" | "fruit_veg" | "drink" | "sweet" | "herb_tea" | "other";
        verdict: "safe" | "caution" | "avoid";
        short_answer: string;
        details: string | null;
        condition_note: string | null;
        source_label: string;
        source_url: string | null;
        reviewed_by: string | null;
        reviewed_on: string | null;
        status: "draft" | "published" | "archived";
        views_count: number;
        asked_count: number;
        criado_em: string;
        atualizado_em: string;
      }>;
      faq_questions: Tabela<{ id: string; asked_by: string; text: string; normalized: string; status: "open" | "answered" | "rejected" | "duplicate"; duplicate_of: string | null; answered_food_id: string | null; reject_reason: "fora_do_escopo" | "pergunta_medica" | "repetida" | null; votes_count: number; created_at: string }>;
      faq_question_votes: Tabela<{ question_id: string; user_id: string; criado_em: string }>;
      faq_favorites: Tabela<{ id: string; user_id: string; food_id: string; criado_em: string; atualizado_em: string; apagado_em: string | null }>;
      faq_bloqueio: Tabela<{ palavra: string }>;
      calendar_feed_tokens: Tabela<{ id: string; familia_id: string; token: string; criado_em: string; revoked_at: string | null }>;
    };
    Views: {
      v_modo: { Row: { familia_id: string; modo: "gestacao" | "bebe" }; Relationships: [] };
      calendar_items_v: {
        Row: { familia_id: string; item_type: "appointment" | "exam" | "custom" | "edd"; item_id: string; title: string; location: string | null; starts_at: string | null; all_day: boolean; all_day_date: string | null; color_key: string; deep_link: string };
        Relationships: [];
      };
    };
    Functions: {
      criar_convite: { Args: { p_papel: string }; Returns: string };
      convite_publico: { Args: { p_token: string }; Returns: Json };
      aceitar_convite: { Args: { p_token: string; p_nome?: string | null }; Returns: string };
      remover_membro: { Args: { p_profile_id: string }; Returns: undefined };
      iniciar_cortesia: { Args: { p_nascido_em: string }; Returns: string | null };
      meus_membros: { Args: Record<string, never>; Returns: { profile_id: string; nome: string | null; papel: string; convidado_por: string | null; ultimo_acesso_em: string; permissoes: Json; removido_em: string | null }[] };
      definir_permissoes_parceiro: { Args: { p_profile_id: string; p_permissoes: Json }; Returns: undefined };
      minha_familia: { Args: Record<string, never>; Returns: { familia_id: string; papel: string; plano: string; trial_fim: string | null; cortesia_fim: string | null; modo: string; dpp: string | null }[] };
      // Funcionalidade 12
      criar_convite_parceiro: { Args: Record<string, never>; Returns: Json };
      revogar_convite_parceiro: { Args: Record<string, never>; Returns: undefined };
      convite_parceiro_publico: { Args: { p_token?: string | null; p_code?: string | null }; Returns: Json };
      aceitar_convite_parceiro: { Args: { p_token?: string | null; p_code?: string | null; p_nome?: string | null }; Returns: Json };
      sair_da_gestacao: { Args: Record<string, never>; Returns: undefined };
      // Funcionalidade 09
      buscar_faq: { Args: { q: string }; Returns: { slug: string; name: string; verdict: string; category: string; pontuacao: number }[] };
      faq_contar_visualizacao: { Args: { p_slug: string }; Returns: undefined };
      faq_perguntas_parecidas: { Args: { p_texto: string }; Returns: { id: string; text: string; votes_count: number; ja_votei: boolean }[] };
      faq_perguntar: { Args: { p_texto: string }; Returns: string };
      faq_votar: { Args: { p_pergunta: string }; Returns: number };
      faq_tem_ofensa: { Args: { p_texto: string }; Returns: boolean };
      faq_perguntas_abertas: { Args: Record<string, never>; Returns: { id: string; text: string; votes_count: number; created_at: string }[] };
      faq_publicar: { Args: { p_food: string; p_perguntas?: string[]; p_revisor?: string | null; p_revisado_em?: string | null }; Returns: number };
      faq_rejeitar: { Args: { p_pergunta: string; p_motivo: string }; Returns: undefined };
      // Funcionalidade 08
      feed_calendario: { Args: { p_novo?: boolean }; Returns: string };
      revogar_feed_calendario: { Args: Record<string, never>; Returns: undefined };
      exames_marcados_parceiro: { Args: Record<string, never>; Returns: { id: string; catalog_code: string | null; custom_name: string | null; scheduled_at: string | null; scheduled_all_day: boolean; atualizado_em: string }[] };
      familia_do_usuario: { Args: Record<string, never>; Returns: string | null };
      // Painel de admin (0002_admin.sql): só agregados, exigem eh_admin().
      admin_eu: { Args: Record<string, never>; Returns: Json };
      admin_resumo: { Args: Record<string, never>; Returns: Json };
      admin_serie_diaria: { Args: { p_dias?: number }; Returns: { dia: string; novas: number; ativas: number; registros: number; leituras: number }[] };
      admin_distribuicoes: { Args: Record<string, never>; Returns: Json };
      admin_familias: {
        Args: { p_limite?: number; p_offset?: number };
        Returns: { id: string; modo: string; semana: number | null; mes_bebe: number | null; membros: number; plano: string; criado_em: string; ultimo_acesso_em: string | null; registros: number }[];
      };
      admin_leituras: { Args: Record<string, never>; Returns: { conteudo_id: string; leituras: number; guardados: number }[] };
      admin_voz: { Args: { p_limite?: number }; Returns: Json };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Tabelas = Database["public"]["Tables"];
export type NomeTabela = keyof Tabelas;
export type Linha<T extends NomeTabela> = Tabelas[T]["Row"];
