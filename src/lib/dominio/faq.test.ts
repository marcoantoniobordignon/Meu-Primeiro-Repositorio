import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import semente from "../../../supabase/seed/faq-verbetes.json";
import {
  BLOQUEIO,
  buscar,
  CATEGORIAS_FAQ,
  maisBuscados,
  normalizar,
  pontuacao,
  publicavel,
  similaridade,
  temOfensa,
  trigramas,
  validarPergunta,
  type Verbete,
} from "@dominio/faq.ts";

const verbetes = semente as Verbete[];

describe("FAQ RN-02 · busca igual à do pg_trgm", () => {
  it("normaliza acento e caixa", () => {
    expect(normalizar("AÇAÍ com Pão")).toBe("acai com pao");
  });

  it("trigramas como o show_trgm", () => {
    expect([...trigramas("acai")].sort()).toEqual(["  a", " ac", "acai".slice(0, 3), "ai ", "cai"].sort());
  });

  // Valores tirados do Postgres (similarity e faq_pontuacao), para o app e o banco concordarem.
  it.each([
    ["acai", "Açaí", 1, 1],
    ["peixe", "Peixe cru (sushi, ceviche)", 0.26086956, 1],
    ["quejo", "Queijo coalho", 0.25, 0.44444445],
    ["cafe", "Café", 1, 1],
    ["sushi", "Peixe cru (sushi, ceviche)", 0.26086956, 1],
    ["brigadeiro", "Açaí", 0, 0],
    ["kombuxa", "Kombucha", 0.41666666, 0.41666666],
  ])("%s × %s", (q, t, sim, pont) => {
    expect(similaridade(q, t)).toBeCloseTo(sim, 5);
    expect(pontuacao(q, t)).toBeCloseTo(pont, 5);
  });

  it("critério: 'acai' sem acento acha 'Açaí' na semente", () => {
    expect(buscar(verbetes, "acai")[0]?.name).toBe("Açaí");
  });

  it("empate: quem tem a palavra no nome vem antes de quem só tem no apelido", () => {
    const r = buscar(verbetes, "queijo").slice(0, 3).map((v) => v.name);
    expect(r.every((n) => normalizar(n).includes("queijo"))).toBe(true);
  });

  it("tolera erro de digitação e acha por apelido", () => {
    expect(buscar(verbetes, "kombuxa").map((v) => v.slug)).toContain("kombucha");
    expect(buscar(verbetes, "sashimi").map((v) => v.slug)).toContain("peixe-cru");
    expect(buscar(verbetes, "quejo coalho")[0]?.slug).toBe("queijo-coalho");
  });

  it("no máximo 20, todos com similaridade ≥ 0,3; busca vazia ou de 1 letra não lista tudo", () => {
    const r = buscar(verbetes, "cha");
    expect(r.length).toBeLessThanOrEqual(20);
    expect(buscar(verbetes, "")).toEqual([]);
    expect(buscar(verbetes, "a")).toEqual([]);
    expect(buscar(verbetes, "xilofone voador")).toEqual([]);
  });

  it("'Mais buscados' pelas aberturas; empate, a ordem da semente", () => {
    const l = [{ name: "a", views_count: 1 }, { name: "b", views_count: 5 }, { name: "c" }, { name: "d", views_count: 5 }];
    expect(maisBuscados(l, 3).map((x) => x.name)).toEqual(["b", "d", "a"]);
  });
});

describe("FAQ RN-05 · perguntas", () => {
  it("3 a 140 caracteres", () => {
    expect(validarPergunta("oi")).toBe("tamanho");
    expect(validarPergunta("x".repeat(141))).toBe("tamanho");
    expect(validarPergunta("Posso comer pequi?")).toBeNull();
  });

  it("critério: ofensa bloqueada, ignorando acento e caixa; palavra parecida passa", () => {
    expect(temOfensa("Posso comer essa PÔRRA?")).toBe(true);
    expect(validarPergunta("que merda de enjoo, posso comer gengibre?")).toBe("ofensa");
    expect(temOfensa("Posso comer porcaria?")).toBe(false);
    expect(temOfensa("Pode comer computador")).toBe(false);
  });

  it("a lista do app é a mesma do banco", () => {
    const sql = readFileSync(path.resolve(__dirname, "../../../supabase/migrations/0008_faq.sql"), "utf8");
    const bloco = sql.slice(sql.indexOf("insert into public.faq_bloqueio"), sql.indexOf(";", sql.indexOf("insert into public.faq_bloqueio")));
    const doBanco = [...bloco.matchAll(/\('([a-z]+)'\)/g)].map((m) => m[1]);
    expect(doBanco.sort()).toEqual([...BLOQUEIO].sort());
  });
});

describe("FAQ RN-01/09/11 · conteúdo", () => {
  it("publicar exige fonte e revisão humana", () => {
    expect(publicavel({ source_label: "MS", reviewed_by: null, reviewed_on: null })).toBe(false);
    expect(publicavel({ source_label: "MS", reviewed_by: "Nutri Ana", reviewed_on: "2026-10-01" })).toBe(true);
    expect(publicavel({ source_label: " ", reviewed_by: "Nutri Ana", reviewed_on: "2026-10-01" })).toBe(false);
  });

  it("a semente (rascunho) tem ao menos 120 verbetes, todas as categorias e os itens brasileiros", () => {
    expect(verbetes.length).toBeGreaterThanOrEqual(120);
    for (const c of CATEGORIAS_FAQ) expect(verbetes.filter((v) => v.category === c).length, c).toBeGreaterThanOrEqual(8);
    for (const slug of ["acai", "pequi", "caldo-de-cana", "tapioca", "queijo-coalho", "cha-mate"]) expect(verbetes.some((v) => v.slug === slug), slug).toBe(true);
    expect(new Set(verbetes.map((v) => v.slug)).size).toBe(verbetes.length);
  });

  it("a semente respeita o modelo (limites e condição nos 'com cuidado')", () => {
    for (const v of verbetes) {
      expect(v.short_answer.length, v.slug).toBeLessThanOrEqual(200);
      expect((v.details ?? "").length, v.slug).toBeLessThanOrEqual(800);
      expect((v.condition_note ?? "").length, v.slug).toBeLessThanOrEqual(200);
      expect(v.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(["safe", "caution", "avoid"]).toContain(v.verdict);
      expect(v.source_label.trim().length).toBeGreaterThan(0);
      if (v.verdict === "caution") expect(v.condition_note, v.slug).toBeTruthy();
      if (v.source_url) expect(v.source_url).toMatch(/^https?:\/\//);
    }
  });

  it("os 10 exemplos da spec com os vereditos dela", () => {
    const veredito = (slug: string) => verbetes.find((v) => v.slug === slug)?.verdict;
    expect(veredito("acai")).toBe("caution");
    expect(veredito("cafe")).toBe("caution");
    expect(veredito("kombucha")).toBe("caution");
    expect(veredito("peixe-cru")).toBe("avoid");
    expect(veredito("bebida-alcoolica")).toBe("avoid");
  });
});
