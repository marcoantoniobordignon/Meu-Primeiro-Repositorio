/**
 * Funcionalidade 17 · Modo fé (católico): a oração da semana, a lista do batismo, o lembrete dos 14 dias,
 * a oração embutida na virada da semana e o link do Verbum. Puro: app e job usam o mesmo.
 */
import { normalizar } from "./faq.ts";
import { idDeterministico } from "./id.ts";
import type { Lembrete } from "./lembretes.ts";
import type { ItemLista } from "./plano-parto.ts";
import { dataNoFuso, idadeGestacional, inicioDaSemana, instanteLocal, somarDiasISO, type DataISO } from "./tempo.ts";
import { textosLembretes as t } from "./textos-lembretes.ts";

export const TIPOS_ORACAO = ["weekly", "fixed", "intercessor", "blessing"] as const;
export type TipoOracao = (typeof TIPOS_ORACAO)[number];

export interface Oracao {
  id?: string;
  slug: string;
  kind: TipoOracao;
  title: string;
  body: string;
  week: number | null;
  saint_name: string | null;
  saint_day: string | null;
  source_label: string;
  reviewed_by?: string | null;
  reviewed_on?: string | null;
  position: number;
  status?: "draft" | "published" | "archived";
}

export function idDaOracao(slug: string): string {
  return idDeterministico(`faith:${slug}`);
}

export const SEMANAS_DE_ORACAO = 40;

/** RN-03: `week = min(ga_week, 40)` (e pelo menos 1, antes da semana 1). */
export function semanaDaOracao(semanaGestacional: number): number {
  return Math.min(SEMANAS_DE_ORACAO, Math.max(1, Math.floor(semanaGestacional)));
}

export function oracaoDaSemana<O extends Pick<Oracao, "kind" | "week">>(oracoes: O[], semanaGestacional: number): O | undefined {
  const s = semanaDaOracao(semanaGestacional);
  return oracoes.find((o) => o.kind === "weekly" && o.week === s);
}

/** Abas da biblioteca (RN-04): orações fixas, intercessores e a bênção; as semanais têm a tela da semana. */
export const ABAS_FE = ["fixed", "intercessor", "blessing"] as const;
export type AbaFe = (typeof ABAS_FE)[number];

export function oracoesDaAba<O extends Pick<Oracao, "kind" | "position" | "title">>(oracoes: O[], aba: AbaFe): O[] {
  return oracoes.filter((o) => o.kind === aba).sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));
}

/** RN-04: busca simples no título, no texto e no nome do santo (sem acento, todas as palavras). */
export function buscarOracoes<O extends Pick<Oracao, "title" | "body" | "saint_name">>(oracoes: O[], q: string): O[] {
  const termos = normalizar(q).split(/\s+/).filter(Boolean);
  if (!termos.length) return [];
  return oracoes.filter((o) => {
    const texto = normalizar(`${o.title} ${o.saint_name ?? ""} ${o.body}`);
    return termos.every((x) => texto.includes(x));
  });
}

/** RN-05: publicado só com fonte, revisor e data. */
export function oracaoPublicavel(o: Pick<Oracao, "source_label" | "reviewed_by" | "reviewed_on">): boolean {
  return Boolean(o.source_label?.trim() && o.reviewed_by?.trim() && o.reviewed_on);
}

/** "MM-DD" → "16 de outubro". */
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export function diaDoSanto(mmdd: string | null | undefined): string | null {
  const m = /^(\d{2})-(\d{2})$/.exec(mmdd ?? "");
  if (!m) return null;
  return `${Number(m[2])} de ${MESES[Number(m[1]) - 1]}`;
}

// ---------------------------------------------------------------------------
// Batismo (RN-07)
// ---------------------------------------------------------------------------
export const ITENS_BATISMO = [
  "Conversar com a paróquia",
  "Escolher os padrinhos",
  "Definir a data",
  "Confirmar com a paróquia os documentos exigidos",
  "Roupa e vela de batismo",
  "Convidar a família",
] as const;

/** Ids determinísticos: registrar o nascimento em dois aparelhos não duplica a lista. */
export function itensDoBatismo(semente: string): ItemLista[] {
  return ITENS_BATISMO.map((title, i) => ({ id: idDeterministico(`batismo:${semente}:${i}`), list: "baptism", title, quantity: null, note: null, is_done: false, is_custom: false, position: i + 1 }));
}

export const DIAS_ATE_LEMBRETE_BATISMO = 14;

/** RN-07: push único aos 14 dias do nascimento, às 10:00 (só com o modo ligado). */
export function lembreteDoBatismo(e: { nascidoEm: DataISO | null | undefined; tz: string; modoFe: boolean }): Lembrete[] {
  if (!e.modoFe || !e.nascidoEm) return [];
  return [
    {
      chave: "faith:baptism",
      categoria: "faith",
      tipo: "faith_baptism_nudge",
      ref: "baptism",
      em: instanteLocal(somarDiasISO(e.nascidoEm.slice(0, 10), DIAS_ATE_LEMBRETE_BATISMO), "10:00", e.tz),
      titulo: t.fe.batismo,
      corpo: t.fe.batismoCorpo,
      url: "/fe/batismo?origem=lembrete&categoria=faith",
      acoes: [],
      essencial: false,
      prioridade: 35,
    },
  ];
}

/**
 * RN-08: a oração da semana vai embutida no `week_turn`, só com a chave de Ajustes ligada. Se o aviso da
 * virada (foto da barriga) já sai naquela semana, ganha a linha da oração; se não sai, a virada ganha um
 * aviso próprio, no mesmo horário (10:00). O texto não traz a oração: só avisa que ela está no app.
 */
export function oracaoNaVirada(lembretes: Lembrete[], e: { dpp: DataISO | null; agora: Date; tz: string; modoFe: boolean; oracaoNoPush: boolean }): Lembrete[] {
  if (!e.modoFe || !e.oracaoNoPush || !e.dpp) return lembretes;
  const semana = idadeGestacional(e.dpp, dataNoFuso(e.agora, e.tz)).semana;
  if (semana < 1 || semana > 42) return lembretes;
  const daVirada = (l: Lembrete) => l.categoria === "belly" && l.tipo === "week_turn" && l.ref === `semana-${semana}`;
  if (lembretes.some(daVirada)) return lembretes.map((l) => (daVirada(l) ? { ...l, corpo: `${l.corpo} ${t.fe.oracaoNaVirada}` } : l));
  return [
    ...lembretes,
    {
      chave: `faith:week:${semana}`,
      categoria: "faith",
      tipo: "week_turn",
      ref: `semana-${semana}`,
      em: instanteLocal(inicioDaSemana(e.dpp, semana), "10:00", e.tz),
      titulo: t.fe.viradaTitulo(semana),
      corpo: t.fe.oracaoNaVirada,
      url: `/fe/oracao?semana=${semanaDaOracao(semana)}&origem=lembrete&categoria=faith`,
      acoes: [],
      essencial: false,
      prioridade: 40,
    },
  ];
}

// ---------------------------------------------------------------------------
// Verbum (RN-09) e compartilhar
// ---------------------------------------------------------------------------
/** O Verbum é outro app (sem conta compartilhada): só um link com UTM. */
export function linkDoVerbum(base: string | null | undefined): string | null {
  if (!base) return null;
  try {
    const u = new URL(base);
    u.searchParams.set("utm_source", "ninho");
    u.searchParams.set("utm_medium", "app");
    u.searchParams.set("utm_campaign", "evangelho_do_dia");
    return u.toString();
  } catch {
    return null;
  }
}

export function textoParaCompartilhar(o: Pick<Oracao, "title" | "body" | "source_label">): string {
  return `${o.title}\n\n${o.body}\n\n${o.source_label}. Via Ninho.`;
}

/** Leitura (RN-04): fonte de 16 a 28 px. */
export const FONTE_MIN = 16;
export const FONTE_MAX = 28;
export function ajustarFonte(atual: number, passo: number): number {
  return Math.min(FONTE_MAX, Math.max(FONTE_MIN, Math.round(atual + passo)));
}

// ---------------------------------------------------------------------------
// RN-10: contadores anônimos
// ---------------------------------------------------------------------------
export const CHAVES_ANONIMAS = ["faith_on", "faith_off", "prayer_viewed", "library_opened", "verbum_link_tapped"] as const;
export type ChaveAnonima = (typeof CHAVES_ANONIMAS)[number];
export type Pendentes = Record<string, Partial<Record<ChaveAnonima, number>>>;

export function somarPendente(p: Pendentes, dia: DataISO, chave: ChaveAnonima): Pendentes {
  const doDia = { ...(p[dia] ?? {}) };
  doDia[chave] = Math.min(100, (doDia[chave] ?? 0) + 1);
  return { ...p, [dia]: doDia };
}

/** O que sobe: só dia, chave e contagem (nada de usuário, hora ou rota). */
export function itensParaEnviar(p: Pendentes): { dia: DataISO; chave: ChaveAnonima; n: number }[] {
  return Object.entries(p)
    .flatMap(([dia, chaves]) => Object.entries(chaves).map(([chave, n]) => ({ dia, chave: chave as ChaveAnonima, n: n ?? 0 })))
    .filter((x) => x.n > 0)
    .slice(0, 50);
}
