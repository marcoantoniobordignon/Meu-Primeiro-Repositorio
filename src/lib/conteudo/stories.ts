import type { ConteudoLido } from "@/lib/dados/colecoes";
import { deISO, type DataISO } from "@/lib/dates";

import { banco, type Conteudo } from "./banco";

/** Gerador determinístico: mesma data, mesma ordem o dia inteiro (CON-01). */
function semente(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function embaralhar<T>(lista: T[], seed: string): T[] {
  const rnd = mulberry32(semente(seed));
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [copia[i], copia[j]] = [copia[j]!, copia[i]!];
  }
  return copia;
}

export interface ContextoStories {
  hoje: DataISO;
  /** Modo gestação. */
  semana?: number;
  /** Modo bebê (CON-02). */
  mesBebe?: number;
}

export function elegivel(c: Conteudo, ctx: ContextoStories): boolean {
  if (ctx.mesBebe !== undefined) {
    return c.mes_bebe_min !== null && c.mes_bebe_max !== null && ctx.mesBebe >= c.mes_bebe_min && ctx.mesBebe <= c.mes_bebe_max;
  }
  if (ctx.semana === undefined) return false;
  return c.semana_min !== null && c.semana_max !== null && ctx.semana >= c.semana_min && ctx.semana <= c.semana_max;
}

export interface StoryDoDia {
  conteudo: Conteudo;
  lida: boolean;
  guardada: boolean;
}

/**
 * CON-01: [story da semana] + 2 elegíveis não lidas, com `dia_da_semana` igual ao
 * de hoje primeiro, depois ordem aleatória com semente = data. Se faltarem não
 * lidas, completa com lidas (CON-04: aparecem esmaecidas).
 */
export function storiesDoDia(lidos: ConteudoLido[], ctx: ContextoStories, todos: Conteudo[] = banco): StoryDoDia[] {
  const estado = new Map(lidos.map((l) => [l.conteudo_id, l]));
  const marcar = (c: Conteudo): StoryDoDia => ({
    conteudo: c,
    lida: Boolean(estado.get(c.id)?.lido_em),
    guardada: estado.get(c.id)?.guardado ?? false,
  });

  const saida: StoryDoDia[] = [];
  if (ctx.semana !== undefined) {
    const semana = todos.find((c) => c.categoria === "semana" && c.semana_min === Math.min(42, Math.max(1, ctx.semana!)));
    if (semana) saida.push(marcar(semana));
  }

  const diaHoje = deISO(ctx.hoje).getDay();
  const outros = todos.filter((c) => c.categoria !== "semana" && elegivel(c, ctx));
  const embaralhados = embaralhar(outros, ctx.hoje);
  const doDia = embaralhados.filter((c) => c.dia_da_semana === diaHoje);
  const resto = embaralhados.filter((c) => c.dia_da_semana !== diaHoje);
  const ordenados = [...doDia, ...resto];

  const naoLidos = ordenados.filter((c) => !estado.get(c.id)?.lido_em);
  const jaLidos = ordenados.filter((c) => estado.get(c.id)?.lido_em);
  for (const c of [...naoLidos, ...jaLidos]) {
    if (saida.length >= 3) break;
    saida.push(marcar(c));
  }
  return saida;
}

/** CON-05: sem plano, conteúdo premium mostra só o primeiro card e um card de convite. */
export function cardsParaLeitura(c: Conteudo, temPlano: boolean): { cards: string[]; bloqueada: boolean } {
  if (!c.premium || temPlano) return { cards: c.cards, bloqueada: false };
  return { cards: c.cards.slice(0, 1), bloqueada: true };
}

/** Stories guardadas, mais recente primeiro. */
export function guardadas(lidos: ConteudoLido[], todos: Conteudo[] = banco): Conteudo[] {
  return lidos
    .filter((l) => l.guardado)
    .sort((a, b) => b.atualizado_em.localeCompare(a.atualizado_em))
    .map((l) => todos.find((c) => c.id === l.conteudo_id))
    .filter((c): c is Conteudo => Boolean(c));
}
