import type { Conteudo } from "@/lib/conteudo/banco";

/** Números do topo da visão geral (RPC admin_resumo). */
export interface Resumo {
  familias: number;
  familias_7d: number;
  familias_30d: number;
  ativas_1d: number;
  ativas_7d: number;
  ativas_30d: number;
  gestacao: number;
  bebe: number;
  plano_ativo: number;
  trial: number;
  cortesia: number;
  membros: number;
  cuidadores: number;
  registros_7d: number;
  sintomas_7d: number;
  leituras_7d: number;
  voz_7d: number;
  onboarding_concluido: number;
  perfis: number;
  com_email: number;
}

export interface PontoDia {
  dia: string; // YYYY-MM-DD
  novas: number;
  ativas: number;
  registros: number;
  leituras: number;
}

export interface Contagem {
  chave: string;
  n: number;
}

export interface Distribuicoes {
  semanas: Contagem[];
  meses_bebe: Contagem[];
  papeis: Contagem[];
  tipos_registro: Contagem[];
  origens_registro: Contagem[];
  sintomas: Contagem[];
  planos: Contagem[];
}

/** Uma família na lista: nenhum nome, nenhum dado de saúde. */
export interface FamiliaResumo {
  id: string;
  modo: "gestacao" | "bebe";
  semana: number | null;
  mes_bebe: number | null;
  membros: number;
  plano: string;
  criado_em: string;
  ultimo_acesso_em: string | null;
  registros: number;
}

export interface Leitura {
  conteudo_id: string;
  leituras: number;
  guardados: number;
}

export interface VozItem {
  id: string;
  transcricao: string | null;
  resposta: unknown;
  confianca: number | null;
  aceita: boolean | null;
  corrigida: boolean;
  ms_total: number | null;
  criado_em: string;
}

export interface VozResumo {
  total: number;
  total_30d: number;
  aceitas: number;
  corrigidas: number;
  nao_entendidas: number;
  confianca_media: number | null;
  ms_mediano: number | null;
  recentes: VozItem[];
}

/** Uma fonte de dados do painel: o Supabase de verdade ou a demonstração. */
export interface FonteAdmin {
  nome: "supabase" | "demo";
  resumo(): Promise<Resumo>;
  serie(dias: number): Promise<PontoDia[]>;
  distribuicoes(): Promise<Distribuicoes>;
  familias(limite: number, offset: number): Promise<FamiliaResumo[]>;
  leituras(): Promise<Leitura[]>;
  voz(limite: number): Promise<VozResumo>;
  /** Todos os conteúdos, publicados ou não. */
  conteudos(): Promise<Conteudo[]>;
  salvarConteudo(c: Conteudo): Promise<void>;
  apagarConteudo(id: string): Promise<void>;
}
