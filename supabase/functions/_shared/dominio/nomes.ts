/**
 * Funcionalidade 15 · Lista de nomes: baralho com filtros, chave do voto (a mesma do banco), ranking, pré-visualização
 * com sobrenomes (iniciais e sílabas) e o santo do nome. Puro: testado sem tela.
 */
import { normalizar } from "./faq.ts";
import { idDeterministico } from "./id.ts";

export type Sexo = "f" | "m" | "u";
export type VotoNome = "like" | "dislike";

export interface NomeCatalogo {
  id?: string;
  name: string;
  sex_hint: Sexo;
  origin: string | null;
  meaning: string | null;
  ibge_rank_f: number | null;
  ibge_rank_m: number | null;
  syllables: number;
  saint_name: string | null;
  saint_day: string | null;
  reviewed?: boolean;
}

export interface VotoBase {
  id: string;
  name_id: string | null;
  custom_name: string | null;
  vote: VotoNome;
  rank: number | null;
  apagado_em?: string | null;
}

export function idDoNome(nome: string): string {
  return idDeterministico(`nome:${normalizar(nome)}`);
}

// ---------------------------------------------------------------------------
// Nome próprio (RN-10) e a chave do voto (a mesma coluna gerada no banco)
// ---------------------------------------------------------------------------
export const MAX_NOME_PROPRIO = 40;

/** Igual ao trigger do banco: espaços simples, sem pontas; todo em minúsculas vira "Inicial Maiúscula". */
export function normalizarNomeProprio(t: string): string {
  const limpo = t.trim().replace(/\s+/g, " ");
  if (limpo !== limpo.toLowerCase()) return limpo;
  return limpo.replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, l: string) => sep + l.toUpperCase());
}

/** Só letras, espaços e hífen, até 40 (check do banco). */
export function nomeProprioValido(t: string): boolean {
  const n = normalizarNomeProprio(t);
  return n.length >= 1 && n.length <= MAX_NOME_PROPRIO && /^\p{L}+([ -]\p{L}+)*$/u.test(n);
}

/** `coalesce(name_id::text, 'c:' || lower(unaccent(custom_name)))`. */
export function chaveDoVoto(v: Pick<VotoBase, "name_id" | "custom_name">): string {
  return v.name_id ?? `c:${normalizar(normalizarNomeProprio(v.custom_name ?? ""))}`;
}

/** Uma linha por pessoa e nome: desfazer e votar de novo reaproveita o id (a fila não duplica). */
export function idDoVoto(pessoa: string, chave: string): string {
  return idDeterministico(`voto-nome:${pessoa}:${chave}`);
}

/** Nome próprio que já está no catálogo vira voto no catálogo (conta para o match do mesmo jeito). */
export function nomeDoCatalogo<N extends Pick<NomeCatalogo, "name">>(catalogo: N[], digitado: string): N | undefined {
  const alvo = normalizar(normalizarNomeProprio(digitado));
  return catalogo.find((n) => normalizar(n.name) === alvo);
}

// ---------------------------------------------------------------------------
// Popularidade e filtros (RN-01)
// ---------------------------------------------------------------------------
export type Popularidade = "muito_comum" | "comum" | "raro";
export const LIMITE_MUITO_COMUM = 100;
export const LIMITE_COMUM = 400;

/** Pela posição no Censo (a melhor entre feminino e masculino); sem posição, raro. */
export function popularidade(n: Pick<NomeCatalogo, "ibge_rank_f" | "ibge_rank_m">): Popularidade {
  const r = Math.min(n.ibge_rank_f ?? Infinity, n.ibge_rank_m ?? Infinity);
  return r <= LIMITE_MUITO_COMUM ? "muito_comum" : r <= LIMITE_COMUM ? "comum" : "raro";
}

/** O filtro de popularidade só faz sentido com as posições do Censo no catálogo. */
export function catalogoTemPopularidade(catalogo: Pick<NomeCatalogo, "ibge_rank_f" | "ibge_rank_m">[]): boolean {
  return catalogo.some((n) => n.ibge_rank_f !== null || n.ibge_rank_m !== null);
}

export interface Filtros {
  sexo: "f" | "m" | null;
  letra: string | null;
  /** 1, 2, 3 ou 4 (= 4 ou mais). */
  silabas: number | null;
  origem: string | null;
  popularidade: Popularidade | null;
}
export const SEM_FILTROS: Filtros = { sexo: null, letra: null, silabas: null, origem: null, popularidade: null };

export function passaNoFiltro(n: NomeCatalogo, f: Filtros): boolean {
  if (f.sexo && n.sex_hint !== f.sexo && n.sex_hint !== "u") return false;
  if (f.letra && normalizar(n.name)[0] !== normalizar(f.letra)[0]) return false;
  if (f.silabas && (f.silabas >= 4 ? n.syllables < 4 : n.syllables !== f.silabas)) return false;
  if (f.origem && n.origin !== f.origem) return false;
  if (f.popularidade && popularidade(n) !== f.popularidade) return false;
  return true;
}

export function origensDoCatalogo(catalogo: Pick<NomeCatalogo, "origin">[]): string[] {
  return [...new Set(catalogo.map((n) => n.origin).filter((o): o is string => Boolean(o)))].sort((a, b) => a.localeCompare(b));
}

// ---------------------------------------------------------------------------
// Baralho (RN-01)
// ---------------------------------------------------------------------------
export const CARTAS_POR_SESSAO = 20;

/** Embaralha de forma estável pela semente da sessão (mesma sessão, mesma ordem; recarregar não muda o baralho). */
function peso(semente: string, id: string): string {
  return idDeterministico(`${semente}:${id}`);
}

/** 20 sorteados entre os nomes ainda sem voto dela, respeitando os filtros. */
export function montarBaralho<N extends NomeCatalogo & { id: string }>(catalogo: N[], votados: Set<string>, filtros: Filtros, semente: string, n = CARTAS_POR_SESSAO): N[] {
  return catalogo
    .filter((x) => !votados.has(x.id) && passaNoFiltro(x, filtros))
    .map((x) => ({ x, p: peso(semente, x.id) }))
    .sort((a, b) => a.p.localeCompare(b.p))
    .slice(0, n)
    .map(({ x }) => x);
}

// ---------------------------------------------------------------------------
// Ranking (RN-04)
// ---------------------------------------------------------------------------
export const MAX_RANKING = 10;

/** Os curtidos no ranking, na ordem. */
export function ranking<V extends VotoBase>(votos: V[]): V[] {
  return votos.filter((v) => !v.apagado_em && v.vote === "like" && v.rank !== null).sort((a, b) => a.rank! - b.rank!);
}

/** Nova ordem (ids) → posição de cada voto (1..10; o resto fica sem posição). Devolve só o que mudou. */
export function novasPosicoes<V extends VotoBase>(votos: V[], ordem: string[]): { id: string; rank: number | null }[] {
  const lista = ordem.slice(0, MAX_RANKING);
  return votos
    .filter((v) => !v.apagado_em && v.vote === "like")
    .map((v) => ({ id: v.id, rank: lista.includes(v.id) ? lista.indexOf(v.id) + 1 : null, antes: v.rank }))
    .filter((x) => x.rank !== x.antes)
    .map(({ id, rank }) => ({ id, rank }));
}

export function mover(ordem: string[], id: string, delta: -1 | 1): string[] {
  const i = ordem.indexOf(id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= ordem.length) return ordem;
  const nova = [...ordem];
  [nova[i], nova[j]] = [nova[j]!, nova[i]!];
  return nova;
}

// ---------------------------------------------------------------------------
// Pré-visualização (RN-08)
// ---------------------------------------------------------------------------
const VOGAIS = "aeiouyáéíóúâêôãõàü";
const FORTES = "aeoáéóâêôãõ";
const NASAIS = "ãõ";

/**
 * Sílabas pela divisão escolar (hiato em "Ma-ri-a"). Regras: "gu"/"qu" antes de e/i não contam o u; "y" antes de
 * vogal é consoante (Ya-ra); "gi" no começo, antes de a/o/u, não conta o i (Gio-va-na); i/u depois de vogal forte
 * formam ditongo (Lau-ra, Hei-tor, Lour-des), salvo em "a" + i/u com consoante final (Na-ir, Ra-ul), antes de
 * consoante dobrada ou "nh" (Ra-is-sa, Ra-i-nha) e em "ui" + z (Lu-iz). Serve para os sobrenomes da pré-visualização; o primeiro nome usa a contagem revisada do catálogo.
 */
export function contarSilabas(palavra: string): number {
  const p = palavra
    .toLowerCase()
    .replace(/[^\p{L}]/gu, "")
    .replace(/([gq])u(?=[eiéíêy])/g, "$1")
    .replace(/y(?=[aeiouáéíóúâêôãõ])/g, "j")
    .replace(/y/g, "i")
    .replace(/^gi(?=[aou])/, "g");
  const vogal = (c: string | undefined) => c !== undefined && VOGAIS.includes(c);
  let silabas = 0;
  let anterior = "";
  let ditongo = false;
  for (let k = 0; k < p.length; k++) {
    const c = p[k]!;
    if (!vogal(c)) {
      anterior = "";
      ditongo = false;
      continue;
    }
    const proxima = p[k + 1];
    const depois = p[k + 2];
    // Hiato: "a" + i/u com l, m, n, r ou z no fim ("Nair", "Raul"), consoante dobrada ("Raissa") ou "nh" ("Rainha").
    const fechaComConsoante =
      proxima !== undefined &&
      !vogal(proxima) &&
      ((anterior === "a" && depois === undefined && "lmnrz".includes(proxima)) || proxima === depois || (proxima === "n" && depois === "h"));
    const hiato = fechaComConsoante || (anterior === "u" && c === "i" && proxima === "z");
    const glide = (c === "i" || c === "u") && !ditongo && anterior !== "" && !hiato && (FORTES.includes(anterior) || (anterior === "i" && c === "u") || (anterior === "u" && c === "i"));
    const nasal = (c === "o" || c === "e") && NASAIS.includes(anterior) && !ditongo;
    if (anterior !== "" && (glide || nasal)) {
      ditongo = true;
    } else {
      silabas++;
      ditongo = false;
    }
    anterior = c;
  }
  return Math.max(1, silabas);
}

/** Até 2 sobrenomes (digitados na hora, nunca guardados). */
export const MAX_SOBRENOMES = 2;
const PARTICULAS = new Set(["da", "de", "do", "das", "dos", "e"]);

export function nomeCompleto(nome: string, sobrenomes: string[]): string {
  return [nome, ...sobrenomes.slice(0, MAX_SOBRENOMES)].map((s) => s.trim().replace(/\s+/g, " ")).filter(Boolean).join(" ");
}

/** "Helena Souza da Lima" → "H. S. L." (partículas não entram). */
export function iniciais(completo: string): string {
  return completo
    .split(/\s+/)
    .filter((p) => p && !PARTICULAS.has(p.toLowerCase()))
    .map((p) => `${p[0]!.toUpperCase()}.`)
    .join(" ");
}

/** Sílabas do nome completo: a do catálogo para o primeiro nome, a conta para os sobrenomes. */
export function silabasDoNomeCompleto(nome: string, silabasDoNome: number | null, sobrenomes: string[]): number {
  const primeiro = silabasDoNome ?? nome.split(/\s+/).filter(Boolean).reduce((s, p) => s + contarSilabas(p), 0);
  return primeiro + sobrenomes.slice(0, MAX_SOBRENOMES).flatMap((s) => s.split(/\s+/)).filter(Boolean).reduce((s, p) => s + contarSilabas(p), 0);
}

// ---------------------------------------------------------------------------
// Santo (RN-09) e "Este é o nome!" (RN-07)
// ---------------------------------------------------------------------------
export function santoDoNome(n: Pick<NomeCatalogo, "saint_name" | "saint_day">, modoFe: boolean): { nome: string; dia: string | null } | null {
  if (!modoFe || !n.saint_name) return null;
  return { nome: n.saint_name, dia: n.saint_day };
}

/** Com parceiro ativo, só um match vira o nome; sem parceiro, um nome que ela curtiu (o banco confere o mesmo). */
export function podeEscolher(e: { temParceiro: boolean; ehMatch: boolean; curtido: boolean }): boolean {
  return e.temParceiro ? e.ehMatch : e.curtido;
}
