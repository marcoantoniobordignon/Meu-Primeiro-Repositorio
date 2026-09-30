import { describe, expect, it } from "vitest";

import type { Consulta } from "@/lib/dados/colecoes";

import { estadoDoCard } from "./consultas";

function c(id: string, data: Date, realizada = false): Consulta {
  return { id, data: data.toISOString(), tipo: "pre_natal", realizada, atualizado_em: "" };
}

const agora = new Date(2026, 8, 30, 10, 0);

describe("HG-05 · card da próxima consulta", () => {
  it("sem consulta pendente: nenhuma", () => {
    expect(estadoDoCard([c("a", new Date(2026, 9, 5), true)], agora)).toEqual({ tipo: "nenhuma" });
  });

  it("a próxima não realizada; iminente a partir de 24 h antes", () => {
    const amanha = c("a", new Date(2026, 9, 1, 9, 0));
    const semana = c("b", new Date(2026, 9, 7, 9, 0));
    expect(estadoDoCard([semana, amanha], agora)).toEqual({ tipo: "proxima", consulta: amanha, iminente: true });
    expect(estadoDoCard([semana], agora)).toEqual({ tipo: "proxima", consulta: semana, iminente: false });
  });
});

describe("HG-06 · consulta passada sem marcar", () => {
  it("aparece por 3 dias; depois disso, some", () => {
    const ontem = c("a", new Date(2026, 8, 29, 9, 0));
    expect(estadoDoCard([ontem], agora)).toEqual({ tipo: "passada", consulta: ontem });
    const haQuatroDias = c("b", new Date(2026, 8, 26, 9, 0));
    expect(estadoDoCard([haQuatroDias], agora)).toEqual({ tipo: "nenhuma" });
  });

  it("tem prioridade sobre a próxima", () => {
    const ontem = c("a", new Date(2026, 8, 29, 9, 0));
    const amanha = c("b", new Date(2026, 9, 1, 9, 0));
    expect(estadoDoCard([amanha, ontem], agora).tipo).toBe("passada");
  });
});
