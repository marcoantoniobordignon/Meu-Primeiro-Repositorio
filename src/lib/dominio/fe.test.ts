import { describe, expect, it } from "vitest";

import semente from "../../../supabase/seed/oracoes.json";
import { paraOGa, ROTAS_DE_FE, VALORES_DE_FE } from "@/lib/analytics";
import { concluir, estadoInicial } from "@/lib/onboarding/estado";
import { CATALOGO_MARCOS } from "@dominio/diario.ts";
import {
  ajustarFonte,
  buscarOracoes,
  diaDoSanto,
  FONTE_MAX,
  FONTE_MIN,
  itensDoBatismo,
  itensParaEnviar,
  lembreteDoBatismo,
  linkDoVerbum,
  oracaoDaSemana,
  oracaoPublicavel,
  oracoesDaAba,
  semanaDaOracao,
  somarPendente,
  textoParaCompartilhar,
  type Oracao,
} from "@dominio/fe.ts";
import { planejar, type EstadoParaLembretes } from "@dominio/lembretes.ts";
import { inicioDaSemana, instanteLocal } from "@dominio/tempo.ts";
import { cardsDaHome } from "@dominio/trimestre.ts";

const oracoes = semente as Oracao[];
const SP = "America/Sao_Paulo";
const DPP = "2027-03-08";

describe("RN-03 · oração da semana", () => {
  it("week = min(semana, 40); antes da 1, a 1", () => {
    expect(semanaDaOracao(12)).toBe(12);
    expect(semanaDaOracao(41)).toBe(40);
    expect(semanaDaOracao(0)).toBe(1);
  });

  it("critério: volto meses depois e vejo a da semana atual, ou a 40 se passou", () => {
    expect(oracaoDaSemana(oracoes, 22)?.week).toBe(22);
    expect(oracaoDaSemana(oracoes, 42)?.week).toBe(40);
  });

  it("RN-03: a semente tem as 40 semanais, uma por semana", () => {
    const semanais = oracoes.filter((o) => o.kind === "weekly").map((o) => o.week).sort((a, b) => a! - b!);
    expect(semanais).toEqual(Array.from({ length: 40 }, (_, i) => i + 1));
  });

  it("a semente respeita o modelo e traz a lista de lançamento", () => {
    expect(new Set(oracoes.map((o) => o.slug)).size).toBe(oracoes.length);
    for (const o of oracoes) {
      expect(o.body.length, o.slug).toBeLessThanOrEqual(1200);
      expect(o.title.length, o.slug).toBeLessThanOrEqual(80);
      expect(o.source_label.trim().length, o.slug).toBeGreaterThan(0);
      expect(o.kind === "weekly", o.slug).toBe(o.week !== null);
      if (o.saint_day) expect(o.saint_day).toMatch(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
    }
    const titulos = oracoes.map((o) => o.title);
    for (const t of ["Ave-Maria", "Magnificat", "Nossa Senhora do Bom Parto", "São Gerardo Majella", "Santa Gianna Beretta Molla", "São José"]) {
      expect(titulos.some((x) => x.includes(t)), t).toBe(true);
    }
    expect(oracoes.find((o) => o.title.includes("Gerardo"))?.saint_day).toBe("10-16");
    expect(oracoes.find((o) => o.title.includes("Gianna"))?.saint_day).toBe("04-28");
    expect(oracoes.find((o) => o.title.includes("São José"))?.saint_day).toBe("03-19");
    expect(oracoes.filter((o) => o.kind === "blessing")).toHaveLength(1);
  });
});

describe("RN-04/05 · biblioteca", () => {
  it("abas em ordem e busca por título, texto e santo, sem acento", () => {
    expect(oracoesDaAba(oracoes, "intercessor").map((o) => o.kind)).toEqual(["intercessor", "intercessor", "intercessor", "intercessor"]);
    expect(buscarOracoes(oracoes, "sao jose").some((o) => o.title.includes("São José"))).toBe(true);
    expect(buscarOracoes(oracoes, "   ")).toEqual([]);
  });

  it("fonte de 16 a 28 px", () => {
    expect(ajustarFonte(FONTE_MAX, 2)).toBe(28);
    expect(ajustarFonte(FONTE_MIN, -2)).toBe(16);
    expect(ajustarFonte(18, 2)).toBe(20);
  });

  it("RN-05: publicar exige fonte, revisor e data", () => {
    expect(oracaoPublicavel({ source_label: "Lc 1,46-55", reviewed_by: "Pe. João", reviewed_on: "2026-09-30" })).toBe(true);
    expect(oracaoPublicavel({ source_label: "Lc 1,46-55", reviewed_by: null, reviewed_on: null })).toBe(false);
    expect(oracaoPublicavel({ source_label: " ", reviewed_by: "Pe. João", reviewed_on: "2026-09-30" })).toBe(false);
  });

  it("dia do santo por extenso e texto para compartilhar com a fonte", () => {
    expect(diaDoSanto("10-16")).toBe("16 de outubro");
    expect(diaDoSanto(null)).toBeNull();
    expect(textoParaCompartilhar({ title: "Ave-Maria", body: "Ave Maria", source_label: "Oração tradicional" })).toBe("Ave-Maria\n\nAve Maria\n\nOração tradicional. Via Ninho.");
  });

  it("RN-09: link do Verbum com UTM; sem endereço configurado, sem card", () => {
    expect(linkDoVerbum("https://exemplo.app/evangelho")).toBe("https://exemplo.app/evangelho?utm_source=ninho&utm_medium=app&utm_campaign=evangelho_do_dia");
    expect(linkDoVerbum(undefined)).toBeNull();
    expect(linkDoVerbum("não é url")).toBeNull();
  });
});

describe("RN-01/02 · ligar e desligar", () => {
  it("RN-01: só 'Sim' liga no onboarding; 'Decidir depois', 'Não' e pular deixam desligado", () => {
    const base = { ...estadoInicial(), tela: 8, dpp: DPP };
    expect(concluir({ ...base, fe: "sim" }, true).prefs?.faith_mode).toBe(true);
    expect(concluir({ ...base, fe: "depois" }, true).prefs?.faith_mode).toBe(false);
    expect(concluir({ ...base, fe: "nao" }, true).prefs?.faith_mode).toBe(false);
    expect(concluir(base, true).prefs?.faith_mode).toBe(false);
  });

  it("RN-02: a oração entra na posição 3 em todos os trimestres, dentro do limite de 6", () => {
    for (const tri of [1, 2, 3] as const) {
      const r = cardsDaHome(tri, {}, undefined, { oracao: true });
      expect(r).toHaveLength(6);
      expect(r[2]!.card, `T${tri}`).toBe("oracao");
      expect(r[0]!.card).toBe("resumo");
    }
    expect(cardsDaHome(2, {}).map((c) => c.card)).not.toContain("oracao");
  });
});

describe("RN-07/08 · batismo e push", () => {
  it("os 6 itens do batismo, com ids estáveis", () => {
    const a = itensDoBatismo("mae-1");
    expect(a.map((i) => i.title)).toEqual(["Conversar com a paróquia", "Escolher os padrinhos", "Definir a data", "Confirmar com a paróquia os documentos exigidos", "Roupa e vela de batismo", "Convidar a família"]);
    expect(a.every((i) => i.list === "baptism")).toBe(true);
    expect(itensDoBatismo("mae-1").map((i) => i.id)).toEqual(a.map((i) => i.id));
    expect(itensDoBatismo("mae-2")[0]!.id).not.toBe(a[0]!.id);
  });

  it("RN-07: lembrete único aos 14 dias do nascimento, às 10:00, só com o modo ligado", () => {
    const [l] = lembreteDoBatismo({ nascidoEm: "2027-03-01", tz: SP, modoFe: true });
    expect(l!.em.toISOString()).toBe(instanteLocal("2027-03-15", "10:00", SP).toISOString());
    expect(l!.tipo).toBe("faith_baptism_nudge");
    expect(l!.titulo).toBe("Quando pensar no batismo?");
    expect(l!.chave).toBe("faith:baptism");
    expect(lembreteDoBatismo({ nascidoEm: "2027-03-01", tz: SP, modoFe: false })).toEqual([]);
    expect(lembreteDoBatismo({ nascidoEm: null, tz: SP, modoFe: true })).toEqual([]);
  });

  const estado = (p: Partial<EstadoParaLembretes>): EstadoParaLembretes => ({
    agora: new Date(),
    tz: SP,
    dpp: DPP,
    criadaEm: "2026-07-01T12:00:00Z",
    prefs: {},
    medicamentos: [],
    doses: [],
    exames: [],
    consultas: [],
    perguntas: [],
    semanasComFoto: [],
    marcos: { respondidos: [], estados: [] },
    ...p,
  });

  it("critério: registro o nascimento e 14 dias depois o planejador manda o lembrete", () => {
    const agora = instanteLocal("2027-03-15", "10:00", SP);
    const fe = planejar(estado({ agora, dpp: null, nascidoEm: "2027-03-01", prefs: { faith_mode: true } })).filter((l) => l.categoria === "faith");
    expect(fe.map((l) => l.tipo)).toEqual(["faith_baptism_nudge"]);
    expect(planejar(estado({ agora, dpp: null, nascidoEm: "2027-03-01", prefs: { faith_mode: false } })).filter((l) => l.categoria === "faith")).toEqual([]);
  });

  it("RN-08: sem a chave de Ajustes, nenhuma oração no push", () => {
    const agora = new Date(`${inicioDaSemana(DPP, 20)}T13:30:00Z`);
    const l = planejar(estado({ agora, prefs: { faith_mode: true } }));
    expect(l.filter((x) => x.categoria === "faith")).toEqual([]);
    expect(l.some((x) => x.corpo.includes("oração"))).toBe(false);
  });

  it("RN-08: com a chave, a oração vai embutida no week_turn da barriga", () => {
    const agora = new Date(`${inicioDaSemana(DPP, 20)}T13:30:00Z`);
    // Fotos nas semanas anteriores: os avisos da barriga não estão pausados (spec 05 RN-05).
    const l = planejar(estado({ agora, semanasComFoto: [17, 18, 19], prefs: { faith_mode: true, faith_weekly_push: true } }));
    const virada = l.find((x) => x.tipo === "week_turn" && x.ref === "semana-20")!;
    expect(virada.categoria).toBe("belly");
    expect(virada.corpo).toContain("A oração da semana já está no app.");
    expect(l.filter((x) => x.categoria === "faith")).toEqual([]);
  });

  it("RN-08: sem o aviso da barriga naquela semana, a virada ganha um aviso próprio às 10:00", () => {
    const agora = new Date(`${inicioDaSemana(DPP, 20)}T13:30:00Z`);
    const l = planejar(estado({ agora, semanasComFoto: [20], prefs: { faith_mode: true, faith_weekly_push: true, belly_reminders: false } }));
    const [proprio] = l.filter((x) => x.categoria === "faith");
    expect(proprio!.tipo).toBe("week_turn");
    expect(proprio!.em.toISOString()).toBe(instanteLocal(inicioDaSemana(DPP, 20), "10:00", SP).toISOString());
    expect(proprio!.url).toContain("/fe/oracao?semana=20");
  });
});

describe("RN-10 · nada do modo fé no GA4", () => {
  it("telas de fé não mandam evento nenhum", () => {
    expect(paraOGa("/fe", { a: 1 })).toBeNull();
    expect(paraOGa("/fe/oracao", { a: 1 })).toBeNull();
    expect(paraOGa("/feira", { a: 1 })).toEqual({ a: 1 });
    expect(ROTAS_DE_FE.test("/fe/batismo")).toBe(true);
  });

  it("valores de fé viram 'oculto' em qualquer evento (marco da oração, lista do batismo, card)", () => {
    expect(paraOGa("/diario", { milestone_code: "first_prayer", photos: 0 })).toEqual({ milestone_code: "oculto", photos: 0 });
    expect(paraOGa("/plano-parto/listas", { list: "baptism" })).toEqual({ list: "oculto" });
    expect(paraOGa("/hoje", { card: "oracao", position: 3 })).toEqual({ card: "oculto", position: 3 });
  });

  it("todo marco só de fé do catálogo está na lista de bloqueio", () => {
    for (const m of CATALOGO_MARCOS.filter((x) => x.faith_only)) expect(VALORES_DE_FE.has(m.code), m.code).toBe(true);
  });

  it("contadores: só dia, chave e contagem, no máximo 100 por dia", () => {
    let p = somarPendente({}, "2026-10-07", "faith_on");
    p = somarPendente(p, "2026-10-07", "faith_on");
    p = somarPendente(p, "2026-10-08", "prayer_viewed");
    expect(itensParaEnviar(p)).toEqual([
      { dia: "2026-10-07", chave: "faith_on", n: 2 },
      { dia: "2026-10-08", chave: "prayer_viewed", n: 1 },
    ]);
    for (let i = 0; i < 150; i++) p = somarPendente(p, "2026-10-09", "library_opened");
    expect(itensParaEnviar(p).find((x) => x.chave === "library_opened")?.n).toBe(100);
  });
});
