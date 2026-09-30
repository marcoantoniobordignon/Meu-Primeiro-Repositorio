import { describe, expect, it } from "vitest";

import type { PosPartoCheckin } from "@/lib/dados/colecoes";

import { cortesiaFim, emCortesia, mostraCheckin, podeDesfazer, semanasSeprematuro, sinalDeAlerta, validarNascimento } from "./nascimento";

const agora = new Date(2026, 8, 30, 10, 0);

describe("VIR-04 · validação da data", () => {
  it("futuro não; mais de 12 meses pede confirmação", () => {
    expect(validarNascimento(new Date(2026, 9, 1), agora)).toBe("futuro");
    expect(validarNascimento(new Date(2025, 8, 1), agora)).toBe("confirmar_antigo");
    expect(validarNascimento(new Date(2026, 8, 29), agora)).toBe("ok");
  });
});

describe("VIR-05 · prematuro", () => {
  it("antes de DPP − 21 dias sugere semanas; depois, null", () => {
    expect(semanasSeprematuro("2026-09-01", "2026-10-15")).toBe(33);
    expect(semanasSeprematuro("2026-10-01", "2026-10-15")).toBeNull();
  });
});

describe("VIR-02 · cortesia", () => {
  it("7 dias a partir do nascimento, só sem plano", () => {
    const fim = cortesiaFim("2026-09-30T08:00:00.000Z", false)!;
    expect(fim).toBe("2026-10-07T08:00:00.000Z");
    expect(cortesiaFim("2026-09-30T08:00:00.000Z", true)).toBeNull();
    expect(emCortesia(fim, new Date("2026-10-06T00:00:00Z"))).toBe(true);
    expect(emCortesia(fim, new Date("2026-10-08T00:00:00Z"))).toBe(false);
  });
});

describe("VIR-06 · desfazer", () => {
  it("só em 24 h", () => {
    expect(podeDesfazer(new Date(2026, 8, 29, 12).toISOString(), agora)).toBe(true);
    expect(podeDesfazer(new Date(2026, 8, 28, 12).toISOString(), agora)).toBe(false);
  });
});

function c(data: string, dor: 0 | 1 | 2 | 3, humor: 1 | 2 | 3 | 4 | 5, sangramento: PosPartoCheckin["sangramento"] = "leve"): PosPartoCheckin {
  return { id: data, data, dor, humor, sangramento, atualizado_em: "" };
}

describe("VIR-07 · check-in pós-parto", () => {
  it("card nas 6 primeiras semanas, uma vez por dia", () => {
    expect(mostraCheckin("2026-09-20T10:00:00Z", [], "2026-09-30")).toBe(true);
    expect(mostraCheckin("2026-09-20T10:00:00Z", [c("2026-09-30", 0, 4)], "2026-09-30")).toBe(false);
    expect(mostraCheckin("2026-07-01T10:00:00Z", [], "2026-09-30")).toBe(false);
  });

  it("alerta com dor 3, sangramento intenso ou humor baixo por 3 dias", () => {
    expect(sinalDeAlerta([c("2026-09-30", 3, 4)], "2026-09-30")).toBe(true);
    expect(sinalDeAlerta([c("2026-09-30", 1, 4, "intenso")], "2026-09-30")).toBe(true);
    expect(sinalDeAlerta([c("2026-09-30", 1, 2), c("2026-09-29", 1, 1), c("2026-09-28", 0, 2)], "2026-09-30")).toBe(true);
    expect(sinalDeAlerta([c("2026-09-30", 1, 2), c("2026-09-29", 1, 3), c("2026-09-28", 0, 2)], "2026-09-30")).toBe(false);
    expect(sinalDeAlerta([c("2026-09-30", 1, 4)], "2026-09-30")).toBe(false);
  });
});
