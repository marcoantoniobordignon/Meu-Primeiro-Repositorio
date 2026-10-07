import { describe, expect, it } from "vitest";

import type { Medication, MedicationDose } from "@/lib/dados/colecoes";

import {
  adesao,
  adesaoPorDia,
  casarMedicamento,
  descreverAgenda,
  diasNavegaveis,
  dosePendenteMaisProxima,
  dosesDoDia,
  intencaoTomei,
  minutosDeAtraso,
  podeAtivarMais,
  podeRegistrarRetroativo,
  sequencia,
  sugestoesDeNome,
  textoDaLista,
} from "./regras";

const SP = "America/Sao_Paulo";

function med(id: string, name: string, p: Partial<Medication> = {}): Medication {
  return {
    id,
    name,
    dose: null,
    instructions: null,
    schedule_type: "fixed_times",
    times: ["08:00"],
    interval_hours: null,
    interval_anchor: null,
    weekdays: null,
    starts_on: "2026-10-01",
    ends_on: null,
    is_active: true,
    reminders_on: true,
    color_key: "primaria",
    atualizado_em: "",
    ...p,
  };
}

let seq = 0;
function dose(scheduled: string | null, status: MedicationDose["status"], p: Partial<MedicationDose> = {}): MedicationDose {
  return { id: `d${seq++}`, medication_id: "m", scheduled_at: scheduled, status, taken_at: null, source: null, snooze_count: 0, snoozed_until: null, atualizado_em: "", ...p };
}

// "2026-10-06T11:00Z" = 08:00 em SP.
const agora = new Date("2026-10-06T15:00:00.000Z"); // 12:00 em SP

describe("MED RN-01/02 · cadastro", () => {
  it("autocompletar sem acento, começa-com antes de contém, nunca o que já foi digitado", () => {
    expect(sugestoesDeNome("a")).toEqual([]);
    expect(sugestoesDeNome("acido")).toEqual(["Ácido fólico", "Ácido acetilsalicílico"]);
    expect(sugestoesDeNome("ferr")).toEqual(["Ferro quelato", "Sulfato ferroso"]);
    expect(sugestoesDeNome("ácido fólico")).toEqual([]);
    expect(sugestoesDeNome("vitamina").length).toBeLessThanOrEqual(6);
  });

  it("descreve a agenda em uma linha", () => {
    expect(descreverAgenda(med("a", "x", { times: ["20:00", "08:00"] }))).toBe("08:00 e 20:00");
    expect(descreverAgenda(med("a", "x", { times: ["06:00", "12:00", "18:00"] }))).toBe("06:00, 12:00 e 18:00");
    expect(descreverAgenda(med("a", "x", { schedule_type: "weekdays", weekdays: [5, 1, 3], times: ["09:00"] }))).toBe("seg, qua e sex às 09:00");
    expect(descreverAgenda(med("a", "x", { schedule_type: "interval", interval_hours: 8, interval_anchor: "06:00" }))).toBe("a cada 8 h, desde 06:00");
    expect(descreverAgenda(med("a", "x", { schedule_type: "as_needed" }))).toBe("se necessário");
  });
});

describe("MED RN-11 · limite do free", () => {
  const tres = [med("1", "a"), med("2", "b"), med("3", "c")];
  it("free: até 3 ativos; arquivados e apagados não contam; premium ilimitado", () => {
    expect(podeAtivarMais(tres.slice(0, 2), false)).toBe(true);
    expect(podeAtivarMais(tres, false)).toBe(false);
    expect(podeAtivarMais(tres, true)).toBe(true);
    expect(podeAtivarMais([...tres.slice(0, 2), med("4", "d", { is_active: false }), med("5", "e", { apagado_em: "x" })], false)).toBe(true);
  });
});

describe("MED · tela Hoje", () => {
  it("doses do dia em ordem, no fuso; 'se necessário' pela hora em que foi tomada", () => {
    const l = [
      dose("2026-10-06T23:00:00.000Z", "pending"),
      dose("2026-10-06T11:00:00.000Z", "taken"),
      dose("2026-10-07T02:30:00.000Z", "pending"), // 23:30 do dia 6 em SP
      dose("2026-10-07T03:30:00.000Z", "pending"), // 00:30 do dia 7
      dose(null, "taken", { taken_at: "2026-10-06T14:00:00.000Z" }),
      dose("2026-10-06T12:00:00.000Z", "pending", { apagado_em: "x" }),
    ];
    expect(dosesDoDia(l, "2026-10-06", SP).map((d) => d.scheduled_at ?? d.taken_at)).toEqual([
      "2026-10-06T11:00:00.000Z",
      "2026-10-06T14:00:00.000Z",
      "2026-10-06T23:00:00.000Z",
      "2026-10-07T02:30:00.000Z",
    ]);
  });

  it("RN-08: retroativo até 7 dias atrás; dá para escolher hoje e os 7 dias antes", () => {
    expect(podeRegistrarRetroativo(dose("2026-09-29T11:00:00.000Z", "missed"), agora, SP)).toBe(true);
    expect(podeRegistrarRetroativo(dose("2026-09-28T23:00:00.000Z", "missed"), agora, SP)).toBe(false);
    expect(podeRegistrarRetroativo(dose(null, "taken"), agora, SP)).toBe(false);
    expect(diasNavegaveis(agora, SP)).toEqual(["2026-10-06", "2026-10-05", "2026-10-04", "2026-10-03", "2026-10-02", "2026-10-01", "2026-09-30", "2026-09-29"]);
  });

  it("minutos de atraso para o evento", () => {
    expect(minutosDeAtraso({ scheduled_at: "2026-10-06T11:00:00.000Z" }, new Date("2026-10-06T11:12:30Z"))).toBe(13);
    expect(minutosDeAtraso({ scheduled_at: "2026-10-06T11:00:00.000Z" }, new Date("2026-10-06T10:50:00Z"))).toBe(-10);
    expect(minutosDeAtraso({ scheduled_at: null }, agora)).toBe(0);
  });
});

describe("MED RN-07/09 · adesão", () => {
  const l = [
    dose("2026-10-06T11:00:00.000Z", "taken"),
    dose("2026-10-06T23:00:00.000Z", "pending"), // futura: fora
    dose("2026-10-05T11:00:00.000Z", "skipped"),
    dose("2026-10-05T23:00:00.000Z", "missed"),
    dose("2026-10-04T11:00:00.000Z", "taken"),
    dose("2026-09-20T11:00:00.000Z", "missed"), // fora dos 7 dias, dentro dos 30
    dose(null, "taken", { taken_at: "2026-10-06T14:00:00.000Z" }), // se necessário: fora
    dose("2026-10-06T14:30:00.000Z", "pending"), // passou, mas ainda pendente: fora
    dose("2026-10-03T11:00:00.000Z", "taken", { apagado_em: "x" }),
  ];

  it("tomadas / (tomadas + puladas + sem registro), só horários que já passaram", () => {
    expect(adesao(l, agora, SP, 7)).toEqual({ tomadas: 2, puladas: 1, semRegistro: 1, taxa: 0.5 });
    expect(adesao(l, agora, SP, 30)).toEqual({ tomadas: 2, puladas: 1, semRegistro: 2, taxa: 0.4 });
  });

  it("pular conta como registrada mas não como tomada", () => {
    expect(adesao([dose("2026-10-06T11:00:00.000Z", "skipped")], agora, SP, 7).taxa).toBe(0);
  });

  it("sem dose contável: taxa nula", () => {
    expect(adesao([], agora, SP, 7)).toEqual({ tomadas: 0, puladas: 0, semRegistro: 0, taxa: null });
  });

  it("registro retroativo de anteontem atualiza a adesão", () => {
    const antes = [dose("2026-10-04T11:00:00.000Z", "missed"), dose("2026-10-06T11:00:00.000Z", "taken")];
    expect(adesao(antes, agora, SP, 7).taxa).toBe(0.5);
    const depois = [{ ...antes[0]!, status: "taken" as const, source: "backfill" as const }, antes[1]!];
    expect(adesao(depois, agora, SP, 7).taxa).toBe(1);
  });

  it("barras por dia, do mais antigo para hoje", () => {
    const barras = adesaoPorDia(l, agora, SP, 7);
    expect(barras).toHaveLength(7);
    expect(barras.at(-1)).toEqual({ data: "2026-10-06", taxa: 1, programadas: 2 });
    expect(barras.at(-2)).toEqual({ data: "2026-10-05", taxa: 0, programadas: 2 });
    expect(barras.at(-3)).toEqual({ data: "2026-10-04", taxa: 1, programadas: 1 });
    expect(barras[0]).toEqual({ data: "2026-09-30", taxa: null, programadas: 0 });
  });
});

describe("MED RN-10 · sequência", () => {
  it("conta dias seguidos com 100 % tomadas, a partir de ontem", () => {
    const l = [
      dose("2026-10-06T11:00:00.000Z", "missed"), // hoje não entra
      dose("2026-10-05T11:00:00.000Z", "taken"),
      dose("2026-10-05T23:00:00.000Z", "taken"),
      dose("2026-10-04T11:00:00.000Z", "taken"),
      dose("2026-10-03T11:00:00.000Z", "taken"),
      dose("2026-10-02T11:00:00.000Z", "skipped"),
      dose("2026-10-01T11:00:00.000Z", "taken"),
    ];
    expect(sequencia(l, agora, SP)).toBe(3);
  });

  it("dia sem dose programada não quebra (nem soma); 'se necessário' não conta", () => {
    const l = [
      dose("2026-10-05T11:00:00.000Z", "taken"),
      // 2026-10-04 sem dose (dias da semana)
      dose("2026-10-03T11:00:00.000Z", "taken"),
      dose(null, "skipped", { taken_at: "2026-10-04T11:00:00.000Z" }),
    ];
    expect(sequencia(l, agora, SP)).toBe(2);
  });

  it("uma dose não tomada no dia quebra; sem doses, zero", () => {
    expect(sequencia([dose("2026-10-05T11:00:00.000Z", "taken"), dose("2026-10-05T23:00:00.000Z", "missed")], agora, SP)).toBe(0);
    expect(sequencia([], agora, SP)).toBe(0);
  });

  it("hoje completo ainda não soma", () => {
    expect(sequencia([dose("2026-10-06T11:00:00.000Z", "taken")], agora, SP)).toBe(0);
  });
});

describe("MED RN-12 · por voz", () => {
  const meds = [med("ferro", "Sulfato ferroso"), med("vd", "Vitamina D"), med("b12", "Vitamina B12"), med("af", "Ácido fólico"), med("arq", "Ferro antigo", { is_active: false })];

  it("entende 'tomei ...' e ignora o resto", () => {
    expect(intencaoTomei("Tomei o ferro")).toBe("ferro");
    expect(intencaoTomei("acabei de tomar a vitamina D agora")).toBe("vitamina d");
    expect(intencaoTomei("já tomei meu ácido fólico")).toBe("acido folico");
    expect(intencaoTomei("tomei")).toBe("");
    expect(intencaoTomei("dormiu 20 minutos")).toBeNull();
  });

  it("um acerto pelo nome normalizado (sem acento, prefixo, ativos só)", () => {
    expect(casarMedicamento("ferro", meds).map((m) => m.id)).toEqual(["ferro"]);
    expect(casarMedicamento("acido folico", meds).map((m) => m.id)).toEqual(["af"]);
    expect(casarMedicamento("vitamina d", meds).map((m) => m.id)).toEqual(["vd"]);
    expect(casarMedicamento("FÓLICO", meds).map((m) => m.id)).toEqual(["af"]);
  });

  it("zero ou vários acertos (abre o sheet para escolher)", () => {
    expect(casarMedicamento("vitamina", meds).map((m) => m.id).sort()).toEqual(["b12", "vd"]);
    expect(casarMedicamento("insulina", meds)).toEqual([]);
    expect(casarMedicamento("", meds)).toEqual([]);
  });

  it("registra a dose pendente mais próxima de agora", () => {
    const l = [
      dose("2026-10-06T11:00:00.000Z", "pending", { medication_id: "ferro" }),
      dose("2026-10-06T23:00:00.000Z", "pending", { medication_id: "ferro" }),
      dose("2026-10-06T15:10:00.000Z", "taken", { medication_id: "ferro" }),
      dose("2026-10-06T15:05:00.000Z", "pending", { medication_id: "outro" }),
    ];
    expect(dosePendenteMaisProxima(l, "ferro", agora)?.scheduled_at).toBe("2026-10-06T11:00:00.000Z");
    expect(dosePendenteMaisProxima(l, "nada", agora)).toBeUndefined();
    // Longe demais (mais de 12 h): vira uma tomada sem horário, não a dose de amanhã.
    expect(dosePendenteMaisProxima([dose("2026-10-07T11:00:00.000Z", "pending", { medication_id: "ferro" })], "ferro", agora)).toBeUndefined();
  });
});

describe("MED · compartilhar a lista", () => {
  it("só ativos, em ordem alfabética, com o que ela anotou", () => {
    const texto = textoDaLista(
      [med("b", "Vitamina D", { dose: "1 gota", times: ["08:00"] }), med("a", "Ácido fólico", { instructions: "em jejum" }), med("c", "Antigo", { is_active: false })],
      "Meus medicamentos",
    );
    expect(texto).toBe("Meus medicamentos\n• Ácido fólico · 08:00 · em jejum\n• Vitamina D · 1 gota · 08:00");
  });
});
