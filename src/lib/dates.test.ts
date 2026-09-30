import { describe, expect, it } from "vitest";

import {
  dataDoRegistro,
  diasEntre,
  dppDaDum,
  dppNoPassado,
  dumDaDpp,
  ehISOValida,
  formatarDuracao,
  formatarQuando,
  idadeBebe,
  legendaSemana,
  saudacaoPorHora,
  semanaExibida,
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

describe("HG-01 · semana gestacional", () => {
  it("22 semanas e 3 dias, 18 semanas para o parto", () => {
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
  });

  it("nunca vai abaixo de zero antes da DUM; exibida fica entre 1 e 42", () => {
    expect(semanaGestacional("2027-09-30", "2026-09-30").semana).toBe(0);
    expect(semanaExibida(0)).toBe(1);
    expect(semanaExibida(45)).toBe(42);
  });

  it("trimestres viram em 13 e 27", () => {
    const dpp = "2027-02-02";
    const dum = "2026-04-28";
    expect(semanaGestacional(dpp, somarDias(dum, 12 * 7)).trimestre).toBe(1);
    expect(semanaGestacional(dpp, somarDias(dum, 13 * 7)).trimestre).toBe(2);
    expect(semanaGestacional(dpp, somarDias(dum, 27 * 7)).trimestre).toBe(3);
  });
});

describe("HG-02/03 · legenda do anel", () => {
  it("semanas para o parto até a 36", () => {
    expect(legendaSemana(semanaGestacional("2027-02-02", "2026-10-02"))).toEqual({ texto: "18 semanas para o parto", tom: "normal" });
  });
  it("da 37 em diante, pode ser a qualquer momento", () => {
    const g = semanaGestacional("2026-10-21", "2026-09-30"); // 37s0d
    expect(g.semana).toBe(37);
    expect(legendaSemana(g).texto).toBe("pode ser a qualquer momento");
  });
  it("depois da DPP, dias além da data", () => {
    const g = semanaGestacional("2026-09-23", "2026-09-30");
    expect(g.semana).toBe(41);
    expect(legendaSemana(g)).toEqual({ texto: "7 dias além da data", tom: "acento" });
  });
});

describe("HG-04 · saudação", () => {
  it("por hora local", () => {
    expect(saudacaoPorHora(5)).toBe("Bom dia");
    expect(saudacaoPorHora(11)).toBe("Bom dia");
    expect(saudacaoPorHora(12)).toBe("Boa tarde");
    expect(saudacaoPorHora(17)).toBe("Boa tarde");
    expect(saudacaoPorHora(18)).toBe("Boa noite");
    expect(saudacaoPorHora(4)).toBe("Boa noite");
  });
});

describe("SIN-05 · madrugada", () => {
  it("entre 0h e 4h a pergunta 'ainda é ontem?' cabe", () => {
    expect(dataDoRegistro(new Date(2026, 8, 30, 1, 0)).madrugada).toBe(true);
    expect(dataDoRegistro(new Date(2026, 8, 30, 1, 0)).ontem).toBe("2026-09-29");
    expect(dataDoRegistro(new Date(2026, 8, 30, 4, 0)).madrugada).toBe(false);
  });
});

describe("formatação", () => {
  it("quando: hoje, amanhã, data", () => {
    const agora = new Date(2026, 8, 30, 9, 0);
    expect(formatarQuando(new Date(2026, 9, 1, 14, 30).toISOString(), agora)).toBe("amanhã às 14:30");
    expect(formatarQuando(new Date(2026, 8, 30, 8, 0).toISOString(), agora)).toBe("hoje às 08:00");
  });
  it("duração", () => {
    expect(formatarDuracao(45)).toBe("45 s");
    expect(formatarDuracao(200)).toBe("3 min 20 s");
    expect(formatarDuracao(120)).toBe("2 min");
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
