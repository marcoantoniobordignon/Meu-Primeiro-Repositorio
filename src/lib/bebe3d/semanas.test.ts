import { describe, expect, it } from "vitest";

import { bancoSemanas, bpmDaSemana, crlDaSemana, dadosDaSemana, escalaDaSemana, raioUteroDaSemana, SEMANA_MAX, SEMANA_MIN } from "./semanas";

describe("B3D-02 · escala coerente com a semana", () => {
  it("o bebê só cresce: CRL e escala são monotônicos da semana 4 à 40", () => {
    for (let s = SEMANA_MIN; s < SEMANA_MAX; s++) {
      expect(crlDaSemana(s + 1), `semana ${s}`).toBeGreaterThan(crlDaSemana(s));
      expect(escalaDaSemana(s + 1)).toBeGreaterThan(escalaDaSemana(s));
    }
  });

  it("o bebê cabe no útero em toda semana (CRL menor que o diâmetro interno)", () => {
    for (let s = SEMANA_MIN; s <= SEMANA_MAX; s++) {
      expect(crlDaSemana(s), `semana ${s}`).toBeLessThan(raioUteroDaSemana(s) * 2);
    }
  });

  it("batimentos caem do primeiro trimestre ao termo", () => {
    expect(bpmDaSemana(8)).toBeGreaterThan(bpmDaSemana(20));
    expect(bpmDaSemana(20)).toBeGreaterThan(bpmDaSemana(38));
  });
});

describe("B3D-03 · dados da semana", () => {
  it("toda semana no banco tem medidas, comparação, 2 a 3 marcos e descrição em texto", () => {
    expect(bancoSemanas.semanas.length).toBeGreaterThan(0);
    for (const s of bancoSemanas.semanas) {
      expect(s.semana).toBeGreaterThanOrEqual(SEMANA_MIN);
      expect(s.semana).toBeLessThanOrEqual(SEMANA_MAX);
      expect(s.comprimento_cm).toBeGreaterThan(0);
      expect(s.peso_g).toBeGreaterThan(0);
      expect(s.comparacao.length).toBeGreaterThan(2);
      expect(s.marcos.length).toBeGreaterThanOrEqual(2);
      expect(s.marcos.length).toBeLessThanOrEqual(3);
      expect(s.descricao_cena.length).toBeGreaterThan(40);
      expect(["pendente", "aprovada"]).toContain(s.revisao_medica);
    }
  });

  it("tudo marcado para revisão médica antes de publicar; fontes citadas", () => {
    expect(bancoSemanas.revisao_medica).toBe("pendente");
    expect(bancoSemanas.fontes.length).toBeGreaterThanOrEqual(2);
    expect(bancoSemanas.aviso).toContain("Não substitui");
    expect(dadosDaSemana(20)?.comparacao).toBe("uma banana");
    expect(dadosDaSemana(3)).toBeUndefined();
  });
});
