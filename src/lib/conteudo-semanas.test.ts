import { describe, expect, it } from "vitest";

import { conteudoDaSemana, totalSemanasConteudo } from "./conteudo-semanas";

describe("ONB-03 · conteúdo embutido no bundle", () => {
  it("tem as 42 semanas, sem buracos e sem campo vazio", () => {
    expect(totalSemanasConteudo).toBe(42);
    for (let s = 1; s <= 42; s++) {
      const c = conteudoDaSemana(s);
      expect(c.semana).toBe(s);
      expect(c.tamanho).not.toBe("");
      expect(c.frase).not.toBe("");
      expect(c.dica).not.toBe("");
      expect(c.emoji).not.toBe("");
    }
  });

  it("segura as bordas: semana 0 usa a 1, acima de 42 usa a 42", () => {
    expect(conteudoDaSemana(0).semana).toBe(1);
    expect(conteudoDaSemana(45).semana).toBe(42);
  });
});
