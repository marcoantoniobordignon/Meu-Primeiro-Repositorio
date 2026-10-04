import { describe, expect, it } from "vitest";

import { FRASE_ENCAMINHAMENTO } from "@/lib/conteudo/banco";

import { cardsDoCorpo, normalizarConteudo, novoConteudo, slugify, textoFaixa, validarConteudo } from "./conteudo";

const valido = () => ({
  ...novoConteudo(),
  titulo: "Dor nas costas",
  slug: "dor-nas-costas",
  semana_min: 20,
  semana_max: 30,
  corpo_md: `Primeiro card.\n\n---\n\nSegundo card.\n\n---\n\n${FRASE_ENCAMINHAMENTO}`,
});

describe("ADM-01 · validação antes de publicar", () => {
  it("conteúdo completo passa", () => {
    expect(validarConteudo(valido())).toEqual([]);
  });

  it("CON-08: título, slug, faixa, corpo e minutos", () => {
    const campos = validarConteudo({ ...novoConteudo(), corpo_md: "", minutos_leitura: 0 }).map((p) => p.campo);
    expect(campos).toEqual(expect.arrayContaining(["titulo", "slug", "faixa", "corpo", "minutos"]));
  });

  it("CON-07: barra 'sempre', 'nunca' e 'garantido' no título ou no corpo", () => {
    const c = valido();
    expect(validarConteudo({ ...c, titulo: "Isso sempre funciona" }).map((p) => p.campo)).toContain("palavras");
    expect(validarConteudo({ ...c, corpo_md: c.corpo_md.replace("Primeiro card.", "Nunca faça isso.") }).map((p) => p.campo)).toContain("palavras");
    expect(validarConteudo({ ...c, corpo_md: c.corpo_md.replace("Primeiro card.", "Sempreviva é uma flor.") })).toEqual([]);
  });

  it("CON-07: conteúdo de saúde termina com a frase de encaminhamento; 'bebe' não precisa", () => {
    const semFrase = { ...valido(), corpo_md: "Um.\n\n---\n\nDois." };
    expect(validarConteudo(semFrase).map((p) => p.campo)).toContain("frase");
    expect(validarConteudo({ ...semFrase, categoria: "bebe" as const })).toEqual([]);
  });

  it("slug repetido, faixa invertida e story da semana com uma semana só", () => {
    const c = valido();
    expect(validarConteudo(c, ["dor-nas-costas"]).map((p) => p.campo)).toContain("slug");
    expect(validarConteudo({ ...c, semana_min: 30, semana_max: 20 }).map((p) => p.campo)).toContain("faixa");
    expect(validarConteudo({ ...c, categoria: "semana" as const }).map((p) => p.campo)).toContain("semana_categoria");
  });

  it("card maior que uma tela é barrado", () => {
    const c = valido();
    expect(validarConteudo({ ...c, corpo_md: `${"a".repeat(421)}\n\n---\n\n${FRASE_ENCAMINHAMENTO}` }).map((p) => p.campo)).toContain("corpo");
  });
});

describe("ADM-02 · normalização", () => {
  it("cards derivados do corpo, cor pela categoria, id = slug, semana nunca premium", () => {
    const n = normalizarConteudo({ ...valido(), id: "", categoria: "sono", premium: true, semana_max: null });
    expect(n.id).toBe("dor-nas-costas");
    expect(n.cards).toHaveLength(3);
    expect(n.cor_token).toBe("sono");
    expect(n.semana_max).toBe(20);
    expect(n.premium).toBe(true);
    expect(normalizarConteudo({ ...valido(), categoria: "semana", premium: true, semana_max: 20 }).premium).toBe(false);
  });

  it("slugify e cards", () => {
    expect(slugify("Enjoo: o que ajuda?")).toBe("enjoo-o-que-ajuda");
    expect(cardsDoCorpo("a\n---\nb\n\n --- \n\nc")).toEqual(["a", "b", "c"]);
    expect(textoFaixa({ semana_min: 20, semana_max: 24, mes_bebe_min: null, mes_bebe_max: null })).toBe("sem. 20–24");
    expect(textoFaixa({ semana_min: null, semana_max: null, mes_bebe_min: 0, mes_bebe_max: 0 })).toBe("mês 0");
  });
});
