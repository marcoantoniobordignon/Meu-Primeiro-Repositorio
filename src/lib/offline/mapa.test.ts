import { describe, expect, it } from "vitest";

import { mapeamentoDaColecao, paraServidor } from "./mapa";

describe("mapa da fila · tabelas pessoais", () => {
  it("tabelas pessoais (favoritos, leituras, votos de nome) vão sem criado_por (o banco usa user_id = auth.uid())", () => {
    for (const chave of ["ninho.faq_favorites", "ninho.article_reads", "ninho.faith_favorites", "ninho.rights_favorites", "ninho.name_votes"]) {
      const m = mapeamentoDaColecao(chave);
      expect(m, chave).toBeTruthy();
      const enviado = paraServidor({ id: "x", atualizado_em: "t", criado_por: "00000000-0000-0000-0000-000000000001", familia_id: "f" } as never, m!.soLocal);
      expect(enviado).toEqual({ id: "x", atualizado_em: "t" });
    }
  });

  it("tabelas da família mantêm criado_por", () => {
    const m = mapeamentoDaColecao("ninho.diary_entries")!;
    expect(paraServidor({ id: "x", atualizado_em: "t", criado_por: "u" }, m.soLocal)).toEqual({ id: "x", atualizado_em: "t", criado_por: "u" });
  });
});
