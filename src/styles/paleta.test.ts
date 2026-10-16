import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Identidade de out/2026 (marrom, rosa, bege, oliva): lê o tokens.css de verdade e confere o contraste WCAG
 * de cada par de texto que as telas usam, no claro e no escuro.
 */
const css = readFileSync(path.resolve(__dirname, "tokens.css"), "utf8");

function bloco(seletor: string): Record<string, string> {
  const i = css.indexOf(`${seletor} {`);
  if (i < 0) throw new Error(`sem bloco ${seletor}`);
  const corpo = css.slice(i + seletor.length + 2, css.indexOf("}", i));
  return Object.fromEntries([...corpo.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1]!, m[2]!]));
}
function luminancia(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

const claro = bloco(":root");
const escuro = { ...claro, ...bloco('[data-tema="escuro"]') };

describe("paleta da marca · contraste AA", () => {
  it.each([
    ["texto", "fundo"],
    ["texto", "superficie"],
    ["texto", "cor-primaria-suave"],
    ["texto", "cor-acento-suave"],
    ["texto-mudo", "fundo"],
    ["texto-mudo", "superficie"],
    ["texto-mudo", "cor-primaria-suave"],
    ["texto-mudo", "cor-acento-suave"],
    ["cor-primaria-texto", "fundo"],
    ["cor-primaria-texto", "superficie"],
    ["cor-primaria-texto", "cor-primaria-suave"],
    ["cor-acento-texto", "fundo"],
    ["cor-acento-texto", "superficie"],
    ["cor-acento-texto", "cor-acento-suave"],
    ["erro", "fundo"],
    ["erro", "superficie"],
    ["sucesso", "fundo"],
    ["sucesso", "superficie"],
  ])("claro: %s sobre %s ≥ 4,5", (texto, fundo) => {
    expect(contraste(claro[texto]!, claro[fundo]!)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(["cor-primaria", "cor-acento", "reg-sono", "reg-mamada", "reg-fralda", "reg-banho"])("botões: texto branco sobre %s ≥ 4,5 (no claro e no escuro)", (fundo) => {
    expect(contraste("#ffffff", claro[fundo]!)).toBeGreaterThanOrEqual(4.5);
    expect(contraste("#ffffff", escuro[fundo]!)).toBeGreaterThanOrEqual(4.5);
  });

  it("sucesso: texto da superfície sobre o verde ≥ 4,5 (no claro e no escuro)", () => {
    expect(contraste(claro.superficie!, claro.sucesso!)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(escuro.superficie!, escuro.sucesso!)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ["texto", "fundo"],
    ["texto", "superficie"],
    ["texto", "cor-primaria-suave"],
    ["texto", "cor-acento-suave"],
    ["texto-mudo", "superficie"],
    ["cor-primaria-texto", "cor-primaria-suave"],
    ["cor-acento-texto", "fundo"],
    ["cor-acento-texto", "superficie"],
    ["erro", "superficie"],
    ["sucesso", "superficie"],
  ])("escuro: %s sobre %s ≥ 4,5", (texto, fundo) => {
    expect(contraste(escuro[texto]!, escuro[fundo]!)).toBeGreaterThanOrEqual(4.5);
  });
});
