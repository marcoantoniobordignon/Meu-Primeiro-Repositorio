import type { Sintoma } from "@/lib/dados/colecoes";
import { diasEntre, somarDias, type DataISO } from "@/lib/dates";

import { frequentesNaSemana, frequentesPosParto, itemDoCatalogo, nomeDoSintoma, type ItemCatalogo } from "./catalogo";

export type Intensidade = 1 | 2 | 3;

export const nomeIntensidade: Record<Intensidade, string> = { 1: "leve", 2: "incômodo", 3: "forte" };

/** SIN-03: 1 → 2 → 3 → remove (null). */
export function proximaIntensidade(atual: Intensidade | null): Intensidade | null {
  if (atual === null) return 1;
  if (atual === 3) return null;
  return (atual + 1) as Intensidade;
}

/**
 * SIN-01: chips da home = registrados hoje (primeiro) + frequentes da semana,
 * até 5, sem repetir. O chip "+" é adicionado pela tela.
 */
export function chipsDaHome(hojeRegistrados: Sintoma[], semana: number, modoBebe = false, maximo = 5): ItemCatalogo[] {
  const vistos = new Set<string>();
  const saida: ItemCatalogo[] = [];
  for (const s of hojeRegistrados) {
    const item = itemDoCatalogo(s.slug);
    if (item && !vistos.has(item.slug)) {
      vistos.add(item.slug);
      saida.push(item);
    }
  }
  const frequentes = modoBebe ? frequentesPosParto() : frequentesNaSemana(semana);
  for (const item of frequentes) {
    if (saida.length >= maximo) break;
    if (!vistos.has(item.slug)) {
      vistos.add(item.slug);
      saida.push(item);
    }
  }
  return saida.slice(0, maximo);
}

export function registrosDoDia(todos: Sintoma[], data: DataISO): Sintoma[] {
  return todos.filter((s) => s.data === data);
}

/** Agrupa por dia, do mais recente ao mais antigo. */
export function porDia(todos: Sintoma[]): { data: DataISO; itens: Sintoma[] }[] {
  const mapa = new Map<DataISO, Sintoma[]>();
  for (const s of todos) {
    const lista = mapa.get(s.data) ?? [];
    lista.push(s);
    mapa.set(s.data, lista);
  }
  return [...mapa.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([data, itens]) => ({ data, itens }));
}

/** SIN-08: dias passados editáveis por 30 dias. */
export function diaEditavel(data: DataISO, hoje: DataISO): boolean {
  const d = diasEntre(data, hoje);
  return d >= 0 && d <= 30;
}

/** SIN-07: forte por 3 dias seguidos terminando em `ate`. */
export function forteTresDiasSeguidos(todos: Sintoma[], slug: string, ate: DataISO): boolean {
  for (let i = 0; i < 3; i++) {
    const dia = somarDias(ate, -i);
    const forte = todos.some((s) => s.slug === slug && s.data === dia && s.intensidade === 3);
    if (!forte) return false;
  }
  return true;
}

export interface LinhaResumo {
  slug: string;
  nome: string;
  dias: number;
  fortes: number;
}

/** Últimos `dias` dias (inclusive hoje), por sintoma, mais frequente primeiro. */
export function resumoPeriodo(todos: Sintoma[], hoje: DataISO, dias = 14): LinhaResumo[] {
  const inicio = somarDias(hoje, -(dias - 1));
  const mapa = new Map<string, LinhaResumo>();
  for (const s of todos) {
    if (s.data < inicio || s.data > hoje) continue;
    const linha = mapa.get(s.slug) ?? { slug: s.slug, nome: nomeDoSintoma(s.slug), dias: 0, fortes: 0 };
    linha.dias++;
    if (s.intensidade === 3) linha.fortes++;
    mapa.set(s.slug, linha);
  }
  return [...mapa.values()].sort((a, b) => b.dias - a.dias || a.nome.localeCompare(b.nome));
}

/** SIN-06: `Semanas 21–22 · Enjoo: 6 dias (forte em 2) · Azia: 3 dias`. */
export function resumoComoTexto(linhas: LinhaResumo[], semanaInicio: number, semanaFim: number): string {
  const cabeca = semanaInicio === semanaFim ? `Semana ${semanaInicio}` : `Semanas ${semanaInicio}–${semanaFim}`;
  if (linhas.length === 0) return `${cabeca} · sem sintomas registrados`;
  const partes = linhas.map((l) => {
    const d = l.dias === 1 ? "1 dia" : `${l.dias} dias`;
    return l.fortes > 0 ? `${l.nome}: ${d} (forte em ${l.fortes})` : `${l.nome}: ${d}`;
  });
  return [cabeca, ...partes].join(" · ");
}
