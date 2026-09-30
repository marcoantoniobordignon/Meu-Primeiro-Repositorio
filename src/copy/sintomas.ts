/** Copy de sintomas e diário (spec 06). O catálogo vive em lib/sintomas/catalogo.ts. */
export const sintomasCopy = {
  sheetTitulo: "Como você está hoje?",
  sheetTituloDia: (rotulo: string) => `Como você estava ${rotulo.toLowerCase()}?`,
  ajudaIntensidade: "Toque de novo para mudar a intensidade: leve, incômodo, forte.",
  grupos: {
    corpo: "Corpo",
    digestivo: "Digestivo",
    humor: "Humor",
    sono: "Sono",
    bebe: "Bebê",
  },
  nota: "Uma nota, se quiser",
  notaPlaceholder: "Ex.: começou depois do almoço",
  salvar: "Salvar",
  salvo: "Diário atualizado ✓",
  registrado: (nome: string) => `${nome} registrado ✓`,
  removido: (nome: string) => `${nome} removido`,
  mais: "Mais",
  somenteLeitura: "Dias com mais de 30 dias ficam só para leitura.",

  madrugada: {
    titulo: "Ainda é ontem?",
    apoio: "Passa da meia-noite. Quer registrar no dia de ontem ou já em hoje?",
    ontem: "Ontem",
    hoje: "Hoje",
  },

  diario: {
    titulo: "Diário",
    resumo: "Resumo",
    filtroTodos: "Todos",
    vazio: "Nada registrado ainda. Um toque por dia já ajuda na consulta.",
    registrarHoje: "Registrar hoje",
    valeComentar: "Vale comentar na próxima consulta",
    intensidade: { 1: "leve", 2: "incômodo", 3: "forte" } as Record<1 | 2 | 3, string>,
  },

  resumo: {
    titulo: "Resumo para a consulta",
    apoio: "Últimos 14 dias, para mostrar ou colar no WhatsApp.",
    copiar: "Copiar como texto",
    copiado: "Copiado ✓",
    semSuporte: "Selecione e copie o texto abaixo.",
    vazio: "Nenhum sintoma nos últimos 14 dias.",
    dia: "Dia",
  },
} as const;
