import type { DataISO } from "@/lib/dates";

/**
 * Estado do onboarding, persistido em localStorage (ONB-04):
 * fechar no meio e voltar retoma na mesma tela, por até 7 dias.
 */

export const TOTAL_TELAS = 7;
export const CHAVE_ESTADO = "ninho.onboarding";
export const CHAVE_PERFIL = "ninho.perfil";
const VALIDADE_MS = 7 * 86_400_000;

export type Momento = "gestacao" | "bebe";

export interface EstadoOnboarding {
  tela: number; // 1..7
  iniciadoEm: number; // epoch ms
  atualizadoEm: number;
  momento?: Momento;
  dpp?: DataISO;
  dum?: DataISO;
  nascidoEm?: DataISO;
  nome?: string;
  sintomas?: string[];
  pushPermitido?: boolean;
  puladas: number[];
}

export interface Perfil {
  nome?: string;
  modo: Momento;
  dpp?: DataISO;
  nascidoEm?: DataISO;
  sintomasHoje?: { data: DataISO; ids: string[] };
  pushPermitido?: boolean;
  anonima: boolean;
  onboardingConcluidoEm: string;
}

export function estadoInicial(agora = Date.now()): EstadoOnboarding {
  return { tela: 1, iniciadoEm: agora, atualizadoEm: agora, puladas: [] };
}

/** Retorna o estado guardado se ainda vale (≤ 7 dias); senão null. */
export function lerEstado(agora = Date.now()): EstadoOnboarding | null {
  try {
    const bruto = localStorage.getItem(CHAVE_ESTADO);
    if (!bruto) return null;
    const e = JSON.parse(bruto) as EstadoOnboarding;
    if (agora - e.atualizadoEm > VALIDADE_MS) {
      localStorage.removeItem(CHAVE_ESTADO);
      return null;
    }
    return e;
  } catch {
    return null;
  }
}

export function guardarEstado(e: EstadoOnboarding, agora = Date.now()): EstadoOnboarding {
  const novo = { ...e, atualizadoEm: agora };
  try {
    localStorage.setItem(CHAVE_ESTADO, JSON.stringify(novo));
  } catch {
    /* storage indisponível: segue em memória */
  }
  return novo;
}

export function limparEstado() {
  try {
    localStorage.removeItem(CHAVE_ESTADO);
  } catch {
    /* nada */
  }
}

/** Fecha o onboarding: grava o perfil e apaga o rascunho. */
export function concluir(e: EstadoOnboarding, anonima: boolean, hoje: DataISO): Perfil {
  const perfil: Perfil = {
    nome: e.nome?.trim() || undefined,
    modo: e.momento ?? "gestacao",
    dpp: e.dpp,
    nascidoEm: e.nascidoEm,
    sintomasHoje: e.sintomas?.length ? { data: hoje, ids: e.sintomas } : undefined,
    pushPermitido: e.pushPermitido,
    anonima,
    onboardingConcluidoEm: new Date().toISOString(),
  };
  try {
    localStorage.setItem(CHAVE_PERFIL, JSON.stringify(perfil));
  } catch {
    /* nada */
  }
  limparEstado();
  return perfil;
}

export function lerPerfil(): Perfil | null {
  try {
    const bruto = localStorage.getItem(CHAVE_PERFIL);
    return bruto ? (JSON.parse(bruto) as Perfil) : null;
  } catch {
    return null;
  }
}

/** ONB-08: voltar é sempre possível, exceto da tela 3 para a 2 depois de gravar a DPP. */
export function podeVoltar(e: EstadoOnboarding): boolean {
  if (e.tela <= 1) return false;
  if (e.tela === 3 && (e.dpp || e.nascidoEm)) return false;
  return true;
}

/** Telas que podem ser puladas (spec 04, tabela). */
export function podePular(tela: number): boolean {
  return tela >= 4;
}
