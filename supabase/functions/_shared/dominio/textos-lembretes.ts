/**
 * Copy dos lembretes (push). Mora aqui, e não em src/copy, porque o job do servidor também
 * monta os textos; `src/copy/lembretes.ts` re-exporta para o app. Frases curtas, tom "a gente".
 */
export const textosLembretes = {
  // Funcionalidade 17: modo fé.
  fe: {
    batismo: "Quando pensar no batismo?",
    batismoCorpo: "A lista de preparação está pronta no app, no seu tempo.",
    viradaTitulo: (s: number) => `Começou a semana ${s}`,
    oracaoNaVirada: "A oração da semana já está no app.",
  },
  // Funcionalidade 11 RN-06: virada de trimestre (uma vez, às 09:00 do dia).
  trimestre: {
    titulo: (t: 2 | 3) => (t === 2 ? "Bem-vinda ao 2º trimestre" : "Bem-vinda ao 3º trimestre"),
    corpo: (t: 2 | 3) => (t === 2 ? "Uma fase nova começa hoje. Veja o que vem por aí." : "A reta final começou. A gente te mostra o que esperar."),
  },
  med: {
    principal: (nome: string) => `Hora do ${nome}`,
    reforco: (nome: string) => `Ainda dá tempo: ${nome}`,
    adiada: (nome: string) => `De novo: ${nome}`,
    corpo: (dose: string | null) => (dose ? `${dose} · toque para registrar` : "Toque para registrar"),
    discretoTitulo: "Hora do seu lembrete",
    discretoCorpo: "Toque para registrar",
    acaoTomei: "Tomei",
    acaoAdiar: "Adiar",
  },
  exam: {
    abre: () => "A janela do exame abre em 2 semanas",
    abreCorpo: (nome: string) => `${nome}: bom momento para marcar.`,
    fecha7: () => "Falta 1 semana para a janela fechar",
    fecha2: () => "A janela fecha em 2 dias",
    fechaCorpo: (nome: string) => `${nome} ainda está para marcar.`,
    vespera: (nome: string) => `Amanhã: ${nome}`,
    vesperaCorpo: (hora: string | null) => (hora ? `Às ${hora}. Toque para ver os detalhes.` : "Toque para ver os detalhes."),
    duasHoras: (nome: string) => `${nome} daqui a 2 horas`,
    duasHorasCorpo: (local: string | null) => local ?? "Toque para ver os detalhes.",
    comoFoi: (nome: string) => `Como foi ${nome}?`,
    comoFoiCorpo: "Marque como feito ou remarque.",
    acaoJaFiz: "Já fiz",
    acaoRemarquei: "Remarquei",
  },
  appt: {
    vespera: (hora: string) => `Amanhã tem consulta às ${hora}`,
    vesperaCorpo: (perguntas: number) =>
      perguntas === 0 ? "Toque para ver os detalhes." : perguntas === 1 ? "1 pergunta na sua pauta" : `${perguntas} perguntas na sua pauta`,
    duasHoras: () => "Consulta daqui a 2 horas",
    duasHorasCorpo: (local: string | null) => local ?? "Toque para ver a pauta.",
  },
  // Funcionalidade 12 RN-08: avisos do parceiro (em "você", sobre "ela").
  parceiro: {
    vespera: (hora: string) => `Amanhã tem consulta, às ${hora}`,
    vesperaCorpo: (local: string | null) => (local ? `${local}. Que tal ir junto?` : "Que tal ir junto?"),
    exame: (nome: string) => `Ela marcou: ${nome}`,
    exameCorpo: (quando: string) => `${quando}. Toque para ver na agenda.`,
    marco: (semana: number) => `Semana ${semana}!`,
    marcoCorpo: (semana: number) =>
      semana === 12 ? "Fim do primeiro trimestre à vista. Veja o que muda." :
      semana === 20 ? "Metade do caminho. Veja como ajudar esta semana." :
      semana === 28 ? "Começou o terceiro trimestre. Veja como ajudar." :
      semana === 36 ? "Reta final. Confira a mala e o plano de parto juntos." :
      semana === 38 ? "Pode ser a qualquer momento. Deixe o telefone por perto." :
      "Chegou a data provável. Respire: muitos bebês vêm depois.",
  },
  belly: {
    virada: (semana: number) => `Semana ${semana}: hora da foto da barriga`,
    viradaCorpo: "Uma foto por semana, e a gente monta o vídeo no fim.",
    reforco: (semana: number) => `Ainda dá tempo da foto da semana ${semana}`,
    reforcoCorpo: "Leva um minutinho.",
  },
  diary: {
    titulo: (marco: string) => `Diário: ${marco}`,
  },
} as const;
