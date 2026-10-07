import type { DataISO } from "@/lib/dates";
import type { Prefs } from "@dominio/prefs.ts";

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
  pushPermitido?: boolean;
  anonima: boolean;
  /** Spec 14 define; até lá, 'free'. */
  plano?: "free" | "trial" | "ativo";
  /** VIR-02: fim da cortesia de 7 dias após o nascimento. */
  cortesiaFim?: string | null;
  /** BEB-11: último bebê selecionado. */
  bebeAtivoId?: string;
  /** Spec 12: papel de quem usa este aparelho. */
  papel?: "mae" | "parceiro" | "avo" | "cuidador";
  /** Para o botão "ligar para minha equipe" (spec 11). */
  telefoneEquipe?: string;
  /** `profiles.tz`: fuso IANA do aparelho; lembretes e doses seguem a hora local dele (medicamentos RN-03). */
  tz?: string;
  /** `profiles.prefs` (foto da barriga, modo fé, notificações). */
  prefs?: Prefs;
  /** `profiles.consents` (galeria RN-05: leitura de laudo por IA). */
  consents?: { ai_document_reading?: { given_at: string } | null };
  onboardingConcluidoEm: string;
  /** Funcionalidade 11 RN-06: `profiles.t2_seen_at`/`t3_seen_at` (a tela de virada aparece uma vez). */
  t2VistoEm?: string | null;
  t3VistoEm?: string | null;
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

/** Fecha o onboarding: grava o perfil e apaga o rascunho. Os sintomas vão para a coleção (spec 06). */
export function concluir(e: EstadoOnboarding, anonima: boolean): Perfil {
  const perfil: Perfil = {
    nome: e.nome?.trim() || undefined,
    modo: e.momento ?? "gestacao",
    dpp: e.dpp,
    nascidoEm: e.nascidoEm,
    pushPermitido: e.pushPermitido,
    anonima,
    plano: "free",
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

export function guardarPerfil(perfil: Perfil): Perfil {
  try {
    localStorage.setItem(CHAVE_PERFIL, JSON.stringify(perfil));
  } catch {
    /* nada */
  }
  return perfil;
}

export function apagarPerfil() {
  try {
    localStorage.removeItem(CHAVE_PERFIL);
  } catch {
    /* nada */
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
