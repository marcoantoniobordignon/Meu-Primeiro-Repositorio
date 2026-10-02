/**
 * Esqueleto e volumes do bebê placeholder, em pose fetal.
 * Unidades: o modelo mede 1,3 da cabeça ao bumbum (ver CRL_DO_MODELO).
 * O bebê olha para +z; o sol fica em +y / -z.
 *
 * Os nomes dos ossos seguem a especificação de assets (docs/bebe-3d-assets.md),
 * então o modelo definitivo em glTF usa os mesmos nomes e o controlador de
 * animação não muda.
 */
export type V3 = [number, number, number];

export type NomeOsso =
  | "pelvis"
  | "coluna"
  | "torax"
  | "pescoco"
  | "cabeca"
  | "braco_E"
  | "antebraco_E"
  | "mao_E"
  | "dedos_E"
  | "braco_D"
  | "antebraco_D"
  | "mao_D"
  | "dedos_D"
  | "coxa_E"
  | "canela_E"
  | "pe_E"
  | "coxa_D"
  | "canela_D"
  | "pe_D";

export interface Osso {
  nome: NomeOsso;
  pai: NomeOsso | null;
  /** Posição do início do osso (articulação), no espaço do modelo. */
  inicio: V3;
  /** Posição do fim (a articulação seguinte ou a ponta). */
  fim: V3;
  /** Raio médio da parte do corpo que este osso controla (para os pesos de pele). */
  raio: number;
}

/** Cápsula de campo implícito: a "carne" que o marching cubes extrai. */
export interface Capsula {
  a: V3;
  b: V3;
  raio: number;
  /** Osso ao qual a espessura desta cápsula pertence (para o SSS). */
  osso: NomeOsso;
  /** Peso no campo: negativo cava (olhos, boca). Padrão 1. */
  peso?: number;
}

const E = (p: V3): V3 => p;
const D = (p: V3): V3 => [-p[0], p[1], p[2]];

// Articulações (lado esquerdo; o direito é espelhado em x).
const J = {
  pelvis: [0, 0, 0] as V3,
  coluna: [0, 0.2, 0.04] as V3,
  torax: [0, 0.42, 0.07] as V3,
  pescoco: [0, 0.6, 0.12] as V3,
  cabeca: [0, 0.74, 0.17] as V3,
  topo: [0, 1.06, 0.18] as V3,
  ombro: [-0.21, 0.5, 0.1] as V3,
  cotovelo: [-0.3, 0.3, 0.32] as V3,
  punho: [-0.16, 0.36, 0.5] as V3,
  mao: [-0.08, 0.46, 0.58] as V3,
  dedos: [-0.03, 0.54, 0.62] as V3,
  quadril: [-0.11, -0.03, 0.03] as V3,
  joelho: [-0.19, -0.02, 0.44] as V3,
  tornozelo: [-0.13, -0.38, 0.4] as V3,
  pe: [-0.1, -0.42, 0.58] as V3,
};

export const ossos: Osso[] = [
  { nome: "pelvis", pai: null, inicio: J.pelvis, fim: J.coluna, raio: 0.2 },
  { nome: "coluna", pai: "pelvis", inicio: J.coluna, fim: J.torax, raio: 0.2 },
  { nome: "torax", pai: "coluna", inicio: J.torax, fim: J.pescoco, raio: 0.2 },
  { nome: "pescoco", pai: "torax", inicio: J.pescoco, fim: J.cabeca, raio: 0.09 },
  { nome: "cabeca", pai: "pescoco", inicio: J.cabeca, fim: J.topo, raio: 0.32 },
  { nome: "braco_E", pai: "torax", inicio: E(J.ombro), fim: E(J.cotovelo), raio: 0.075 },
  { nome: "antebraco_E", pai: "braco_E", inicio: E(J.cotovelo), fim: E(J.punho), raio: 0.065 },
  { nome: "mao_E", pai: "antebraco_E", inicio: E(J.punho), fim: E(J.mao), raio: 0.06 },
  { nome: "dedos_E", pai: "mao_E", inicio: E(J.mao), fim: E(J.dedos), raio: 0.03 },
  { nome: "braco_D", pai: "torax", inicio: D(J.ombro), fim: D(J.cotovelo), raio: 0.075 },
  { nome: "antebraco_D", pai: "braco_D", inicio: D(J.cotovelo), fim: D(J.punho), raio: 0.065 },
  { nome: "mao_D", pai: "antebraco_D", inicio: D(J.punho), fim: D(J.mao), raio: 0.06 },
  { nome: "dedos_D", pai: "mao_D", inicio: D(J.mao), fim: D(J.dedos), raio: 0.03 },
  { nome: "coxa_E", pai: "pelvis", inicio: E(J.quadril), fim: E(J.joelho), raio: 0.1 },
  { nome: "canela_E", pai: "coxa_E", inicio: E(J.joelho), fim: E(J.tornozelo), raio: 0.08 },
  { nome: "pe_E", pai: "canela_E", inicio: E(J.tornozelo), fim: E(J.pe), raio: 0.06 },
  { nome: "coxa_D", pai: "pelvis", inicio: D(J.quadril), fim: D(J.joelho), raio: 0.1 },
  { nome: "canela_D", pai: "coxa_D", inicio: D(J.joelho), fim: D(J.tornozelo), raio: 0.08 },
  { nome: "pe_D", pai: "canela_D", inicio: D(J.tornozelo), fim: D(J.pe), raio: 0.06 },
];

function lado(l: "E" | "D"): Capsula[] {
  const m = l === "E" ? E : D;
  const s = l === "E" ? -1 : 1;
  const dedo = (dx: number, dy: number, dz: number, i: number): Capsula => ({
    a: m(J.mao),
    b: m([J.mao[0] + dx * s, J.mao[1] + dy, J.mao[2] + dz]),
    raio: 0.022 - i * 0.002,
    osso: `dedos_${l}`,
  });
  return [
    { a: m(J.ombro), b: m(J.cotovelo), raio: 0.075, osso: `braco_${l}` },
    { a: m(J.cotovelo), b: m(J.punho), raio: 0.065, osso: `antebraco_${l}` },
    { a: m(J.punho), b: m(J.mao), raio: 0.058, osso: `mao_${l}` },
    // Dedinhos: quatro cápsulas finas e um polegar mais curto, levemente em leque.
    dedo(0.07, 0.11, 0.04, 0),
    dedo(0.04, 0.12, 0.05, 1),
    dedo(0.01, 0.12, 0.055, 2),
    dedo(-0.02, 0.11, 0.05, 3),
    { a: m(J.mao), b: m([J.mao[0] - 0.06 * s, J.mao[1] + 0.04, J.mao[2] + 0.03]), raio: 0.024, osso: `dedos_${l}` },
    { a: m(J.quadril), b: m(J.joelho), raio: 0.1, osso: `coxa_${l}` },
    { a: m(J.joelho), b: m(J.tornozelo), raio: 0.08, osso: `canela_${l}` },
    { a: m(J.tornozelo), b: m(J.pe), raio: 0.058, osso: `pe_${l}` },
    { a: m(J.pe), b: m([J.pe[0] + 0.02 * s, J.pe[1] - 0.005, J.pe[2] + 0.05]), raio: 0.035, osso: `pe_${l}` },
  ];
}

export const capsulas: Capsula[] = [
  // Cabeça grande e redonda, testa alta, queixo pequeno (proporção da semana 20).
  { a: [0, 0.78, 0.1], b: [0, 0.86, 0.1], raio: 0.285, osso: "cabeca" },
  { a: [-0.07, 0.8, 0.13], b: [0.07, 0.8, 0.13], raio: 0.27, osso: "cabeca" }, // largura do crânio
  { a: [-0.07, 0.92, 0.3], b: [0.07, 0.92, 0.3], raio: 0.1, osso: "cabeca" }, // testa
  // Rosto: as feições precisam avançar além da esfera do crânio (frente em z≈0.40) para aparecerem.
  { a: [-0.15, 0.71, 0.3], b: [-0.13, 0.75, 0.3], raio: 0.1, osso: "cabeca" }, // bochecha E
  { a: [0.15, 0.71, 0.3], b: [0.13, 0.75, 0.3], raio: 0.1, osso: "cabeca" }, // bochecha D
  { a: [-0.12, 0.86, 0.37], b: [0.12, 0.86, 0.37], raio: 0.045, osso: "cabeca" }, // arcada das sobrancelhas
  { a: [-0.12, 0.8, 0.39], b: [-0.11, 0.8, 0.39], raio: 0.05, osso: "cabeca", peso: -0.55 }, // órbita E
  { a: [0.12, 0.8, 0.39], b: [0.11, 0.8, 0.39], raio: 0.05, osso: "cabeca", peso: -0.55 }, // órbita D
  { a: [-0.12, 0.795, 0.4], b: [-0.11, 0.795, 0.4], raio: 0.05, osso: "cabeca" }, // pálpebra E (fechada)
  { a: [0.12, 0.795, 0.4], b: [0.11, 0.795, 0.4], raio: 0.05, osso: "cabeca" }, // pálpebra D
  { a: [0, 0.82, 0.4], b: [0, 0.74, 0.46], raio: 0.032, osso: "cabeca" }, // dorso do nariz
  { a: [0, 0.735, 0.47], b: [0, 0.73, 0.47], raio: 0.042, osso: "cabeca" }, // ponta do nariz
  { a: [-0.035, 0.725, 0.45], b: [0.035, 0.725, 0.45], raio: 0.03, osso: "cabeca" }, // asas do nariz
  { a: [-0.05, 0.69, 0.44], b: [0.05, 0.69, 0.44], raio: 0.035, osso: "cabeca" }, // lábio superior
  { a: [-0.04, 0.655, 0.435], b: [0.04, 0.655, 0.435], raio: 0.032, osso: "cabeca" }, // lábio inferior
  { a: [-0.045, 0.672, 0.46], b: [0.045, 0.672, 0.46], raio: 0.018, osso: "cabeca", peso: -1.0 }, // linha da boca
  { a: [0, 0.615, 0.38], b: [0, 0.63, 0.38], raio: 0.07, osso: "cabeca" }, // queixo
  { a: [-0.29, 0.74, 0.1], b: [-0.3, 0.8, 0.09], raio: 0.055, osso: "cabeca" }, // orelha E
  { a: [0.29, 0.74, 0.1], b: [0.3, 0.8, 0.09], raio: 0.055, osso: "cabeca" }, // orelha D
  { a: J.pescoco, b: J.cabeca, raio: 0.09, osso: "pescoco" },
  // Tronco em C, com barriga redonda.
  { a: J.pelvis, b: J.coluna, raio: 0.17, osso: "pelvis" },
  { a: J.coluna, b: J.torax, raio: 0.19, osso: "coluna" },
  { a: J.torax, b: J.pescoco, raio: 0.17, osso: "torax" },
  { a: [0, 0.14, 0.14], b: [0, 0.22, 0.14], raio: 0.18, osso: "coluna" }, // barriga
  { a: [0, -0.07, -0.05], b: [0, -0.04, -0.05], raio: 0.15, osso: "pelvis" }, // bumbum
  ...lado("E"),
  ...lado("D"),
];

/** Umbigo: onde o cordão nasce, no espaço do modelo. */
export const UMBIGO: V3 = [0, 0.12, 0.33];
/** Centro aproximado da cabeça, para o foco da câmera. */
export const CENTRO_CABECA: V3 = [0, 0.78, 0.2];
/** Centro aproximado das mãos, para o enquadramento "mãos". */
export const CENTRO_MAOS: V3 = [0, 0.46, 0.58];
