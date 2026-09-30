import bruto from "../../supabase/seed/conteudo-semanas.json";

/** ONB-03: conteúdo por semana embutido no bundle; funciona sem rede. */
export interface ConteudoSemana {
  semana: number;
  emoji: string;
  tamanho: string;
  comprimento: string;
  peso: string;
  frase: string;
  dica: string;
}

const semanas: ConteudoSemana[] = bruto as ConteudoSemana[];

/** Semana 0 usa a 1; acima de 42 usa a 42. */
export function conteudoDaSemana(semana: number): ConteudoSemana {
  const alvo = Math.min(42, Math.max(1, semana));
  const achado = semanas.find((s) => s.semana === alvo);
  if (!achado) throw new Error(`conteudo-semanas.json sem a semana ${alvo}`);
  return achado;
}

export const totalSemanasConteudo = semanas.length;
