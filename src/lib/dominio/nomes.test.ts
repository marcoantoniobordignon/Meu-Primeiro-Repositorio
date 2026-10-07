import { describe, expect, it } from "vitest";

import semente from "../../../supabase/seed/nomes.json";
import { estadosDosCards, type DadosDaHome } from "@/lib/artigos/home";
import { normalizar } from "@dominio/faq.ts";
import {
  catalogoTemPopularidade,
  chaveDoVoto,
  contarSilabas,
  idDoNome,
  idDoVoto,
  iniciais,
  montarBaralho,
  mover,
  nomeCompleto,
  nomeDoCatalogo,
  nomeProprioValido,
  normalizarNomeProprio,
  novasPosicoes,
  passaNoFiltro,
  podeEscolher,
  popularidade,
  ranking,
  santoDoNome,
  SEM_FILTROS,
  silabasDoNomeCompleto,
  type NomeCatalogo,
  type VotoBase,
} from "@dominio/nomes.ts";

const catalogo = (semente as NomeCatalogo[]).map((n) => ({ ...n, id: idDoNome(n.name) }));

describe("RN-01 · baralho e filtros", () => {
  it("critério: 20 por rodada, entre os nomes sem voto, estável na mesma sessão", () => {
    const a = montarBaralho(catalogo, new Set(), SEM_FILTROS, "s1");
    expect(a).toHaveLength(20);
    expect(montarBaralho(catalogo, new Set(), SEM_FILTROS, "s1").map((n) => n.id)).toEqual(a.map((n) => n.id));
    expect(montarBaralho(catalogo, new Set(), SEM_FILTROS, "s2").map((n) => n.id)).not.toEqual(a.map((n) => n.id));
    const votados = new Set(a.slice(0, 5).map((n) => n.id));
    expect(montarBaralho(catalogo, votados, SEM_FILTROS, "s1").some((n) => votados.has(n.id))).toBe(false);
  });

  it("critério: 'começa com M' só traz nomes com M (com ou sem acento)", () => {
    const m = montarBaralho(catalogo, new Set(), { ...SEM_FILTROS, letra: "M" }, "s");
    expect(m.length).toBe(20);
    expect(m.every((n) => normalizar(n.name).startsWith("m"))).toBe(true);
    expect(passaNoFiltro({ ...catalogo[0]!, name: "Érica" }, { ...SEM_FILTROS, letra: "E" })).toBe(true);
  });

  it("sexo (neutro entra nos dois), sílabas (4 = 4 ou mais), origem", () => {
    const f = montarBaralho(catalogo, new Set(), { ...SEM_FILTROS, sexo: "f" }, "s", 999);
    expect(f.every((n) => n.sex_hint !== "m")).toBe(true);
    expect(montarBaralho(catalogo, new Set(), { ...SEM_FILTROS, silabas: 4 }, "s", 999).every((n) => n.syllables >= 4)).toBe(true);
    expect(montarBaralho(catalogo, new Set(), { ...SEM_FILTROS, silabas: 2 }, "s", 999).every((n) => n.syllables === 2)).toBe(true);
    expect(montarBaralho(catalogo, new Set(), { ...SEM_FILTROS, origem: "hebraica" }, "s", 999).every((n) => n.origin === "hebraica")).toBe(true);
  });

  it("acabou: filtros sem nenhum nome devolvem baralho vazio", () => {
    expect(montarBaralho(catalogo, new Set(), { ...SEM_FILTROS, letra: "X", silabas: 1, sexo: "f" }, "s")).toEqual([]);
    const todos = new Set(catalogo.map((n) => n.id));
    expect(montarBaralho(catalogo, todos, SEM_FILTROS, "s")).toEqual([]);
  });

  it("popularidade pelo Censo; sem posições no catálogo, o filtro some", () => {
    expect(popularidade({ ibge_rank_f: 3, ibge_rank_m: null })).toBe("muito_comum");
    expect(popularidade({ ibge_rank_f: 250, ibge_rank_m: null })).toBe("comum");
    expect(popularidade({ ibge_rank_f: null, ibge_rank_m: null })).toBe("raro");
    expect(catalogoTemPopularidade(catalogo)).toBe(false);
    expect(catalogoTemPopularidade([{ ibge_rank_f: 1, ibge_rank_m: null }])).toBe(true);
  });
});

describe("RN-05/10 · nome próprio e chave do match", () => {
  it("critério: 'Joaquim' não está no catálogo e entra como nome próprio", () => {
    expect(nomeDoCatalogo(catalogo, "Joaquim")).toBeUndefined();
    expect(nomeProprioValido("Joaquim")).toBe(true);
  });

  it("só letras, espaço e hífen, até 40", () => {
    expect(nomeProprioValido("Maria-Flor")).toBe(true);
    expect(nomeProprioValido("Ana Clara")).toBe(true);
    expect(nomeProprioValido("R2-D2")).toBe(false);
    expect(nomeProprioValido("   ")).toBe(false);
    expect(nomeProprioValido("a".repeat(41))).toBe(false);
    expect(nomeProprioValido("Ana--Clara")).toBe(false);
  });

  it("normaliza como o banco: espaços, pontas e minúsculas viram 'Inicial Maiúscula'", () => {
    expect(normalizarNomeProprio("  joaquim  ")).toBe("Joaquim");
    expect(normalizarNomeProprio("maria-flor  da silva")).toBe("Maria-Flor Da Silva");
    expect(normalizarNomeProprio("McAllister")).toBe("McAllister");
  });

  it("a chave casa sem acento e sem caixa (igual à coluna gerada no banco)", () => {
    expect(chaveDoVoto({ name_id: null, custom_name: "JOAQUÍM " })).toBe(chaveDoVoto({ name_id: null, custom_name: "joaquim" }));
    expect(chaveDoVoto({ name_id: null, custom_name: "joaquim" })).toBe("c:joaquim");
    expect(chaveDoVoto({ name_id: "abc", custom_name: null })).toBe("abc");
  });

  it("nome digitado que já está no catálogo vota no catálogo", () => {
    expect(nomeDoCatalogo(catalogo, "helena")?.name).toBe("Helena");
  });

  it("um voto por pessoa e nome (o id não muda ao desfazer e votar de novo)", () => {
    expect(idDoVoto("p1", "c:joaquim")).toBe(idDoVoto("p1", "c:joaquim"));
    expect(idDoVoto("p1", "c:joaquim")).not.toBe(idDoVoto("p2", "c:joaquim"));
  });
});

describe("RN-04 · ranking", () => {
  const v = (id: string, rank: number | null, vote: "like" | "dislike" = "like"): VotoBase => ({ id, name_id: id, custom_name: null, vote, rank });

  it("até 10, em ordem; só o que mudou é gravado", () => {
    const votos = [v("a", 1), v("b", 2), v("c", null), v("d", null, "dislike")];
    expect(ranking(votos).map((x) => x.id)).toEqual(["a", "b"]);
    expect(novasPosicoes(votos, ["b", "a", "c"])).toEqual([
      { id: "a", rank: 2 },
      { id: "b", rank: 1 },
      { id: "c", rank: 3 },
    ]);
    expect(novasPosicoes(votos, ["a"])).toEqual([{ id: "b", rank: null }]);
    const muitos = Array.from({ length: 12 }, (_, i) => v(`n${i}`, null));
    expect(novasPosicoes(muitos, muitos.map((x) => x.id)).filter((x) => x.rank !== null)).toHaveLength(10);
  });

  it("subir e descer não passam das pontas", () => {
    expect(mover(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(mover(["a", "b", "c"], "a", -1)).toEqual(["a", "b", "c"]);
    expect(mover(["a", "b", "c"], "c", 1)).toEqual(["a", "b", "c"]);
  });
});

describe("RN-07/08/09 · pré-visualização, santo e escolha", () => {
  it("nome com até 2 sobrenomes, iniciais (sem partículas) e sílabas", () => {
    const c = nomeCompleto("Helena", ["Souza", "da Lima", "Extra"]);
    expect(c).toBe("Helena Souza da Lima");
    expect(iniciais(c)).toBe("H. S. L.");
    expect(silabasDoNomeCompleto("Helena", 3, ["Souza", "Oliveira"])).toBe(3 + 2 + 4);
  });

  it("sílabas pela divisão escolar", () => {
    const casos: [string, number][] = [["Maria", 3], ["Ana", 2], ["Miguel", 2], ["Laura", 2], ["Gael", 2], ["Heitor", 2], ["Isabela", 4], ["Souza", 2], ["Oliveira", 4], ["Pereira", 3], ["Rodrigues", 3], ["Araújo", 4], ["João", 2], ["Nair", 2], ["Raul", 2], ["Raissa", 3], ["Yasmin", 2], ["Giovana", 3], ["Lourdes", 2], ["Reis", 1], ["Queiroz", 2]];
    for (const [p, n] of casos) expect(contarSilabas(p), p).toBe(n);
  });

  it("a contagem bate com a semente em pelo menos 98% dos nomes", () => {
    const iguais = (semente as NomeCatalogo[]).filter((n) => n.name.split(" ").reduce((s, p) => s + contarSilabas(p), 0) === n.syllables).length;
    expect(iguais / semente.length).toBeGreaterThanOrEqual(0.98);
  });

  it("RN-09: santo do nome só com o modo fé", () => {
    const jose = catalogo.find((n) => n.name === "José")!;
    expect(santoDoNome(jose, false)).toBeNull();
    expect(santoDoNome(jose, true)).toEqual({ nome: "São José", dia: "03-19" });
  });

  it("RN-07: com parceiro, só match vira o nome; sem parceiro, um curtido", () => {
    expect(podeEscolher({ temParceiro: true, ehMatch: false, curtido: true })).toBe(false);
    expect(podeEscolher({ temParceiro: true, ehMatch: true, curtido: true })).toBe(true);
    expect(podeEscolher({ temParceiro: false, ehMatch: false, curtido: true })).toBe(true);
    expect(podeEscolher({ temParceiro: false, ehMatch: false, curtido: false })).toBe(false);
  });
});

describe("semente do catálogo", () => {
  it("cerca de 800 nomes, únicos sem acento e sem caixa, dentro do modelo", () => {
    expect(catalogo.length).toBeGreaterThanOrEqual(780);
    expect(new Set(catalogo.map((n) => normalizar(n.name))).size).toBe(catalogo.length);
    for (const n of catalogo) {
      expect(["f", "m", "u"]).toContain(n.sex_hint);
      expect((n.meaning ?? "").length, n.name).toBeLessThanOrEqual(160);
      expect(n.syllables).toBeGreaterThanOrEqual(1);
      if (n.saint_day) expect(n.saint_day).toMatch(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
      expect(nomeProprioValido(n.name), n.name).toBe(true);
    }
    expect(catalogo.filter((n) => n.sex_hint !== "m").length).toBeGreaterThan(350);
    expect(catalogo.filter((n) => n.sex_hint !== "f").length).toBeGreaterThan(350);
  });
});

describe("home · card de nomes (tabela da funcionalidade 11)", () => {
  const base: DadosDaHome = {
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
  it("sem voto = vazio; com match = pendente; escolhido = feito; sem dados = oculto", () => {
    expect(estadosDosCards({ ...base, nomes: { votos: 0, matches: 0, escolhido: false } }).nomes).toBe("vazio");
    expect(estadosDosCards({ ...base, nomes: { votos: 5, matches: 0, escolhido: false } }).nomes).toBe("normal");
    expect(estadosDosCards({ ...base, nomes: { votos: 5, matches: 2, escolhido: false } }).nomes).toBe("pendente");
    expect(estadosDosCards({ ...base, nomes: { votos: 5, matches: 2, escolhido: true } }).nomes).toBe("feito");
    expect(estadosDosCards(base).nomes).toBe("oculto");
  });
});
