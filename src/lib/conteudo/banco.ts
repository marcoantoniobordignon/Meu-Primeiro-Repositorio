import bruto from "../../conteudo/banco.json";

export type Categoria = "semana" | "corpo" | "bebe" | "parto" | "pos_parto" | "sono" | "amamentacao";
export type CorToken = "primaria" | "acento" | "banho" | "fralda" | "sono" | "mamada";

export interface Conteudo {
  id: string;
  slug: string;
  titulo: string;
  categoria: Categoria;
  cor_token: CorToken;
  semana_min: number | null;
  semana_max: number | null;
  mes_bebe_min: number | null;
  mes_bebe_max: number | null;
  dia_da_semana: number | null;
  minutos_leitura: number;
  premium: boolean;
  publicado: boolean;
  cards: string[];
  corpo_md: string;
}

/** CON-06: o banco inteiro vai no bundle, então toda story lê offline. */
export const banco: Conteudo[] = (bruto as Conteudo[]).filter((c) => c.publicado);

const porId = new Map(banco.map((c) => [c.id, c]));

export function conteudoPorId(id: string): Conteudo | undefined {
  return porId.get(id);
}

export const nomeCategoria: Record<Categoria, string> = {
  semana: "Esta semana",
  corpo: "Seu corpo",
  bebe: "Bebê",
  parto: "Parto",
  pos_parto: "Pós-parto",
  sono: "Sono",
  amamentacao: "Amamentação",
};

/** CON-07: categorias que falam de saúde e precisam da frase de encaminhamento. */
export const categoriasDeSaude: Categoria[] = ["semana", "corpo", "parto", "pos_parto", "sono", "amamentacao"];
export const FRASE_ENCAMINHAMENTO = "Na dúvida, fale com quem te acompanha.";
export const PALAVRAS_PROIBIDAS = ["sempre", "nunca", "garantido", "garantida"];
