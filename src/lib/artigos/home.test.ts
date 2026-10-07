import { describe, expect, it } from "vitest";

import { cardsDaHome } from "@dominio/trimestre.ts";

import { estadosDosCards, type DadosDaHome } from "./home";

const vazia: DadosDaHome = {
  exames: { pode: true, agora: 0, total: 0 },
  medicamentos: { ativos: 0, dosesHoje: 0, tomadasHoje: 0 },
  marco: { aberto: false, entradas: 0 },
  fotoDaSemana: false,
  consulta: { pode: true, tipo: "nenhuma" },
  planoEtapas: null,
  mala: { feitos: 0, total: 0 },
  artigo: { existe: true, naoLidos: 3 },
  direitos: true,
};

describe("RN-02 · estado de cada card pelo que a feature tem", () => {
  it("conta nova: estados vazios com ação, artigo pendente, nada de buraco", () => {
    const e = estadosDosCards(vazia);
    expect(e).toMatchObject({ exames: "vazio", medicamentos: "vazio", marco: "vazio", consulta: "vazio", artigo: "pendente", foto: "pendente", nomes: "oculto" });
    const r = cardsDaHome(1, e);
    expect(r).toHaveLength(6);
    expect(r.map((c) => c.card)).toContain("artigo");
  });

  it("exames: janela aberta é pendente; sem permissão, some", () => {
    expect(estadosDosCards({ ...vazia, exames: { pode: true, agora: 2, total: 12 } }).exames).toBe("pendente");
    expect(estadosDosCards({ ...vazia, exames: { pode: true, agora: 0, total: 12 } }).exames).toBe("normal");
    expect(estadosDosCards({ ...vazia, exames: { pode: false, agora: 2, total: 12 } }).exames).toBe("oculto");
  });

  it("medicamentos: doses por tomar = pendente; todas tomadas = feito", () => {
    expect(estadosDosCards({ ...vazia, medicamentos: { ativos: 1, dosesHoje: 2, tomadasHoje: 1 } }).medicamentos).toBe("pendente");
    expect(estadosDosCards({ ...vazia, medicamentos: { ativos: 1, dosesHoje: 2, tomadasHoje: 2 } }).medicamentos).toBe("feito");
    expect(estadosDosCards({ ...vazia, medicamentos: { ativos: 1, dosesHoje: 0, tomadasHoje: 0 } }).medicamentos).toBe("normal");
  });

  it("critério: foto da semana tirada vira 'feito' e desce com check", () => {
    const e = estadosDosCards({ ...vazia, fotoDaSemana: true, exames: { pode: true, agora: 1, total: 5 }, marco: { aberto: true, entradas: 1 } });
    expect(e.foto).toBe("feito");
    const r = cardsDaHome(2, e);
    expect(r.at(-1)).toMatchObject({ card: "foto", estado: "feito" });
  });

  it("consulta: iminente ou 'como foi' pedem ação; sem agenda, some", () => {
    expect(estadosDosCards({ ...vazia, consulta: { pode: true, tipo: "iminente" } }).consulta).toBe("pendente");
    expect(estadosDosCards({ ...vazia, consulta: { pode: true, tipo: "como_foi" } }).consulta).toBe("pendente");
    expect(estadosDosCards({ ...vazia, consulta: { pode: true, tipo: "proxima" } }).consulta).toBe("normal");
    expect(estadosDosCards({ ...vazia, consulta: { pode: false, tipo: "proxima" } }).consulta).toBe("oculto");
  });

  it("plano e mala: completos são 'feito'; o resto é pendente", () => {
    expect(estadosDosCards({ ...vazia, planoEtapas: 5 }).plano_parto).toBe("feito");
    expect(estadosDosCards({ ...vazia, planoEtapas: 2 }).plano_parto).toBe("pendente");
    expect(estadosDosCards({ ...vazia, mala: { feitos: 20, total: 20 } }).mala).toBe("feito");
    expect(estadosDosCards({ ...vazia, mala: { feitos: 0, total: 0 } }).mala).toBe("pendente");
  });

  it("funcionalidade 16: direito que entrou na fase nesta semana é pendente e cabe na home da semana 28", () => {
    expect(estadosDosCards({ ...vazia, direitoNovo: true }).direitos).toBe("pendente");
    expect(estadosDosCards({ ...vazia, direitos: false, direitoNovo: true }).direitos).toBe("oculto");
    const e = estadosDosCards({ ...vazia, direitoNovo: true, planoEtapas: 0, artigo: { existe: true, naoLidos: 3 } });
    expect(cardsDaHome(3, e).map((c) => c.card)).toContain("direitos");
  });

  it("papel sem a feature não vê o card", () => {
    const e = estadosDosCards({ ...vazia, semPermissao: ["medicamentos", "plano_parto", "mala"] });
    expect([e.medicamentos, e.plano_parto, e.mala]).toEqual(["oculto", "oculto", "oculto"]);
  });

  it("RN-08: artigo todo lido = feito; sem nenhum, some", () => {
    expect(estadosDosCards({ ...vazia, artigo: { existe: true, naoLidos: 0 } }).artigo).toBe("feito");
    expect(estadosDosCards({ ...vazia, artigo: { existe: false, naoLidos: 0 } }).artigo).toBe("oculto");
  });
});
