"use client";

import { chamarRpc, supabase, supabaseConfigurado, tabela } from "@/lib/supabase/client";
import type { Verbete } from "@dominio/faq.ts";

/** Painel do FAQ (revisora): RLS deixa a revisora ler e escrever `faq_foods`; o resto por RPC. */
export interface PerguntaAberta {
  id: string;
  text: string;
  votes_count: number;
  created_at: string;
}

export type VerbetePainel = Verbete & { id: string };

async function cliente() {
  const sb = await supabase();
  if (!sb) throw new Error("sem servidor");
  return sb;
}

export function painelComServidor(): boolean {
  return supabaseConfigurado();
}

export async function listarVerbetes(): Promise<VerbetePainel[]> {
  const { data, error } = await tabela(await cliente(), "faq_foods").select("*").order("name", { ascending: true }).limit(2000);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as VerbetePainel[];
}

export async function perguntasAbertas(): Promise<PerguntaAberta[]> {
  const { data, error } = await chamarRpc<PerguntaAberta[]>(await cliente(), "faq_perguntas_abertas");
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Salva como rascunho (a IA pode sugerir, mas só uma pessoa publica: RN-09). */
export async function salvarRascunho(v: VerbetePainel): Promise<void> {
  const linha = { ...v, status: v.status === "published" ? "published" : "draft", atualizado_em: new Date().toISOString() };
  const { error } = await tabela(await cliente(), "faq_foods").upsert(linha, { onConflict: "id" });
  if (error) throw new Error(error.message);
}

export async function publicar(foodId: string, perguntas: string[], revisor: string, revisadoEm: string): Promise<number> {
  const { data, error } = await chamarRpc<number>(await cliente(), "faq_publicar", { p_food: foodId, p_perguntas: perguntas, p_revisor: revisor, p_revisado_em: revisadoEm });
  if (error) throw new Error(error.message);
  return data ?? 0;
}

export async function rejeitar(pergunta: string, motivo: "fora_do_escopo" | "pergunta_medica" | "repetida"): Promise<void> {
  const { error } = await chamarRpc<null>(await cliente(), "faq_rejeitar", { p_pergunta: pergunta, p_motivo: motivo });
  if (error) throw new Error(error.message);
}
