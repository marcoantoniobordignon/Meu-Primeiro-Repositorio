import bruto from "../../../supabase/seed/sintomas.json";

export type GrupoSintoma = "corpo" | "digestivo" | "humor" | "sono" | "bebe";
export type Especial = "chutes" | "contracoes";

export interface ItemCatalogo {
  slug: string;
  nome: string;
  grupo: GrupoSintoma;
  /** Faixas [min, max] de semanas em que o sintoma é frequente. */
  semanas_frequentes: [number, number][];
  /** SIN-04: chips que abrem um sheet em vez de registrar. */
  especial?: Especial;
}

export const catalogo: ItemCatalogo[] = bruto as ItemCatalogo[];

const porSlug = new Map(catalogo.map((i) => [i.slug, i]));

export function itemDoCatalogo(slug: string): ItemCatalogo | undefined {
  return porSlug.get(slug);
}

export function nomeDoSintoma(slug: string): string {
  return porSlug.get(slug)?.nome ?? slug;
}

/** Cor do chip por grupo (DS-01: cor entra por nome de token, nunca por hex). */
export const corDoGrupo: Record<GrupoSintoma, "primaria" | "fralda" | "acento" | "sono" | "banho"> = {
  corpo: "primaria",
  digestivo: "fralda",
  humor: "acento",
  sono: "sono",
  bebe: "banho",
};

export const ordemGrupos: GrupoSintoma[] = ["corpo", "digestivo", "humor", "sono", "bebe"];

export function ehFrequenteNaSemana(item: ItemCatalogo, semana: number): boolean {
  return item.semanas_frequentes.some(([min, max]) => semana >= min && semana <= max);
}

/** Frequentes na semana, na ordem do catálogo. */
export function frequentesNaSemana(semana: number): ItemCatalogo[] {
  return catalogo.filter((i) => ehFrequenteNaSemana(i, semana));
}

/** Pós-parto (modo bebê): um conjunto fixo enquanto a spec 09 não define o dela. */
export function frequentesPosParto(): ItemCatalogo[] {
  return ["cansaco", "insonia", "humor_oscilando", "dor_costas"]
    .map((s) => porSlug.get(s))
    .filter((i): i is ItemCatalogo => Boolean(i));
}
