import { describe, expect, it } from "vitest";

import {
  adiar,
  deveArquivar,
  dosesSemRegistro,
  horariosDeLembrete,
  horariosProgramados,
  idDaDose,
  podeAdiar,
  reconciliarDoses,
  validaAgenda,
  type DoseBase,
  type MedicamentoAgenda,
} from "@dominio/medicamentos.ts";
import { horaNoFuso } from "@dominio/tempo.ts";

const SP = "America/Sao_Paulo";

function med(p: Partial<MedicamentoAgenda> = {}): MedicamentoAgenda {
  return {
    id: "ferro",
    schedule_type: "fixed_times",
    times: ["08:00", "20:00"],
    interval_hours: null,
    interval_anchor: null,
    weekdays: null,
    starts_on: "2026-10-01",
    ends_on: null,
    is_active: true,
    atualizado_em: "2026-10-01T09:00:00.000Z",
    ...p,
  };
}

const nova = (b: DoseBase) => b;
const horas = (lista: Date[], tz = SP) => lista.map((d) => horaNoFuso(d, tz));

describe("MED · agenda: horários programados", () => {
  it("horários fixos todo dia, no fuso do perfil", () => {
    const l = horariosProgramados(med(), "2026-10-06", "2026-10-07", SP);
    expect(l.map((d) => d.toISOString())).toEqual(["2026-10-06T11:00:00.000Z", "2026-10-06T23:00:00.000Z", "2026-10-07T11:00:00.000Z", "2026-10-07T23:00:00.000Z"]);
  });

  it("horários duplicados viram um só e saem em ordem", () => {
    expect(horas(horariosProgramados(med({ times: ["20:00", "08:00", "08:00"] }), "2026-10-06", "2026-10-06", SP))).toEqual(["08:00", "20:00"]);
  });

  it("dias da semana (0 = domingo)", () => {
    // 2026-10-05 é segunda; 2026-10-07, quarta.
    const l = horariosProgramados(med({ schedule_type: "weekdays", times: ["09:00"], weekdays: [1, 3] }), "2026-10-04", "2026-10-10", SP);
    expect(l.map((d) => d.toISOString().slice(0, 10))).toEqual(["2026-10-05", "2026-10-07"]);
  });

  it("a cada N horas a partir da âncora, dentro das 24 h do dia", () => {
    const m = med({ schedule_type: "interval", times: null, interval_hours: 8, interval_anchor: "06:00" });
    expect(horas(horariosProgramados(m, "2026-10-06", "2026-10-06", SP))).toEqual(["06:00", "14:00", "22:00"]);
    const m5 = med({ schedule_type: "interval", times: null, interval_hours: 5, interval_anchor: "08:00" });
    // 08, 13, 18, 23 e 04 da madrugada seguinte (ainda "do dia" da âncora).
    expect(horas(horariosProgramados(m5, "2026-10-06", "2026-10-06", SP))).toEqual(["08:00", "13:00", "18:00", "23:00", "04:00"]);
    const m24 = med({ schedule_type: "interval", times: null, interval_hours: 24, interval_anchor: "21:00" });
    expect(horas(horariosProgramados(m24, "2026-10-06", "2026-10-08", SP))).toEqual(["21:00", "21:00", "21:00"]);
  });

  it("'se necessário' não programa nada; início e fim limitam os dias", () => {
    expect(horariosProgramados(med({ schedule_type: "as_needed", times: null }), "2026-10-01", "2026-10-30", SP)).toEqual([]);
    const l = horariosProgramados(med({ starts_on: "2026-10-06", ends_on: "2026-10-07" }), "2026-10-01", "2026-10-30", SP);
    expect(l).toHaveLength(4);
  });

  it("RN-03: a mesma hora local em outro fuso é outro instante", () => {
    const [sp] = horariosProgramados(med({ times: ["08:00"] }), "2026-10-06", "2026-10-06", SP);
    const [lis] = horariosProgramados(med({ times: ["08:00"] }), "2026-10-06", "2026-10-06", "Europe/Lisbon");
    expect(horaNoFuso(lis!, "Europe/Lisbon")).toBe("08:00");
    expect(sp!.getTime() - lis!.getTime()).toBe(4 * 3_600_000);
  });

  it("validação da agenda", () => {
    expect(validaAgenda(med())).toBeNull();
    expect(validaAgenda(med({ times: [] }))).toBe("horarios");
    expect(validaAgenda(med({ times: ["06:00", "10:00", "14:00", "18:00", "22:00"] }))).toBe("horarios");
    expect(validaAgenda(med({ schedule_type: "weekdays", weekdays: [] }))).toBe("dias");
    expect(validaAgenda(med({ schedule_type: "weekdays", weekdays: [7] }))).toBe("dias");
    expect(validaAgenda(med({ schedule_type: "interval", interval_hours: 3, interval_anchor: "08:00" }))).toBe("intervalo");
    expect(validaAgenda(med({ schedule_type: "interval", interval_hours: 25, interval_anchor: "08:00" }))).toBe("intervalo");
    expect(validaAgenda(med({ schedule_type: "interval", interval_hours: 6, interval_anchor: null }))).toBe("ancora");
    expect(validaAgenda(med({ schedule_type: "as_needed", times: null }))).toBeNull();
    expect(validaAgenda(med({ ends_on: "2026-09-30" }))).toBe("fim");
  });
});

describe("MED · materialização das doses (modelo de dados)", () => {
  const agora = new Date("2026-10-06T12:00:00.000Z"); // 09:00 em SP
  // Medicamento salvo agora: nada de passado para recuperar.
  const recem = (p: Partial<MedicamentoAgenda> = {}) => med({ atualizado_em: agora.toISOString(), ...p });

  it("gera hoje e os próximos 6 dias, sem passado antes da última edição", () => {
    const { criar, apagar } = reconciliarDoses(med({ atualizado_em: "2026-10-06T11:30:00.000Z" }), [], agora, SP, nova);
    expect(apagar).toEqual([]);
    // Hoje: só 20:00 (08:00 já passou e foi antes da edição). Mais 6 dias × 2.
    expect(criar).toHaveLength(13);
    expect(criar.every((d) => d.status === "pending")).toBe(true);
    expect(criar[0]!.scheduled_at).toBe("2026-10-06T23:00:00.000Z");
    expect(criar.at(-1)!.scheduled_at).toBe("2026-10-12T23:00:00.000Z");
  });

  it("ids determinísticos: rodar duas vezes (ou no servidor) não duplica", () => {
    const m = med();
    const primeira = reconciliarDoses(m, [], agora, SP, nova).criar;
    expect(primeira.length).toBeGreaterThan(13); // inclui os dias desde o cadastro, recuperados
    const segunda = reconciliarDoses(m, primeira, agora, SP, nova);
    expect(segunda).toEqual({ criar: [], apagar: [] });
    expect(primeira[0]!.id).toBe(idDaDose("ferro", new Date(primeira[0]!.scheduled_at!)));
  });

  it("ao editar, apaga as pendentes futuras fora da agenda e cria as novas", () => {
    const antes = reconciliarDoses(recem(), [], agora, SP, nova).criar;
    const editado = recem({ times: ["08:00", "21:00"] });
    const { criar, apagar } = reconciliarDoses(editado, antes, agora, SP, nova);
    const vinte = antes.filter((d) => d.scheduled_at!.endsWith("T23:00:00.000Z"));
    expect(new Set(apagar)).toEqual(new Set(vinte.map((d) => d.id)));
    expect(criar.every((d) => d.scheduled_at!.endsWith("T00:00:00.000Z"))).toBe(true);
    expect(criar).toHaveLength(7);
  });

  it("estados finais nunca são tocados, nem no futuro", () => {
    const [dose] = reconciliarDoses(recem(), [], agora, SP, nova).criar;
    const tomada = { ...dose!, status: "taken" as const, taken_at: agora.toISOString() };
    const r = reconciliarDoses(recem({ times: ["07:00"] }), [tomada], agora, SP, nova);
    expect(r.apagar).not.toContain(tomada.id);
  });

  it("voltar a um horário antigo revive o id apagado (mesmo registro)", () => {
    const [dose] = reconciliarDoses(recem({ times: ["20:00"] }), [], agora, SP, nova).criar;
    const apagada = { ...dose!, apagado_em: agora.toISOString() };
    const r = reconciliarDoses(recem({ times: ["20:00"] }), [apagada], agora, SP, nova);
    expect(r.criar.some((d) => d.id === dose!.id && d.apagado_em === null)).toBe(true);
  });

  it("arquivado ou apagado: some com as pendentes futuras", () => {
    const doses = reconciliarDoses(recem(), [], agora, SP, nova).criar;
    expect(reconciliarDoses(recem({ is_active: false }), doses, agora, SP, nova).apagar).toHaveLength(doses.length);
    expect(reconciliarDoses(recem({ apagado_em: agora.toISOString() }), doses, agora, SP, nova).criar).toEqual([]);
  });

  it("RN-03: mudou o fuso, as pendentes futuras mantêm a hora local", () => {
    const doses = reconciliarDoses(recem(), [], agora, SP, nova).criar;
    const r = reconciliarDoses(recem(), doses, agora, "America/Manaus", nova);
    expect(r.apagar).toHaveLength(doses.length);
    expect(r.criar.every((d) => ["08:00", "20:00"].includes(horaNoFuso(new Date(d.scheduled_at!), "America/Manaus")))).toBe(true);
  });

  it("10 dias sem abrir: recupera os dias nunca gerados como 'missed', sem tocar no que existe", () => {
    const criado = med({ atualizado_em: "2026-10-01T09:00:00.000Z" });
    const noDia1 = reconciliarDoses(criado, [], new Date("2026-10-01T09:30:00.000Z"), SP, nova).criar; // até dia 7
    const volta = new Date("2026-10-11T12:00:00.000Z"); // 09:00 do dia 11
    const r = reconciliarDoses(criado, noDia1, volta, SP, nova);
    const passadas = r.criar.filter((d) => new Date(d.scheduled_at!).getTime() < volta.getTime());
    // Dias 8, 9, 10 (2 cada) e 08:00 do dia 11.
    expect(passadas.map((d) => d.scheduled_at!.slice(0, 13))).toEqual([
      "2026-10-08T11",
      "2026-10-08T23",
      "2026-10-09T11",
      "2026-10-09T23",
      "2026-10-10T11",
      "2026-10-10T23",
      "2026-10-11T11",
    ]);
    // Com mais de 2 h, já "missed"; a das 08:00 de hoje (1 h atrás) ainda pendente.
    expect(passadas.slice(0, 6).every((d) => d.status === "missed")).toBe(true);
    expect(passadas[6]!.status).toBe("pending");
    // As do dia 1–7 continuam pendentes até alguém marcar "Sem registro".
    expect(dosesSemRegistro(noDia1, volta).length).toBe(noDia1.length);
  });

  it("recém-passada (menos de 2 h) recuperada entra como pendente", () => {
    const criado = med({ times: ["08:30"], atualizado_em: "2026-10-05T09:00:00.000Z" });
    const r = reconciliarDoses(criado, [], new Date("2026-10-06T12:00:00.000Z"), SP, nova);
    const hoje = r.criar.find((d) => d.scheduled_at === "2026-10-06T11:30:00.000Z");
    expect(hoje?.status).toBe("pending");
  });

  it("não recupera dose que já existiu (mesmo apagada)", () => {
    const criado = med({ times: ["08:00"], atualizado_em: "2026-10-01T09:00:00.000Z" });
    const id = idDaDose("ferro", new Date("2026-10-05T11:00:00.000Z"));
    const apagada: DoseBase = { id, medication_id: "ferro", scheduled_at: "2026-10-05T11:00:00.000Z", status: "pending", apagado_em: "2026-10-04T00:00:00.000Z" };
    const r = reconciliarDoses(criado, [apagada], agora, SP, nova);
    expect(r.criar.some((d) => d.id === id)).toBe(false);
  });
});

describe("MED RN-04 · sem registro e lembretes", () => {
  const dose: DoseBase = { id: "d", medication_id: "m", scheduled_at: "2026-10-06T11:00:00.000Z", status: "pending", snooze_count: 0 };

  it("pendente vira 'missed' com 2 h do horário, nem um minuto antes", () => {
    expect(dosesSemRegistro([dose], new Date("2026-10-06T12:59:59.000Z"))).toEqual([]);
    expect(dosesSemRegistro([dose], new Date("2026-10-06T13:00:00.000Z"))).toEqual([dose]);
    expect(dosesSemRegistro([{ ...dose, status: "taken" }], new Date("2026-10-07T00:00:00Z"))).toEqual([]);
    expect(dosesSemRegistro([{ ...dose, apagado_em: "x" }], new Date("2026-10-07T00:00:00Z"))).toEqual([]);
  });

  it("lembrete na hora e um único reforço 30 min depois", () => {
    expect(horariosDeLembrete(dose).map((l) => [l.tipo, l.em.toISOString()])).toEqual([
      ["principal", "2026-10-06T11:00:00.000Z"],
      ["reforco", "2026-10-06T11:30:00.000Z"],
    ]);
    expect(horariosDeLembrete({ ...dose, status: "taken" })).toEqual([]);
    expect(horariosDeLembrete({ ...dose, scheduled_at: null })).toEqual([]);
  });

  it("RN-05: adiar empurra 15 min, no máximo 2 vezes; adiada troca o reforço pelo horário adiado", () => {
    const t = new Date("2026-10-06T11:01:00.000Z");
    const uma = adiar(dose, t);
    expect(uma.snooze_count).toBe(1);
    expect(uma.snoozed_until).toBe("2026-10-06T11:16:00.000Z");
    expect(horariosDeLembrete(uma).map((l) => l.tipo)).toEqual(["principal", "adiada"]);
    const duas = adiar(uma, new Date("2026-10-06T11:16:00.000Z"));
    expect(duas.snooze_count).toBe(2);
    expect(podeAdiar(duas)).toBe(false);
    expect(adiar(duas, new Date("2026-10-06T11:31:00.000Z"))).toBe(duas);
    expect(podeAdiar({ ...dose, status: "taken" })).toBe(false);
  });
});

describe("MED RN-11 · fim do tratamento", () => {
  it("passou de ends_on no fuso, arquiva", () => {
    const m = med({ ends_on: "2026-10-06" });
    expect(deveArquivar(m, new Date("2026-10-07T02:59:00Z"), SP)).toBe(false); // 23:59 do dia 6 em SP
    expect(deveArquivar(m, new Date("2026-10-07T03:00:00Z"), SP)).toBe(true);
    expect(deveArquivar(med(), new Date("2030-01-01T00:00:00Z"), SP)).toBe(false);
    expect(deveArquivar({ ...m, is_active: false }, new Date("2030-01-01T00:00:00Z"), SP)).toBe(false);
  });
});

describe("MED · job do servidor (manutenção)", () => {
  it("arquiva, materializa, apaga pendentes fora da agenda e marca 'missed', sem repetir", async () => {
    const { manutencaoDasDoses } = await import("@dominio/medicamentos.ts");
    const agora = new Date("2026-10-06T12:00:00.000Z");
    const ativo = med({ id: "a", atualizado_em: agora.toISOString() });
    const acabou = med({ id: "b", ends_on: "2026-10-05", atualizado_em: "2026-10-01T00:00:00.000Z" });
    const velha: DoseBase = { id: "v", medication_id: "a", scheduled_at: "2026-10-06T08:00:00.000Z", status: "pending" };
    const futuraDoB: DoseBase = { id: "fb", medication_id: "b", scheduled_at: "2026-10-07T11:00:00.000Z", status: "pending" };
    const r = manutencaoDasDoses([ativo, acabou], [velha, futuraDoB], agora, SP);
    expect(r.arquivar).toEqual(["b"]);
    expect(r.apagar).toEqual(["fb"]);
    expect(r.semRegistro).toEqual(["v"]);
    expect(r.criar.every((d) => d.medication_id === "a")).toBe(true);
    const de_novo = manutencaoDasDoses([ativo, { ...acabou, is_active: false }], [{ ...velha, status: "missed" }, ...r.criar], agora, SP);
    expect(de_novo).toEqual({ arquivar: [], criar: [], apagar: [], semRegistro: [] });
  });
});
