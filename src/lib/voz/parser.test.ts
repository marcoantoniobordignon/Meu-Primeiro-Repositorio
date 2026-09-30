import { describe, expect, it } from "vitest";

import frases from "../../../tests/voz/frases.json";

import { interpretarLocal, type RegistroVoz } from "./parser";

interface Esperado {
  tipo: string;
  dados?: Record<string, unknown>;
  minutos?: number;
  segundos?: number;
  fim?: null;
  inicioHaMin?: number;
  fimHaMin?: number;
  horaFim?: string;
  bebe?: string;
  slug?: string;
  intensidade?: number;
  quantidade?: number;
}

interface Caso {
  modo: "gestacao" | "bebe";
  frase: string;
  bebes?: boolean;
  espera: Esperado[];
}

const agora = new Date(2026, 8, 30, 10, 0, 0);
const min = (iso: string) => Math.round((agora.getTime() - new Date(iso).getTime()) / 60_000);

function conferir(r: RegistroVoz, e: Esperado) {
  expect(r.tipo).toBe(e.tipo);
  if (e.dados) expect((r as { dados?: Record<string, unknown> }).dados).toMatchObject(e.dados);
  if (e.minutos !== undefined && "inicio" in r && "fim" in r && r.fim) {
    expect(Math.round((new Date(r.fim).getTime() - new Date(r.inicio).getTime()) / 60_000)).toBe(e.minutos);
  }
  if (e.segundos !== undefined && "inicio" in r && "fim" in r && r.fim) {
    expect(Math.round((new Date(r.fim).getTime() - new Date(r.inicio).getTime()) / 1000)).toBe(e.segundos);
  }
  if (e.fim === null) expect((r as { fim: string | null }).fim).toBeNull();
  if (e.inicioHaMin !== undefined) expect(min((r as { inicio: string }).inicio)).toBe(e.inicioHaMin);
  if (e.fimHaMin !== undefined) expect(min((r as { fim: string }).fim)).toBe(e.fimHaMin);
  if (e.horaFim) expect(new Date((r as { fim: string }).fim).toTimeString().slice(0, 5)).toBe(e.horaFim);
  if (e.bebe) expect((r as { bebe_id?: string }).bebe_id).toBe(e.bebe);
  if (e.slug) expect((r as { slug: string }).slug).toBe(e.slug);
  if (e.intensidade) expect((r as { intensidade: number }).intensidade).toBe(e.intensidade);
  if (e.quantidade) expect((r as { quantidade: number }).quantidade).toBe(e.quantidade);
}

describe("VOZ · parser local (tests/voz/frases.json)", () => {
  for (const caso of frases as Caso[]) {
    it(`${caso.modo}: "${caso.frase}"`, () => {
      const r = interpretarLocal(caso.frase, {
        modo: caso.modo,
        agora,
        bebes: caso.bebes ? [{ id: "theo", nome: "Theo" }, { id: "lia", nome: "Lia" }] : undefined,
        bebeAtivoId: caso.bebes ? "lia" : undefined,
      });
      if (caso.espera.length === 0) {
        expect(r.registros).toEqual([]);
        expect(r.confianca).toBeLessThan(0.6);
        return;
      }
      expect(r.confianca).toBeGreaterThanOrEqual(0.6);
      expect(r.registros).toHaveLength(caso.espera.length);
      caso.espera.forEach((e, i) => conferir(r.registros[i]!, e));
      expect(r.resumo.length).toBeGreaterThan(0);
    });
  }

  it("VOZ-05: 'dormiu' com sono em andamento não cria outro", () => {
    const r = interpretarLocal("dormiu", { modo: "bebe", agora, sonoEmAndamento: true });
    expect(r.registros).toEqual([]);
  });

  it("VOZ-06: horário no futuro não grava", () => {
    const r = interpretarLocal("mamou às 23 horas", { modo: "bebe", agora: new Date(2026, 8, 30, 10, 0) });
    // "às 23" ontem à noite é o passado mais próximo, então é válido:
    expect(r.registros).toHaveLength(1);
    expect(new Date((r.registros[0] as { fim: string }).fim).getDate()).toBe(29);
  });

  it("resumo legível para a confirmação", () => {
    const r = interpretarLocal("mamou doze minutos no direito", { modo: "bebe", agora });
    expect(r.resumo).toBe("Mamada no direito, 12 min");
    const r2 = interpretarLocal("trocou fralda de cocô e mamou 8 minutos", { modo: "bebe", agora });
    expect(r2.resumo).toBe("Fralda de cocô · Mamada, 8 min");
  });
});
