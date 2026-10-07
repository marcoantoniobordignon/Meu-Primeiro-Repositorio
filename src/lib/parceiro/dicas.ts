import bruto from "../../../supabase/seed/dicas-parceiro.json";
import { dicaDaSemana, type DicaParceiro } from "@dominio/parceiro.ts";

/** RN-09: "Como ajudar" vem no bundle (funciona sem rede); a tabela `partner_tips` recebe o mesmo pelo `conteudo:sync`. */
export const DICAS_PARCEIRO = bruto as DicaParceiro[];

export function dicaParaSemana(semana: number): DicaParceiro | null {
  return dicaDaSemana(DICAS_PARCEIRO, semana);
}
