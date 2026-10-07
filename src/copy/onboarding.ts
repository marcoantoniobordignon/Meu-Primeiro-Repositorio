/** Copy do onboarding (spec 04). Tom "a gente", frases curtas. */
export const onboarding = {
  progresso: "Progresso do onboarding",
  voltar: "Voltar",
  pular: "Pular",
  continuar: "Continuar",

  boasVindas: {
    marca: "Ninho",
    titulo: "Um lugar só seu, semana a semana.",
    pergunta: "Em que momento você está?",
    gravida: { titulo: "Estou grávida", desc: "Acompanhar a gestação semana a semana" },
    bebe: { titulo: "Já com o bebê", desc: "Registrar sono, mamadas e o dia a dia" },
    privacidade: "Nada sai daqui sem você pedir. Sem conta, sem cadastro agora.",
  },

  data: {
    perguntaGestacao: "Quando é a data prevista do parto?",
    perguntaBebe: "Quando o bebê nasceu?",
    apoioGestacao: "Se não souber, a gente calcula pela última menstruação.",
    apoioBebe: "É com essa data que a gente conta os dias, as semanas e os meses.",
    modoDpp: "Sei a data do parto",
    modoDum: "Sei a última menstruação",
    rotuloDpp: "Data prevista do parto",
    rotuloDum: "Primeiro dia da última menstruação",
    rotuloNascimento: "Data de nascimento",
    calculada: (dpp: string) => `Pela sua DUM, o parto deve ser por volta de ${dpp}.`,
    ajustar: "Ajustar essa data",
    erroInvalida: "Essa data não parece certa. Confere pra gente?",
    erroFuturo: "Essa data ainda não chegou.",
    erroMuitoLonge: "Uma gestação dura em torno de 40 semanas. Confere a data?",
    passadoTitulo: "Essa data já passou. O bebê já nasceu?",
    passadoSim: "Sim, já nasceu",
    passadoNao: "Não, corrigir a data",
  },

  valor: {
    semanas: "semanas",
    semana: "semana",
    eDias: (d: number) => (d === 1 ? "e 1 dia" : `e ${d} dias`),
    faltam: (s: number) => (s === 1 ? "1 semana para o parto" : `${s} semanas para o parto`),
    faltamDias: (d: number) => (d === 1 ? "1 dia para o parto" : `${d} dias para o parto`),
    passouDpp: "A data prevista já passou. Falta pouco.",
    tamanhoTitulo: "Do tamanho de",
    medidas: (cm: string, g: string) => `≈ ${cm} · ${g}`,
    estaSemana: "Esta semana",
    trimestre: (t: number) => `${t}º trimestre`,
    bebeTitulo: (dias: number) =>
      dias === 0 ? "Nasceu hoje" : dias === 1 ? "1 dia de vida" : `${dias} dias de vida`,
    bebeApoio: "A partir de agora, cada registro vira memória e padrão.",
    cta: "Quero acompanhar",
  },

  nome: {
    pergunta: "Como a gente te chama?",
    apoio: "Só pra dar bom dia do jeito certo.",
    rotulo: "Seu nome",
    placeholder: "Seu primeiro nome",
  },

  comoEsta: {
    pergunta: (nome?: string) => (nome ? `${nome}, como você está hoje?` : "Como você está hoje?"),
    apoio: "Toque no que sentir. Isso vira seu diário.",
    nada: "Nenhum desses hoje",
  },

  // Funcionalidade 17: nenhuma resposta vem marcada.
  fe: {
    pergunta: "Quer incluir conteúdo de fé católica?",
    apoio: "Oração da semana, orações e santos protetores da gravidez. Dá para mudar quando quiser, em Eu.",
    sim: "Sim, quero",
    nao: "Não, obrigada",
    depois: "Decidir depois",
  },

  instalar: {
    pergunta: "Deixa o Ninho a um toque",
    apoio: "Instalado na tela inicial, abre na hora, mesmo sem internet, às 3 da manhã.",
    ios: {
      titulo: "No iPhone",
      passos: ["Toque em Compartilhar", "Escolha \"Adicionar à Tela de Início\"", "Confirme em Adicionar"],
    },
    android: {
      titulo: "No Android",
      passos: ["Toque no menu ⋮ do navegador", "Escolha \"Instalar app\"", "Confirme"],
    },
    outro: {
      titulo: "No computador",
      passos: ["Clique no ícone de instalar na barra de endereço", "Confirme"],
    },
    instalarAgora: "Instalar agora",
    jaInstalei: "Já instalei",
    instalado: "Já está instalado.",
    pushTitulo: "Quer o aviso de \"virou a semana\"?",
    pushApoio: "Toda segunda, um lembrete curto do que muda. No máximo dois avisos por dia, nunca mais que isso.",
    pushSim: "Quero o aviso",
    pushNao: "Agora não",
    pushIndisponivel: "Aviso disponível depois de instalar.",
  },

  guardar: {
    pergunta: "Guardar sua linha do tempo?",
    apoio: "Com uma conta, tudo continua se você trocar de celular. Sem conta, fica só neste aparelho.",
    google: "Continuar com Google",
    email: "Continuar com e-mail",
    rotuloEmail: "Seu e-mail",
    enviarLink: "Me manda o link",
    linkEnviado: "Enviamos um link pro seu e-mail. Toque nele pra entrar.",
    agoraNao: "Agora não",
    oQueFicaTitulo: "O que fica guardado",
    oQueFica: {
      gestacao: (semana: number) => `Sua ${semana}ª semana e a data do parto`,
      bebe: (dias: number) => (dias === 1 ? "O primeiro dia do bebê" : `Os ${dias} dias do bebê`),
      diario: (n: number) => (n === 0 ? "Seu diário, a partir de hoje" : n === 1 ? "O sintoma de hoje" : `Os ${n} sintomas de hoje`),
      depois: "Tudo o que vier depois",
    },
    semServidor: "Guardamos aqui no aparelho por enquanto. A conta chega em breve.",
  },

  sintomasSemana: {
    titulo: "Sintomas frequentes",
  },
} as const;
