import { describe, expect, it } from "vitest";

import {
  duracao,
  fotosDosSlides,
  formatarComprimento,
  formatarPeso,
  idDaRetrospectiva,
  lembretesDaRetrospectiva,
  OBRIGATORIOS,
  podeOcultar,
  previaDisponivel,
  primeiraFrase,
  slidesParaExportar,
  slidesPossiveis,
  slidesVisiveis,
  validarNascimento,
  type ConfigRetro,
  type DadosRetro,
  type EntradaDiario,
} from "@dominio/retrospectiva.ts";
import { dumDaDpp, somarDiasISO } from "@dominio/tempo.ts";

/** Funcionalidade 07 · regras numeradas da retrospectiva (o domínio é o mesmo do player, da exportação e do job). */
const DPP = "2026-12-01";
const DUM = dumDaDpp(DPP);
const ELA = "mae";
const ELE = "pai";
const vazio: ConfigRetro = { hidden_slides: [], chosen_entries: {} };

function entrada(id: string, o: Partial<EntradaDiario> = {}): EntradaDiario {
  return { id, body: `Texto ${id}.`, entry_date: "2026-05-01", milestone_code: null, criado_por: ELA, ...o };
}

function dados(o: Partial<DadosRetro> = {}): DadosRetro {
  return {
    kind: "preview",
    autora: ELA,
    dpp: DPP,
    hoje: somarDiasISO(DUM, 255),
    nomeDoBebe: null,
    nascimento: null,
    entradas: [],
    fotos: [],
    ultrassons: [],
    numeros: { consultas: 0, documentos: 0, fotos: 0, entradas: 0 },
    ...o,
  };
}

const tipos = (d: DadosRetro, c = vazio) => slidesPossiveis(d, c).map((s) => s.tipo);

describe("RN-01 · disponibilidade", () => {
  it("a prévia abre em 36s0d (ga_days ≥ 252), não um dia antes", () => {
    expect(previaDisponivel(DPP, somarDiasISO(DUM, 251))).toBe(false);
    expect(previaDisponivel(DPP, somarDiasISO(DUM, 252))).toBe(true);
    expect(previaDisponivel(null, somarDiasISO(DUM, 300))).toBe(false);
  });

  it("o id é determinístico por gestante e tipo (outro aparelho não duplica)", () => {
    expect(idDaRetrospectiva("u1", "preview")).toBe(idDaRetrospectiva("u1", "preview"));
    expect(idDaRetrospectiva("u1", "preview")).not.toBe(idDaRetrospectiva("u1", "final"));
    expect(idDaRetrospectiva("u1", "final")).not.toBe(idDaRetrospectiva("u2", "final"));
  });
});

describe("RN-02 · registrar nascimento", () => {
  const base = { hoje: "2026-11-20", dpp: DPP, peso_g: null, comprimento_cm: null };
  it("data entre DUM + 140 dias e hoje", () => {
    expect(validarNascimento({ ...base, data: somarDiasISO(DUM, 139) })).toBe("antes_do_minimo");
    expect(validarNascimento({ ...base, data: somarDiasISO(DUM, 140) })).toBeNull();
    expect(validarNascimento({ ...base, data: "2026-11-20" })).toBeNull();
    expect(validarNascimento({ ...base, data: "2026-11-21" })).toBe("futuro");
  });
  it("peso de 500 a 7000 g e comprimento de 20 a 65 cm", () => {
    const d = { ...base, data: "2026-11-20" };
    expect(validarNascimento({ ...d, peso_g: 499 })).toBe("peso");
    expect(validarNascimento({ ...d, peso_g: 500 })).toBeNull();
    expect(validarNascimento({ ...d, peso_g: 7000 })).toBeNull();
    expect(validarNascimento({ ...d, peso_g: 7001 })).toBe("peso");
    expect(validarNascimento({ ...d, comprimento_cm: 19.9 })).toBe("comprimento");
    expect(validarNascimento({ ...d, comprimento_cm: 20 })).toBeNull();
    expect(validarNascimento({ ...d, comprimento_cm: 65 })).toBeNull();
    expect(validarNascimento({ ...d, comprimento_cm: 65.5 })).toBe("comprimento");
  });
  it("formata peso e comprimento em pt-BR", () => {
    expect(formatarPeso(3250)).toBe("3.250 g");
    expect(formatarComprimento(49.5)).toBe("49,5 cm");
    expect(formatarComprimento(50)).toBe("50 cm");
  });
});

describe("RN-03 · slides sem dado são omitidos; os obrigatórios sempre existem", () => {
  it("quase sem dados (gestação criada na semana 35): capa, duração, números e encerramento", () => {
    expect(tipos(dados())).toEqual(["cover", "duration", "numbers", "closing"]);
  });

  it("final só com a data: os possíveis + a ponte; o encerramento leva o nascimento", () => {
    const nascimento = { nome: null, data: somarDiasISO(DUM, 275), hora: null, peso_g: null, comprimento_cm: null };
    const s = slidesPossiveis(dados({ kind: "final", nascimento }), vazio);
    expect(s.map((x) => x.tipo)).toEqual(["cover", "duration", "numbers", "closing", "bridge"]);
    expect(s.find((x) => x.tipo === "closing")).toMatchObject({ nascimento });
    // Da DUM ao parto: 39 semanas e 2 dias.
    expect(s.find((x) => x.tipo === "duration")).toMatchObject({ semanas: 39, dias: 2 });
  });

  it("a prévia conta até hoje e termina em 'Até logo' (sem nascimento nem ponte)", () => {
    const s = slidesPossiveis(dados({ hoje: somarDiasISO(DUM, 255) }), vazio);
    expect(s.find((x) => x.tipo === "duration")).toMatchObject({ semanas: 36, dias: 3 });
    expect(s.find((x) => x.tipo === "closing")).toMatchObject({ nascimento: null });
    expect(s.some((x) => x.tipo === "bridge")).toBe(false);
  });

  it("timelapse só com 3 fotos ou mais (sem fotos, nada quebra)", () => {
    const foto = (i: number) => ({ id: `f${i}`, gest_week: 10 + i, storage_path: `p/${i}.jpg` });
    expect(tipos(dados({ fotos: [foto(1), foto(2)] }))).not.toContain("belly");
    const s = slidesPossiveis(dados({ fotos: [foto(3), foto(1), foto(2)] }), vazio);
    expect(s.find((x) => x.tipo === "belly")).toMatchObject({ quadros: [{ semana: 11 }, { semana: 12 }, { semana: 13 }] });
    // A capa usa a foto mais recente.
    expect(s[0]).toMatchObject({ tipo: "cover", foto: "p/3.jpg" });
    expect(tipos(dados({ fotos: [foto(1), foto(2), { ...foto(3), apagado_em: "x" }] }))).not.toContain("belly");
  });

  it("ultrassom: o favorito mais recente com imagem", () => {
    const us = [
      { id: "a", kind: "us_morpho", exam_date: "2026-07-01", is_favorite: true, storage_path: "a.jpg" },
      { id: "b", kind: "us_obstetric", exam_date: "2026-09-01", is_favorite: true, storage_path: "b.jpg" },
      { id: "c", kind: "us_obstetric", exam_date: "2026-10-01", is_favorite: false, storage_path: "c.jpg" },
      { id: "d", kind: "blood", exam_date: "2026-10-02", is_favorite: true, storage_path: "d.jpg" },
      { id: "e", kind: "us_other", exam_date: "2026-10-03", is_favorite: true, storage_path: null },
    ];
    expect(slidesPossiveis(dados({ ultrassons: us }), vazio).find((x) => x.tipo === "ultrasound")).toMatchObject({ caminho: "b.jpg", data: "2026-09-01" });
  });

  it("a ordem segue a tabela da spec", () => {
    const d = dados({
      kind: "final",
      nascimento: { nome: "Theo", data: somarDiasISO(DUM, 275), hora: "08:15", peso_g: 3250, comprimento_cm: 49.5 },
      entradas: [
        entrada("d", { milestone_code: "discovery" }),
        entrada("k", { milestone_code: "first_kick" }),
        entrada("s", { milestone_code: "sex_known" }),
        entrada("n", { milestone_code: "name_chosen" }),
        entrada("q"),
        entrada("p", { criado_por: ELE }),
      ],
      fotos: [1, 2, 3].map((i) => ({ id: `f${i}`, gest_week: 10 + i, storage_path: `${i}.jpg` })),
      ultrassons: [{ id: "u", kind: "us_morpho", exam_date: "2026-07-01", is_favorite: true, storage_path: "u.jpg" }],
    });
    const c: ConfigRetro = { hidden_slides: [], chosen_entries: { quote: { entrada: "q" }, partner: { entrada: "p" } } };
    expect(tipos(d, c)).toEqual(["cover", "duration", "discovery", "belly", "ultrasound", "first_kick", "sex_name", "numbers", "quote", "partner", "closing", "bridge"]);
    expect(slidesPossiveis(d, c).length).toBeLessThanOrEqual(12);
    expect(slidesPossiveis(d, c)[0]).toMatchObject({ nome: "Theo" });
  });
});

describe("RN-04 · frases do diário", () => {
  it("por padrão, a primeira frase (até 140) da entrada do marco", () => {
    expect(primeiraFrase("Foi o dia mais lindo. Depois teve mais coisa.")).toBe("Foi o dia mais lindo.");
    expect(primeiraFrase("  sem ponto  final ")).toBe("sem ponto final");
    const longa = `${"palavra ".repeat(40)}fim.`;
    const f = primeiraFrase(longa)!;
    expect(f.length).toBeLessThanOrEqual(140);
    expect(f.endsWith("…")).toBe(true);
    expect(f).not.toMatch(/palavr…$/);
    expect(primeiraFrase("   ")).toBeNull();
  });

  it("nenhuma frase aparece sem ter sido escrita por ela: o marco do parceiro não entra sozinho", () => {
    const d = dados({ entradas: [entrada("k", { milestone_code: "first_kick", criado_por: ELE })] });
    expect(tipos(d)).not.toContain("first_kick");
  });

  it("entrada do parceiro só entra se ela escolher", () => {
    const d = dados({ entradas: [entrada("p", { criado_por: ELE, body: "Chorei vendo o ultrassom." })] });
    expect(tipos(d)).not.toContain("partner");
    const s = slidesPossiveis(d, { hidden_slides: [], chosen_entries: { partner: { entrada: "p" } } });
    expect(s.find((x) => x.tipo === "partner")).toMatchObject({ frase: { texto: "Chorei vendo o ultrassom.", origem: { entrada: "p" } } });
  });

  it("ela troca por outra entrada ou digita (até 140)", () => {
    const d = dados({ entradas: [entrada("d", { milestone_code: "discovery", body: "Padrão." }), entrada("x", { body: "Outra." })] });
    const outra = slidesPossiveis(d, { hidden_slides: [], chosen_entries: { discovery: { entrada: "x" } } });
    expect(outra.find((x) => x.tipo === "discovery")).toMatchObject({ frase: { texto: "Outra." } });
    const digitada = slidesPossiveis(d, { hidden_slides: [], chosen_entries: { discovery: { texto: "x".repeat(200) } } });
    expect(digitada.find((x) => x.tipo === "discovery")).toMatchObject({ frase: { origem: "texto", data: null } });
    expect((digitada.find((x) => x.tipo === "discovery") as { frase: { texto: string } }).frase.texto).toHaveLength(140);
  });

  it("entrada escolhida que foi apagada volta ao padrão do marco", () => {
    const d = dados({ entradas: [entrada("d", { milestone_code: "discovery", body: "Padrão." }), entrada("x", { apagado_em: "z" })] });
    const s = slidesPossiveis(d, { hidden_slides: [], chosen_entries: { discovery: { entrada: "x" } } });
    expect(s.find((x) => x.tipo === "discovery")).toMatchObject({ frase: { texto: "Padrão." } });
  });

  it("sexo e nome juntam os dois marcos dela", () => {
    const d = dados({ entradas: [entrada("s", { milestone_code: "sex_known", body: "É menino!" }), entrada("n", { milestone_code: "name_chosen", body: "Theo." })] });
    expect(slidesPossiveis(d, vazio).find((x) => x.tipo === "sex_name")).toMatchObject({ sexo: { texto: "É menino!" }, nome: { texto: "Theo." } });
  });
});

describe("RN-05 · ocultar", () => {
  it("os obrigatórios nunca saem; os outros saem do player e da exportação", () => {
    for (const t of OBRIGATORIOS) expect(podeOcultar(t)).toBe(false);
    expect(podeOcultar("belly")).toBe(true);
    const d = dados({ fotos: [1, 2, 3].map((i) => ({ id: `${i}`, gest_week: i + 10, storage_path: `${i}` })) });
    const c: ConfigRetro = { hidden_slides: ["belly", "cover", "numbers"], chosen_entries: {} };
    expect(slidesVisiveis(d, c).map((s) => s.tipo)).toEqual(["cover", "duration", "numbers", "closing"]);
    expect(slidesParaExportar(d, c).map((s) => s.tipo)).toEqual(["cover", "duration", "numbers", "closing"]);
  });

  it("a ponte não vai para o vídeo (é um botão do app)", () => {
    const d = dados({ kind: "final", nascimento: { nome: "Bia", data: somarDiasISO(DUM, 270), hora: null, peso_g: null, comprimento_cm: null } });
    expect(slidesVisiveis(d, vazio).at(-1)?.tipo).toBe("bridge");
    expect(slidesParaExportar(d, vazio).at(-1)?.tipo).toBe("closing");
  });
});

describe("RN-06/07 · tempo e fotos da exportação", () => {
  it("duração da DUM até a data", () => {
    expect(duracao(DPP, somarDiasISO(DUM, 0))).toEqual({ semanas: 0, dias: 0 });
    expect(duracao(DPP, somarDiasISO(DUM, 280))).toEqual({ semanas: 40, dias: 0 });
    expect(duracao(DPP, somarDiasISO(DUM, -3))).toEqual({ semanas: 0, dias: 0 });
  });

  it("todas as fotos que o vídeo precisa, sem repetir", () => {
    const d = dados({
      fotos: [1, 2, 3].map((i) => ({ id: `${i}`, gest_week: i + 10, storage_path: `b${i}` })),
      ultrassons: [{ id: "u", kind: "us_morpho", exam_date: "2026-07-01", is_favorite: true, storage_path: "u" }],
    });
    expect(fotosDosSlides(slidesParaExportar(d, vazio)).sort()).toEqual(["b1", "b2", "b3", "u"]);
  });
});

describe("RN-09 · push retro_ready", () => {
  const titulos = { previa: "P", final: "F", corpo: "C" };
  it("prévia na semana 38 às 10:00 (se a gestação foi criada antes)", () => {
    const [l] = lembretesDaRetrospectiva({ dpp: DPP, nascidoEm: null, tz: "America/Sao_Paulo", criadaEm: "2026-05-01T00:00:00Z", titulos });
    expect(l).toMatchObject({ chave: "retro:preview", tipo: "retro_ready", categoria: "retro" });
    expect(l!.em.toISOString()).toBe(`${somarDiasISO(DUM, 266)}T13:00:00.000Z`);
    expect(l!.url).toContain("kind=preview");
    expect(lembretesDaRetrospectiva({ dpp: DPP, nascidoEm: null, tz: "America/Sao_Paulo", criadaEm: `${somarDiasISO(DUM, 270)}T00:00:00Z`, titulos })).toEqual([]);
  });

  it("final no dia seguinte ao nascimento às 10:00; depois do nascimento, sem prévia", () => {
    const l = lembretesDaRetrospectiva({ dpp: DPP, nascidoEm: "2026-11-25", tz: "America/Sao_Paulo", criadaEm: "2026-05-01T00:00:00Z", titulos });
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ chave: "retro:final" });
    expect(l[0]!.em.toISOString()).toBe("2026-11-26T13:00:00.000Z");
  });
});
