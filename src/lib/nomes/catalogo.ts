"use client";

import bruto from "../../../supabase/seed/nomes.json";
import { useColecao } from "@/lib/dados/colecao";
import { nomesRemotos, type NomeRemoto } from "@/lib/dados/colecoes";
import { supabaseConfigurado } from "@/lib/supabase/client";
import { idDoNome, type NomeCatalogo } from "@dominio/nomes.ts";

/**
 * RN-11: o catálogo vai junto com as telas de nomes (funciona offline desde a primeira abertura) e, com servidor,
 * é trocado pela cópia baixada. Ids pelo nome: os mesmos no bundle e no banco (o `conteudo:sync` grava assim).
 * Só este módulo importa o JSON, para ele não pesar nas outras telas.
 */
const SEMENTE: NomeRemoto[] = (bruto as NomeCatalogo[]).map((n) => ({ ...n, id: idDoNome(n.name), atualizado_em: "1970-01-01T00:00:00Z", reviewed: false }));

export function useCatalogoDeNomes(): { catalogo: NomeRemoto[]; comServidor: boolean } {
  const remotos = useColecao(nomesRemotos);
  const comServidor = supabaseConfigurado();
  return { catalogo: comServidor && remotos.length ? remotos : SEMENTE, comServidor };
}

/**
 * Significado e origem: com servidor, só os revisados (os outros mostram "Significado em breve", como pede a spec);
 * sem servidor (desenvolvimento e testes), a semente aparece marcada como rascunho.
 */
export function significadoVisivel(n: Pick<NomeRemoto, "meaning" | "origin" | "reviewed">, comServidor: boolean): { meaning: string | null; origin: string | null; rascunho: boolean } {
  if (comServidor && !n.reviewed) return { meaning: null, origin: null, rascunho: false };
  return { meaning: n.meaning, origin: n.origin, rascunho: !comServidor };
}
