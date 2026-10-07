import { describe, expect, it } from "vitest";

import {
  abrirAgora,
  dataDeAbertura,
  dataPropriaValida,
  ehAniversario,
  erroAoLacrar,
  erroAoSalvar,
  exportavel,
  limitesDaDataPropria,
  nomeDeArquivo,
  podeCriarCarta,
  referenciaDasCartas,
  somarAnos,
} from "@dominio/cartas.ts";

describe("RN-02 · data de abertura (a mesma conta do banco)", () => {
  it("1º aniversário, 5, 10, 15 e 18 anos a partir da referência", () => {
    expect(dataDeAbertura("first_birthday", "2027-03-08", null)).toBe("2028-03-08");
    expect(dataDeAbertura("age_5", "2027-03-08", null)).toBe("2032-03-08");
    expect(dataDeAbertura("age_18", "2027-03-08", null)).toBe("2045-03-08");
    expect(dataDeAbertura("custom", "2027-03-08", "2030-01-01")).toBe("2030-01-01");
    expect(dataDeAbertura(null, "2027-03-08", null)).toBeNull();
    expect(dataDeAbertura("age_5", null, null)).toBeNull();
  });

  it("29/02 vira 28/02 em ano comum (como o interval do Postgres)", () => {
    expect(somarAnos("2028-02-29", 18)).toBe("2046-02-28");
    expect(somarAnos("2028-02-29", 4)).toBe("2032-02-29");
  });

  it("critério: antes do nascimento vale a DPP; registrado, o nascimento (e a data é recalculada)", () => {
    expect(referenciaDasCartas(null, "2027-03-08")).toBe("2027-03-08");
    expect(referenciaDasCartas("2027-02-20", "2027-03-08")).toBe("2027-02-20");
    expect(dataDeAbertura("first_birthday", referenciaDasCartas("2027-02-20", "2027-03-08"), null)).toBe("2028-02-20");
  });

  it("data própria: de hoje + 180 dias até hoje + 30 anos", () => {
    expect(limitesDaDataPropria("2026-10-07")).toEqual({ min: "2027-04-05", max: "2056-10-07" });
    expect(dataPropriaValida("2027-04-04", "2026-10-07")).toBe(false);
    expect(dataPropriaValida("2027-04-05", "2026-10-07")).toBe(true);
    expect(dataPropriaValida("2056-10-08", "2026-10-07")).toBe(false);
    expect(dataPropriaValida(null, "2026-10-07")).toBe(false);
  });
});

describe("RN-01/03 · salvar e lacrar", () => {
  const base = { title: "Para você", body: "Te espero.", audio_path: null, open_rule: "first_birthday" as const, custom_open_on: null, delivery_email: null };
  it("salvar pede título (até 80), texto até 5000 e e-mail válido", () => {
    expect(erroAoSalvar({ ...base, title: "  " })).toBe("titulo");
    expect(erroAoSalvar({ ...base, title: "a".repeat(81) })).toBe("titulo");
    expect(erroAoSalvar({ ...base, body: "a".repeat(5001) })).toBe("texto_longo");
    expect(erroAoSalvar({ ...base, delivery_email: "theo@" })).toBe("email");
    expect(erroAoSalvar({ ...base, body: null })).toBeNull();
  });

  it("lacrar pede texto ou áudio, a regra e, se própria, a data no prazo", () => {
    expect(erroAoLacrar({ ...base, body: " " }, "2026-10-07")).toBe("conteudo");
    expect(erroAoLacrar({ ...base, body: null, audio_path: "cartas/x/a.webm" }, "2026-10-07")).toBeNull();
    expect(erroAoLacrar({ ...base, open_rule: null }, "2026-10-07")).toBe("regra");
    expect(erroAoLacrar({ ...base, open_rule: "custom", custom_open_on: "2026-12-01" }, "2026-10-07")).toBe("data");
    expect(erroAoLacrar(base, "2026-10-07")).toBeNull();
  });
});

describe("RN-05/07/10/11", () => {
  it("critério: no free, a 3ª carta pede o Completo", () => {
    expect(podeCriarCarta(0, false)).toBe(true);
    expect(podeCriarCarta(1, false)).toBe(true);
    expect(podeCriarCarta(2, false)).toBe(false);
    expect(podeCriarCarta(50, true)).toBe(true);
  });

  it("RN-05: abre às 06:00 locais do dia; atrasada, na próxima rodada a partir das 06:00", () => {
    const c = { status: "sealed" as const, open_on: "2028-03-08", apagado_em: null };
    expect(abrirAgora(c, "2028-03-08", "05:59")).toBe(false);
    expect(abrirAgora(c, "2028-03-08", "06:00")).toBe(true);
    expect(abrirAgora(c, "2028-03-09", "01:00")).toBe(false);
    expect(abrirAgora(c, "2028-03-09", "06:00")).toBe(true);
    expect(abrirAgora({ ...c, status: "opened" }, "2028-03-08", "07:00")).toBe(false);
    expect(abrirAgora({ ...c, apagado_em: "x" }, "2028-03-08", "07:00")).toBe(false);
  });

  it("RN-10: exporta rascunho e aberta, nunca a lacrada", () => {
    expect(exportavel({ status: "draft" })).toBe(true);
    expect(exportavel({ status: "opened" })).toBe(true);
    expect(exportavel({ status: "sealed" })).toBe(false);
    expect(exportavel({ status: "opened", apagado_em: "x" })).toBe(false);
  });

  it("critério RN-11: o e-mail anual sai no aniversário (29/02 em 28/02 no ano comum)", () => {
    expect(ehAniversario("2027-02-20", "2028-02-20")).toBe(true);
    expect(ehAniversario("2027-02-20", "2027-02-20")).toBe(false);
    expect(ehAniversario("2027-02-20", "2028-02-21")).toBe(false);
    expect(ehAniversario("2028-02-29", "2029-02-28")).toBe(true);
    expect(ehAniversario("2028-02-29", "2032-02-29")).toBe(true);
  });

  it("nome de arquivo seguro para o ZIP", () => {
    expect(nomeDeArquivo("Para você, no 1º aniversário!", "txt")).toBe("para-voce-no-1-aniversario.txt");
    expect(nomeDeArquivo("???", "zip")).toBe("carta.zip");
  });
});
