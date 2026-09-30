import { describe, expect, it } from "vitest";

import type { RegistroBebe } from "@/lib/dados/colecoes";

import { faixaDaTabela, podeAvisar, preverSoneca, semanasParaJanela } from "./soneca";

function sono(id: string, inicio: Date, fim: Date | null): RegistroBebe {
  return { id, bebe_id: "b", tipo: "sono", inicio: inicio.toISOString(), fim: fim?.toISOString() ?? null, dados: {}, origem: "manual", criado_por: "eu", atualizado_em: "" };
}
const dia = (d: number, h: number, m = 0) => new Date(2026, 8, d, h, m);
const semanasAtras = (n: number, ref: Date) => new Date(ref.getTime() - n * 7 * 86_400_000).toISOString();

describe("SON-02 · tabela por idade", () => {
  it("cobre as 7 faixas", () => {
    expect(faixaDaTabela(0)).toEqual({ min: 35, max: 60 });
    expect(faixaDaTabela(5)).toEqual({ min: 35, max: 60 });
    expect(faixaDaTabela(8)).toEqual({ min: 60, max: 90 });
    expect(faixaDaTabela(15)).toEqual({ min: 75, max: 120 });
    expect(faixaDaTabela(20)).toEqual({ min: 90, max: 150 });
    expect(faixaDaTabela(30)).toEqual({ min: 120, max: 180 });
    expect(faixaDaTabela(40)).toEqual({ min: 150, max: 240 });
    expect(faixaDaTabela(60)).toEqual({ min: 180, max: 300 });
  });

  it("prematuro usa a idade corrigida", () => {
    const agora = dia(30, 12);
    const bebe = { nascido_em: semanasAtras(12, agora), prematuro_semanas: 34 };
    expect(semanasParaJanela({ ...bebe, prematuro_semanas: null }, agora)).toBe(12);
    expect(semanasParaJanela(bebe, agora)).toBe(6);
  });
});

describe("SON-01/03/05/06 · preverSoneca", () => {
  const agora = dia(30, 12, 30);
  const bebe8s = { nascido_em: semanasAtras(8, agora), prematuro_semanas: null };

  it("sem sono nas últimas 24 h: sem_dados", () => {
    expect(preverSoneca([], bebe8s, agora).estado).toBe("sem_dados");
    expect(preverSoneca([sono("a", dia(28, 10), dia(28, 11))], bebe8s, agora).estado).toBe("sem_dados");
  });

  it("bebê de 8 semanas acorda às 12:05: janela entre 13:05 e 13:35 (centro 75 ± 12)", () => {
    const p = preverSoneca([sono("a", dia(30, 11), dia(30, 12, 5))], bebe8s, dia(30, 12, 30));
    expect(p.base).toBe("tabela");
    expect(p.estado).toBe("antes");
    expect(p.vigiliaMin).toBe(75);
    expect(p.janelaInicio).toBeGreaterThanOrEqual(dia(30, 13, 5).getTime());
    expect(p.janelaFim).toBeLessThanOrEqual(dia(30, 13, 35).getTime());
    expect(new Date(p.janelaInicio!).getMinutes()).toBe(8);
    expect(new Date(p.janelaFim!).getMinutes()).toBe(32);
  });

  it("às 13:20 está na janela; às 14:00 passou", () => {
    const regs = [sono("a", dia(30, 11), dia(30, 12, 5))];
    expect(preverSoneca(regs, bebe8s, dia(30, 13, 20)).estado).toBe("na_janela");
    expect(preverSoneca(regs, bebe8s, dia(30, 14, 0)).estado).toBe("passou");
  });

  it("sono em andamento: dormindo há X min", () => {
    const p = preverSoneca([sono("a", dia(30, 12), null)], bebe8s, agora);
    expect(p).toMatchObject({ estado: "dormindo", dormindoHa: 30 });
  });

  it("com 5+ vigílias nos últimos 7 dias usa a mediana, limitada à tabela", () => {
    // Vigílias de 70 min repetidas.
    const regs: RegistroBebe[] = [];
    for (let d = 26; d <= 29; d++) {
      regs.push(sono(`${d}a`, dia(d, 9), dia(d, 10)), sono(`${d}b`, dia(d, 11, 10), dia(d, 12)), sono(`${d}c`, dia(d, 13, 10), dia(d, 14)));
    }
    regs.push(sono("hoje", dia(30, 11), dia(30, 12, 5)));
    const p = preverSoneca(regs, bebe8s, agora);
    expect(p.base).toBe("mediana");
    expect(p.vigiliaMin).toBe(70);
  });
});

describe("SON-08 · aviso", () => {
  it("10 min antes, só de dia e com o aviso ligado", () => {
    const p = { estado: "antes" as const, base: "tabela" as const, janelaInicio: dia(30, 13, 5).getTime() };
    expect(podeAvisar(true, p, dia(30, 12, 57))).toBe(true);
    expect(podeAvisar(false, p, dia(30, 12, 57))).toBe(false);
    expect(podeAvisar(true, p, dia(30, 12, 40))).toBe(false);
    const noite = { ...p, janelaInicio: dia(30, 23, 10).getTime() };
    expect(podeAvisar(true, noite, dia(30, 23, 2))).toBe(false);
  });
});
