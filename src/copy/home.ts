/** Copy da home da gestação (spec 05). */
export const home = {
  semanas: "semanas",
  semana: "semana",
  eDias: (d: number) => (d === 1 ? "e 1 dia" : `e ${d} dias`),
  trimestre: (t: number) => `${t}º trimestre`,
  comoEsta: "Como você está hoje?",
  hojeParaVoce: "Hoje para você",
  verTodas: "Ver diário",
  guardarLinha: "Guardar minha linha do tempo",
  dispensar: "Dispensar",

  consulta: {
    titulo: "Próxima consulta",
    nenhuma: "Nenhuma consulta marcada",
    adicionar: "Adicionar",
    verTodas: "Ver todas",
    foiBem: "Foi bem?",
    sim: "Sim",
    remarcar: "Remarcar",
  },

  chutes: {
    ativo: "Contando chutes",
    resumo: (n: number, min: number) => `${n} ${n === 1 ? "chute" : "chutes"} · ${min} min`,
    continuar: "Continuar",
  },

  contracoes: {
    ativo: "Contrações",
    emAndamento: "Uma em andamento",
    ultima: (ha: string) => `Última ${ha}`,
    alerta: "Padrão de trabalho de parto. Fale com sua equipe.",
    abrir: "Abrir",
  },

  bebe: {
    diasDeVida: "dias de vida",
    diaDeVida: "dia de vida",
    emBreve: "A home do bebê chega na próxima etapa.",
  },
} as const;
