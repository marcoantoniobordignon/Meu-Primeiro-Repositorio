/**
 * Funcionalidade 11 · Adaptação por trimestre: o trimestre da idade gestacional, a ordem dos cards da home,
 * "Para esta semana", a regra de "lido", a tela de virada e o push `trimester_turn`. Puro: app e job usam o mesmo.
 */
import { normalizar } from "./faq.ts";
import { idDeterministico } from "./id.ts";
import type { Lembrete } from "./lembretes.ts";
import { dataNoFuso, inicioDaSemana, instanteLocal, somarDiasISO, type DataISO } from "./tempo.ts";
import { textosLembretes as t } from "./textos-lembretes.ts";

export type Trimestre = 1 | 2 | 3;

/** RN-06: as viradas são em 14s0d e 28s0d. */
export const SEMANA_DA_VIRADA = { 2: 14, 3: 28 } as const;

/** RN-01: o trimestre vem da idade gestacional (muda à meia-noite local, junto com a semana). */
export function trimestreDaSemana(semana: number): Trimestre {
  return semana < SEMANA_DA_VIRADA[2] ? 1 : semana < SEMANA_DA_VIRADA[3] ? 2 : 3;
}

export function trimestreDosDias(diasDeGestacao: number): Trimestre {
  return trimestreDaSemana(Math.floor(diasDeGestacao / 7));
}

/** Semanas do trimestre (o 3º vai até a 42, depois da DPP). */
export function semanasDoTrimestre(tri: Trimestre): [number, number] {
  return tri === 1 ? [0, 13] : tri === 2 ? [14, 27] : [28, 42];
}

// ---------------------------------------------------------------------------
// Home (RN-02)
// ---------------------------------------------------------------------------
export const CARDS_HOME = ["resumo", "exames", "medicamentos", "marco", "foto", "consulta", "plano_parto", "mala", "artigo", "faq", "direitos", "nomes"] as const;
export type CardHome = (typeof CARDS_HOME)[number];

/** A tabela da spec: prioridade por trimestre; 0 = não aparece naquele trimestre. */
export const PRIORIDADE: Record<CardHome, readonly [number, number, number]> = {
  resumo: [100, 100, 100],
  exames: [90, 80, 60],
  medicamentos: [85, 50, 50],
  marco: [80, 85, 40],
  foto: [40, 90, 70],
  consulta: [60, 60, 85],
  plano_parto: [0, 20, 95],
  mala: [0, 10, 80],
  artigo: [70, 70, 55],
  faq: [75, 45, 30],
  direitos: [35, 55, 65],
  nomes: [10, 40, 30],
};

export const MAX_CARDS_HOME = 6;
export const BONUS_PENDENTE = 10;

/**
 * pendente: há algo a fazer (+10); feito: a ação da fase já foi feita (desce com check);
 * vazio: a feature ainda não tem dados (mostra o estado vazio com a ação principal);
 * oculto: não se aplica (sem permissão, sem conteúdo, feature que não existe).
 */
export type EstadoCard = "pendente" | "feito" | "vazio" | "normal" | "oculto";

export interface CardDaHome {
  card: CardHome;
  estado: EstadoCard;
  prioridade: number;
}

/**
 * RN-02: escolhe os 6 de maior prioridade efetiva (base do trimestre, +10 se pendente) e mostra os feitos
 * no fim, com check. O resumo (anel) abre a home sempre: é a "cara" da semana, mesmo que um card
 * pendente passe dos 100.
 */
export function cardsDaHome(tri: Trimestre, estados: Partial<Record<CardHome, EstadoCard>>, max = MAX_CARDS_HOME): CardDaHome[] {
  const candidatos = CARDS_HOME.map((card, ordem) => {
    const estado = estados[card] ?? "normal";
    const base = PRIORIDADE[card][tri - 1] ?? 0;
    return { card, estado, prioridade: base + (estado === "pendente" ? BONUS_PENDENTE : 0), base, ordem };
  }).filter((c) => c.base > 0 && c.estado !== "oculto");
  const porPrioridade = (a: (typeof candidatos)[number], b: (typeof candidatos)[number]) => b.prioridade - a.prioridade || a.ordem - b.ordem;
  const resumo = candidatos.filter((c) => c.card === "resumo");
  const escolhidos = candidatos
    .filter((c) => c.card !== "resumo")
    .sort(porPrioridade)
    .slice(0, Math.max(0, max - resumo.length));
  const ordem = [...resumo, ...escolhidos.filter((c) => c.estado !== "feito"), ...escolhidos.filter((c) => c.estado === "feito")];
  return ordem.map(({ card, estado, prioridade }) => ({ card, estado, prioridade }));
}

// ---------------------------------------------------------------------------
// Artigos (RN-03/04/05/08/09/10)
// ---------------------------------------------------------------------------
export interface Artigo {
  id?: string;
  slug: string;
  title: string;
  summary: string;
  body_md: string;
  hero_image_path?: string | null;
  week_from: number;
  week_to: number;
  reading_minutes: number;
  featured: boolean;
  position: number;
  is_premium?: boolean;
  reviewed_by?: string | null;
  reviewed_on?: string | null;
  status?: "draft" | "published" | "archived";
}

export interface LeituraBase {
  article_id: string;
  read_at: string | null;
  is_favorite: boolean;
}

/** Id pelo slug: o mesmo no bundle (sem servidor) e no banco (o `conteudo:sync` grava assim). */
export function idDoArtigo(slug: string): string {
  return idDeterministico(`article:${slug}`);
}

/** Uma leitura por pessoa e artigo: dois aparelhos da mesma conta convergem no mesmo registro. */
export function idDaLeitura(pessoa: string, artigoId: string): string {
  return idDeterministico(`article_read:${pessoa}:${artigoId}`);
}

export function trimestreDoArtigo(a: Pick<Artigo, "week_from">): Trimestre {
  return trimestreDaSemana(a.week_from);
}

/** Artigo de uma semana só (os de várias semanas são os "gerais" do trimestre). */
export function artigoDaSemanaUnica(a: Pick<Artigo, "week_from" | "week_to">): boolean {
  return a.week_from === a.week_to;
}

/** RN-03: `featured desc, position`; empate pela semana e pelo slug, para a ordem ser estável. */
export function ordemDosArtigos(a: Artigo, b: Artigo): number {
  return Number(b.featured) - Number(a.featured) || a.position - b.position || a.week_from - b.week_from || a.slug.localeCompare(b.slug);
}

export const MAX_PARA_ESTA_SEMANA = 3;

/**
 * RN-03/04/08: até 3 artigos não lidos da semana (`week_from <= semana <= week_to`) e, faltando,
 * os não lidos do trimestre. Lido some da lista.
 */
export function paraEstaSemana<A extends Artigo & { id: string }>(artigos: A[], lidos: Set<string>, semana: number, max = MAX_PARA_ESTA_SEMANA): A[] {
  const naoLidos = artigos.filter((a) => !lidos.has(a.id));
  const daSemana = naoLidos.filter((a) => a.week_from <= semana && semana <= a.week_to).sort(ordemDosArtigos);
  const tri = trimestreDaSemana(semana);
  const doTrimestre = naoLidos
    .filter((a) => !daSemana.includes(a) && trimestreDoArtigo(a) === tri)
    // Os mais perto da semana atual primeiro, depois a ordem editorial.
    .sort((a, b) => distancia(a, semana) - distancia(b, semana) || ordemDosArtigos(a, b));
  return [...daSemana, ...doTrimestre].slice(0, max);
}

function distancia(a: Pick<Artigo, "week_from" | "week_to">, semana: number): number {
  return semana < a.week_from ? a.week_from - semana : semana > a.week_to ? semana - a.week_to : 0;
}

/** RN-08: há conteúdo para a semana ou o trimestre (lido ou não)? Sem nenhum, o card some. */
export function temArtigoParaASemana(artigos: Artigo[], semana: number): boolean {
  const tri = trimestreDaSemana(semana);
  return artigos.some((a) => (a.week_from <= semana && semana <= a.week_to) || trimestreDoArtigo(a) === tri);
}

/** RN-04: aberto por pelo menos 20 s ou rolado até 80%. */
export const SEGUNDOS_PARA_LIDO = 20;
export const ROLAGEM_PARA_LIDO = 0.8;
export function leituraConcluida(e: { segundos: number; fracaoRolada: number }): boolean {
  return e.segundos >= SEGUNDOS_PARA_LIDO || e.fracaoRolada >= ROLAGEM_PARA_LIDO;
}

/** Quanto da página já passou pela tela (0–1). */
export function fracaoRolada(e: { topo: number; alturaJanela: number; alturaTotal: number }): number {
  if (e.alturaTotal <= 0) return 0;
  return Math.max(0, Math.min(1, (e.topo + e.alturaJanela) / e.alturaTotal));
}

/** RN-05: abas T1/T2/T3, todas abertas (trimestres futuros também); a do trimestre atual abre primeiro. */
export function artigosDaAba<A extends Artigo>(artigos: A[], tri: Trimestre): A[] {
  return artigos
    .filter((a) => trimestreDoArtigo(a) === tri)
    .sort((a, b) => a.week_from - b.week_from || Number(artigoDaSemanaUnica(b)) - Number(artigoDaSemanaUnica(a)) || ordemDosArtigos(a, b));
}

/** RN-05: busca por texto simples no título e no resumo (sem acento e sem caixa; todas as palavras). */
export function buscarArtigos<A extends Pick<Artigo, "title" | "summary">>(artigos: A[], q: string): A[] {
  const termos = normalizar(q).split(/\s+/).filter(Boolean);
  if (!termos.length) return [];
  return artigos.filter((a) => {
    const texto = normalizar(`${a.title} ${a.summary}`);
    return termos.every((t) => texto.includes(t));
  });
}

/** RN-09: publicado só com revisor e data. */
export function artigoPublicavel(a: Pick<Artigo, "reviewed_by" | "reviewed_on">): boolean {
  return Boolean(a.reviewed_by?.trim() && a.reviewed_on);
}

/** RN-11: o free vê o resumo e o paywall num artigo premium (na v1 nenhum é). */
export function podeLerArtigo(a: Pick<Artigo, "is_premium">, temPlano: boolean): boolean {
  return !a.is_premium || temPlano;
}

/** RN-10: semanas de 4 a 40 sem nenhum artigo (o lançamento pede pelo menos 1 por semana). */
export function semanasSemArtigo(artigos: Pick<Artigo, "week_from" | "week_to">[]): number[] {
  const faltam: number[] = [];
  for (let s = 4; s <= 40; s++) if (!artigos.some((a) => artigoDaSemanaUnica(a) && a.week_from === s)) faltam.push(s);
  return faltam;
}

// ---------------------------------------------------------------------------
// Virada de trimestre (RN-06)
// ---------------------------------------------------------------------------
/**
 * Qual tela de virada mostrar agora: a do trimestre atual, se ainda não foi vista e se a gestação já
 * estava no app antes da virada (quem chega no meio do 2º trimestre não "vira" para ele).
 * Voltar depois de semanas mostra só a do trimestre atual, uma vez.
 */
export function viradaPendente(e: { semana: number; t2Visto: boolean; t3Visto: boolean; semanaNaCriacao: number | null }): 2 | 3 | null {
  const tri = trimestreDaSemana(e.semana);
  if (tri === 1) return null;
  const visto = tri === 2 ? e.t2Visto : e.t3Visto;
  if (visto) return null;
  if (e.semanaNaCriacao !== null && e.semanaNaCriacao >= SEMANA_DA_VIRADA[tri]) return null;
  return tri;
}

/** Ver a do 3º dá por vista a do 2º (perdida): cada uma aparece no máximo uma vez. */
export function marcarVirada(para: 2 | 3, atual: { t2?: string | null; t3?: string | null }, agora: string): { t2: string; t3: string | null } {
  return { t2: atual.t2 ?? agora, t3: para === 3 ? (atual.t3 ?? agora) : (atual.t3 ?? null) };
}

export interface NumerosDoTrimestre {
  fotos: number;
  marcos: number;
  consultas: number;
}

/** RN-06: fotos tiradas, marcos registrados e consultas feitas no trimestre (o que acabou de terminar). */
export function numerosDoTrimestre(
  tri: Trimestre,
  e: {
    dpp: DataISO;
    tz: string;
    fotos: { gest_week: number; apagado_em?: string | null }[];
    entradas: { milestone_code: string | null; entry_date: DataISO; apagado_em?: string | null }[];
    consultas: { starts_at: string; status: string; apagado_em?: string | null }[];
  },
): NumerosDoTrimestre {
  const [de, ate] = semanasDoTrimestre(tri);
  const inicio = inicioDaSemana(e.dpp, de);
  const fim = somarDiasISO(inicioDaSemana(e.dpp, ate + 1), -1);
  const dentro = (d: DataISO) => d >= inicio && d <= fim;
  return {
    fotos: e.fotos.filter((f) => !f.apagado_em && f.gest_week >= de && f.gest_week <= ate).length,
    marcos: e.entradas.filter((x) => !x.apagado_em && x.milestone_code && dentro(x.entry_date)).length,
    consultas: e.consultas.filter((c) => !c.apagado_em && c.status === "done" && dentro(dataNoFuso(new Date(c.starts_at), e.tz))).length,
  };
}

/** Tela 5: 3 cards "o que esperar", dos artigos gerais do novo trimestre (depois os da semana). */
export function oQueEsperar<A extends Artigo>(artigos: A[], tri: Trimestre, n = 3): A[] {
  const doTri = artigos.filter((a) => trimestreDoArtigo(a) === tri);
  const gerais = doTri.filter((a) => !artigoDaSemanaUnica(a)).sort((a, b) => a.position - b.position || a.slug.localeCompare(b.slug));
  const semanais = doTri.filter(artigoDaSemanaUnica).sort((a, b) => a.week_from - b.week_from);
  return [...gerais, ...semanais].slice(0, n);
}

/**
 * RN-06: push `trimester_turn` no dia da virada às 09:00 (hora local), uma vez (a chave fica em
 * reminders_sent). Não avisa de uma virada que aconteceu antes de a gestação entrar no app.
 */
export function lembretesDeVirada(e: { dpp: DataISO | null; tz: string; criadaEm: string }): Lembrete[] {
  if (!e.dpp) return [];
  const criada = dataNoFuso(new Date(e.criadaEm), e.tz);
  const saida: Lembrete[] = [];
  for (const para of [2, 3] as const) {
    const dia = inicioDaSemana(e.dpp, SEMANA_DA_VIRADA[para]);
    if (criada >= dia) continue;
    saida.push({
      chave: `trimester:${para}`,
      categoria: "trimester",
      tipo: "trimester_turn",
      ref: `t${para}`,
      em: instanteLocal(dia, "09:00", e.tz),
      titulo: t.trimestre.titulo(para),
      corpo: t.trimestre.corpo(para),
      url: `/virada?t=${para}&origem=lembrete&categoria=trimester`,
      acoes: [],
      essencial: false,
      prioridade: 50,
    });
  }
  return saida;
}
