import { describe, expect, it } from "vitest";

import {
  diasEntre,
  dppDaDum,
  dppNoPassado,
  dumDaDpp,
  ehISOValida,
  idadeBebe,
  semanaGestacional,
  somarDias,
} from "./dates";

describe("datas básicas", () => {
  it("soma dias atravessando mês e ano", () => {
    expect(somarDias("2026-12-30", 3)).toBe("2027-01-02");
    expect(somarDias("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("valida ISO de verdade (rejeita 31 de fevereiro)", () => {
    expect(ehISOValida("2026-02-31")).toBe(false);
    expect(ehISOValida("2026-02-28")).toBe(true);
    expect(ehISOValida("31/02/2026")).toBe(false);
  });

  it("diferença em dias ignora horário de verão", () => {
    expect(diasEntre("2026-01-01", "2026-12-31")).toBe(364);
  });
});

describe("ONB-02 · DPP a partir da DUM", () => {
  it("DPP = DUM + 280 dias", () => {
    expect(dppDaDum("2026-01-01")).toBe("2026-10-08");
    expect(dumDaDpp("2026-10-08")).toBe("2026-01-01");
  });

  it("DPP mais de 2 semanas no passado pede confirmação", () => {
    expect(dppNoPassado("2026-09-01", "2026-09-30")).toBe(true);
    expect(dppNoPassado("2026-09-20", "2026-09-30")).toBe(false);
    expect(dppNoPassado("2026-12-01", "2026-09-30")).toBe(false);
  });
});

describe("ARQ-08 · semana gestacional", () => {
  it("22 semanas e 3 dias, 18 semanas para o parto", () => {
    // DUM = 2026-04-28 → DPP = 2027-02-02. Hoje = DUM + 157 dias = 22s3d.
    const s = semanaGestacional("2027-02-02", "2026-10-02");
    expect(s.semana).toBe(22);
    expect(s.dia).toBe(3);
    expect(s.semanasParaDpp).toBe(18);
    expect(s.trimestre).toBe(2);
    expect(s.progresso).toBeCloseTo(157 / 280, 5);
  });

  it("na DPP: 40 semanas, 0 para o parto, progresso 1", () => {
    const s = semanaGestacional("2026-09-30", "2026-09-30");
    expect(s.semana).toBe(40);
    expect(s.semanasParaDpp).toBe(0);
    expect(s.progresso).toBe(1);
    expect(s.trimestre).toBe(3);
  });

  it("nunca vai abaixo de zero antes da DUM", () => {
    const s = semanaGestacional("2027-09-30", "2026-09-30");
    expect(s.semana).toBe(0);
    expect(s.diasCorridos).toBe(0);
  });

  it("trimestres viram em 13 e 27", () => {
    const dpp = "2027-02-02";
    const dum = "2026-04-28";
    expect(semanaGestacional(dpp, somarDias(dum, 12 * 7)).trimestre).toBe(1);
    expect(semanaGestacional(dpp, somarDias(dum, 13 * 7)).trimestre).toBe(2);
    expect(semanaGestacional(dpp, somarDias(dum, 27 * 7)).trimestre).toBe(3);
  });
});

describe("idade do bebê", () => {
  it("conta dias, semanas e meses", () => {
    const i = idadeBebe("2026-08-01", "2026-09-30");
    expect(i.dias).toBe(60);
    expect(i.semanas).toBe(8);
    expect(i.meses).toBe(1);
  });
});
