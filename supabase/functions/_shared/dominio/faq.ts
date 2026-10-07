import { idDeterministico } from "./id.ts";

/**
 * Funcionalidade 09 · FAQ de comidas: busca tolerante a acento e a erro de digitação, com a mesma
 * conta do `pg_trgm` (o app busca no que já tem, inclusive sem rede), bloqueio de ofensas e validação.
 */

export const CATEGORIAS_FAQ = ["meat", "fish", "dairy", "fruit_veg", "drink", "sweet", "herb_tea", "other"] as const;
export type CategoriaFaq = (typeof CATEGORIAS_FAQ)[number];
export type Veredito = "safe" | "caution" | "avoid";

export interface Verbete {
  id?: string;
  slug: string;
  name: string;
  aliases: string[];
  category: CategoriaFaq;
  verdict: Veredito;
  short_answer: string;
  details: string | null;
  condition_note: string | null;
  source_label: string;
  source_url: string | null;
  reviewed_by?: string | null;
  reviewed_on?: string | null;
  status?: "draft" | "published" | "archived";
  views_count?: number;
  asked_count?: number;
}

/** Id do verbete pelo slug: o mesmo no bundle (sem servidor) e no banco (o `conteudo:sync` grava assim). */
export function idDoVerbete(slug: string): string {
  return idDeterministico(`faq:${slug}`);
}

/** RN-02: `lower(unaccent(texto))`. */
export function normalizar(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Trigramas como o `pg_trgm`: palavras alfanuméricas, com dois espaços antes e um depois. */
export function trigramas(t: string): Set<string> {
  const saida = new Set<string>();
  for (const palavra of normalizar(t).split(/[^a-z0-9]+/).filter(Boolean)) {
    const p = `  ${palavra} `;
    for (let i = 0; i + 3 <= p.length; i++) saida.add(p.slice(i, i + 3));
  }
  return saida;
}

/** `similarity()` do pg_trgm: comuns / união. */
export function similaridade(a: string, b: string): number {
  const ta = trigramas(a);
  const tb = trigramas(b);
  if (!ta.size || !tb.size) return 0;
  let comuns = 0;
  for (const t of ta) if (tb.has(t)) comuns++;
  return comuns / (ta.size + tb.size - comuns);
}

/**
 * RN-02 (= `faq_pontuacao` no banco): a melhor similaridade entre a busca e o texto inteiro ou
 * qualquer trecho de palavras seguidas ("peixe" acha "Peixe cru (sushi, ceviche)").
 */
export function pontuacao(q: string, texto: string): number {
  if (!normalizar(q).trim()) return 0;
  const palavras = normalizar(texto).split(/[^a-z0-9]+/).filter(Boolean);
  let melhor = similaridade(q, texto);
  for (let i = 0; i < palavras.length; i++) {
    for (let j = i; j < palavras.length; j++) melhor = Math.max(melhor, similaridade(q, palavras.slice(i, j + 1).join(" ")));
  }
  return melhor;
}

export const LIMIAR_BUSCA = 0.3;
export const MAX_RESULTADOS = 20;

export function pontuacaoDoVerbete(q: string, v: Pick<Verbete, "name" | "aliases">): number {
  return Math.max(pontuacao(q, v.name), ...v.aliases.map((a) => pontuacao(q, a)), 0);
}

/** RN-02: nome e apelidos, similaridade ≥ 0,3, ordem por similaridade, no máximo 20. */
export function buscar<T extends Pick<Verbete, "name" | "aliases">>(verbetes: T[], q: string): T[] {
  if (normalizar(q).trim().length < 2) return [];
  // Empate: quem casa pelo nome antes de quem casa por apelido; depois o nome mais curto.
  return verbetes
    .map((v) => ({ v, p: pontuacaoDoVerbete(q, v), n: pontuacao(q, v.name) }))
    .filter((x) => x.p >= LIMIAR_BUSCA)
    .sort((a, b) => b.p - a.p || b.n - a.n || a.v.name.length - b.v.name.length || a.v.name.localeCompare(b.v.name))
    .slice(0, MAX_RESULTADOS)
    .map((x) => x.v);
}

/** RN-10: os mais abertos (sem servidor, a ordem da semente). */
export function maisBuscados<T extends Pick<Verbete, "views_count" | "name">>(verbetes: T[], n = 50): T[] {
  return verbetes
    .map((v, i) => ({ v, i }))
    .sort((a, b) => (b.v.views_count ?? 0) - (a.v.views_count ?? 0) || a.i - b.i)
    .slice(0, n)
    .map((x) => x.v);
}

// ---------------------------------------------------------------------------
// Perguntas (RN-05)
// ---------------------------------------------------------------------------
/** A mesma lista da tabela `faq_bloqueio` (um teste garante que batem). */
export const BLOQUEIO = [
  "porra", "caralho", "merda", "buceta", "puta", "puto", "foder", "fodase", "foda", "cacete",
  "arrombado", "arrombada", "viado", "desgracado", "desgracada", "vagabunda", "vagabundo", "piranha",
  "otario", "otaria", "imbecil", "idiota", "babaca", "cuzao", "fdp", "vsf", "pqp", "krl", "bosta", "retardado",
];

export function temOfensa(texto: string): boolean {
  const palavras = new Set(normalizar(texto).split(/[^a-z0-9]+/));
  return BLOQUEIO.some((b) => palavras.has(b));
}

export const LIMITE_PERGUNTAS_DIA = 5;
export type ErroPergunta = "tamanho" | "ofensa";

export function validarPergunta(texto: string): ErroPergunta | null {
  const t = texto.trim();
  if (t.length < 3 || t.length > 140) return "tamanho";
  if (temOfensa(t)) return "ofensa";
  return null;
}

/** RN-01/09: publicado de verdade só com revisão humana. */
export function publicavel(v: Pick<Verbete, "source_label" | "reviewed_by" | "reviewed_on">): boolean {
  return Boolean(v.source_label?.trim() && v.reviewed_by?.trim() && v.reviewed_on);
}
