import type { DataISO } from "@/lib/dates";

import { criarColecao, type Registro } from "./colecao";

/** Spec 06 */
export interface Sintoma extends Registro {
  data: DataISO;
  slug: string;
  intensidade: 1 | 2 | 3;
  nota?: string | null;
  origem: "chip" | "sheet" | "onboarding";
}

/** Spec 05 */
export interface Consulta extends Registro {
  data: string; // ISO datetime local
  tipo: "pre_natal" | "ultrassom" | "exame" | "outro";
  profissional?: string | null;
  local?: string | null;
  realizada: boolean;
  notas?: string | null;
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

export const sintomas = criarColecao<Sintoma>("ninho.sintomas");
export const consultas = criarColecao<Consulta>("ninho.consultas");
export const sessoesChutes = criarColecao<SessaoChutes>("ninho.sessoes_chutes");
export const contracoes = criarColecao<Contracao>("ninho.contracoes");
export const conteudosLidos = criarColecao<ConteudoLido>("ninho.conteudos_lidos");

export const todasColecoes = [sintomas, consultas, sessoesChutes, contracoes, conteudosLidos];
