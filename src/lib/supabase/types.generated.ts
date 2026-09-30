/**
 * Tipos do banco. Gere com `pnpm supabase:types` (precisa do Supabase local rodando);
 * esta versão foi escrita à mão a partir de supabase/migrations/0001_schema.sql e
 * o teste em src/lib/supabase/types.test.ts confere que as tabelas batem.
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
        criado_em: string;
      }>;
      admins: Tabela<{ email: string }>;
      bebes: Tabela<Base & { nome: string; nascido_em: string; prematuro_semanas: number | null; ordem: number; aviso_soneca: boolean; registrado_em: string }>;
      registros: Tabela<Base & { bebe_id: string; tipo: "sono" | "mamada" | "fralda" | "banho" | "outro"; inicio: string; fim: string | null; dados: Json; origem: "voz" | "manual" | "timer" }>;
      sintomas_catalogo: Tabela<{ slug: string; nome: string; grupo: string; cor_token: string | null; semanas_frequentes: number[]; especial: string | null }>;
      sintomas: Tabela<Base & { data: string; slug: string; intensidade: number; nota: string | null; origem: "chip" | "sheet" | "onboarding" | "voz" }>;
      consultas: Tabela<Base & { data: string; tipo: "pre_natal" | "ultrassom" | "exame" | "outro"; profissional: string | null; local: string | null; realizada: boolean; notas: string | null }>;
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
    };
    Views: {
      v_modo: { Row: { familia_id: string; modo: "gestacao" | "bebe" }; Relationships: [] };
    };
    Functions: {
      criar_convite: { Args: { p_papel: string }; Returns: string };
      convite_publico: { Args: { p_token: string }; Returns: Json };
      aceitar_convite: { Args: { p_token: string; p_nome?: string | null }; Returns: string };
      remover_membro: { Args: { p_profile_id: string }; Returns: undefined };
      iniciar_cortesia: { Args: { p_nascido_em: string }; Returns: string | null };
      meus_membros: { Args: Record<string, never>; Returns: { profile_id: string; nome: string | null; papel: string; convidado_por: string | null; ultimo_acesso_em: string }[] };
      minha_familia: { Args: Record<string, never>; Returns: { familia_id: string; papel: string; plano: string; trial_fim: string | null; cortesia_fim: string | null; modo: string }[] };
      familia_do_usuario: { Args: Record<string, never>; Returns: string | null };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Tabelas = Database["public"]["Tables"];
export type NomeTabela = keyof Tabelas;
export type Linha<T extends NomeTabela> = Tabelas[T]["Row"];
