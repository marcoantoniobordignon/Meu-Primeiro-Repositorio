import { beforeEach, describe, expect, it } from "vitest";

import { userExams, type UserExam } from "@/lib/dados/colecoes";
import {
  CATALOGO_EXAMES,
  diasAteFimDaJanela,
  duplicadosDoCatalogo,
  gerarExamesPadrao,
  janelaDoExame,
  nomeDoExame,
  recalcularJanelas,
} from "@dominio/exames.ts";
import { dppDaDum } from "@/lib/dates";
import { somarDiasISO } from "@dominio/tempo.ts";

import { adicionarDoCatalogo, concluirExame, criarPersonalizado, desmarcarExame, dispensarExame, manterExames, marcarExame, restaurarExame } from "./acoes";
import {
  agruparPorSecao,
  exameParaPerguntar,
  extrasDisponiveis,
  foraDaJanela,
  instanteDaMarcacao,
  janelaPersonalizadaValida,
  nomePersonalizadoValido,
  secaoDoExame,
  validarMarcacao,
} from "./regras";

const SP = "America/Sao_Paulo";
const DUM = "2026-06-01";
const DPP = dppDaDum(DUM); // 2027-03-08
const semana = (s: number, d = 0) => somarDiasISO(DUM, s * 7 + d);

function completo(e: ReturnType<typeof gerarExamesPadrao>[number]): UserExam {
  return { ...e, location: null, notes: null, document_id: null, done_on: e.done_on ?? null, atualizado_em: "" };
}

describe("EXA · catálogo", () => {
  it("13 sementes; 9 padrão; janelas da tabela em dias desde a DUM", () => {
    expect(CATALOGO_EXAMES).toHaveLength(13);
    expect(CATALOGO_EXAMES.filter((c) => c.is_default_on).map((c) => c.code)).toEqual(["us_dating", "blood_1", "urine_1", "nuchal", "morpho", "ogtt", "blood_3", "urine_3", "gbs"]);
    const j = Object.fromEntries(CATALOGO_EXAMES.map((c) => [c.code, [c.window_start_day, c.window_end_day]]));
    expect(j).toEqual({
      us_dating: [42, 76],
      blood_1: [42, 97],
      urine_1: [42, 97],
      nuchal: [77, 97],
      morpho: [140, 174],
      ogtt: [168, 202],
      blood_3: [196, 230],
      urine_3: [196, 244],
      gbs: [245, 265],
      coombs: [196, 209],
      fetal_echo: [168, 202],
      us_growth: [224, 258],
      ctg: [252, 286],
    });
  });

  it("descrições curtas (≤ 140) e códigos únicos", () => {
    for (const c of CATALOGO_EXAMES) expect(c.short_desc.length, c.code).toBeLessThanOrEqual(140);
    expect(new Set(CATALOGO_EXAMES.map((c) => c.code)).size).toBe(13);
  });
});

describe("EXA RN-01/02 · geração e janelas", () => {
  it("janela = lmp + dias; o fim inclui o último dia da semana", () => {
    expect(janelaDoExame({ catalog_code: "morpho", window_start_week: null, window_end_week: null }, DPP)).toEqual({ inicio: semana(20), fim: semana(24, 6) });
  });

  it("criada na semana 20: os do 1º trimestre entram como janela passada", () => {
    const l = gerarExamesPadrao(DPP, semana(20), "u");
    expect(l).toHaveLength(9);
    const passados = l.filter((e) => e.past_window).map((e) => e.catalog_code);
    expect(passados).toEqual(["us_dating", "blood_1", "urine_1", "nuchal"]);
    expect(l.every((e) => e.status === "to_schedule")).toBe(true);
  });

  it("ids determinísticos por semente e código (gerar de novo não duplica)", () => {
    expect(gerarExamesPadrao(DPP, semana(9), "u").map((e) => e.id)).toEqual(gerarExamesPadrao(DPP, semana(9), "u").map((e) => e.id));
    expect(gerarExamesPadrao(DPP, semana(9), "u")[0]!.id).not.toBe(gerarExamesPadrao(DPP, semana(9), "v")[0]!.id);
  });

  it("mudar a DUM recalcula só os não concluídos e só o que mudou", () => {
    const l = gerarExamesPadrao(DPP, semana(9), "u");
    const feito = { ...l[0]!, status: "done" as const };
    const lista = [feito, ...l.slice(1)];
    expect(recalcularJanelas(lista, DPP, semana(9))).toEqual([]);
    const novaDpp = somarDiasISO(DPP, 7);
    const mudados = recalcularJanelas(lista, novaDpp, semana(9));
    expect(mudados).toHaveLength(8);
    expect(mudados.find((e) => e.catalog_code === "morpho")!.window_start_date).toBe(somarDiasISO(semana(20), 7));
    expect(mudados.some((e) => e.id === feito.id)).toBe(false);
  });

  it("exame personalizado: janela opcional em semanas; sem janela, nulo", () => {
    expect(janelaDoExame({ catalog_code: null, window_start_week: 30, window_end_week: 32 }, DPP)).toEqual({ inicio: semana(30), fim: semana(32, 6) });
    expect(janelaDoExame({ catalog_code: null, window_start_week: 30, window_end_week: null }, DPP)).toEqual({ inicio: semana(30), fim: semana(30, 6) });
    expect(janelaDoExame({ catalog_code: null, window_start_week: null, window_end_week: null }, DPP)).toEqual({ inicio: null, fim: null });
  });

  it("duplicados do catálogo: fica o mais avançado", () => {
    const [a] = gerarExamesPadrao(DPP, semana(9), "u");
    const [b] = gerarExamesPadrao(DPP, semana(9), "v");
    expect(duplicadosDoCatalogo([a!, { ...b!, status: "done" }])).toEqual([a!.id]);
    expect(duplicadosDoCatalogo([a!, { ...b!, apagado_em: "x" }])).toEqual([]);
    const ids = [a!.id, b!.id].sort();
    expect(duplicadosDoCatalogo([a!, b!])).toEqual([ids[1]]);
  });
});

describe("EXA · seções de 'Meus exames'", () => {
  it("criada na semana 9: translucência nucal em 'Agora' e morfológico em 'Próximos'", () => {
    const hoje = semana(9);
    const g = agruparPorSecao(gerarExamesPadrao(DPP, hoje, "u").map(completo), hoje);
    // Ordem: fim da janela, depois nome.
    expect(g.agora.map((e) => e.catalog_code)).toEqual(["us_dating", "blood_1", "nuchal", "urine_1"]);
    expect(g.proximos.map((e) => e.catalog_code)).toEqual(["morpho", "ogtt", "blood_3", "urine_3", "gbs"]);
    expect(g.anteriores).toEqual([]);
  });

  it("criada na semana 20: os do 1º trimestre em 'Anteriores'", () => {
    const hoje = semana(20);
    const g = agruparPorSecao(gerarExamesPadrao(DPP, hoje, "u").map(completo), hoje);
    expect(g.anteriores.map((e) => e.catalog_code).sort()).toEqual(["blood_1", "nuchal", "urine_1", "us_dating"]);
    expect(g.agora.map((e) => e.catalog_code)).toEqual(["morpho"]);
  });

  it("volta depois de semanas: janela fechada vira 'Anteriores', não pendente eterno", () => {
    const e = completo(gerarExamesPadrao(DPP, semana(9), "u").find((x) => x.catalog_code === "nuchal")!);
    expect(secaoDoExame(e, semana(13, 6))).toBe("agora");
    expect(secaoDoExame(e, semana(14))).toBe("anteriores");
  });

  it("limite de 'Agora': janela abrindo em até 14 dias", () => {
    const e = completo(gerarExamesPadrao(DPP, semana(9), "u").find((x) => x.catalog_code === "morpho")!);
    expect(secaoDoExame(e, semana(17, 6))).toBe("proximos");
    expect(secaoDoExame(e, semana(18))).toBe("agora");
  });

  it("estados mandam: marcado, feito, dispensado; personalizado sem janela em 'Agora'", () => {
    const e = completo(gerarExamesPadrao(DPP, semana(9), "u")[0]!);
    expect(secaoDoExame({ ...e, status: "scheduled" }, semana(30))).toBe("marcados");
    expect(secaoDoExame({ ...e, status: "done" }, semana(30))).toBe("feitos");
    expect(secaoDoExame({ ...e, status: "dismissed" }, semana(30))).toBe("dispensados");
    expect(secaoDoExame({ ...e, catalog_code: null, custom_name: "Vitamina D", window_start_date: null, window_end_date: null }, semana(30))).toBe("agora");
  });
});

describe("EXA RN-06 · marcar", () => {
  const agora = new Date("2026-10-06T15:00:00.000Z"); // 12:00 em SP

  it("data obrigatória, hora opcional, passado não", () => {
    expect(validarMarcacao({ data: "", hora: "" }, agora, SP)).toBe("sem_data");
    expect(validarMarcacao({ data: "2026-10-05", hora: "" }, agora, SP)).toBe("passado");
    expect(validarMarcacao({ data: "2026-10-06", hora: "11:00" }, agora, SP)).toBe("passado");
    expect(validarMarcacao({ data: "2026-10-06", hora: "" }, agora, SP)).toBeNull();
    expect(validarMarcacao({ data: "2026-10-06", hora: "13:00" }, agora, SP)).toBeNull();
    expect(validarMarcacao({ data: "2026-12-01", hora: "07:30" }, agora, SP)).toBeNull();
  });

  it("fora da janela é permitido, com aviso", () => {
    const e = { window_start_date: "2026-10-10", window_end_date: "2026-10-20" };
    expect(foraDaJanela(e, "2026-10-09")).toBe(true);
    expect(foraDaJanela(e, "2026-10-10")).toBe(false);
    expect(foraDaJanela(e, "2026-10-20")).toBe(false);
    expect(foraDaJanela(e, "2026-10-21")).toBe(true);
    expect(foraDaJanela({ window_start_date: null, window_end_date: null }, "2030-01-01")).toBe(false);
  });

  it("instante gravado: hora local; dia todo, meio-dia local", () => {
    expect(instanteDaMarcacao({ data: "2026-10-10", hora: "07:30" }, SP)).toEqual({ scheduled_at: "2026-10-10T10:30:00.000Z", scheduled_all_day: false });
    expect(instanteDaMarcacao({ data: "2026-10-10", hora: "" }, SP)).toEqual({ scheduled_at: "2026-10-10T15:00:00.000Z", scheduled_all_day: true });
  });

  it("dias até o fim da janela (evento)", () => {
    expect(diasAteFimDaJanela({ window_end_date: "2026-10-20" }, "2026-10-10")).toBe(10);
    expect(diasAteFimDaJanela({ window_end_date: null }, "2026-10-10")).toBeNull();
  });
});

describe("EXA RN-09/11 · personalizado e card de ontem", () => {
  it("nome de 3 a 60 caracteres; janela em semanas de 4 a 42, início antes do fim", () => {
    expect(nomePersonalizadoValido("  ab ")).toBe(false);
    expect(nomePersonalizadoValido("TSH")).toBe(true);
    expect(nomePersonalizadoValido("x".repeat(61))).toBe(false);
    expect(janelaPersonalizadaValida(null, null)).toBe(true);
    expect(janelaPersonalizadaValida(10, 12)).toBe(true);
    expect(janelaPersonalizadaValida(12, 10)).toBe(false);
    expect(janelaPersonalizadaValida(3, 10)).toBe(false);
    expect(janelaPersonalizadaValida(10, 43)).toBe(false);
  });

  it("marcado com a data de ontem (ou antes) sem ação: o mais antigo", () => {
    const base = completo(gerarExamesPadrao(DPP, semana(9), "u")[0]!);
    const agora = new Date("2026-10-06T15:00:00.000Z");
    const ontem = { ...base, id: "a", status: "scheduled" as const, scheduled_at: "2026-10-05T12:00:00.000Z" };
    const hojeCedo = { ...base, id: "b", status: "scheduled" as const, scheduled_at: "2026-10-06T10:00:00.000Z" };
    const semanaPassada = { ...base, id: "c", status: "scheduled" as const, scheduled_at: "2026-09-29T12:00:00.000Z" };
    expect(exameParaPerguntar([hojeCedo], agora, SP)).toBeUndefined();
    expect(exameParaPerguntar([hojeCedo, ontem], agora, SP)?.id).toBe("a");
    expect(exameParaPerguntar([ontem, semanaPassada], agora, SP)?.id).toBe("c");
    expect(exameParaPerguntar([{ ...ontem, status: "done" }], agora, SP)).toBeUndefined();
  });
});

describe("EXA · ações na coleção", () => {
  beforeEach(() => {
    localStorage.clear();
    userExams.limpar();
  });
  const ctx = { dpp: DPP, criadaEm: semana(9), semente: "u", tz: SP };
  const agora = new Date(`${semana(9)}T15:00:00.000Z`);

  it("manter: gera uma vez, nunca vazia, e recalcula com a DUM nova sem duplicar", () => {
    manterExames(ctx, agora);
    manterExames(ctx, agora);
    expect(userExams.listar()).toHaveLength(9);
    const novaDpp = somarDiasISO(DPP, -7);
    manterExames({ ...ctx, dpp: novaDpp }, agora);
    expect(userExams.listar()).toHaveLength(9);
    expect(userExams.listar().find((e) => e.catalog_code === "morpho")!.window_start_date).toBe(somarDiasISO(semana(20), -7));
  });

  it("dispensar e restaurar; marcar, concluir com documento; remarcar", () => {
    manterExames(ctx, agora);
    const e = userExams.listar().find((x) => x.catalog_code === "nuchal")!;
    expect(dispensarExame(e).status).toBe("dismissed");
    expect(restaurarExame(userExams.obter(e.id)!, agora).status).toBe("to_schedule");
    const marcado = marcarExame(userExams.obter(e.id)!, { data: semana(12), hora: "08:00" }, SP, { location: "Lab", notes: null });
    expect(marcado).toMatchObject({ status: "scheduled", scheduled_all_day: false, location: "Lab" });
    expect(restaurarExame(dispensarExame(marcado), agora).status).toBe("scheduled");
    expect(desmarcarExame(marcado)).toMatchObject({ status: "to_schedule", scheduled_at: null });
    expect(concluirExame(marcado, semana(12), "doc-1")).toMatchObject({ status: "done", done_on: semana(12), document_id: "doc-1" });
    expect(concluirExame(marcado, null)).toMatchObject({ status: "done", done_on: null });
  });

  it("outros exames comuns e 'Criar o meu'", () => {
    manterExames(ctx, agora);
    expect(extrasDisponiveis(userExams.listar()).map((c) => c.code)).toEqual(["coombs", "fetal_echo", "us_growth", "ctg"]);
    const coombs = adicionarDoCatalogo("coombs", ctx, agora);
    expect(nomeDoExame(coombs)).toBe("Coombs indireto");
    expect(extrasDisponiveis(userExams.listar())).toHaveLength(3);
    const meu = criarPersonalizado("  Vitamina D ", { inicio: 30, fim: null }, ctx, agora);
    expect(meu).toMatchObject({ custom_name: "Vitamina D", catalog_code: null, window_start_date: semana(30), window_end_date: semana(30, 6) });
  });
});
