import type { CorItem } from "@dominio/calendario.ts";

/** Cor por tipo de registro: só tokens do design system (classes fixas para o Tailwind enxergar). */
export const FUNDO_DA_COR: Record<CorItem, string> = {
  primaria: "bg-primaria",
  acento: "bg-acento",
  sono: "bg-sono",
  banho: "bg-banho",
  fralda: "bg-fralda",
  sucesso: "bg-sucesso",
};
