/**
 * Funcionalidade 16 · Direitos da gestante: "Para esta fase", busca no aparelho (sem rede), selos de revisão
 * e de atualização, quem vê cada cartão e o texto para compartilhar. Puro: testado sem tela.
 */
import { normalizar } from "./faq.ts";
import { idDeterministico } from "./id.ts";

export const TEMAS_DIREITOS = ["work", "health", "birth", "postpartum", "benefits"] as const;
export type TemaDireito = (typeof TEMAS_DIREITOS)[number];
export type ParaQuem = "mother" | "partner" | "both";

export interface CartaoDireito {
  id?: string;
  slug: string;
  topic: TemaDireito;
  question: string;
  answer: string;
  details_md: string | null;
  legal_basis: string[];
  legal_links: string[];
  what_to_do_md: string;
  week_from: number | null;
  week_to: number | null;
  applies_to: ParaQuem;
  position: number;
  reviewed_by?: string | null;
  reviewed_on?: string | null;
  status?: "draft" | "published" | "archived";
  content_updated_at?: string | null;
}

export interface CanalDeAjuda {
  id?: string;
  slug: string;
  name: string;
  phone: string | null;
  url: string | null;
  description: string;
  position: number;
  active?: boolean;
}

export function idDoCartao(slug: string): string {
  return idDeterministico(`rights:${slug}`);
}
export function idDoCanal(slug: string): string {
  return idDeterministico(`help:${slug}`);
}

/** RN-01: publicado só com base legal, revisor e data. */
export function cartaoPublicavel(c: Pick<CartaoDireito, "legal_basis" | "reviewed_by" | "reviewed_on">): boolean {
  return c.legal_basis.some((l) => l.trim()) && Boolean(c.reviewed_by?.trim() && c.reviewed_on);
}

/** RN-07: o parceiro vê só os cartões dele e os dos dois; a gestante (e quem mais estiver na família), todos. */
export function visivelPara<C extends Pick<CartaoDireito, "applies_to">>(c: C, papel: string | null | undefined): boolean {
  return papel !== "parceiro" || c.applies_to !== "mother";
}

export const MAX_PARA_ESTA_FASE = 2;

/**
 * RN-03: até 2 cartões com `week_from <= semana <= week_to`, ainda não dispensados. Primeiro os que acabaram de
 * entrar na fase (maior `week_from`), depois os de janela mais curta, depois tema e posição.
 */
export function paraEstaFase<C extends CartaoDireito>(cartoes: C[], semana: number, dispensados: string[] = [], max = MAX_PARA_ESTA_FASE): C[] {
  const fora = new Set(dispensados);
  return cartoes
    .filter((c) => c.week_from !== null && c.week_to !== null && c.week_from <= semana && semana <= c.week_to && !fora.has(c.slug))
    .sort(
      (a, b) =>
        b.week_from! - a.week_from! ||
        a.week_to! - a.week_from! - (b.week_to! - b.week_from!) ||
        TEMAS_DIREITOS.indexOf(a.topic) - TEMAS_DIREITOS.indexOf(b.topic) ||
        a.position - b.position,
    )
    .slice(0, max);
}

/** Ordem da lista: tema e posição. */
export function ordenarCartoes<C extends Pick<CartaoDireito, "topic" | "position" | "question">>(cartoes: C[]): C[] {
  return [...cartoes].sort((a, b) => TEMAS_DIREITOS.indexOf(a.topic) - TEMAS_DIREITOS.indexOf(b.topic) || a.position - b.position || a.question.localeCompare(b.question));
}

// ---------------------------------------------------------------------------
// Busca (RN-04): no banco é `to_tsvector('portuguese')`; no aparelho (offline), um radical simples parecido.
// ---------------------------------------------------------------------------
const SUFIXOS = ["amente", "mente", "idades", "idade", "acoes", "icoes", "coes", "soes", "acao", "icao", "cao", "sao", "oes", "ados", "adas", "idos", "idas", "ado", "ada", "ido", "ida", "ais", "eis", "ar", "er", "ir", "es", "as", "os", "a", "o", "e", "s"];

/** Radical bem simples (sem acento, sem flexões comuns), com no mínimo 4 letras. */
export function radical(palavra: string): string {
  const p = normalizar(palavra);
  for (const s of SUFIXOS) if (p.endsWith(s) && p.length - s.length >= 4) return p.slice(0, -s.length);
  return p;
}

function palavras(t: string): string[] {
  return normalizar(t).split(/[^a-z0-9]+/).filter((x) => x.length > 1);
}

/** Todas as palavras da busca precisam bater com alguma da pergunta ou da resposta (pelo radical). */
export function buscarDireitos<C extends Pick<CartaoDireito, "question" | "answer" | "topic">>(cartoes: C[], q: string, tema: TemaDireito | null = null): C[] {
  const termos = palavras(q).filter((x) => x.length > 2).map(radical);
  return cartoes.filter((c) => {
    if (tema && c.topic !== tema) return false;
    if (!termos.length) return Boolean(tema);
    const radicais = palavras(`${c.question} ${c.answer}`).map(radical);
    return termos.every((t) => radicais.some((r) => r === t || r.startsWith(t)));
  });
}

// ---------------------------------------------------------------------------
// Selos (RN-02/09)
// ---------------------------------------------------------------------------
const DIA = 86_400_000;

/** RN-02: revisão com mais de 12 meses pede "Conferir atualização". */
export function precisaConferir(reviewedOn: string | null | undefined, hoje: string): boolean {
  if (!reviewedOn) return false;
  const [a, m, d] = reviewedOn.split("-").map(Number) as [number, number, number];
  const limite = `${a + 1}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return hoje > limite;
}

/** RN-09: o texto mudou depois que ela favoritou, e a mudança tem até 14 dias. */
export function mostrarAtualizado(c: Pick<CartaoDireito, "content_updated_at">, favoritadoEm: string | null | undefined, agora: Date): boolean {
  if (!c.content_updated_at || !favoritadoEm) return false;
  const mudou = new Date(c.content_updated_at).getTime();
  return mudou > new Date(favoritadoEm).getTime() && agora.getTime() - mudou <= 14 * DIA;
}

// ---------------------------------------------------------------------------
// Compartilhar (RN-05) e ligar
// ---------------------------------------------------------------------------
export function textoParaCompartilhar(c: Pick<CartaoDireito, "question" | "answer" | "legal_basis">): string {
  return `${c.question} ${c.answer} Base legal: ${c.legal_basis.join("; ")}. Via Ninho.`;
}

export function linkTelefone(phone: string | null | undefined): string | null {
  const d = (phone ?? "").replace(/\D/g, "");
  return d.length >= 3 ? `tel:${d}` : null;
}

/** "08007019656" → "0800 701 9656"; números curtos (180, 136) ficam como estão. */
export function telefoneLegivel(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (/^0800\d{7}$/.test(d)) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  return d;
}
