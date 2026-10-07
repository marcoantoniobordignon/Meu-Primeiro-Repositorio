import { describe, expect, it } from "vitest";

import a from "../../../supabase/seed/artigos-a.json";
import { blocos } from "./markdown";

describe("markdown dos artigos (funcionalidade 11)", () => {
  it("'## ' vira subtítulo e '1. ' vira lista numerada só com a opção ligada", () => {
    const md = "## O que muda\n\nTexto.\n\n1. um\n2. dois";
    expect(blocos(md, { titulos: true })).toEqual([
      { tipo: "titulo", trechos: [{ tipo: "texto", valor: "O que muda" }] },
      { tipo: "paragrafo", trechos: [{ tipo: "texto", valor: "Texto." }] },
      { tipo: "lista", itens: [[{ tipo: "texto", valor: "um" }], [{ tipo: "texto", valor: "dois" }]], ordenada: true },
    ]);
    // Nas stories, nada muda.
    expect(blocos(md)[0]).toEqual({ tipo: "paragrafo", trechos: [{ tipo: "texto", valor: "## O que muda" }] });
  });

  it("subtítulo seguido de texto no mesmo bloco", () => {
    expect(blocos("## Dica\nBeba água.", { titulos: true }).map((b) => b.tipo)).toEqual(["titulo", "paragrafo"]);
  });

  it("nenhum artigo da semente sobra com '#' cru depois de renderizado", () => {
    for (const x of a) {
      const sobra = blocos(x.body_md, { titulos: true }).some((b) => b.tipo === "paragrafo" && b.trechos.some((t) => t.valor.trimStart().startsWith("#")));
      expect(sobra, x.slug).toBe(false);
    }
  });
});
