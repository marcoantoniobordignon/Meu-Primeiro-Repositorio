import bruto from "../../conteudo/semanas-3d.json";

export interface SemanaBebe3D {
  semana: number;
  comprimento_cm: number;
  comprimento_texto: string;
  peso_g: number;
  peso_texto: string;
  comparacao: string;
  emoji: string;
  marcos: string[];
  descricao_cena: string;
  revisao_medica: "pendente" | "aprovada";
}

interface Banco {
  revisao_medica: string;
  fontes: string[];
  aviso: string;
  semanas: SemanaBebe3D[];
}

export const bancoSemanas = bruto as Banco;
export const SEMANA_MIN = 4;
export const SEMANA_MAX = 40;

export function dadosDaSemana(semana: number): SemanaBebe3D | undefined {
  return bancoSemanas.semanas.find((s) => s.semana === semana);
}

/**
 * Comprimento cabeça–nádega (CRL) mediano em cm por semana, para a escala do
 * bebê dentro do útero ser coerente (Hadlock 1992 / NHS, arredondado).
 * A partir da semana 14 o CRL deixa de ser medido na prática clínica; os
 * valores seguintes são estimativas de proporção cabeça–nádega.
 */
const CRL_CM: Record<number, number> = {
  4: 0.1, 5: 0.2, 6: 0.4, 7: 1.0, 8: 1.6, 9: 2.3, 10: 3.1, 11: 4.1, 12: 5.4, 13: 7.4,
  14: 8.7, 15: 10.1, 16: 11.6, 17: 13.0, 18: 14.2, 19: 15.3, 20: 16.4, 21: 17.5, 22: 18.6,
  23: 19.7, 24: 20.8, 25: 21.8, 26: 22.8, 27: 23.8, 28: 24.8, 29: 25.8, 30: 26.8,
  31: 27.8, 32: 28.8, 33: 29.8, 34: 30.8, 35: 31.8, 36: 32.8, 37: 33.6, 38: 34.4, 39: 35.2, 40: 36.0,
};

export function crlDaSemana(semana: number): number {
  const s = Math.max(SEMANA_MIN, Math.min(SEMANA_MAX, Math.round(semana)));
  return CRL_CM[s] ?? CRL_CM[SEMANA_MAX]!;
}

/** O modelo base mede 1,3 unidades da cabeça ao bumbum; 1 unidade da cena = 1 cm. */
export const CRL_DO_MODELO = 1.3;

export function escalaDaSemana(semana: number): number {
  return crlDaSemana(semana) / CRL_DO_MODELO;
}

/**
 * Raio do útero da cena, em cm. Licença artística: o útero real é apertado
 * demais para uma câmera; aqui ele cresce com o bebê mantendo ar em volta,
 * e o embrião das primeiras semanas continua pequeno dentro dele.
 */
export function raioUteroDaSemana(semana: number): number {
  return 8 + crlDaSemana(semana) * 1.25;
}

/** Batimentos por minuto medianos: alto no 1º trimestre, descendo até o termo. */
export function bpmDaSemana(semana: number): number {
  if (semana <= 9) return 170;
  if (semana <= 14) return 160;
  if (semana <= 24) return 150;
  if (semana <= 32) return 140;
  return 132;
}
