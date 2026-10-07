import { describe, expect, it } from "vitest";

import bruto from "../../../supabase/seed/direitos.json";
import {
  buscarDireitos,
  cartaoPublicavel,
  linkTelefone,
  mostrarAtualizado,
  ordenarCartoes,
  paraEstaFase,
  precisaConferir,
  radical,
  telefoneLegivel,
  TEMAS_DIREITOS,
  textoParaCompartilhar,
  visivelPara,
  type CanalDeAjuda,
  type CartaoDireito,
} from "@dominio/direitos.ts";

const { cards, channels } = bruto as { cards: CartaoDireito[]; channels: CanalDeAjuda[] };
const slugs = (l: { slug: string }[]) => l.map((c) => c.slug);

describe("RN-04 · busca", () => {
  it("critério: 'demissão' acha o cartão de estabilidade, com a base legal", () => {
    const r = buscarDireitos(cards, "demissão");
    expect(slugs(r)).toContain("estabilidade-gestante");
    expect(r.find((c) => c.slug === "estabilidade-gestante")!.legal_basis[0]).toContain("ADCT art. 10");
  });

  it("radical simples, sem acento: 'demissao', 'acompanhantes', 'gratuita'", () => {
    expect(slugs(buscarDireitos(cards, "demissao"))).toContain("estabilidade-gestante");
    expect(slugs(buscarDireitos(cards, "acompanhantes"))).toContain("acompanhante-no-parto");
    expect(radical("Demissão")).toBe(radical("demissao"));
  });

  it("filtro por tema, sozinho ou com texto; nada bate, nada volta", () => {
    expect(buscarDireitos(cards, "", "benefits").map((c) => c.topic)).toEqual(["benefits"]);
    expect(buscarDireitos(cards, "acompanhante", "work")).toEqual([]);
    expect(buscarDireitos(cards, "", null)).toEqual([]);
    expect(buscarDireitos(cards, "xilofone")).toEqual([]);
  });
});

describe("RN-03 · Para esta fase", () => {
  it("critério: na semana 28 a home sugere o cartão do acompanhante (até 2)", () => {
    const r = paraEstaFase(cards, 28);
    expect(r.length).toBeLessThanOrEqual(2);
    expect(r[0]!.slug).toBe("acompanhante-no-parto");
  });

  it("dispensado não volta; fora da janela não entra; sem semana não entra", () => {
    expect(slugs(paraEstaFase(cards, 28, ["acompanhante-no-parto"]))).not.toContain("acompanhante-no-parto");
    expect(paraEstaFase(cards, 2)).toEqual([]);
    expect(slugs(paraEstaFase(cards, 40, [], 50))).not.toContain("teste-de-gravidez");
    for (const c of paraEstaFase(cards, 10, [], 50)) expect(c.week_from! <= 10 && 10 <= c.week_to!).toBe(true);
  });
});

describe("RN-01/02/09 · revisão e selos", () => {
  it("RN-01: publicar exige base legal, revisor e data", () => {
    expect(cartaoPublicavel({ legal_basis: ["Lei 11.108/2005"], reviewed_by: "Dra. Lia", reviewed_on: "2026-09-30" })).toBe(true);
    expect(cartaoPublicavel({ legal_basis: [], reviewed_by: "Dra. Lia", reviewed_on: "2026-09-30" })).toBe(false);
    expect(cartaoPublicavel({ legal_basis: ["Lei"], reviewed_by: " ", reviewed_on: "2026-09-30" })).toBe(false);
  });

  it("critério: revisado há mais de 12 meses mostra 'Conferir atualização'", () => {
    expect(precisaConferir("2025-10-06", "2026-10-07")).toBe(true);
    expect(precisaConferir("2025-10-07", "2026-10-07")).toBe(false);
    expect(precisaConferir(null, "2026-10-07")).toBe(false);
  });

  it("critério: alterado depois de favoritado mostra 'Atualizado' por 14 dias", () => {
    const agora = new Date("2027-02-10T12:00:00Z");
    expect(mostrarAtualizado({ content_updated_at: "2027-02-01T12:00:00Z" }, "2026-10-01T12:00:00Z", agora)).toBe(true);
    expect(mostrarAtualizado({ content_updated_at: "2027-01-20T12:00:00Z" }, "2026-10-01T12:00:00Z", agora)).toBe(false);
    expect(mostrarAtualizado({ content_updated_at: "2026-09-01T12:00:00Z" }, "2026-10-01T12:00:00Z", agora)).toBe(false);
    expect(mostrarAtualizado({ content_updated_at: "2027-02-01T12:00:00Z" }, null, agora)).toBe(false);
  });
});

describe("RN-05/07 · compartilhar e quem vê", () => {
  it("critério: o texto compartilhado sai com a lei citada", () => {
    const c = cards.find((x) => x.slug === "acompanhante-no-parto")!;
    const t = textoParaCompartilhar(c);
    expect(t.startsWith(`${c.question} ${c.answer} Base legal: `)).toBe(true);
    expect(t).toContain("Lei 11.108/2005");
    expect(t.endsWith(". Via Ninho.")).toBe(true);
  });

  it("critério: o parceiro vê a licença-paternidade e não os cartões só da gestante", () => {
    const doParceiro = cards.filter((c) => visivelPara(c, "parceiro"));
    expect(slugs(doParceiro)).toContain("licenca-paternidade");
    expect(slugs(doParceiro)).toContain("acompanhante-no-parto");
    expect(slugs(doParceiro)).not.toContain("estabilidade-gestante");
    expect(cards.filter((c) => visivelPara(c, "mae"))).toHaveLength(cards.length);
  });

  it("ordem: tema e posição", () => {
    const o = ordenarCartoes(cards);
    expect(TEMAS_DIREITOS.indexOf(o[0]!.topic)).toBe(0);
    expect(o.map((c) => TEMAS_DIREITOS.indexOf(c.topic))).toEqual([...o.map((c) => TEMAS_DIREITOS.indexOf(c.topic))].sort((a, b) => a - b));
  });
});

describe("canais de ajuda", () => {
  it("critério: Ligue 180 abre o discador", () => {
    const l180 = channels.find((c) => c.slug === "ligue-180")!;
    expect(linkTelefone(l180.phone)).toBe("tel:180");
    expect(linkTelefone(null)).toBeNull();
    expect(telefoneLegivel("08007019656")).toBe("0800 701 9656");
  });

  it("a semente de canais: os 4 da spec, com telefone ou site", () => {
    expect(slugs(channels)).toEqual(["ligue-180", "disque-saude-136", "ans", "defensoria-publica"]);
    for (const c of channels) {
      expect(c.phone || c.url, c.slug).toBeTruthy();
      if (c.phone) expect(c.phone).toMatch(/^\d{3,13}$/);
      if (c.url) expect(c.url).toMatch(/^https:\/\//);
    }
  });
});

describe("semente de cartões", () => {
  it("os 17 da lista de lançamento, dentro dos limites do modelo", () => {
    expect(cards).toHaveLength(17);
    expect(new Set(slugs(cards)).size).toBe(17);
    for (const c of cards) {
      expect(c.question.length, c.slug).toBeLessThanOrEqual(90);
      expect(c.answer.length, c.slug).toBeLessThanOrEqual(280);
      expect((c.details_md ?? "").length, c.slug).toBeLessThanOrEqual(1500);
      expect(c.what_to_do_md.length, c.slug).toBeLessThanOrEqual(600);
      expect(c.legal_basis.length, c.slug).toBeGreaterThan(0);
      expect(c.legal_links.length, c.slug).toBeLessThanOrEqual(c.legal_basis.length);
      for (const l of c.legal_links) expect(l).toMatch(/^https:\/\/www\.planalto\.gov\.br\//);
      expect(TEMAS_DIREITOS).toContain(c.topic);
      expect((c.week_from === null) === (c.week_to === null), c.slug).toBe(true);
    }
    const porTema = Object.fromEntries(TEMAS_DIREITOS.map((t) => [t, cards.filter((c) => c.topic === t).length]));
    expect(porTema).toEqual({ work: 8, health: 5, birth: 1, postpartum: 2, benefits: 1 });
  });
});
