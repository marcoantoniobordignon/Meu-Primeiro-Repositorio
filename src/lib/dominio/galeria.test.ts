import { describe, expect, it } from "vitest";

import {
  cabeNoPlano,
  consentimentoValido,
  COTA_IA_MES,
  cotaRestante,
  dataMinimaSemConfirmar,
  ehTipo,
  ehUltrassom,
  ESQUEMA_RESUMO,
  familiaTemPlano,
  INSTRUCOES_LEITURA,
  janelaDaCota,
  LIMITE_PAGINAS_FREE,
  MAX_PAGINAS_DOCUMENTO,
  MAX_PAGINAS_EXPORTACAO,
  TIPOS_DOCUMENTO,
  tipoDoExame,
  VALIDADE_EXPORTACAO_S,
  validarData,
  validarResumo,
} from "@dominio/galeria.ts";
import { CATALOGO_EXAMES } from "@dominio/exames.ts";
import { dumDaDpp, somarDiasISO } from "@dominio/tempo.ts";

const DPP = "2027-03-08";
const DUM = dumDaDpp(DPP);
const HOJE = "2026-10-07";

const item = { name: "Hemoglobina", value: "11,8", unit: "g/dL", reference: "12,0 a 16,0", flagged_in_report: true };
const bom = { exam_name: "Hemograma", lab: "Lab Vida", exam_date: "2026-10-01", items: [item] };

describe("GAL · tipos e limites", () => {
  it("os 10 tipos da spec, nesta ordem", () => {
    expect(TIPOS_DOCUMENTO).toEqual(["us_obstetric", "us_nuchal", "us_morpho", "us_other", "blood", "urine", "glucose", "serology", "culture_gbs", "other"]);
    expect(TIPOS_DOCUMENTO.every(ehTipo)).toBe(true);
    expect([null, undefined, "", "raio_x", 3, "US_MORPHO"].some(ehTipo)).toBe(false);
  });

  it("limites técnicos e de negócio", () => {
    expect([MAX_PAGINAS_DOCUMENTO, LIMITE_PAGINAS_FREE, COTA_IA_MES, MAX_PAGINAS_EXPORTACAO, VALIDADE_EXPORTACAO_S]).toEqual([20, 20, 20, 50, 86_400]);
  });

  it("RN-12: favoritar só nos us_*", () => {
    expect(TIPOS_DOCUMENTO.filter(ehUltrassom)).toEqual(["us_obstetric", "us_nuchal", "us_morpho", "us_other"]);
  });

  it("todo exame do catálogo (spec 03) tem um tipo de documento", () => {
    for (const e of CATALOGO_EXAMES) expect(ehTipo(tipoDoExame(e.code)), e.code).toBe(true);
    expect(tipoDoExame("morpho")).toBe("us_morpho");
    expect(tipoDoExame("nuchal")).toBe("us_nuchal");
    expect(tipoDoExame("ogtt")).toBe("glucose");
    expect(tipoDoExame("gbs")).toBe("culture_gbs");
    expect(tipoDoExame("urine_3")).toBe("urine");
    expect([tipoDoExame(null), tipoDoExame(undefined), tipoDoExame("inventado")]).toEqual([null, null, null]);
  });
});

describe("GAL RN-01 · data", () => {
  it("sem data não salva; futura não salva; hoje salva", () => {
    expect(validarData("", HOJE, DPP)).toEqual({ erro: "sem_data", confirmar: false });
    expect(validarData("2026-10-08", HOJE, DPP)).toEqual({ erro: "futura", confirmar: false });
    expect(validarData(HOJE, HOJE, DPP)).toEqual({ erro: null, confirmar: false });
  });

  it("mais de 90 dias antes da DUM pede confirmação (não bloqueia); 90 exatos, não", () => {
    expect(validarData(somarDiasISO(DUM, -90), HOJE, DPP).confirmar).toBe(false);
    expect(validarData(somarDiasISO(DUM, -91), HOJE, DPP)).toEqual({ erro: null, confirmar: true });
    expect(dataMinimaSemConfirmar(DPP)).toBe(somarDiasISO(DUM, -90));
  });

  it("sem DPP não há o que confirmar", () => {
    expect(validarData("2001-01-01", HOJE, null).confirmar).toBe(false);
    expect(validarData("2001-01-01", HOJE, undefined).confirmar).toBe(false);
  });
});

describe("GAL RN-02 · limite do free", () => {
  it("até 20 páginas somadas; a 21ª não cabe; premium sem limite", () => {
    expect(cabeNoPlano(18, 2, false)).toBe(true);
    expect(cabeNoPlano(20, 1, false)).toBe(false);
    expect(cabeNoPlano(19, 2, false)).toBe(false);
    expect(cabeNoPlano(500, 20, true)).toBe(true);
  });

  it("editar sem página nova nunca barra quem já passou do limite (nada some)", () => {
    expect(cabeNoPlano(35, 0, false)).toBe(true);
  });
});

describe("GAL RN-06/07 · validação do que a IA devolve", () => {
  it("aceita o formato e copia só os campos conhecidos", () => {
    const r = validarResumo({ ...bom, extra: "x", items: [{ ...item, status: "alto" }] });
    expect(r).toEqual(bom);
    expect(r?.items[0]).not.toHaveProperty("status");
  });

  it("nunca calcula alto/baixo: o destaque é o do laudo", () => {
    const semMarca = validarResumo({ ...bom, items: [{ ...item, value: "99", flagged_in_report: false }] });
    expect(semMarca?.items[0]?.flagged_in_report).toBe(false);
  });

  it("nulos onde a spec permite; laudo sem itens é válido", () => {
    expect(validarResumo({ exam_name: null, lab: null, exam_date: null, items: [] })).toEqual({ exam_name: null, lab: null, exam_date: null, items: [] });
    expect(validarResumo({ ...bom, items: [{ ...item, unit: null, reference: null }] })?.items[0]).toMatchObject({ unit: null, reference: null });
  });

  it("apara espaços e trata texto vazio como nulo", () => {
    expect(validarResumo({ ...bom, lab: "  ", exam_name: "  Hemograma  " })).toMatchObject({ lab: null, exam_name: "Hemograma" });
  });

  it.each([
    ["nulo", null],
    ["array", []],
    ["texto", "{}"],
    ["sem items", { exam_name: null, lab: null, exam_date: null }],
    ["items não é lista", { ...bom, items: {} }],
    ["campo faltando", { lab: null, exam_date: null, items: [] }],
    ["tipo errado no topo", { ...bom, lab: 3 }],
    ["item sem nome", { ...bom, items: [{ ...item, name: "" }] }],
    ["item sem valor", { ...bom, items: [{ ...item, value: null }] }],
    ["flag não booleana", { ...bom, items: [{ ...item, flagged_in_report: "sim" }] }],
    ["unidade faltando", { ...bom, items: [{ name: "x", value: "1", reference: null, flagged_in_report: false }] }],
    ["item nulo", { ...bom, items: [null] }],
    ["itens demais", { ...bom, items: Array.from({ length: 301 }, () => item) }],
  ])("RN-07: %s vira null (failed)", (_, bruto) => {
    expect(validarResumo(bruto)).toBeNull();
  });

  it("corta textos longos", () => {
    const r = validarResumo({ ...bom, exam_name: "a".repeat(500), items: [{ ...item, reference: "r".repeat(1000) }] });
    expect(r?.exam_name).toHaveLength(200);
    expect(r?.items[0]?.reference).toHaveLength(300);
  });

  it("o esquema pedido ao modelo bate com o validador", () => {
    expect(ESQUEMA_RESUMO.required).toEqual(["exam_name", "lab", "exam_date", "items"]);
    expect(ESQUEMA_RESUMO.properties.items.items.required).toEqual(["name", "value", "unit", "reference", "flagged_in_report"]);
    expect(ESQUEMA_RESUMO.additionalProperties).toBe(false);
    expect(ESQUEMA_RESUMO.properties.items.items.additionalProperties).toBe(false);
  });

  it("as instruções proíbem interpretar e só marcam o que o laudo marca", () => {
    expect(INSTRUCOES_LEITURA).toMatch(/Não interprete/);
    expect(INSTRUCOES_LEITURA).toMatch(/flagged_in_report é true somente quando o próprio laudo marca/);
    expect(INSTRUCOES_LEITURA).toMatch(/Nunca calcule/);
  });
});

describe("GAL RN-08 · cota mensal", () => {
  it("mês civil no fuso dela: em São Paulo, 31/10 às 23h ainda é outubro", () => {
    const j = janelaDaCota(new Date("2026-11-01T01:30:00Z"), "America/Sao_Paulo");
    expect(j.inicio.toISOString()).toBe("2026-10-01T03:00:00.000Z");
    expect(j.renova.toISOString()).toBe("2026-11-01T03:00:00.000Z");
  });

  it("dezembro renova em janeiro do ano seguinte", () => {
    const j = janelaDaCota(new Date("2026-12-15T12:00:00Z"), "America/Sao_Paulo");
    expect(j.renova.toISOString()).toBe("2027-01-01T03:00:00.000Z");
  });

  it("restantes nunca negativas", () => {
    expect([cotaRestante(0), cotaRestante(19), cotaRestante(20), cotaRestante(25)]).toEqual([20, 1, 0, 0]);
  });
});

describe("GAL · plano e consentimento no servidor", () => {
  const agora = new Date("2026-10-07T12:00:00Z");
  it("premium: ativo, teste vigente ou cortesia vigente", () => {
    expect(familiaTemPlano({ plano: "ativo" }, agora)).toBe(true);
    expect(familiaTemPlano({ plano: "trial", trial_fim: "2026-10-08T00:00:00Z" }, agora)).toBe(true);
    expect(familiaTemPlano({ plano: "trial", trial_fim: "2026-10-06T00:00:00Z" }, agora)).toBe(false);
    expect(familiaTemPlano({ plano: "free", cortesia_fim: "2026-10-09T00:00:00Z" }, agora)).toBe(true);
    expect(familiaTemPlano({ plano: "free", cortesia_fim: "2026-10-01T00:00:00Z" }, agora)).toBe(false);
    expect(familiaTemPlano({ plano: "expirado" }, agora)).toBe(false);
    expect(familiaTemPlano({ plano: null }, agora)).toBe(false);
  });

  it("RN-05: consentimento é um instante real, não no futuro", () => {
    expect(consentimentoValido("2026-10-07T11:59:00Z", agora)).toBe(true);
    expect(consentimentoValido("2026-10-07T12:04:00Z", agora)).toBe(true); // folga de relógio
    expect(consentimentoValido("2026-10-08T00:00:00Z", agora)).toBe(false);
    expect([null, undefined, "", "ontem", 123, {}].some((v) => consentimentoValido(v, agora))).toBe(false);
  });
});
