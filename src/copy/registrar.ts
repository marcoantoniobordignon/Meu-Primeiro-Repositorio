/** Copy da tela do "+" e dos sheets de chutes e contrações. */
export const registrarCopy = {
  titulo: "O que você quer registrar?",
  sintoma: { titulo: "Sintoma", desc: "Como você está hoje" },
  chutes: { titulo: "Chutes", desc: "Contar os movimentos" },
  contracoes: { titulo: "Contrações", desc: "Duração e intervalo" },
  consulta: { titulo: "Consulta", desc: "Marcar a próxima" },

  sheetChutes: {
    titulo: "Contar chutes",
    apoio: "Toque a cada movimento. Encerra sozinho com 10 chutes ou em 2 horas.",
    botao: "Senti um chute",
    contagem: (n: number) => `${n} de 10`,
    encerrar: "Encerrar agora",
    encerrada: (n: number, t: string) => `${n} ${n === 1 ? "chute" : "chutes"} em ${t} ✓`,
  },

  sheetContracoes: {
    titulo: "Contrações",
    apoio: "Toque quando começar e de novo quando passar.",
    iniciar: "Começou",
    parar: "Passou",
    emAndamento: "Em andamento",
    ultimas: "Últimas 6",
    duracao: "duração",
    intervalo: "intervalo",
    primeira: "primeira",
    alerta: "Padrão de trabalho de parto. Fale com sua equipe.",
    vazio: "Nenhuma contração registrada ainda.",
  },
} as const;
