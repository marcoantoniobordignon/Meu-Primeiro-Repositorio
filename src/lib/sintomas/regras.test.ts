import { describe, expect, it } from "vitest";

import type { Sintoma } from "@/lib/dados/colecoes";

import { catalogo } from "./catalogo";
import {
  chipsDaHome,
  diaEditavel,
  forteTresDiasSeguidos,
  porDia,
  proximaIntensidade,
  resumoComoTexto,
  resumoPeriodo,
} from "./regras";

function s(slug: string, data: string, intensidade: 1 | 2 | 3 = 1): Sintoma {
  return { id: `${slug}-${data}`, slug, data, intensidade, origem: "chip", atualizado_em: "" };
}

describe("catálogo", () => {
  it("tem 28 itens, slugs únicos e todo item cobre alguma semana", () => {
    expect(catalogo).toHaveLength(28);
    expect(new Set(catalogo.map((i) => i.slug)).size).toBe(28);
    for (const i of catalogo) expect(i.semanas_frequentes.length).toBeGreaterThan(0);
  });
});

describe("SIN-01 · chips da home", () => {
  it("registrados hoje vêm primeiro e completa até 5 com os frequentes da semana", () => {
    const chips = chipsDaHome([s("insonia", "2026-09-30")], 10);
    expect(chips[0]?.slug).toBe("insonia");
    expect(chips).toHaveLength(5);
    expect(new Set(chips.map((c) => c.slug)).size).toBe(5);
  });

  it("não repete um registrado que também é frequente", () => {
    const chips = chipsDaHome([s("enjoo", "2026-09-30")], 8);
    expect(chips.filter((c) => c.slug === "enjoo")).toHaveLength(1);
  });
});

describe("SIN-03 · intensidade", () => {
  it("cicla 1 → 2 → 3 → remove", () => {
    expect(proximaIntensidade(null)).toBe(1);
    expect(proximaIntensidade(1)).toBe(2);
    expect(proximaIntensidade(2)).toBe(3);
    expect(proximaIntensidade(3)).toBeNull();
  });
});

describe("SIN-06 · resumo de 14 dias", () => {
  const dados = [
    s("enjoo", "2026-09-30", 3),
    s("enjoo", "2026-09-29", 3),
    s("enjoo", "2026-09-28"),
    s("azia", "2026-09-30"),
    s("azia", "2026-09-17"),
    s("azia", "2026-09-16"), // fora dos 14 dias
  ];

  it("conta dias e fortes só dentro do período", () => {
    const linhas = resumoPeriodo(dados, "2026-09-30");
    expect(linhas).toEqual([
      { slug: "enjoo", nome: "Enjoo", dias: 3, fortes: 2 },
      { slug: "azia", nome: "Azia", dias: 2, fortes: 0 },
    ]);
  });

  it("vira texto legível", () => {
    const texto = resumoComoTexto(resumoPeriodo(dados, "2026-09-30"), 21, 22);
    expect(texto).toBe("Semanas 21–22 · Enjoo: 3 dias (forte em 2) · Azia: 2 dias");
    expect(resumoComoTexto([], 22, 22)).toBe("Semana 22 · sem sintomas registrados");
  });
});

describe("SIN-07 · forte 3 dias seguidos", () => {
  it("só quando os três dias são fortes", () => {
    const tres = [s("azia", "2026-09-30", 3), s("azia", "2026-09-29", 3), s("azia", "2026-09-28", 3)];
    expect(forteTresDiasSeguidos(tres, "azia", "2026-09-30")).toBe(true);
    expect(forteTresDiasSeguidos(tres.slice(0, 2), "azia", "2026-09-30")).toBe(false);
    expect(forteTresDiasSeguidos([...tres.slice(0, 2), s("azia", "2026-09-28", 2)], "azia", "2026-09-30")).toBe(false);
  });
});

describe("SIN-08 · edição de dias passados", () => {
  it("até 30 dias; nem futuro nem além disso", () => {
    expect(diaEditavel("2026-09-30", "2026-09-30")).toBe(true);
    expect(diaEditavel("2026-08-31", "2026-09-30")).toBe(true);
    expect(diaEditavel("2026-08-30", "2026-09-30")).toBe(false);
    expect(diaEditavel("2026-10-01", "2026-09-30")).toBe(false);
  });
});

describe("diário por dia", () => {
  it("agrupa do mais recente ao mais antigo", () => {
    const dias = porDia([s("azia", "2026-09-28"), s("enjoo", "2026-09-30"), s("azia", "2026-09-30")]);
    expect(dias.map((d) => d.data)).toEqual(["2026-09-30", "2026-09-28"]);
    expect(dias[0]?.itens).toHaveLength(2);
  });
});
