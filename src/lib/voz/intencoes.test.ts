import { describe, expect, it } from "vitest";

import { intencaoLocal, intencaoPergunta } from "./intencoes";

describe("CRO RN-08 · 'pergunta para o médico' por voz", () => {
  it.each([
    ["Pergunta para o médico: posso tomar café", "Posso tomar café?"],
    ["pergunta pra médica se posso viajar de avião", "Posso viajar de avião?"],
    ["anotar uma pergunta para a consulta, quando faço o morfológico", "Quando faço o morfológico?"],
    ["Perguntar ao médico se posso pintar o cabelo", "Posso pintar o cabelo?"],
    ["lembrar de perguntar para a doutora sobre o enjoo", "O enjoo?"],
    ["perguntar se posso correr pro médico", "Posso correr?"],
    ["quero perguntar ao obstetra sobre a vacina?", "A vacina?"],
  ])("“%s” → “%s”", (frase, esperado) => {
    expect(intencaoPergunta(frase)).toBe(esperado);
  });

  it("frases de registro não viram pergunta", () => {
    expect(intencaoPergunta("mamou 12 minutos no direito")).toBeNull();
    expect(intencaoPergunta("estou com azia")).toBeNull();
    expect(intencaoPergunta("pergunta para o médico")).toBeNull();
  });
});

describe("Intenção local (antes do parser)", () => {
  it("pergunta, remédio ou nada", () => {
    expect(intencaoLocal("pergunta para o médico: e a azia")).toEqual({ tipo: "pergunta", texto: "E a azia?" });
    expect(intencaoLocal("tomei o ferro")).toEqual({ tipo: "remedio", nome: "ferro" });
    expect(intencaoLocal("senti três chutes")).toBeNull();
  });
});
