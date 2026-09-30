import { describe, expect, it } from "vitest";

import type { ConteudoLido } from "@/lib/dados/colecoes";

import { banco, categoriasDeSaude, FRASE_ENCAMINHAMENTO, PALAVRAS_PROIBIDAS } from "./banco";
import { blocos } from "./markdown";
import { cardsParaLeitura, elegivel, storiesDoDia } from "./stories";

describe("CON-07 · checagem do banco de conteúdo", () => {
  it("nenhum texto usa 'sempre', 'nunca' ou 'garantido'", () => {
    const re = new RegExp(`\\b(${PALAVRAS_PROIBIDAS.join("|")})\\b`, "i");
    const infratores = banco.filter((c) => re.test(c.corpo_md) || re.test(c.titulo)).map((c) => c.slug);
    expect(infratores).toEqual([]);
  });

  it("toda story de saúde termina com a frase de encaminhamento", () => {
    const semFrase = banco
      .filter((c) => categoriasDeSaude.includes(c.categoria))
      .filter((c) => !c.corpo_md.trim().endsWith(FRASE_ENCAMINHAMENTO))
      .map((c) => c.slug);
    expect(semFrase).toEqual([]);
  });

  it("CON-08: título, corpo, categoria, faixa e minutos preenchidos; slugs únicos", () => {
    expect(new Set(banco.map((c) => c.slug)).size).toBe(banco.length);
    for (const c of banco) {
      expect(c.titulo.length).toBeGreaterThan(3);
      expect(c.cards.length).toBeGreaterThan(0);
      expect(c.minutos_leitura).toBeGreaterThan(0);
      expect(c.semana_min !== null || c.mes_bebe_min !== null).toBe(true);
    }
  });

  it("tem as 42 stories de semana, nenhuma premium (CON-05)", () => {
    const semanas = banco.filter((c) => c.categoria === "semana");
    expect(semanas).toHaveLength(42);
    expect(semanas.every((c) => !c.premium)).toBe(true);
  });

  it("toda semana de 1 a 42 tem ao menos 2 artigos além da story da semana", () => {
    for (let s = 1; s <= 42; s++) {
      const n = banco.filter((c) => c.categoria !== "semana" && elegivel(c, { hoje: "2026-09-30", semana: s })).length;
      expect(n, `semana ${s}`).toBeGreaterThanOrEqual(2);
    }
  });

  it("todo mês do bebê de 0 a 12 tem ao menos 1 artigo", () => {
    for (let m = 0; m <= 12; m++) {
      const n = banco.filter((c) => elegivel(c, { hoje: "2026-09-30", mesBebe: m })).length;
      expect(n, `mês ${m}`).toBeGreaterThanOrEqual(1);
    }
  });
});

function lido(id: string, guardado = false): ConteudoLido {
  return { id: `l-${id}`, conteudo_id: id, lido_em: "2026-09-29T10:00:00Z", guardado, atualizado_em: "2026-09-29T10:00:00Z" };
}

describe("CON-01 · stories do dia", () => {
  it("na semana 22 vejo 3, a primeira é 'Semana 22: o que muda'", () => {
    const s = storiesDoDia([], { hoje: "2026-09-30", semana: 22 });
    expect(s).toHaveLength(3);
    expect(s[0]?.conteudo.titulo).toBe("Semana 22: o que muda");
    expect(s.slice(1).every((x) => x.conteudo.categoria !== "semana")).toBe(true);
  });

  it("mesma ordem o dia inteiro; ordem muda com a data", () => {
    const a = storiesDoDia([], { hoje: "2026-09-30", semana: 22 }).map((x) => x.conteudo.id);
    const b = storiesDoDia([], { hoje: "2026-09-30", semana: 22 }).map((x) => x.conteudo.id);
    expect(a).toEqual(b);
    const dias = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"];
    const outras = dias.map((d) => storiesDoDia([], { hoje: d, semana: 22 }).map((x) => x.conteudo.id).join());
    expect(new Set([a.join(), ...outras]).size).toBeGreaterThan(1);
  });

  it("CON-04: lida é substituída por outra não lida e volta esmaecida só se faltar opção", () => {
    const primeira = storiesDoDia([], { hoje: "2026-09-30", semana: 22 });
    const lidaId = primeira[1]!.conteudo.id;
    const depois = storiesDoDia([lido(lidaId)], { hoje: "2026-10-01", semana: 22 });
    expect(depois.slice(1).some((x) => x.conteudo.id === lidaId)).toBe(false);
  });

  it("CON-02: em modo bebê usa mes_bebe", () => {
    const s = storiesDoDia([], { hoje: "2026-09-30", mesBebe: 1 });
    expect(s.length).toBeGreaterThan(0);
    expect(s.every((x) => x.conteudo.mes_bebe_min !== null)).toBe(true);
  });
});

describe("CON-05 · premium", () => {
  it("sem plano, só o primeiro card e bloqueada; com plano, inteira", () => {
    const premium = banco.find((c) => c.premium)!;
    expect(cardsParaLeitura(premium, false)).toEqual({ cards: premium.cards.slice(0, 1), bloqueada: true });
    expect(cardsParaLeitura(premium, true)).toEqual({ cards: premium.cards, bloqueada: false });
  });
});

describe("markdown mínimo", () => {
  it("parágrafos, negrito, itálico e lista", () => {
    const b = blocos("Oi **você** e *ela*.\n\n- um\n- dois");
    expect(b).toEqual([
      {
        tipo: "paragrafo",
        trechos: [
          { tipo: "texto", valor: "Oi " },
          { tipo: "negrito", valor: "você" },
          { tipo: "texto", valor: " e " },
          { tipo: "italico", valor: "ela" },
          { tipo: "texto", valor: "." },
        ],
      },
      { tipo: "lista", itens: [[{ tipo: "texto", valor: "um" }], [{ tipo: "texto", valor: "dois" }]] },
    ]);
  });
});
