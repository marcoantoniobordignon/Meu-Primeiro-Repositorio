import { describe, expect, it } from "vitest";

import { formatarNumero, formatarRelativo, formatarVariacao, ticksRedondos, variacao } from "./formato";

describe("ADM · formatação", () => {
  it("números compactos em pt-BR", () => {
    expect(formatarNumero(0)).toBe("0");
    expect(formatarNumero(1284)).toBe("1.284");
    expect(formatarNumero(12_900)).toBe("12,9 mil");
    expect(formatarNumero(2_400_000)).toBe("2,4 mi");
    expect(formatarNumero(null)).toBe("–");
  });

  it("variação com sinal e sem divisão por zero", () => {
    expect(variacao(120, 100)).toBe(20);
    expect(variacao(80, 100)).toBe(-20);
    expect(variacao(5, 0)).toBeNull();
    expect(formatarVariacao(20)).toBe("+20%");
    expect(formatarVariacao(-20)).toBe("-20%");
    expect(formatarVariacao(null)).toBe("");
  });

  it("relativo em português", () => {
    const agora = new Date("2026-09-30T12:00:00Z");
    expect(formatarRelativo("2026-09-30T11:58:00Z", agora)).toBe("há 2 min");
    expect(formatarRelativo("2026-09-30T09:00:00Z", agora)).toBe("há 3 h");
    expect(formatarRelativo("2026-09-29T09:00:00Z", agora)).toBe("ontem");
    expect(formatarRelativo("2026-09-20T09:00:00Z", agora)).toBe("há 10 dias");
    expect(formatarRelativo(null, agora)).toBe("nunca");
  });

  it("ticks redondos cobrem o máximo", () => {
    expect(ticksRedondos(37)).toEqual([0, 10, 20, 30, 40]);
    expect(ticksRedondos(4)).toEqual([0, 1, 2, 3, 4]);
    expect(ticksRedondos(0)).toEqual([0, 1]);
    const t = ticksRedondos(1234);
    expect(t[t.length - 1]!).toBeGreaterThanOrEqual(1234);
  });
});
