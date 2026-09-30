import { describe, expect, it } from "vitest";

import type { Contracao, SessaoChutes } from "@/lib/dados/colecoes";

import { padraoDeTrabalhoDeParto, resumirContracoes, sessaoDeveEncerrar } from "./chutes-contracoes";

const t0 = new Date(2026, 8, 30, 10, 0, 0);
const min = (m: number) => new Date(t0.getTime() + m * 60_000);

describe("HG-07 · sessão de chutes", () => {
  it("encerra com 10 chutes ou 2 h", () => {
    const base: SessaoChutes = { id: "s", inicio: t0.toISOString(), total: 0, atualizado_em: "" };
    expect(sessaoDeveEncerrar({ ...base, total: 9 }, min(30))).toBe(false);
    expect(sessaoDeveEncerrar({ ...base, total: 10 }, min(30))).toBe(true);
    expect(sessaoDeveEncerrar({ ...base, total: 2 }, min(120))).toBe(true);
    expect(sessaoDeveEncerrar({ ...base, total: 10, fim: min(5).toISOString() }, min(30))).toBe(false);
  });
});

function contracao(id: string, inicioMin: number, duracaoS: number): Contracao {
  const ini = min(inicioMin);
  return { id, inicio: ini.toISOString(), fim: new Date(ini.getTime() + duracaoS * 1000).toISOString(), atualizado_em: "" };
}

describe("HG-08 · padrão de trabalho de parto", () => {
  it("6 contrações de 50 s a cada 4 min sinalizam o padrão", () => {
    const lista = [0, 4, 8, 12, 16, 20].map((m, i) => contracao(`c${i}`, m, 50));
    expect(padraoDeTrabalhoDeParto(lista, min(21))).toBe(true);
  });

  it("não sinaliza com menos de 6, curtas demais ou espaçadas demais", () => {
    const cinco = [0, 4, 8, 12, 16].map((m, i) => contracao(`c${i}`, m, 50));
    expect(padraoDeTrabalhoDeParto(cinco, min(17))).toBe(false);
    const curtas = [0, 4, 8, 12, 16, 20].map((m, i) => contracao(`c${i}`, m, i === 3 ? 30 : 50));
    expect(padraoDeTrabalhoDeParto(curtas, min(21))).toBe(false);
    const espacadas = [0, 4, 8, 12, 16, 26].map((m, i) => contracao(`c${i}`, m, 50));
    expect(padraoDeTrabalhoDeParto(espacadas, min(27))).toBe(false);
  });

  it("ignora contrações de mais de uma hora atrás", () => {
    const antigas = [-120, -116, -112, -108, -104, -100].map((m, i) => contracao(`c${i}`, m, 50));
    expect(padraoDeTrabalhoDeParto(antigas, t0)).toBe(false);
  });
});

describe("resumo das contrações", () => {
  it("dá duração e intervalo, mais recente primeiro, no máximo 6", () => {
    const lista = [0, 5, 10, 15, 20, 25, 30].map((m, i) => contracao(`c${i}`, m, 40));
    const r = resumirContracoes(lista, 6, min(31));
    expect(r).toHaveLength(6);
    expect(r[0]?.id).toBe("c6");
    expect(r[0]?.duracaoS).toBe(40);
    expect(r[0]?.intervaloS).toBe(300);
    expect(r[5]?.intervaloS).toBe(300);
  });
});
