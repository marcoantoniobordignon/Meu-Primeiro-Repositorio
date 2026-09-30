/** Catálogo mínimo de sintomas usado pelo onboarding (a spec 06 expande). */
export interface Sintoma {
  id: string;
  nome: string;
}

export const sintomas: Record<string, Sintoma> = {
  enjoo: { id: "enjoo", nome: "Enjoo" },
  cansaco: { id: "cansaco", nome: "Cansaço" },
  sono: { id: "sono", nome: "Muito sono" },
  seios: { id: "seios", nome: "Seios sensíveis" },
  azia: { id: "azia", nome: "Azia" },
  dorCostas: { id: "dorCostas", nome: "Dor nas costas" },
  inchaco: { id: "inchaco", nome: "Inchaço" },
  fome: { id: "fome", nome: "Muita fome" },
  faltaAr: { id: "faltaAr", nome: "Falta de ar" },
  insonia: { id: "insonia", nome: "Insônia" },
  contracoes: { id: "contracoes", nome: "Contrações de treino" },
  pressaoPelvica: { id: "pressaoPelvica", nome: "Pressão na pelve" },
  humor: { id: "humor", nome: "Humor oscilando" },
  tontura: { id: "tontura", nome: "Tontura" },
  bemDisposta: { id: "bemDisposta", nome: "Bem disposta" },
  chutes: { id: "chutes", nome: "Sentindo chutes" },
  dorAmamentar: { id: "dorAmamentar", nome: "Dor ao amamentar" },
  poucoSono: { id: "poucoSono", nome: "Dormi pouco" },
  sensivel: { id: "sensivel", nome: "Mais sensível" },
};

/** Os 4 sintomas mais comuns do pós-parto (tela 5 em modo bebê). */
export function sintomasPosParto(): Sintoma[] {
  return ["poucoSono", "cansaco", "dorAmamentar", "sensivel"]
    .map((id) => sintomas[id])
    .filter((s): s is Sintoma => Boolean(s));
}

/** Os 4 sintomas mais frequentes por faixa de semanas (tela 5). */
export function sintomasDaSemana(semana: number): Sintoma[] {
  const ids =
    semana < 8
      ? ["cansaco", "seios", "enjoo", "humor"]
      : semana < 14
        ? ["enjoo", "cansaco", "sono", "seios"]
        : semana < 20
          ? ["bemDisposta", "fome", "azia", "tontura"]
          : semana < 28
            ? ["chutes", "azia", "dorCostas", "bemDisposta"]
            : semana < 36
              ? ["dorCostas", "inchaco", "faltaAr", "insonia"]
              : ["contracoes", "pressaoPelvica", "insonia", "inchaco"];
  return ids.map((id) => sintomas[id]).filter((s): s is Sintoma => Boolean(s));
}
