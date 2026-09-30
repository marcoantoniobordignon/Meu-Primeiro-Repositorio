import { describe, expect, it } from "vitest";

import type { DadosMamada, RegistroBebe } from "@/lib/dados/colecoes";

import {
  arredondar5min,
  blocosDoDia,
  encerrarPeito,
  segundosPorLado,
  sonoEmAndamento,
  trocarLado,
  ultimoDoTipo,
  validarInicio,
  volumesFrequentes,
} from "./registros";

const t0 = new Date(2026, 8, 30, 10, 0, 0);
const min = (m: number) => new Date(t0.getTime() + m * 60_000);

function reg(id: string, tipo: RegistroBebe["tipo"], inicio: Date, fim: Date | null, dados: RegistroBebe["dados"] = {}): RegistroBebe {
  return { id, bebe_id: "b1", tipo, inicio: inicio.toISOString(), fim: fim?.toISOString() ?? null, dados, origem: "manual", criado_por: "eu", atualizado_em: "" };
}

describe("BEB-01/02 · tiles", () => {
  it("pega o mais recente de cada tipo e o sono em andamento", () => {
    const lista = [reg("a", "sono", min(-120), min(-60)), reg("b", "sono", min(-30), null), reg("c", "fralda", min(-10), min(-10), { conteudo: "xixi" })];
    expect(ultimoDoTipo(lista, "b1", "sono")?.id).toBe("b");
    expect(sonoEmAndamento(lista, "b1")?.id).toBe("b");
    expect(ultimoDoTipo(lista, "b1", "banho")).toBeUndefined();
  });
});

describe("BEB-04 · timer de peito", () => {
  it("troca de lado acumula e encerrar grava 'ambos'", () => {
    const inicio: DadosMamada = { tipo: "peito", lado: "E", segundos_E: 0, segundos_D: 0, lado_desde: t0.toISOString() };
    const trocado = trocarLado(inicio, "D", min(5));
    expect(trocado.segundos_E).toBe(300);
    expect(trocado.lado).toBe("D");
    const s = segundosPorLado(trocado, min(9));
    expect(s).toEqual({ E: 300, D: 240 });
    const fim = encerrarPeito(trocado, min(9));
    expect(fim).toEqual({ tipo: "peito", lado: "ambos", segundos_E: 300, segundos_D: 240, lado_desde: null });
  });

  it("só um lado vira o lado dele", () => {
    const d: DadosMamada = { tipo: "peito", lado: "D", segundos_E: 0, segundos_D: 0, lado_desde: t0.toISOString() };
    expect(encerrarPeito(d, min(12)).lado).toBe("D");
  });
});

describe("BEB-05 · volumes frequentes", () => {
  it("3 mais usados nos últimos 7 dias, empate pelo maior", () => {
    const lista = [
      reg("1", "mamada", min(-60), min(-60), { tipo: "mamadeira", ml: 120 }),
      reg("2", "mamada", min(-120), min(-120), { tipo: "mamadeira", ml: 120 }),
      reg("3", "mamada", min(-180), min(-180), { tipo: "mamadeira", ml: 90 }),
      reg("4", "mamada", min(-240), min(-240), { tipo: "mamadeira", ml: 150 }),
      reg("5", "mamada", min(-300), min(-300), { tipo: "mamadeira", ml: 60 }),
      reg("6", "mamada", min(-60 * 24 * 10), min(-60 * 24 * 10), { tipo: "mamadeira", ml: 200 }),
    ];
    expect(volumesFrequentes(lista, "b1", "2026-09-30")).toEqual([120, 150, 90]);
  });
});

describe("BEB-06/07 · validação de início", () => {
  it("rejeita futuro e mais de 24 h; arredonda de 5 em 5 para baixo, nunca para o futuro", () => {
    expect(validarInicio(min(5), t0)).toBe("futuro");
    expect(validarInicio(min(-25 * 60), t0)).toBe("antigo");
    expect(validarInicio(min(-30), t0)).toBe("ok");
    expect(arredondar5min(new Date(2026, 8, 30, 10, 13)).getMinutes()).toBe(10);
    expect(arredondar5min(new Date(2026, 8, 30, 10, 14, 59)).getMinutes()).toBe(10);
    const agora = new Date(2026, 8, 30, 10, 13, 40);
    expect(validarInicio(arredondar5min(agora), agora)).toBe("ok");
  });
});

describe("BEB-08 · linha do tempo do dia", () => {
  it("corta nas bordas do dia e leva o sono em andamento até agora", () => {
    const lista = [
      reg("noite", "sono", new Date(2026, 8, 29, 22, 0), new Date(2026, 8, 30, 6, 0)),
      reg("soneca", "sono", new Date(2026, 8, 30, 9, 0), null),
      reg("ontem", "fralda", new Date(2026, 8, 29, 12, 0), new Date(2026, 8, 29, 12, 0), { conteudo: "xixi" }),
    ];
    const blocos = blocosDoDia(lista, "b1", "2026-09-30", t0);
    expect(blocos.map((b) => b.registro.id)).toEqual(["noite", "soneca"]);
    expect(blocos[0]).toMatchObject({ inicioMin: 0, fimMin: 360 });
    expect(blocos[1]).toMatchObject({ inicioMin: 540, fimMin: 600, emAndamento: true });
  });
});
