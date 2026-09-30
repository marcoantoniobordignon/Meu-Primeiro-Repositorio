import { beforeEach, describe, expect, it } from "vitest";

import { aoEscrever, criarColecao, type Registro } from "./colecao";

interface Item extends Registro {
  nome: string;
}

beforeEach(() => localStorage.clear());

describe("coleção local", () => {
  it("salva, atualiza pelo mesmo id e persiste", () => {
    const c = criarColecao<Item>("teste.itens");
    c.salvar({ id: "a", nome: "um" });
    c.salvar({ id: "a", nome: "um editado" });
    c.salvar({ id: "b", nome: "dois" });
    expect(c.listar().map((i) => i.nome)).toEqual(["um editado", "dois"]);
    expect(JSON.parse(localStorage.getItem("teste.itens")!)).toHaveLength(2);
  });

  it("apaga com soft delete: some de listar, fica em listarTodos", () => {
    const c = criarColecao<Item>("teste.soft");
    c.salvar({ id: "a", nome: "um" });
    c.apagar("a");
    expect(c.listar()).toHaveLength(0);
    expect(c.listarTodos()[0]?.apagado_em).toBeTruthy();
  });

  it("avisa quem assina e devolve o mesmo array enquanto nada muda", () => {
    const c = criarColecao<Item>("teste.assina");
    let chamadas = 0;
    const parar = c.assinar(() => chamadas++);
    const antes = c.listar();
    expect(c.listar()).toBe(antes);
    c.salvar({ id: "a", nome: "um" });
    expect(chamadas).toBe(1);
    expect(c.listar()).not.toBe(antes);
    parar();
    c.salvar({ id: "b", nome: "dois" });
    expect(chamadas).toBe(1);
  });

  it("gancho de escrita recebe salvar e apagar, não o merge do servidor", () => {
    const c = criarColecao<Item>("teste.gancho");
    const vistos: string[] = [];
    const parar = aoEscrever((chave, r) => vistos.push(`${chave}:${r.id}:${r.apagado_em ? "x" : "ok"}`));
    c.salvar({ id: "a", nome: "um" });
    c.apagar("a");
    c.mesclar([{ id: "b", nome: "do servidor", atualizado_em: "2026-01-01T00:00:00Z" }]);
    parar();
    expect(vistos).toEqual(["teste.gancho:a:ok", "teste.gancho:a:x"]);
  });
});

describe("ARQ-02 · mesclar com o servidor", () => {
  it("vence o maior atualizado_em; nunca duplica", () => {
    const c = criarColecao<Item>("teste.merge");
    c.salvar({ id: "a", nome: "local novo" });
    const antigo = { id: "a", nome: "servidor antigo", atualizado_em: "2020-01-01T00:00:00Z" };
    const futuro = { id: "a", nome: "servidor novo", atualizado_em: "2099-01-01T00:00:00Z" };
    expect(c.mesclar([antigo])).toBe(0);
    expect(c.listar()[0]?.nome).toBe("local novo");
    expect(c.mesclar([futuro, { id: "b", nome: "outro", atualizado_em: "2026-01-01T00:00:00Z" }])).toBe(2);
    expect(c.listar().map((i) => i.nome)).toEqual(["servidor novo", "outro"]);
    expect(c.listarTodos()).toHaveLength(2);
  });

  it("um apagado no servidor some localmente", () => {
    const c = criarColecao<Item>("teste.merge-apagado");
    c.salvar({ id: "a", nome: "vivo" });
    c.mesclar([{ id: "a", nome: "vivo", atualizado_em: "2099-01-01T00:00:00Z", apagado_em: "2099-01-01T00:00:00Z" }]);
    expect(c.listar()).toHaveLength(0);
  });
});
