import { beforeEach, describe, expect, it } from "vitest";

import { idbLimpar, STORE_OUTBOX } from "./idb";
import { concluir, enfileirar, esperaParaTentativa, falhou, pendentes, prontos, temPendenteAntigo } from "./outbox";

beforeEach(() => idbLimpar(STORE_OUTBOX));

describe("ARQ-01 · outbox com retry exponencial", () => {
  it("backoff: 1 s, 4 s, 16 s, 60 s, depois 5 min", () => {
    expect([1, 2, 3, 4, 5, 9].map(esperaParaTentativa)).toEqual([1_000, 4_000, 16_000, 60_000, 300_000, 300_000]);
  });

  it("enfileira, uma entrada por registro (a última escrita vence)", async () => {
    await enfileirar("sintomas", { id: "a", intensidade: 1 }, 100);
    await enfileirar("sintomas", { id: "a", intensidade: 3 }, 200);
    await enfileirar("consultas", { id: "b" }, 300);
    const lista = await pendentes();
    expect(lista).toHaveLength(2);
    expect(lista[0]?.payload.intensidade).toBe(3);
  });

  it("falha adia a próxima tentativa; prontos respeita o backoff", async () => {
    const item = await enfileirar("registros", { id: "r" }, 0);
    const depois = await falhou(item, "rede", 0);
    expect(depois.tentativas).toBe(1);
    expect(depois.proximaEm).toBe(1_000);
    expect(prontos([depois], 500)).toEqual([]);
    expect(prontos([depois], 1_000)).toHaveLength(1);
    await concluir(depois);
    expect(await pendentes()).toEqual([]);
  });

  it("avisa pendente há mais de 24 h", async () => {
    const item = await enfileirar("registros", { id: "r" }, 0);
    expect(temPendenteAntigo([item], 23 * 3_600_000)).toBe(false);
    expect(temPendenteAntigo([item], 25 * 3_600_000)).toBe(true);
  });
});
