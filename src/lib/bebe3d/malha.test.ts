import { describe, expect, it } from "vitest";

import { ossos } from "./esqueleto";
import { gerarMalhaBebe } from "./malha";

describe("B3D-05 · malha placeholder", () => {
  const malha = gerarMalhaBebe(40);

  it("gera uma malha fechada com normais, pesos normalizados e espessura em [0,1]", () => {
    const pos = malha.geometria.getAttribute("position");
    const pesos = malha.geometria.getAttribute("skinWeight");
    const esp = malha.geometria.getAttribute("espessura");
    expect(pos.count).toBeGreaterThan(500);
    expect(malha.geometria.getAttribute("normal").count).toBe(pos.count);
    for (let v = 0; v < pos.count; v += 7) {
      const soma = pesos.getX(v) + pesos.getY(v) + pesos.getZ(v) + pesos.getW(v);
      expect(soma).toBeCloseTo(1, 4);
      expect(esp.getX(v)).toBeGreaterThanOrEqual(0);
      expect(esp.getX(v)).toBeLessThanOrEqual(1);
    }
  });

  it("as mãos são mais finas que a cabeça (é isso que faz a luz passar)", () => {
    const pos = malha.geometria.getAttribute("position");
    const esp = malha.geometria.getAttribute("espessura");
    const idx = malha.geometria.getAttribute("skinIndex");
    const iCabeca = ossos.findIndex((o) => o.nome === "cabeca");
    const iDedos = ossos.findIndex((o) => o.nome === "mao_E");
    let cabeca = 0;
    let nCabeca = 0;
    let dedos = 0;
    let nDedos = 0;
    for (let v = 0; v < pos.count; v++) {
      if (idx.getX(v) === iCabeca) {
        cabeca += esp.getX(v);
        nCabeca++;
      }
      if (idx.getX(v) === iDedos) {
        dedos += esp.getX(v);
        nDedos++;
      }
    }
    expect(nCabeca).toBeGreaterThan(0);
    expect(nDedos).toBeGreaterThan(0);
    expect(dedos / nDedos).toBeLessThan(cabeca / nCabeca);
  });

  it("esqueleto com todos os ossos nomeados, cabeça acima da pelve", () => {
    expect(malha.esqueleto.bones).toHaveLength(ossos.length);
    for (const o of ossos) expect(malha.ossosPorNome.get(o.nome)?.name).toBe(o.nome);
    malha.raiz.updateMatrixWorld(true);
    const cabeca = malha.ossosPorNome.get("cabeca")!.getWorldPosition(new (malha.raiz.position.constructor as typeof import("three").Vector3)());
    expect(cabeca.y).toBeGreaterThan(0.6);
  });
});
