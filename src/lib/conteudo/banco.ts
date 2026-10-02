"use client";

import { useMemo } from "react";

import bruto from "../../conteudo/banco.json";
import { useColecao } from "@/lib/dados/colecao";
import { conteudosRemotos } from "@/lib/dados/colecoes";

export type Categoria = "semana" | "corpo" | "bebe" | "parto" | "pos_parto" | "sono" | "amamentacao";
export type CorToken = "primaria" | "acento" | "banho" | "fralda" | "sono" | "mamada";

export interface Conteudo {
  id: string;
  slug: string;
  titulo: string;
  categoria: Categoria;
  cor_token: CorToken;
  semana_min: number | null;
  semana_max: number | null;
  mes_bebe_min: number | null;
  mes_bebe_max: number | null;
  dia_da_semana: number | null;
  minutos_leitura: number;
  premium: boolean;
  publicado: boolean;
  cards: string[];
  corpo_md: string;
}

/** Tudo que saiu do repositório, inclusive rascunhos (o painel precisa ver). */
export const bancoBruto: Conteudo[] = bruto as Conteudo[];

/** CON-06: o banco inteiro vai no bundle, então toda story lê offline. */
export const banco: Conteudo[] = bancoBruto.filter((c) => c.publicado);

/**
 * O que a mãe vê: o bundle mais o que a equipe editou no painel (tabela
 * `conteudos`, puxada na sincronização). O servidor vence pelo id.
 */
export function mesclarBanco(remotos: Conteudo[], base: Conteudo[] = bancoBruto): Conteudo[] {
  if (remotos.length === 0) return base.filter((c) => c.publicado);
  const porId = new Map(base.map((c) => [c.id, c]));
  for (const r of remotos) porId.set(r.id, r);
  return [...porId.values()].filter((c) => c.publicado);
}

export function useBanco(): Conteudo[] {
  const remotos = useColecao(conteudosRemotos);
  return useMemo(() => mesclarBanco(remotos as unknown as Conteudo[]), [remotos]);
}

export function conteudoPorId(id: string, todos: Conteudo[] = banco): Conteudo | undefined {
  return todos.find((c) => c.id === id);
}

export const nomeCategoria: Record<Categoria, string> = {
  semana: "Esta semana",
  corpo: "Seu corpo",
  bebe: "Bebê",
  parto: "Parto",
  pos_parto: "Pós-parto",
  sono: "Sono",
  amamentacao: "Amamentação",
};

/** CON-07: categorias que falam de saúde e precisam da frase de encaminhamento. */
export const categoriasDeSaude: Categoria[] = ["semana", "corpo", "parto", "pos_parto", "sono", "amamentacao"];
export const FRASE_ENCAMINHAMENTO = "Na dúvida, fale com quem te acompanha.";
export const PALAVRAS_PROIBIDAS = ["sempre", "nunca", "garantido", "garantida"];
