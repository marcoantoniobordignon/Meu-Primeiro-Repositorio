"use client";

import { novoId } from "@/lib/dados/colecao";
import { faqFavoritos } from "@/lib/dados/colecoes";
import { temServidor } from "@/lib/familia/servidor";
import { meuId } from "@/lib/familia/useFamilia";
import { chamarRpc, supabase } from "@/lib/supabase/client";

/** RN-10: favoritos ilimitados, valem sem rede (fila offline). */
export function alternarFavorito(foodId: string): boolean {
  const atual = faqFavoritos.listar().find((f) => f.food_id === foodId);
  if (atual) {
    faqFavoritos.apagar(atual.id);
    return false;
  }
  const antigo = faqFavoritos.listarTodos().find((f) => f.food_id === foodId);
  faqFavoritos.salvar({ id: antigo?.id ?? novoId(), food_id: foodId, criado_por: meuId(), apagado_em: null });
  return true;
}

export async function contarVisualizacao(slug: string): Promise<void> {
  if (!temServidor()) return;
  const sb = await supabase();
  if (sb) await chamarRpc(sb, "faq_contar_visualizacao", { p_slug: slug });
}

export interface Parecida {
  id: string;
  text: string;
  votes_count: number;
  ja_votei: boolean;
}

export type ErroPerguntar = "sem_rede" | "tamanho" | "ofensa" | "limite_diario" | "parecida" | "desconhecido";

export class ErroDaPergunta extends Error {
  constructor(public motivo: ErroPerguntar) {
    super(motivo);
  }
}

async function cliente() {
  if (!temServidor()) throw new ErroDaPergunta("sem_rede");
  const sb = await supabase();
  if (!sb) throw new ErroDaPergunta("sem_rede");
  return sb;
}

function traduzir(m: string | undefined): ErroPerguntar {
  const conhecidos: ErroPerguntar[] = ["tamanho", "ofensa", "limite_diario", "parecida"];
  return conhecidos.find((c) => m?.includes(c)) ?? "desconhecido";
}

/** RN-06: perguntas abertas parecidas (o servidor compara com as de todo mundo). */
export async function parecidas(texto: string): Promise<Parecida[]> {
  const sb = await cliente();
  const { data, error } = await chamarRpc<Parecida[]>(sb, "faq_perguntas_parecidas", { p_texto: texto });
  if (error) throw new ErroDaPergunta(traduzir(error.message));
  return data ?? [];
}

/** RN-05: perguntar pede conexão; o servidor confere tamanho, ofensa, limite e duplicata. */
export async function perguntar(texto: string): Promise<string> {
  const sb = await cliente();
  const { data, error } = await chamarRpc<string>(sb, "faq_perguntar", { p_texto: texto });
  if (error || !data) throw new ErroDaPergunta(traduzir(error?.message));
  return data;
}

export async function votar(pergunta: string): Promise<number> {
  const sb = await cliente();
  const { data, error } = await chamarRpc<number>(sb, "faq_votar", { p_pergunta: pergunta });
  if (error) throw new ErroDaPergunta(traduzir(error.message));
  return data ?? 0;
}
