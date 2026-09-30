import type { Colecao, Registro } from "@/lib/dados/colecao";
import {
  bebes,
  consultas,
  conteudosLidos,
  contracoes,
  posPartoCheckins,
  registrosBebe,
  sessoesChutes,
  sintomas,
} from "@/lib/dados/colecoes";
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
}

export const mapeamentos: Mapeamento[] = [
  { colecao: bebes as Colecao<Registro>, tabela: "bebes", conflito: "id" },
  { colecao: registrosBebe as Colecao<Registro>, tabela: "registros", conflito: "id" },
  { colecao: sintomas as Colecao<Registro>, tabela: "sintomas", conflito: "id" },
  { colecao: consultas as Colecao<Registro>, tabela: "consultas", conflito: "id" },
  { colecao: sessoesChutes as Colecao<Registro>, tabela: "sessoes_chutes", conflito: "id" },
  { colecao: contracoes as Colecao<Registro>, tabela: "contracoes", conflito: "id" },
  { colecao: posPartoCheckins as Colecao<Registro>, tabela: "pos_parto_checkins", conflito: "id" },
  { colecao: conteudosLidos as Colecao<Registro>, tabela: "conteudos_lidos", conflito: "id" },
];

export function mapeamentoDaColecao(chave: string): Mapeamento | undefined {
  return mapeamentos.find((m) => m.colecao.chave === chave);
}

/** Colunas que só existem no servidor e não devem ir no upsert. */
const SO_SERVIDOR = new Set(["familia_id", "criado_em"]);

export function paraServidor(registro: Registro): Record<string, unknown> {
  const saida: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(registro)) {
    if (!SO_SERVIDOR.has(k)) saida[k] = v;
  }
  return saida;
}
