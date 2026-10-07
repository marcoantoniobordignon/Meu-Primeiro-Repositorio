import { chamarRpc, supabase, supabaseConfigurado } from "@/lib/supabase/client";

import type { EstadoConvite } from "./regras";

/** Convites e membros pelas RPCs (spec 12). Sem Supabase, quem chama usa o caminho local. */
export function temServidor(): boolean {
  return supabaseConfigurado() && (typeof navigator === "undefined" || navigator.onLine);
}

export async function criarConviteRemoto(papel: "parceiro" | "avo" | "cuidador"): Promise<string | null> {
  const sb = await supabase();
  if (!sb) return null;
  const { data, error } = await chamarRpc<string>(sb, "criar_convite", { p_papel: papel });
  if (error) throw new Error(error.message);
  return data;
}

export interface ConvitePublico {
  estado: EstadoConvite;
  papel?: "parceiro" | "avo" | "cuidador";
  quem?: string;
  bebe?: string;
}

export async function lerConvitePublico(token: string): Promise<ConvitePublico | null> {
  const sb = await supabase();
  if (!sb) return null;
  const { data, error } = await chamarRpc<ConvitePublico>(sb, "convite_publico", { p_token: token });
  if (error) throw new Error(error.message);
  return data;
}

export async function aceitarConviteRemoto(token: string, nome: string | null): Promise<string> {
  const sb = await supabase();
  if (!sb) throw new Error("sem servidor");
  const { data, error } = await chamarRpc<string>(sb, "aceitar_convite", { p_token: token, p_nome: nome });
  if (error) throw new Error(error.message);
  return data ?? "";
}

export async function removerMembroRemoto(profileId: string): Promise<void> {
  const sb = await supabase();
  if (!sb) return;
  const { error } = await chamarRpc<null>(sb, "remover_membro", { p_profile_id: profileId });
  if (error) throw new Error(error.message);
}

export async function iniciarCortesiaRemota(nascidoEm: string): Promise<string | null> {
  const sb = await supabase();
  if (!sb) return null;
  const { data, error } = await chamarRpc<string | null>(sb, "iniciar_cortesia", { p_nascido_em: nascidoEm });
  if (error) return null;
  return data ?? null;
}

/** Funcionalidades 04/05: a gestante liga e desliga o que o parceiro vê. */
export async function definirPermissoesRemoto(profileId: string, permissoes: Record<string, boolean>): Promise<void> {
  const sb = await supabase();
  if (!sb) return;
  const { error } = await chamarRpc<null>(sb, "definir_permissoes_parceiro", { p_profile_id: profileId, p_permissoes: permissoes });
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Funcionalidade 12 · convite do parceiro
// ---------------------------------------------------------------------------
export interface ConviteParceiroGerado {
  token: string;
  code: string;
  expires_at: string;
}

export interface ConviteParceiroPublico {
  estado: "valido" | "expirado" | "usado" | "revogado" | "inexistente";
  quem?: string;
}

/** Erros do servidor que a tela traduz (RN-02/03/12). */
export type ErroConviteParceiro = "precisa_login" | "outra_conta" | "ja_tem_parceiro" | "expirado" | "revogado" | "usado" | "inexistente" | "ja_e_membro" | "desconhecido";

export function erroDoConvite(e: unknown): ErroConviteParceiro {
  const m = e instanceof Error ? e.message : String(e);
  const conhecidos: ErroConviteParceiro[] = ["precisa_login", "outra_conta", "ja_tem_parceiro", "expirado", "revogado", "usado", "inexistente", "ja_e_membro"];
  return conhecidos.find((c) => m.includes(c)) ?? "desconhecido";
}

export async function criarConviteParceiroRemoto(): Promise<ConviteParceiroGerado> {
  const sb = await supabase();
  if (!sb) throw new Error("sem servidor");
  const { data, error } = await chamarRpc<ConviteParceiroGerado>(sb, "criar_convite_parceiro", {});
  if (error || !data) throw new Error(error?.message ?? "sem resposta");
  return data;
}

export async function revogarConviteParceiroRemoto(): Promise<void> {
  const sb = await supabase();
  if (!sb) return;
  const { error } = await chamarRpc<null>(sb, "revogar_convite_parceiro", {});
  if (error) throw new Error(error.message);
}

export async function lerConviteParceiro(chave: { token?: string; code?: string }): Promise<ConviteParceiroPublico | null> {
  const sb = await supabase();
  if (!sb) return null;
  const { data, error } = await chamarRpc<ConviteParceiroPublico>(sb, "convite_parceiro_publico", { p_token: chave.token ?? null, p_code: chave.code ?? null });
  if (error) throw new Error(error.message);
  return data;
}

export async function aceitarConviteParceiroRemoto(chave: { token?: string; code?: string }, nome: string | null): Promise<{ familia_id: string; horas: number }> {
  const sb = await supabase();
  if (!sb) throw new Error("sem servidor");
  const { data, error } = await chamarRpc<{ familia_id: string; horas: number }>(sb, "aceitar_convite_parceiro", { p_token: chave.token ?? null, p_code: chave.code ?? null, p_nome: nome });
  if (error || !data) throw new Error(error?.message ?? "sem resposta");
  return data;
}

export async function sairDaGestacaoRemoto(): Promise<void> {
  const sb = await supabase();
  if (!sb) return;
  const { error } = await chamarRpc<null>(sb, "sair_da_gestacao", {});
  if (error) throw new Error(error.message);
}
