import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Funcionalidade 11 RN-07 · critério "no modo escuro, o anel e o texto continuam legíveis nos três trimestres":
 * lê o tokens.css de verdade e confere o contraste (WCAG) das cores do anel e do texto no escuro.
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

const escuro = bloco('[data-tema="escuro"]');
const anelEscuro = {
  1: { inicio: escuro["anel-inicio"]!, fim: escuro["anel-fim"]! },
  2: bloco('[data-tema="escuro"][data-trimestre="2"]'),
  3: bloco('[data-tema="escuro"][data-trimestre="3"]'),
};

describe("RN-07 · tema por trimestre", () => {
  it("cada trimestre tem início e fim do anel, no claro e no escuro", () => {
    const raiz = bloco(":root");
    expect(raiz["anel-inicio"]).toBeTruthy();
    expect(raiz["anel-fim"]).toBeTruthy();
    for (const t of [2, 3]) {
      expect(Object.keys(bloco(`[data-trimestre="${t}"]`)).sort()).toEqual(["anel-fim", "anel-inicio"]);
      expect(Object.keys(anelEscuro[t as 2 | 3]).sort()).toEqual(["anel-fim", "anel-inicio"]);
    }
    expect(css).toMatch(/--anim-tema:\s*400ms/);
  });

  it("critério: no escuro o anel tem contraste ≥ 3:1 (elemento gráfico, AA) com fundo e superfície nos três trimestres", () => {
    for (const [t, cores] of Object.entries(anelEscuro)) {
      for (const cor of Object.values(cores) as string[]) {
        expect(contraste(cor, escuro.fundo!), `T${t} ${cor} × fundo`).toBeGreaterThanOrEqual(3);
        expect(contraste(cor, escuro.superficie!), `T${t} ${cor} × superfície`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("no escuro o texto continua AA (4,5:1) sobre fundo e superfície", () => {
    for (const fundo of [escuro.fundo!, escuro.superficie!]) {
      expect(contraste(escuro.texto!, fundo)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(escuro["texto-mudo"]!, fundo)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(escuro["cor-primaria-texto"]!, fundo)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("o 'auto' no escuro do sistema usa as mesmas cores do escuro", () => {
    const media = css.slice(css.indexOf("@media (prefers-color-scheme: dark)"));
    for (const t of [2, 3] as const) {
      const i = media.indexOf(`[data-tema="auto"][data-trimestre="${t}"] {`);
      expect(i).toBeGreaterThan(0);
      const corpo = media.slice(i, media.indexOf("}", i));
      expect(corpo).toContain(anelEscuro[t]["anel-inicio"]!);
      expect(corpo).toContain(anelEscuro[t]["anel-fim"]!);
    }
  });
});
