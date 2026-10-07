import { describe, expect, it } from "vitest";

import { idDeterministico } from "@dominio/id.ts";
import {
  dataISOValida,
  dataNoFuso,
  deslocamentoMin,
  diaSemanaISO,
  diasEntreISO,
  dumDaDpp,
  fusoOuPadrao,
  horaNoFuso,
  horaValida,
  idadeGestacional,
  inicioDaSemana,
  instanteLocal,
  normalizarHora,
  partesNoFuso,
  somarDiasISO,
} from "@dominio/tempo.ts";

describe("tempo com fuso explícito", () => {
  it("instante local em São Paulo (UTC−3) e em Lisboa (com horário de verão)", () => {
    expect(instanteLocal("2026-10-06", "08:00", "America/Sao_Paulo").toISOString()).toBe("2026-10-06T11:00:00.000Z");
    expect(instanteLocal("2026-07-01", "08:00", "Europe/Lisbon").toISOString()).toBe("2026-07-01T07:00:00.000Z");
    expect(instanteLocal("2026-12-01", "08:00", "Europe/Lisbon").toISOString()).toBe("2026-12-01T08:00:00.000Z");
    expect(instanteLocal("2026-10-06", "23:30", "Asia/Tokyo").toISOString()).toBe("2026-10-06T14:30:00.000Z");
  });

  it("ida e volta: o relógio local do instante gerado é o pedido", () => {
    for (const tz of ["America/Sao_Paulo", "America/Manaus", "America/Noronha", "Europe/Lisbon", "America/New_York", "UTC"]) {
      for (const hora of ["00:00", "07:15", "12:00", "23:59"]) {
        const i = instanteLocal("2026-03-29", hora, tz);
        expect(dataNoFuso(i, tz)).toBe("2026-03-29");
        expect(horaNoFuso(i, tz)).toBe(hora);
      }
    }
  });

  it("hora que não existe (início do horário de verão) cai logo depois do buraco", () => {
    // Lisboa: 2026-03-29 01:00 → 02:00.
    const i = instanteLocal("2026-03-29", "01:30", "Europe/Lisbon");
    expect(horaNoFuso(i, "Europe/Lisbon")).toBe("02:30");
  });

  it("partes, deslocamento e dia da semana", () => {
    const i = new Date("2026-10-06T02:30:00Z");
    expect(partesNoFuso(i, "America/Sao_Paulo")).toMatchObject({ ano: 2026, mes: 10, dia: 5, hora: 23, minuto: 30, diaSemana: 1 });
    expect(deslocamentoMin(i, "America/Sao_Paulo")).toBe(-180);
    expect(diaSemanaISO("2026-10-04")).toBe(0);
    expect(diaSemanaISO("2026-10-10")).toBe(6);
  });

  it("aritmética de datas de calendário atravessa mês, ano e bissexto", () => {
    expect(somarDiasISO("2026-12-31", 1)).toBe("2027-01-01");
    expect(somarDiasISO("2028-02-28", 1)).toBe("2028-02-29");
    expect(somarDiasISO("2026-03-01", -1)).toBe("2026-02-28");
    expect(diasEntreISO("2026-01-01", "2027-01-01")).toBe(365);
    expect(diasEntreISO("2026-10-06", "2026-10-01")).toBe(-5);
  });

  it("validações", () => {
    expect(dataISOValida("2026-02-29")).toBe(false);
    expect(dataISOValida("2028-02-29")).toBe(true);
    expect(dataISOValida("2026-1-01")).toBe(false);
    expect(horaValida("08:00")).toBe(true);
    expect(horaValida("08:00:00")).toBe(true);
    expect(horaValida("24:00")).toBe(false);
    expect(horaValida("8h")).toBe(false);
    expect(normalizarHora("8:5")).toBe("08:05");
    expect(normalizarHora("20:00:00")).toBe("20:00");
    expect(fusoOuPadrao("Lua/Base")).toBe("America/Sao_Paulo");
    expect(fusoOuPadrao(null)).toBe("America/Sao_Paulo");
    expect(fusoOuPadrao("Europe/Lisbon")).toBe("Europe/Lisbon");
  });

  it("idade gestacional pela DUM = DPP − 280", () => {
    const dpp = "2027-03-01";
    expect(dumDaDpp(dpp)).toBe("2026-05-25");
    expect(idadeGestacional(dpp, "2026-05-25")).toEqual({ semana: 0, dia: 0, dias: 0 });
    expect(idadeGestacional(dpp, "2026-10-06")).toEqual({ semana: 19, dia: 1, dias: 134 });
    expect(idadeGestacional(dpp, "2027-03-01")).toEqual({ semana: 40, dia: 0, dias: 280 });
    expect(idadeGestacional(dpp, "2026-05-20").semana).toBe(-1);
    expect(inicioDaSemana(dpp, 20)).toBe("2026-10-12");
  });
});

describe("id determinístico", () => {
  it("é estável, tem formato de UUID e muda com a chave", () => {
    const a = idDeterministico("dose:med-1:2026-10-06T11:00:00.000Z");
    expect(a).toBe(idDeterministico("dose:med-1:2026-10-06T11:00:00.000Z"));
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(idDeterministico("dose:med-1:2026-10-06T11:00:00.001Z")).not.toBe(a);
  });

  it("não colide em 20 mil chaves parecidas", () => {
    const vistos = new Set<string>();
    for (let i = 0; i < 20_000; i++) vistos.add(idDeterministico(`dose:m:${i}`));
    expect(vistos.size).toBe(20_000);
  });
});
