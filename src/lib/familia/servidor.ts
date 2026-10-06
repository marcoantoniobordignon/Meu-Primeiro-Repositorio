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
