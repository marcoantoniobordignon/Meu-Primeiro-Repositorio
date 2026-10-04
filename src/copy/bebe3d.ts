/** Copy da aba 3D do bebê. Encantamento e acolhimento, nunca clínico. */
export const bebe3dCopy = {
  titulo: "Seu bebê hoje",
  semana: (n: number) => `Semana ${n}`,
  cardHero: {
    titulo: "Veja seu bebê hoje",
    apoio: (comparacao: string) => `Do tamanho de ${comparacao}. Toque para entrar no ninho.`,
    cta: "Entrar",
  },
  carregando: {
    titulo: "Preparando o ninho",
    frases: ["Aquecendo a luz…", "Enchendo de água morna…", "Acordando o bebê devagar…"],
  },
  fechar: "Fechar",
  enquadramentos: {
    rotulo: "Enquadramento",
    rosto: "Rosto",
    maos: "Mãos",
    corpo: "Corpo",
  },
  ficha: {
    tamanho: "Tamanho",
    peso: "Peso",
    marcos: "Nesta semana",
    comparacao: (c: string) => `Do tamanho de ${c}`,
    verMais: "Ver mais",
    verMenos: "Ver menos",
    revisao: "Em revisão médica",
  },
  aviso: "Ilustração artística baseada em médias de desenvolvimento. Cada bebê é único. Não substitui o acompanhamento pré-natal.",
  descricaoCena: "Descrição da cena",
  medidor: {
    rotulo: "Desempenho",
    nivel: { alto: "Qualidade alta", medio: "Qualidade média", baixo: "Qualidade básica" },
  },
  semWebgl: {
    titulo: "Seu aparelho não consegue mostrar a cena 3D.",
    apoio: "Mas a gente conta como o bebê está nesta semana:",
  },
  reduzido: "Movimento reduzido, como você pediu nas configurações do aparelho.",
} as const;
