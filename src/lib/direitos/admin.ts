"use client";

import { chamarRpc, supabase, supabaseConfigurado } from "@/lib/supabase/client";

export interface CartaoVencido {
  slug: string;
  question: string;
  reviewed_on: string;
}

/** RN-02: cartões publicados com revisão de mais de 12 meses (só revisor ou admin). */
export async function cartoesParaRevisar(): Promise<CartaoVencido[]> {
  if (!supabaseConfigurado()) return [];
  const sb = await supabase();
  if (!sb) return [];
  const { data, error } = await chamarRpc<CartaoVencido[]>(sb, "direitos_para_revisar");
  if (error) throw new Error(error.message);
  return data ?? [];
}
