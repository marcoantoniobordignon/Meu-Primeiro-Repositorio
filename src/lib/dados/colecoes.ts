import type { DataISO } from "@/lib/dates";

import { criarColecao, type Registro } from "./colecao";

/** Spec 06 */
export interface Sintoma extends Registro {
  data: DataISO;
  slug: string;
  intensidade: 1 | 2 | 3;
  nota?: string | null;
  origem: "chip" | "sheet" | "onboarding" | "voz";
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
export const consultas = criarColecao<Consulta>("ninho.consultas");
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
  consultas,
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
