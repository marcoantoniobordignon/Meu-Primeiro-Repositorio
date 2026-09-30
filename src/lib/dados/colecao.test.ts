import { beforeEach, describe, expect, it } from "vitest";

import { criarColecao, type Registro } from "./colecao";

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
});
