import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { ControladorBebe, gestosDaSemana, sortearGesto } from "./animacao";
import { ossos } from "./esqueleto";
import { prng } from "./ruido";

function esqueletoDeTeste() {
  const mapa = new Map<(typeof ossos)[number]["nome"], THREE.Bone>();
  for (const o of ossos) mapa.set(o.nome, new THREE.Bone());
  return mapa;
}

describe("B3D-01 · gestos por idade gestacional", () => {
  it("cada movimento só aparece a partir da semana certa", () => {
    const nomes = (s: number) => gestosDaSemana(s).map((g) => g.nome);
    expect(nomes(8)).toEqual(["repouso"]);
    expect(nomes(15)).toEqual(["repouso", "maos"]);
    expect(nomes(19)).toContain("chute");
    expect(nomes(19)).not.toContain("espreguicar");
    expect(nomes(25)).not.toContain("piscar");
    expect(nomes(26)).toContain("piscar");
  });

  it("nunca repete o gesto anterior (exceto repouso) e respeita a semana", () => {
    const rnd = prng(3);
    let anterior: ReturnType<typeof sortearGesto>["nome"] | null = null;
    for (let i = 0; i < 200; i++) {
      const g = sortearGesto(20, anterior, rnd);
      expect(g.desde).toBeLessThanOrEqual(20);
      if (anterior && anterior !== "repouso") expect(g.nome).not.toBe(anterior);
      anterior = g.nome;
    }
  });
});

describe("B3D-04 · controlador", () => {
  it("o bebê nunca fica parado: a pose muda com o tempo, sem saltos entre quadros", () => {
    const mapa = esqueletoDeTeste();
    const c = new ControladorBebe(mapa, 7);
    const cabeca = mapa.get("cabeca")!;
    let anterior = cabeca.quaternion.clone();
    let maiorSalto = 0;
    let mexeu = false;
    for (let i = 0; i < 60 * 30; i++) {
      c.atualizar(1 / 60, 20, false);
      const salto = anterior.angleTo(cabeca.quaternion);
      maiorSalto = Math.max(maiorSalto, salto);
      if (salto > 1e-5) mexeu = true;
      anterior = cabeca.quaternion.clone();
    }
    expect(mexeu).toBe(true);
    // Menos de 4 graus por quadro: sem tranco.
    expect(maiorSalto).toBeLessThan((4 * Math.PI) / 180);
  });

  it("com 'reduzir movimento', só o repouso fica e o coração continua", () => {
    const mapa = esqueletoDeTeste();
    const c = new ControladorBebe(mapa, 7);
    const coxa = mapa.get("coxa_E")!;
    let pulsou = false;
    for (let i = 0; i < 60 * 10; i++) {
      c.atualizar(1 / 60, 30, true);
      if (c.estado.pulsoCoracao > 0.5) pulsou = true;
      expect(c.estado.gesto).toBe("repouso");
    }
    expect(pulsou).toBe(true);
    expect(coxa.quaternion.angleTo(new THREE.Quaternion())).toBeLessThan(0.01);
  });
});
