import { describe, expect, it } from "vitest";

import dicasSemente from "../../../supabase/seed/dicas-parceiro.json";
import type { ConsultaBase } from "@dominio/consultas.ts";
import type { Enviado } from "@dominio/lembretes.ts";
import {
  codigoValido,
  dicaDaSemana,
  estadoConviteParceiro,
  gerarCodigo,
  LIMITE_SEMANAL_PARCEIRO,
  mensagemDoConvite,
  normalizarCodigo,
  planejarParceiro,
  proximosCompromissos,
  selecionarParaParceiro,
  semanaDoParceiro,
  SEMANAS_MARCO_PARCEIRO,
  trimestreDaSemana,
  type DicaParceiro,
  type EstadoParceiro,
} from "@dominio/parceiro.ts";
import { inicioDaSemana, instanteLocal, somarDiasISO } from "@dominio/tempo.ts";

const TZ = "America/Sao_Paulo";
const DPP = "2027-03-08";
const agora = new Date("2026-10-07T15:00:00Z"); // 12:00 em São Paulo

describe("PAR RN-01/10/12 · convite", () => {
  it("código: 6 letras e números sem ambíguos; o que ela digita é normalizado", () => {
    const c = gerarCodigo(Uint8Array.from([0, 8, 14, 31, 32, 255]));
    expect(c).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(c).not.toMatch(/[IO01]/);
    expect(normalizarCodigo(" ab-c 2d9 ")).toBe("ABC2D9");
    expect(codigoValido("abc-2d9")).toBe(true);
    expect(codigoValido("ABC1D9")).toBe(false); // 1 é ambíguo
    expect(codigoValido("ABCO D9")).toBe(false); // O é ambíguo
    expect(codigoValido("ABC2D")).toBe(false);
  });

  it("estado: usado, revogado, expirado (mais de 7 dias), válido", () => {
    const base = { expires_at: "2026-10-10T00:00:00Z" };
    expect(estadoConviteParceiro(null, agora)).toBe("inexistente");
    expect(estadoConviteParceiro({ ...base, accepted_at: "x" }, agora)).toBe("usado");
    expect(estadoConviteParceiro({ ...base, revoked_at: "x" }, agora)).toBe("revogado");
    expect(estadoConviteParceiro({ expires_at: "2026-10-07T14:59:59Z" }, agora)).toBe("expirado");
    expect(estadoConviteParceiro(base, agora)).toBe("valido");
  });

  it("RN-10: mensagem do compartilhamento", () => {
    expect(mensagemDoConvite("https://ninho.app/convite/abc")).toBe("Entre no Ninho para acompanhar a gravidez comigo: https://ninho.app/convite/abc");
  });
});

describe("PAR RN-09 · Como ajudar", () => {
  const dicas: DicaParceiro[] = [
    { week_from: 20, week_to: 20, trimester: 2, feeling_text: "s20", help_tips: ["a"] },
    { week_from: 14, week_to: 27, trimester: 2, feeling_text: "t2", help_tips: ["b"] },
    { week_from: 1, week_to: 13, trimester: 1, feeling_text: "t1", help_tips: ["c"] },
  ];
  it("a da semana; sem ela, a do trimestre; sem nenhuma, null", () => {
    expect(dicaDaSemana(dicas, 20)?.feeling_text).toBe("s20");
    expect(dicaDaSemana(dicas, 21)?.feeling_text).toBe("t2");
    expect(dicaDaSemana(dicas, 5)?.feeling_text).toBe("t1");
    expect(dicaDaSemana(dicas, 30)).toBeNull();
    expect(dicaDaSemana([], 20)).toBeNull();
  });
  it("trimestres", () => {
    expect([1, 13, 14, 27, 28, 42].map(trimestreDaSemana)).toEqual([1, 1, 2, 2, 3, 3]);
  });
  it("a semente cobre as semanas 4 a 40 e os três trimestres, dentro dos limites", () => {
    const s = dicasSemente as DicaParceiro[];
    for (let w = 4; w <= 40; w++) expect(s.filter((d) => d.week_from === w && d.week_to === w), `semana ${w}`).toHaveLength(1);
    for (const tri of [1, 2, 3]) expect(s.some((d) => d.trimester === tri && d.week_to > d.week_from)).toBe(true);
    for (const d of s) {
      expect(d.feeling_text.length).toBeLessThanOrEqual(160);
      expect(d.help_tips.length).toBeGreaterThanOrEqual(1);
      expect(d.help_tips.length).toBeLessThanOrEqual(3);
      for (const h of d.help_tips) expect(h.length).toBeLessThanOrEqual(200);
      expect(d.trimester).toBe(trimestreDaSemana(d.week_from));
    }
  });
});

describe("PAR RN-08 · avisos do parceiro", () => {
  const consulta = (id: string, starts_at: string, p: Partial<ConsultaBase> = {}): ConsultaBase => ({ id, starts_at, kind: "prenatal", status: "scheduled", provider_name: "Dra. Ana", location: "Clínica Sol", ...p });
  const estado = (p: Partial<EstadoParceiro> = {}): EstadoParceiro => ({ parceiroId: "pai", agora, tz: TZ, dpp: DPP, prefs: null, agenda: true, consultas: [], exames: [], ...p });

  it("véspera da consulta às 18:00 local, com o local", () => {
    const [l] = planejarParceiro(estado({ dpp: null, consultas: [consulta("c1", "2026-10-09T13:00:00Z")] }));
    expect(l).toMatchObject({ tipo: "partner_appointment_eve", categoria: "partner", titulo: "Amanhã tem consulta, às 10:00", corpo: "Clínica Sol. Que tal ir junto?" });
    expect(l!.em.toISOString()).toBe(instanteLocal("2026-10-08", "18:00", TZ).toISOString());
    expect(l!.chave).toBe("partner:pai:appt:c1:2026-10-09T13:00:00Z");
  });

  it("exame marcado por ela: aviso no momento em que marcou", () => {
    const [l] = planejarParceiro(estado({ dpp: null, exames: [{ id: "e1", catalog_code: "morpho", custom_name: null, scheduled_at: "2026-10-20T12:00:00Z", atualizado_em: "2026-10-07T14:55:00Z" }] }));
    expect(l).toMatchObject({ tipo: "partner_exam_scheduled", titulo: "Ela marcou: Ultrassom morfológico", corpo: "20/10/2026 às 09:00. Toque para ver na agenda." });
    expect(l!.em.toISOString()).toBe("2026-10-07T14:55:00.000Z");
  });

  it("marcos nas semanas 12, 20, 28, 36, 38 e 40 às 09:00", () => {
    const marcos = planejarParceiro(estado()).filter((l) => l.tipo === "partner_milestone");
    expect(marcos.map((l) => l.ref)).toEqual(SEMANAS_MARCO_PARCEIRO.map((s) => `semana-${s}`));
    expect(marcos[1]!.em.toISOString()).toBe(instanteLocal(inicioDaSemana(DPP, 20), "09:00", TZ).toISOString());
  });

  it("RN-04: sem a permissão agenda, nada de consulta nem exame", () => {
    const l = planejarParceiro(estado({ agenda: false, consultas: [consulta("c1", "2026-10-09T13:00:00Z")], exames: [{ id: "e1", catalog_code: "morpho", custom_name: null, scheduled_at: "2026-10-20T12:00:00Z", atualizado_em: "2026-10-07T14:55:00Z" }] }));
    expect(l.every((x) => x.tipo === "partner_milestone")).toBe(true);
  });

  it("opt-out por tipo", () => {
    const l = planejarParceiro(estado({ prefs: { partner_milestones: false, partner_appointment_eve: false }, consultas: [consulta("c1", "2026-10-09T13:00:00Z")] }));
    expect(l).toEqual([]);
  });

  it("consulta passada, cancelada ou apagada não avisa", () => {
    const l = planejarParceiro(estado({ dpp: null, consultas: [consulta("a", "2026-10-01T13:00:00Z"), consulta("b", "2026-10-09T13:00:00Z", { status: "cancelled" }), consulta("c", "2026-10-09T13:00:00Z", { apagado_em: "x" })] }));
    expect(l).toEqual([]);
  });

  it("no máximo 3 por semana (janela de 7 dias), e respeita o silêncio da fundação", () => {
    const vespera = planejarParceiro(estado({ dpp: null, consultas: [consulta("c1", "2026-10-08T13:00:00Z")], agora: new Date("2026-10-07T21:05:00Z") }));
    const opc = { agora: new Date("2026-10-07T21:05:00Z"), tz: TZ, prefs: null };
    expect(selecionarParaParceiro(vespera, { ...opc, enviados: [] })).toHaveLength(1);
    const tres: Enviado[] = [1, 2, 3].map((i) => ({ chave: `x${i}`, categoria: "partner", ref: "r", enviado_em: new Date(Date.UTC(2026, 9, 2 + i, 12)).toISOString() }));
    expect(tres).toHaveLength(LIMITE_SEMANAL_PARCEIRO);
    expect(selecionarParaParceiro(vespera, { ...opc, enviados: tres })).toEqual([]);
    const antigos = tres.map((x) => ({ ...x, enviado_em: "2026-09-20T12:00:00Z" }));
    expect(selecionarParaParceiro(vespera, { ...opc, enviados: antigos })).toHaveLength(1);
    // Às 23:30 é silêncio (22h–7h).
    const tarde = planejarParceiro(estado({ dpp: null, exames: [{ id: "e1", catalog_code: "gbs", custom_name: null, scheduled_at: "2026-10-20T12:00:00Z", atualizado_em: "2026-10-08T02:30:00Z" }] }));
    expect(selecionarParaParceiro(tarde, { agora: new Date("2026-10-08T02:35:00Z"), tz: TZ, prefs: null, enviados: [] })).toEqual([]);
  });
});

describe("PAR · home do parceiro", () => {
  it("semana dele = semana dela; sem DPP, null", () => {
    expect(semanaDoParceiro(DPP, agora, TZ)).toBe(18);
    expect(semanaDoParceiro(null, agora, TZ)).toBeNull();
    expect(semanaDoParceiro(somarDiasISO(DPP, 400), agora, TZ)).toBe(0); // DPP muito à frente não dá semana negativa
  });
  it("próximos compromissos: consultas e exames marcados, em ordem, até 3", () => {
    const c = (id: string, d: string): ConsultaBase => ({ id, starts_at: d, kind: "prenatal", status: "scheduled", provider_name: `Dr ${id}` });
    const lista = proximosCompromissos(
      [c("a", "2026-10-20T12:00:00Z"), c("passada", "2026-10-01T12:00:00Z"), c("b", "2026-10-09T12:00:00Z")],
      [
        { id: "e", catalog_code: "morpho", custom_name: null, scheduled_at: "2026-10-12T12:00:00Z" },
        { id: "hoje", catalog_code: "gbs", custom_name: null, scheduled_at: "2026-10-07T03:00:00Z", scheduled_all_day: true },
      ],
      agora,
      TZ,
    );
    expect(lista.map((x) => x.id)).toEqual(["hoje", "b", "e"]);
    expect(lista[2]).toMatchObject({ tipo: "exame", titulo: "Ultrassom morfológico" });
  });
});
