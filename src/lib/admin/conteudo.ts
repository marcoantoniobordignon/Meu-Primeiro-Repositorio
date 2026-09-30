import { categoriasDeSaude, FRASE_ENCAMINHAMENTO, PALAVRAS_PROIBIDAS, type Categoria, type Conteudo, type CorToken } from "@/lib/conteudo/banco";

/** Cor por categoria, a mesma régua do scripts/conteudo-build.mjs. */
export const corDaCategoria: Record<Categoria, CorToken> = {
  semana: "primaria",
  corpo: "acento",
  bebe: "banho",
  parto: "fralda",
  pos_parto: "acento",
  sono: "sono",
  amamentacao: "mamada",
};

export const categorias: Categoria[] = ["corpo", "bebe", "parto", "pos_parto", "sono", "amamentacao", "semana"];

export function slugify(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Cards vêm do corpo, separados por uma linha "---" (a mesma regra do build). */
export function cardsDoCorpo(corpo: string): string[] {
  return corpo
    .split(/\n\s*---\s*\n/)
    .map((c) => c.trim())
    .filter(Boolean);
}

export function novoConteudo(): Conteudo {
  return {
    id: "",
    slug: "",
    titulo: "",
    categoria: "corpo",
    cor_token: "acento",
    semana_min: null,
    semana_max: null,
    mes_bebe_min: null,
    mes_bebe_max: null,
    dia_da_semana: null,
    minutos_leitura: 2,
    premium: false,
    publicado: false,
    cards: [],
    corpo_md: "",
  };
}

export type CampoProblema = "titulo" | "slug" | "faixa" | "corpo" | "palavras" | "frase" | "minutos" | "semana_categoria";

export interface Problema {
  campo: CampoProblema;
  mensagem: string;
}

/**
 * Regras da spec 07 que o painel precisa barrar antes de publicar:
 * CON-07 (sem "sempre/nunca/garantido"; saúde termina com a frase de encaminhamento)
 * e CON-08 (título, corpo, categoria, faixa e minutos preenchidos).
 */
export function validarConteudo(c: Conteudo, slugsExistentes: string[] = []): Problema[] {
  const problemas: Problema[] = [];
  const cards = cardsDoCorpo(c.corpo_md);

  if (c.titulo.trim().length < 4) problemas.push({ campo: "titulo", mensagem: "Título com pelo menos 4 letras." });
  if (!c.slug) problemas.push({ campo: "slug", mensagem: "Precisa de um slug." });
  else if (slugsExistentes.includes(c.slug)) problemas.push({ campo: "slug", mensagem: "Já existe um conteúdo com esse slug." });

  const temSemana = c.semana_min !== null && c.semana_max !== null;
  const temMes = c.mes_bebe_min !== null && c.mes_bebe_max !== null;
  if (!temSemana && !temMes) problemas.push({ campo: "faixa", mensagem: "Escolha em que semanas da gestação ou meses do bebê aparece." });
  if (temSemana && (c.semana_min! < 1 || c.semana_max! > 42 || c.semana_min! > c.semana_max!)) problemas.push({ campo: "faixa", mensagem: "Semanas entre 1 e 42, da menor para a maior." });
  if (temMes && (c.mes_bebe_min! < 0 || c.mes_bebe_max! > 24 || c.mes_bebe_min! > c.mes_bebe_max!)) problemas.push({ campo: "faixa", mensagem: "Meses entre 0 e 24, do menor para o maior." });
  if (c.categoria === "semana" && !(temSemana && c.semana_min === c.semana_max)) {
    problemas.push({ campo: "semana_categoria", mensagem: "A story da semana cobre uma semana só." });
  }

  if (cards.length < 2) problemas.push({ campo: "corpo", mensagem: "Pelo menos 2 cards, separados por uma linha com ---." });
  if (cards.some((card) => card.length > 420)) problemas.push({ campo: "corpo", mensagem: "Cada card cabe numa tela: até 420 caracteres." });
  if (!(c.minutos_leitura >= 1 && c.minutos_leitura <= 15)) problemas.push({ campo: "minutos", mensagem: "Minutos de leitura entre 1 e 15." });

  const re = new RegExp(`\\b(${PALAVRAS_PROIBIDAS.join("|")})\\b`, "i");
  const achou = `${c.titulo}\n${c.corpo_md}`.match(re);
  if (achou) problemas.push({ campo: "palavras", mensagem: `Evite "${achou[0]}": a gente não promete resultado (CON-07).` });

  if (categoriasDeSaude.includes(c.categoria) && !c.corpo_md.trim().endsWith(FRASE_ENCAMINHAMENTO)) {
    problemas.push({ campo: "frase", mensagem: `Conteúdo de saúde termina com "${FRASE_ENCAMINHAMENTO}".` });
  }
  return problemas;
}

/** Prepara para salvar: cards derivados do corpo, cor pela categoria, id = slug. */
export function normalizarConteudo(c: Conteudo): Conteudo {
  const corpo = c.corpo_md.trim();
  return {
    ...c,
    id: c.id || c.slug,
    slug: c.slug || slugify(c.titulo),
    titulo: c.titulo.trim(),
    corpo_md: corpo,
    cards: cardsDoCorpo(corpo),
    cor_token: corDaCategoria[c.categoria],
    semana_max: c.semana_min !== null && c.semana_max === null ? c.semana_min : c.semana_max,
    mes_bebe_max: c.mes_bebe_min !== null && c.mes_bebe_max === null ? c.mes_bebe_min : c.mes_bebe_max,
    premium: c.categoria === "semana" ? false : c.premium,
  };
}

/** Texto curto da faixa: "sem. 20–24" ou "mês 0–3". */
export function textoFaixa(c: Pick<Conteudo, "semana_min" | "semana_max" | "mes_bebe_min" | "mes_bebe_max">): string {
  const partes: string[] = [];
  if (c.semana_min !== null) partes.push(c.semana_min === c.semana_max || c.semana_max === null ? `sem. ${c.semana_min}` : `sem. ${c.semana_min}–${c.semana_max}`);
  if (c.mes_bebe_min !== null) partes.push(c.mes_bebe_min === c.mes_bebe_max || c.mes_bebe_max === null ? `mês ${c.mes_bebe_min}` : `mês ${c.mes_bebe_min}–${c.mes_bebe_max}`);
  return partes.join(" · ") || "sem faixa";
}

export const DIAS_DA_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;
