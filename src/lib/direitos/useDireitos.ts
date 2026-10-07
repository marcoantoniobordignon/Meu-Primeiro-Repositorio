"use client";

import bruto from "../../../supabase/seed/direitos.json";
import { useColecao } from "@/lib/dados/colecao";
import { canaisRemotos, cartoesRemotos, rightsFavoritos, type CanalRemoto, type CartaoRemoto } from "@/lib/dados/colecoes";
import { useFamilia } from "@/lib/familia/useFamilia";
import { supabaseConfigurado } from "@/lib/supabase/client";
import { idDoCanal, idDoCartao, ordenarCartoes, visivelPara, type CanalDeAjuda, type CartaoDireito } from "@dominio/direitos.ts";

/** Cartão e canal com a marca de rascunho (sem servidor, a semente aparece, sempre identificada). */
export type CartaoVisivel = CartaoRemoto & { rascunho: boolean };
export type CanalVisivel = CanalRemoto & { rascunho: boolean };

const semente = bruto as { cards: CartaoDireito[]; channels: CanalDeAjuda[] };
const CARTOES: CartaoVisivel[] = semente.cards.map((c) => ({ ...c, id: idDoCartao(c.slug), atualizado_em: "1970-01-01T00:00:00Z", status: "draft", reviewed_by: null, reviewed_on: null, content_updated_at: null, rascunho: true }));
const CANAIS: CanalVisivel[] = semente.channels.map((c) => ({ ...c, id: idDoCanal(c.slug), atualizado_em: "1970-01-01T00:00:00Z", active: false, rascunho: true }));

/**
 * RN-01/10: com servidor, só o publicado e os canais ativos (cópia local, para ler sem rede). Sem servidor,
 * a semente em rascunho. RN-07: o parceiro vê só os cartões dele e os dos dois (a RLS faz o mesmo no banco).
 */
export function useDireitos() {
  const remotos = useColecao(cartoesRemotos);
  const canaisR = useColecao(canaisRemotos);
  const favs = useColecao(rightsFavoritos);
  const { papel } = useFamilia();
  const comServidor = supabaseConfigurado();
  const todos: CartaoVisivel[] = comServidor ? remotos.filter((c) => c.status === "published").map((c) => ({ ...c, rascunho: false })) : CARTOES;
  const cartoes = ordenarCartoes(todos.filter((c) => visivelPara(c, papel)));
  const canais = (comServidor ? canaisR.filter((c) => c.active).map((c) => ({ ...c, rascunho: false })) : CANAIS).sort((a, b) => a.position - b.position);
  const favoritadoEm = new Map(favs.map((f) => [f.card_id, f.criado_em ?? f.atualizado_em]));
  return { cartoes, canais, favoritos: cartoes.filter((c) => favoritadoEm.has(c.id)), favoritadoEm, papel, comServidor };
}
