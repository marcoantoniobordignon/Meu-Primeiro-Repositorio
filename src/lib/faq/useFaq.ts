"use client";

import bruto from "../../../supabase/seed/faq-verbetes.json";
import { useColecao } from "@/lib/dados/colecao";
import { faqFavoritos, faqVerbetes, type FaqVerbete } from "@/lib/dados/colecoes";
import { supabaseConfigurado } from "@/lib/supabase/client";
import { idDoVerbete, type Verbete } from "@dominio/faq.ts";

/** Verbete com a marca de rascunho (sem servidor, a semente aparece, sempre identificada). */
export type VerbeteVisivel = FaqVerbete & { rascunho: boolean };

const SEMENTE: VerbeteVisivel[] = (bruto as Verbete[]).map((v) => ({ ...v, id: idDoVerbete(v.slug), atualizado_em: "1970-01-01T00:00:00Z", status: "draft", reviewed_by: null, reviewed_on: null, rascunho: true }));

/**
 * RN-01: com servidor, só o publicado (a cópia local do que já veio, para ler e buscar offline).
 * Sem servidor (desenvolvimento e testes), a semente em rascunho, com o selo "Rascunho".
 */
export function useFaq() {
  const remotos = useColecao(faqVerbetes);
  const favoritos = useColecao(faqFavoritos);
  const comServidor = supabaseConfigurado();
  const verbetes: VerbeteVisivel[] = comServidor ? remotos.filter((v) => v.status === "published").map((v) => ({ ...v, rascunho: false })) : SEMENTE;
  const idsFavoritos = new Set(favoritos.map((f) => f.food_id));
  return { verbetes, favoritos: verbetes.filter((v) => idsFavoritos.has(v.id)), idsFavoritos, comServidor };
}
