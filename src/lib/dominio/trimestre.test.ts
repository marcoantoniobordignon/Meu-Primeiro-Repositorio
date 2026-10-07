import { describe, expect, it } from "vitest";

import a from "../../../supabase/seed/artigos-a.json";
import b from "../../../supabase/seed/artigos-b.json";
import { planejar, selecionarParaEnvio } from "@dominio/lembretes.ts";
import { inicioDaSemana } from "@dominio/tempo.ts";
import {
  artigoPublicavel,
  artigosDaAba,
  buscarArtigos,
  cardsDaHome,
  fracaoRolada,
  idDaLeitura,
  idDoArtigo,
  leituraConcluida,
  lembretesDeVirada,
  marcarVirada,
  numerosDoTrimestre,
  oQueEsperar,
  paraEstaSemana,
  podeLerArtigo,
  PRIORIDADE,
  semanasSemArtigo,
  temArtigoParaASemana,
  trimestreDaSemana,
  trimestreDosDias,
  viradaPendente,
  type Artigo,
  type CardHome,
} from "@dominio/trimestre.ts";

const semente = [...a, ...b] as Artigo[];
const artigos = semente.map((x) => ({ ...x, id: idDoArtigo(x.slug) }));
const cards = (r: { card: CardHome }[]) => r.map((c) => c.card);

describe("RN-01 · trimestre pela idade gestacional", () => {
  it("vira em 14s0d e 28s0d", () => {
    expect(trimestreDaSemana(13)).toBe(1);
    expect(trimestreDaSemana(14)).toBe(2);
    expect(trimestreDaSemana(27)).toBe(2);
    expect(trimestreDaSemana(28)).toBe(3);
    expect(trimestreDaSemana(41)).toBe(3);
    expect(trimestreDosDias(14 * 7 - 1)).toBe(1);
    expect(trimestreDosDias(14 * 7)).toBe(2);
    expect(trimestreDosDias(28 * 7)).toBe(3);
  });
});

describe("RN-02 · cards da home", () => {
  it("a tabela da spec, com 0 = não aparece", () => {
    expect(PRIORIDADE.plano_parto).toEqual([0, 20, 95]);
    expect(PRIORIDADE.mala).toEqual([0, 10, 80]);
    expect(Object.keys(PRIORIDADE)).toHaveLength(12);
  });

  it("critério: semana 10 mostra exames e medicamentos antes do plano de parto, que nem aparece", () => {
    const r = cards(cardsDaHome(trimestreDaSemana(10), { exames: "pendente", medicamentos: "vazio", plano_parto: "pendente", mala: "pendente" }));
    expect(r).toHaveLength(6);
    expect(r[0]).toBe("resumo");
    expect(r.indexOf("exames")).toBeLessThan(r.indexOf("medicamentos"));
    expect(r).not.toContain("plano_parto");
    expect(r).not.toContain("mala");
  });

  it("critério: semana 30 com plano e mala por fazer, os dois no topo", () => {
    const r = cards(cardsDaHome(trimestreDaSemana(30), { plano_parto: "pendente", mala: "pendente", consulta: "vazio", foto: "pendente", artigo: "pendente" }));
    expect(r.slice(0, 3)).toEqual(["resumo", "plano_parto", "mala"]);
  });

  it("+10 para ação pendente muda a ordem", () => {
    const sem = cards(cardsDaHome(2, {}));
    expect(sem.indexOf("foto")).toBeLessThan(sem.indexOf("marco"));
    const com = cards(cardsDaHome(2, { marco: "pendente" }));
    expect(com.indexOf("marco")).toBeLessThan(com.indexOf("foto"));
  });

  it("critério: card feito (foto da semana) desce para o fim, com o estado 'feito'", () => {
    const r = cardsDaHome(2, { foto: "feito", marco: "pendente", artigo: "pendente" });
    expect(r.at(-1)).toEqual({ card: "foto", estado: "feito", prioridade: 90 });
    expect(r.filter((c) => c.estado === "feito")).toHaveLength(1);
  });

  it("no máximo 6, o resumo sempre primeiro (mesmo com um card de 105)", () => {
    const r = cardsDaHome(3, { plano_parto: "pendente", mala: "pendente", consulta: "pendente", foto: "pendente", exames: "pendente", direitos: "pendente" });
    expect(r).toHaveLength(6);
    expect(r[0]!.card).toBe("resumo");
    expect(r[1]).toEqual({ card: "plano_parto", estado: "pendente", prioridade: 105 });
  });

  it("oculto não entra e não ocupa vaga", () => {
    const r = cards(cardsDaHome(1, { exames: "oculto", medicamentos: "oculto", nomes: "oculto" }));
    expect(r).toEqual(["resumo", "marco", "faq", "artigo", "consulta", "foto"]);
  });

  it("critério: conta nova sem dados mostra anel, artigo e estados vazios, sem buracos", () => {
    const r = cardsDaHome(1, { exames: "vazio", medicamentos: "vazio", marco: "vazio", foto: "pendente", consulta: "vazio", artigo: "pendente", nomes: "oculto" });
    expect(cards(r)).toContain("artigo");
    expect(r).toHaveLength(6);
    expect(r[0]!.card).toBe("resumo");
  });
});

describe("RN-03/04/08 · Para esta semana", () => {
  it("critério: 3 artigos; o que li sai e entra o próximo", () => {
    const s10 = paraEstaSemana(artigos, new Set(), 10);
    expect(s10).toHaveLength(3);
    expect(s10[0]!.slug).toBe("semana-10");
    expect(s10.every((x) => x.week_from <= 10 && 10 <= x.week_to)).toBe(true);
    const depois = paraEstaSemana(artigos, new Set([s10[0]!.id]), 10);
    expect(depois.map((x) => x.slug)).not.toContain("semana-10");
    expect(depois).toHaveLength(3);
    expect(depois.slice(0, 2)).toEqual(s10.slice(1));
  });

  it("ordem featured desc, position", () => {
    const l = [
      { id: "1", slug: "b", title: "", summary: "", body_md: "", week_from: 20, week_to: 20, reading_minutes: 1, featured: false, position: 1 },
      { id: "2", slug: "a", title: "", summary: "", body_md: "", week_from: 20, week_to: 20, reading_minutes: 1, featured: false, position: 2 },
      { id: "3", slug: "c", title: "", summary: "", body_md: "", week_from: 20, week_to: 20, reading_minutes: 1, featured: true, position: 9 },
    ];
    expect(paraEstaSemana(l, new Set(), 20).map((x) => x.id)).toEqual(["3", "1", "2"]);
  });

  it("faltando da semana, completa com não lidos do trimestre (os mais perto primeiro)", () => {
    const l = [
      { id: "s20", slug: "s20", title: "", summary: "", body_md: "", week_from: 20, week_to: 20, reading_minutes: 1, featured: true, position: 1 },
      { id: "s16", slug: "s16", title: "", summary: "", body_md: "", week_from: 16, week_to: 16, reading_minutes: 1, featured: true, position: 1 },
      { id: "s21", slug: "s21", title: "", summary: "", body_md: "", week_from: 21, week_to: 21, reading_minutes: 1, featured: true, position: 1 },
      { id: "s30", slug: "s30", title: "", summary: "", body_md: "", week_from: 30, week_to: 30, reading_minutes: 1, featured: true, position: 1 },
    ];
    expect(paraEstaSemana(l, new Set(), 20).map((x) => x.id)).toEqual(["s20", "s21", "s16"]);
    expect(paraEstaSemana(l, new Set(["s20", "s21", "s16"]), 20)).toEqual([]);
  });

  it("RN-08: sem artigo da semana, usa os do trimestre; sem nenhum, some", () => {
    expect(paraEstaSemana(artigos, new Set(), 2).length).toBe(3);
    expect(paraEstaSemana(artigos, new Set(), 2).every((x) => x.week_from <= 13)).toBe(true);
    expect(temArtigoParaASemana(artigos, 2)).toBe(true);
    expect(temArtigoParaASemana([], 20)).toBe(false);
    expect(temArtigoParaASemana(artigos.filter((x) => x.week_from >= 28), 10)).toBe(false);
  });

  it("RN-04: lido com 20 s ou 80% rolado", () => {
    expect(leituraConcluida({ segundos: 19.9, fracaoRolada: 0.79 })).toBe(false);
    expect(leituraConcluida({ segundos: 20, fracaoRolada: 0 })).toBe(true);
    expect(leituraConcluida({ segundos: 2, fracaoRolada: 0.8 })).toBe(true);
    expect(fracaoRolada({ topo: 600, alturaJanela: 200, alturaTotal: 1000 })).toBe(0.8);
    expect(fracaoRolada({ topo: 0, alturaJanela: 200, alturaTotal: 0 })).toBe(0);
  });

  it("ids estáveis: artigo pelo slug, leitura por pessoa e artigo", () => {
    expect(idDoArtigo("semana-10")).toBe(idDoArtigo("semana-10"));
    expect(idDaLeitura("p1", "a")).not.toBe(idDaLeitura("p2", "a"));
    expect(idDaLeitura("p1", "a")).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("RN-05/09/10/11 · biblioteca e conteúdo", () => {
  it("abas por trimestre, todas abertas, em ordem de semana", () => {
    const t3 = artigosDaAba(artigos, 3);
    expect(t3.every((x) => x.week_from >= 28)).toBe(true);
    expect(t3[0]!.slug).toBe("semana-28");
    expect(artigosDaAba(artigos, 1).length + artigosDaAba(artigos, 2).length + t3.length).toBe(artigos.length);
  });

  it("busca simples no título e no resumo, sem acento e sem caixa", () => {
    expect(buscarArtigos(artigos, "ACIDO folico").map((x) => x.slug)).toContain("acido-folico-e-suplementos");
    expect(buscarArtigos(artigos, "mala").map((x) => x.slug)).toContain("mala-da-maternidade");
    expect(buscarArtigos(artigos, "   ")).toEqual([]);
    expect(buscarArtigos(artigos, "xilofone")).toEqual([]);
  });

  it("RN-09: publicar exige revisor e data", () => {
    expect(artigoPublicavel({ reviewed_by: "Dra. Ana", reviewed_on: "2026-09-30" })).toBe(true);
    expect(artigoPublicavel({ reviewed_by: " ", reviewed_on: "2026-09-30" })).toBe(false);
    expect(artigoPublicavel({ reviewed_by: "Dra. Ana", reviewed_on: null })).toBe(false);
  });

  it("RN-11: premium só com plano; o resto é livre", () => {
    expect(podeLerArtigo({ is_premium: true }, false)).toBe(false);
    expect(podeLerArtigo({ is_premium: true }, true)).toBe(true);
    expect(podeLerArtigo({ is_premium: false }, false)).toBe(true);
    expect(podeLerArtigo({}, false)).toBe(true);
  });

  it("RN-10: a semente cobre da semana 4 à 40 e tem 6 gerais por trimestre", () => {
    expect(semanasSemArtigo(semente)).toEqual([]);
    for (const tri of [1, 2, 3] as const) {
      expect(semente.filter((x) => x.week_from !== x.week_to && trimestreDaSemana(x.week_from) === tri).length, `T${tri}`).toBeGreaterThanOrEqual(6);
    }
    expect(semanasSemArtigo(semente.filter((x) => x.slug !== "semana-17"))).toEqual([17]);
  });

  it("a semente respeita o modelo (limites, slug, semanas dentro de um trimestre)", () => {
    expect(new Set(semente.map((x) => x.slug)).size).toBe(semente.length);
    for (const x of semente) {
      expect(x.title.length, x.slug).toBeLessThanOrEqual(90);
      expect(x.summary.length, x.slug).toBeLessThanOrEqual(200);
      expect(x.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(x.week_to).toBeGreaterThanOrEqual(x.week_from);
      expect(trimestreDaSemana(x.week_to), x.slug).toBe(trimestreDaSemana(x.week_from));
      expect(x.reading_minutes).toBeGreaterThan(0);
      expect(x.body_md.length).toBeGreaterThan(200);
    }
  });
});

describe("RN-06 · virada de trimestre", () => {
  it("critério: na virada para o 2º, a tela aparece uma vez", () => {
    expect(viradaPendente({ semana: 13, t2Visto: false, t3Visto: false, semanaNaCriacao: 8 })).toBeNull();
    expect(viradaPendente({ semana: 14, t2Visto: false, t3Visto: false, semanaNaCriacao: 8 })).toBe(2);
    expect(viradaPendente({ semana: 14, t2Visto: true, t3Visto: false, semanaNaCriacao: 8 })).toBeNull();
  });

  it("critério: volto 6 semanas depois e a perdida aparece uma vez (só a do trimestre atual)", () => {
    expect(viradaPendente({ semana: 31, t2Visto: false, t3Visto: false, semanaNaCriacao: 8 })).toBe(3);
    const vistas = marcarVirada(3, {}, "2026-10-07T12:00:00Z");
    expect(vistas).toEqual({ t2: "2026-10-07T12:00:00Z", t3: "2026-10-07T12:00:00Z" });
    expect(viradaPendente({ semana: 31, t2Visto: Boolean(vistas.t2), t3Visto: Boolean(vistas.t3), semanaNaCriacao: 8 })).toBeNull();
    expect(marcarVirada(2, { t2: null }, "x")).toEqual({ t2: "x", t3: null });
    expect(marcarVirada(3, { t2: "antes" }, "x")).toEqual({ t2: "antes", t3: "x" });
  });

  it("quem entra no app já no trimestre não vê a celebração dele", () => {
    expect(viradaPendente({ semana: 20, t2Visto: false, t3Visto: false, semanaNaCriacao: 20 })).toBeNull();
    expect(viradaPendente({ semana: 28, t2Visto: false, t3Visto: false, semanaNaCriacao: 20 })).toBe(3);
    expect(viradaPendente({ semana: 20, t2Visto: false, t3Visto: false, semanaNaCriacao: null })).toBe(2);
  });

  it("números do trimestre: fotos, marcos e consultas feitas dentro dele", () => {
    const dpp = "2027-03-08";
    const ini2 = inicioDaSemana(dpp, 14);
    const n = numerosDoTrimestre(1, {
      dpp,
      tz: "America/Sao_Paulo",
      fotos: [{ gest_week: 10 }, { gest_week: 13 }, { gest_week: 14 }, { gest_week: 12, apagado_em: "x" }],
      entradas: [
        { milestone_code: "positivo", entry_date: inicioDaSemana(dpp, 5) },
        { milestone_code: null, entry_date: inicioDaSemana(dpp, 6) },
        { milestone_code: "batimento", entry_date: ini2 },
      ],
      consultas: [
        { starts_at: `${inicioDaSemana(dpp, 8)}T13:00:00Z`, status: "done" },
        { starts_at: `${inicioDaSemana(dpp, 9)}T13:00:00Z`, status: "scheduled" },
        // 01:00 UTC do primeiro dia da semana 14 ainda é a semana 13 em São Paulo.
        { starts_at: `${ini2}T01:00:00Z`, status: "done" },
        { starts_at: `${ini2}T13:00:00Z`, status: "done" },
      ],
    });
    expect(n).toEqual({ fotos: 2, marcos: 1, consultas: 2 });
  });

  it("'o que esperar': 3 gerais do novo trimestre", () => {
    const l = oQueEsperar(artigos, 2);
    expect(l).toHaveLength(3);
    expect(l.every((x) => x.week_from === 14 && x.week_to === 27)).toBe(true);
    expect(oQueEsperar(artigos.filter((x) => x.week_from === x.week_to), 3).map((x) => x.slug)).toEqual(["semana-28", "semana-29", "semana-30"]);
  });

  it("push trimester_turn no dia da virada às 09:00 local, uma vez", () => {
    const dpp = "2027-03-08";
    const l = lembretesDeVirada({ dpp, tz: "America/Sao_Paulo", criadaEm: "2026-07-01T12:00:00Z" });
    expect(l.map((x) => x.chave)).toEqual(["trimester:2", "trimester:3"]);
    expect(l[0]!.em.toISOString()).toBe(`${inicioDaSemana(dpp, 14)}T12:00:00.000Z`);
    expect(l[0]!.url).toBe("/virada?t=2&origem=lembrete&categoria=trimester");
    expect(l[0]!.tipo).toBe("trimester_turn");
    // Criada depois da virada do 2º: só a do 3º.
    expect(lembretesDeVirada({ dpp, tz: "America/Sao_Paulo", criadaEm: `${inicioDaSemana(dpp, 15)}T12:00:00Z` }).map((x) => x.chave)).toEqual(["trimester:3"]);
    expect(lembretesDeVirada({ dpp: null, tz: "UTC", criadaEm: "2026-07-01T12:00:00Z" })).toEqual([]);
  });

  it("o planejador inclui a virada e o envio não repete", () => {
    const dpp = "2027-03-08";
    const agora = new Date(`${inicioDaSemana(dpp, 14)}T12:05:00Z`);
    const base = { agora, tz: "America/Sao_Paulo", dpp, criadaEm: "2026-07-01T12:00:00Z", prefs: {}, medicamentos: [], doses: [], exames: [], consultas: [], perguntas: [], semanasComFoto: [], marcos: { respondidos: [], estados: [] } };
    const saem = selecionarParaEnvio(planejar(base), { agora, tz: base.tz, prefs: {}, enviados: [] }).filter((x) => x.categoria === "trimester");
    expect(saem.map((x) => x.chave)).toEqual(["trimester:2"]);
    const deNovo = selecionarParaEnvio(planejar(base), { agora, tz: base.tz, prefs: {}, enviados: [{ chave: "trimester:2", categoria: "trimester", ref: "t2", enviado_em: agora.toISOString() }] });
    expect(deNovo.filter((x) => x.categoria === "trimester")).toEqual([]);
    const amanha = new Date(agora.getTime() + 86_400_000);
    expect(selecionarParaEnvio(planejar({ ...base, agora: amanha }), { agora: amanha, tz: base.tz, prefs: {}, enviados: [] }).filter((x) => x.categoria === "trimester")).toEqual([]);
  });
});
