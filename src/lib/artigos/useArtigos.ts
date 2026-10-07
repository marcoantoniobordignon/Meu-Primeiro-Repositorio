"use client";

import a from "../../../supabase/seed/artigos-a.json";
import b from "../../../supabase/seed/artigos-b.json";
import { useColecao } from "@/lib/dados/colecao";
import { articleReads, artigosRemotos, type ArtigoRemoto, type ArticleRead } from "@/lib/dados/colecoes";
import { supabaseConfigurado } from "@/lib/supabase/client";
import { idDoArtigo, type Artigo } from "@dominio/trimestre.ts";

/** Artigo com a marca de rascunho (sem servidor, a semente aparece, sempre identificada). */
export type ArtigoVisivel = ArtigoRemoto & { rascunho: boolean };

const SEMENTE: ArtigoVisivel[] = ([...a, ...b] as Artigo[]).map((x) => ({
  ...x,
  id: idDoArtigo(x.slug),
  atualizado_em: "1970-01-01T00:00:00Z",
  status: "draft",
  is_premium: false,
  reviewed_by: null,
  reviewed_on: null,
  rascunho: true,
}));

/** Uma leitura por artigo (se dois aparelhos criaram ids diferentes, junta: lido e favorito mais recente). */
export function leiturasPorArtigo(leituras: ArticleRead[]): Map<string, ArticleRead> {
  const mapa = new Map<string, ArticleRead>();
  for (const l of leituras) {
    const atual = mapa.get(l.article_id);
    if (!atual) {
      mapa.set(l.article_id, l);
      continue;
    }
    const recente = l.atualizado_em > atual.atualizado_em ? l : atual;
    mapa.set(l.article_id, { ...recente, read_at: atual.read_at ?? l.read_at });
  }
  return mapa;
}

/**
 * RN-09: com servidor, só o publicado (a cópia local, para ler offline). Sem servidor (desenvolvimento e
 * testes), a semente em rascunho, com o selo "Rascunho".
 */
export function useArtigos() {
  const remotos = useColecao(artigosRemotos);
  const leituras = leiturasPorArtigo(useColecao(articleReads));
  const comServidor = supabaseConfigurado();
  const artigos: ArtigoVisivel[] = comServidor ? remotos.filter((x) => x.status === "published").map((x) => ({ ...x, rascunho: false })) : SEMENTE;
  const lidos = new Set([...leituras.values()].filter((l) => l.read_at).map((l) => l.article_id));
  const favoritos = artigos.filter((x) => leituras.get(x.id)?.is_favorite);
  return { artigos, leituras, lidos, favoritos, comServidor };
}
