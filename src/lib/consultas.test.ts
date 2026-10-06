import { beforeEach, describe, expect, it } from "vitest";

import { adicionarPergunta, cancelarConsulta, concluirConsulta, dispensarComoFoi, excluirConsulta, migrarConsultasAntigas, salvarConsulta } from "@/lib/consultas-acoes";
import { appointmentMeasures, appointmentQuestions, appointments, type Appointment, type AppointmentQuestion } from "@/lib/dados/colecoes";
import { idbLimpar, idbTodos, STORE_OUTBOX } from "@/lib/offline/idb";
import { enfileirar, type ItemOutbox } from "@/lib/offline/outbox";
import { dataDeRetorno, diasDeRetorno, pautaDaConsulta, proximaConsulta } from "@dominio/consultas.ts";
import { dumDaDpp, somarDiasISO } from "@dominio/tempo.ts";

import {
  consultaParaPerguntar,
  converterConsultaAntiga,
  estadoDoCard,
  lerMedida,
  linhaDoTempo,
  perguntaValida,
  perguntasAoConcluir,
  resumoMedidas,
  statusInicial,
  temMedidas,
  ultimasMedidas,
} from "./consultas";

const SP = "America/Sao_Paulo";
const agora = new Date("2026-09-30T13:00:00.000Z"); // 10:00 em SP

function c(id: string, startsAt: string, p: Partial<Appointment> = {}): Appointment {
  return { id, starts_at: startsAt, kind: "prenatal", provider_name: null, provider_role: null, location: null, status: "scheduled", followup_dismissed: false, atualizado_em: "", ...p };
}
function q(id: string, appointmentId: string | null, p: Partial<AppointmentQuestion> = {}): AppointmentQuestion {
  return { id, appointment_id: appointmentId, text: `pergunta ${id}`, was_asked: false, answer: null, position: Number(id.replace(/\D/g, "")) || 0, atualizado_em: "", ...p };
}

describe("CRO RN-01 · nova consulta", () => {
  it("data passada nasce concluída; futura, marcada", () => {
    expect(statusInicial(new Date("2026-09-29T13:00:00Z"), agora)).toBe("done");
    expect(statusInicial(new Date("2026-10-10T13:00:00Z"), agora)).toBe("scheduled");
  });
});

describe("CRO RN-02 · pauta", () => {
  const hojeMaisTarde = c("hoje", "2026-09-30T18:00:00.000Z");
  const semana = c("semana", "2026-10-07T13:00:00.000Z");
  const antiga = c("antiga", "2026-08-01T13:00:00.000Z");

  it("pergunta solta aparece na consulta 'scheduled' mais próxima (a de hoje segura até concluir)", () => {
    expect(proximaConsulta([semana, hojeMaisTarde, antiga], agora, SP)?.id).toBe("hoje");
    const jaPassouHoje = new Date("2026-09-30T23:00:00.000Z");
    expect(proximaConsulta([semana, hojeMaisTarde], jaPassouHoje, SP)?.id).toBe("hoje");
    expect(proximaConsulta([semana, { ...hojeMaisTarde, status: "done" }], agora, SP)?.id).toBe("semana");
    expect(proximaConsulta([antiga], agora, SP)).toBeUndefined();
  });

  it("pauta: vinculadas + soltas só na próxima; feitas e apagadas fora; em ordem", () => {
    const perguntas = [q("p3", null), q("p1", "semana"), q("p2", null), q("p4", null, { was_asked: true }), q("p5", null, { apagado_em: "x" })];
    expect(pautaDaConsulta(semana, semana, perguntas).map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
    expect(pautaDaConsulta(semana, hojeMaisTarde, perguntas).map((p) => p.id)).toEqual(["p1"]);
    // Sem consulta nenhuma: dá para anotar mesmo assim.
    expect(pautaDaConsulta(undefined, undefined, perguntas).map((p) => p.id)).toEqual(["p2", "p3"]);
  });

  it("ao concluir: feitas ficam com a resposta; não feitas voltam a ser soltas", () => {
    const perguntas = [q("p1", null), q("p2", null), q("p3", "semana"), q("p4", "outra"), q("p5", null, { was_asked: true, appointment_id: "velha" })];
    const r = perguntasAoConcluir("semana", perguntas, { p1: { was_asked: true, answer: " tudo certo " }, p3: { was_asked: true, answer: "" } });
    expect(r).toEqual([
      { ...perguntas[0], appointment_id: "semana", was_asked: true, answer: "tudo certo" },
      { ...perguntas[1], appointment_id: null, was_asked: false },
      { ...perguntas[2], appointment_id: "semana", was_asked: true, answer: null },
    ]);
  });

  it("texto de 3 a 280 caracteres", () => {
    expect(perguntaValida("oi")).toBe(false);
    expect(perguntaValida("  Posso tomar café?  ")).toBe(true);
    expect(perguntaValida("x".repeat(281))).toBe(false);
  });
});

describe("CRO RN-04 · medidas", () => {
  it("faixas do modelo: fora vira erro ('Confira o valor'), vazio é opcional", () => {
    expect(lerMedida("weight_kg", "72,5")).toBe(72.5);
    expect(lerMedida("weight_kg", "29.9")).toBe("erro");
    expect(lerMedida("weight_kg", "250")).toBe(250);
    expect(lerMedida("weight_kg", "")).toBeNull();
    expect(lerMedida("weight_kg", "abc")).toBe("erro");
    expect(lerMedida("weight_kg", "-70")).toBe("erro");
    expect(lerMedida("bp_sys", "120")).toBe(120);
    expect(lerMedida("bp_sys", "120.5")).toBe("erro");
    expect(lerMedida("bp_sys", "59")).toBe("erro");
    expect(lerMedida("bp_sys", "261")).toBe("erro");
    expect(lerMedida("bp_dia", "29")).toBe("erro");
    expect(lerMedida("bp_dia", "160")).toBe(160);
    expect(lerMedida("fundal_height_cm", "0")).toBe(0);
    expect(lerMedida("fundal_height_cm", "28,25")).toBe(28.3);
    expect(lerMedida("fundal_height_cm", "60.1")).toBe("erro");
    expect(lerMedida("fetal_heart_rate", "140")).toBe(140);
    expect(lerMedida("fetal_heart_rate", "221")).toBe("erro");
  });

  it("resumo só mostra os números, sem interpretação", () => {
    const m = { weight_kg: 72.5, bp_sys: 110, bp_dia: 70, fundal_height_cm: null, fetal_heart_rate: null };
    expect(resumoMedidas(m)).toBe("72,5 kg · 110/70 mmHg");
    expect(resumoMedidas({ ...m, weight_kg: null, bp_sys: null, bp_dia: null, fundal_height_cm: 28, fetal_heart_rate: 140 })).toBe("altura uterina 28 cm · batimentos 140 bpm");
    expect(temMedidas({ weight_kg: null, bp_sys: null, bp_dia: null, fundal_height_cm: null, fetal_heart_rate: null })).toBe(false);
    expect(temMedidas(m)).toBe(true);
    expect(resumoMedidas(m)).not.toMatch(/alta|baixa|normal|alerta/i);
  });
});

describe("CRO RN-05 · sugestão de retorno", () => {
  const dpp = "2027-01-06";
  const dum = dumDaDpp(dpp);
  const naSemana = (s: number, d = 0) => somarDiasISO(dum, s * 7 + d);

  it("28 dias antes de 28s0d; 14 de 28s0d a 35s6d; 7 a partir de 36s0d", () => {
    expect(diasDeRetorno(dpp, naSemana(27, 6))).toBe(28);
    expect(diasDeRetorno(dpp, naSemana(28, 0))).toBe(14);
    expect(diasDeRetorno(dpp, naSemana(30, 2))).toBe(14);
    expect(diasDeRetorno(dpp, naSemana(35, 6))).toBe(14);
    expect(diasDeRetorno(dpp, naSemana(36, 0))).toBe(7);
    expect(diasDeRetorno(dpp, naSemana(41, 0))).toBe(7);
  });

  it("na semana 30, sugere 14 dias depois da data da consulta", () => {
    expect(dataDeRetorno(dpp, naSemana(30))).toBe(naSemana(32));
  });
});

describe("CRO RN-07 · 'Como foi a consulta?'", () => {
  it("do dia seguinte em diante, a mais antiga primeiro; uma vez cada", () => {
    const hoje = c("hoje", "2026-09-30T12:00:00.000Z");
    const ontem = c("ontem", "2026-09-29T12:00:00.000Z");
    const meses = c("meses", "2026-06-10T12:00:00.000Z");
    expect(consultaParaPerguntar([hoje], agora, SP)).toBeUndefined();
    expect(consultaParaPerguntar([hoje, ontem], agora, SP)?.id).toBe("ontem");
    expect(consultaParaPerguntar([ontem, meses], agora, SP)?.id).toBe("meses");
    expect(consultaParaPerguntar([{ ...meses, followup_dismissed: true }, ontem], agora, SP)?.id).toBe("ontem");
    expect(consultaParaPerguntar([{ ...ontem, status: "done" }, { ...meses, status: "cancelled" }], agora, SP)).toBeUndefined();
  });

  it("card da home: 'Como foi?' antes da próxima; próxima iminente com 24 h", () => {
    const amanha = c("amanha", "2026-10-01T12:00:00.000Z");
    const semana = c("semana", "2026-10-07T12:00:00.000Z");
    expect(estadoDoCard([semana, amanha], agora, SP)).toEqual({ tipo: "proxima", consulta: amanha, iminente: true });
    expect(estadoDoCard([semana], agora, SP)).toEqual({ tipo: "proxima", consulta: semana, iminente: false });
    expect(estadoDoCard([semana, c("ontem", "2026-09-29T12:00:00.000Z")], agora, SP).tipo).toBe("como_foi");
    expect(estadoDoCard([], agora, SP)).toEqual({ tipo: "nenhuma" });
  });

  it("linha do tempo: próxima, futuras e passadas", () => {
    const t = linhaDoTempo([c("a", "2026-10-07T12:00:00Z"), c("b", "2026-10-01T12:00:00Z"), c("p", "2026-09-01T12:00:00Z", { status: "done" }), c("x", "2026-10-20T12:00:00Z", { status: "cancelled" })], agora, SP);
    expect(t.proxima?.id).toBe("b");
    expect(t.futuras.map((x) => x.id)).toEqual(["a"]);
    expect(t.passadas.map((x) => x.id)).toEqual(["x", "p"]);
  });
});

describe("CRO · ações na coleção", () => {
  beforeEach(async () => {
    localStorage.clear();
    appointments.limpar();
    appointmentQuestions.limpar();
    appointmentMeasures.limpar();
    await idbLimpar(STORE_OUTBOX);
  });

  it("concluir: 3 perguntas, 2 feitas; a que sobrou vai para a pauta da próxima", () => {
    const atual = salvarConsulta({ starts_at: "2026-10-01T12:00:00.000Z", kind: "prenatal", provider_name: "Dra. Ana", provider_role: "obstetrician", location: null }, null, agora);
    const proxima = salvarConsulta({ starts_at: "2026-10-15T12:00:00.000Z", kind: "prenatal", provider_name: null, provider_role: null, location: null }, null, agora);
    const [p1, p2, p3] = ["Posso viajar?", "Café pode?", "E o enjoo?"].map((t) => adicionarPergunta(t));
    expect(pautaDaConsulta(atual, proximaConsulta(appointments.listar(), agora, SP), appointmentQuestions.listar())).toHaveLength(3);

    concluirConsulta(atual, {
      medidas: { weight_kg: 70, bp_sys: 110, bp_dia: 70, fundal_height_cm: null, fetal_heart_rate: null, notes_after: "Voltar em 4 semanas" },
      respostas: { [p1!.id]: { was_asked: true, answer: "pode" }, [p2!.id]: { was_asked: true, answer: null } },
    });
    expect(appointments.obter(atual.id)?.status).toBe("done");
    expect(appointmentMeasures.obter(atual.id)).toMatchObject({ appointment_id: atual.id, weight_kg: 70, notes_after: "Voltar em 4 semanas" });
    const depois = proximaConsulta(appointments.listar(), new Date("2026-10-02T12:00:00Z"), SP);
    expect(depois?.id).toBe(proxima.id);
    expect(pautaDaConsulta(depois, depois, appointmentQuestions.listar()).map((p) => p.id)).toEqual([p3!.id]);
    expect(appointmentQuestions.obter(p1!.id)).toMatchObject({ appointment_id: atual.id, was_asked: true, answer: "pode" });
  });

  it("concluir sem nenhum passo também vale (todos opcionais)", () => {
    const a = salvarConsulta({ starts_at: "2026-10-01T12:00:00.000Z", kind: "ultrasound", provider_name: null, provider_role: null, location: null }, null, agora);
    concluirConsulta(a, { medidas: null, respostas: {} });
    expect(appointments.obter(a.id)?.status).toBe("done");
    expect(appointmentMeasures.listar()).toEqual([]);
  });

  it("RN-11: excluir apaga medidas e solta as perguntas; cancelar solta as não feitas", () => {
    const a = salvarConsulta({ starts_at: "2026-10-01T12:00:00.000Z", kind: "prenatal", provider_name: null, provider_role: null, location: null }, null, agora);
    concluirConsulta(a, { medidas: { weight_kg: 70, bp_sys: null, bp_dia: null, fundal_height_cm: null, fetal_heart_rate: null, notes_after: null }, respostas: {} });
    const p = adicionarPergunta("Pergunta vinculada", a.id);
    excluirConsulta(appointments.obter(a.id)!);
    expect(appointments.listar()).toEqual([]);
    expect(appointmentMeasures.listar()).toEqual([]);
    expect(appointmentQuestions.obter(p.id)?.appointment_id).toBeNull();

    const b = salvarConsulta({ starts_at: "2026-10-03T12:00:00.000Z", kind: "prenatal", provider_name: null, provider_role: null, location: null }, null, agora);
    const pb = adicionarPergunta("Outra vinculada", b.id);
    expect(cancelarConsulta(b).status).toBe("cancelled");
    expect(appointmentQuestions.obter(pb.id)?.appointment_id).toBeNull();
    expect(dispensarComoFoi(b).followup_dismissed).toBe(true);
  });

  it("últimas medidas: da concluída mais recente que tem alguma", () => {
    const velha = c("v", "2026-08-01T12:00:00Z", { status: "done" });
    const nova = c("n", "2026-09-01T12:00:00Z", { status: "done" });
    const semMedida = c("s", "2026-09-20T12:00:00Z", { status: "done" });
    const m = (id: string, w: number | null) => ({ id, appointment_id: id, weight_kg: w, bp_sys: null, bp_dia: null, fundal_height_cm: null, fetal_heart_rate: null, notes_after: null, atualizado_em: "" });
    expect(ultimasMedidas([velha, nova, semMedida], [m("v", 60), m("n", 62), m("s", null)])?.consulta.id).toBe("n");
    expect(ultimasMedidas([velha], [])).toBeNull();
  });
});

describe("CRO · migração da antiga `consultas`", () => {
  beforeEach(async () => {
    localStorage.clear();
    appointments.limpar();
    appointmentMeasures.limpar();
    await idbLimpar(STORE_OUTBOX);
  });

  it("converte tipo, status, profissional e notas", () => {
    const r = converterConsultaAntiga({ id: "a", data: "2026-10-01T12:00:00.000Z", tipo: "ultrassom", profissional: "Dr. Leo", local: "Clínica", realizada: true, notas: "repouso", atualizado_em: "2026-09-01T00:00:00Z" });
    expect(r.consulta).toMatchObject({ id: "a", starts_at: "2026-10-01T12:00:00.000Z", kind: "ultrasound", provider_name: "Dr. Leo", location: "Clínica", status: "done" });
    expect(r.medidas).toMatchObject({ id: "a", appointment_id: "a", notes_after: "repouso" });
    expect(converterConsultaAntiga({ id: "b", data: "x", tipo: "exame", realizada: false, atualizado_em: "" }).consulta).toMatchObject({ kind: "other", status: "scheduled" });
  });

  it("migra a coleção local uma vez e troca a tabela dos itens parados na outbox", async () => {
    const antiga = { id: "a", data: "2026-10-10T12:00:00.000Z", tipo: "pre_natal", realizada: false, atualizado_em: "2026-09-01T00:00:00Z" };
    localStorage.setItem("ninho.consultas", JSON.stringify([antiga]));
    await enfileirar("consultas" as never, antiga);
    expect(await migrarConsultasAntigas()).toBe(1);
    expect(appointments.listar().map((x) => x.id)).toEqual(["a"]);
    expect(localStorage.getItem("ninho.consultas")).toBeNull();
    const fila = await idbTodos<ItemOutbox>(STORE_OUTBOX);
    expect(fila.map((i) => [i.id, i.tabela])).toEqual([["appointments:a", "appointments"]]);
    expect(fila[0]!.payload).toMatchObject({ starts_at: antiga.data, kind: "prenatal", status: "scheduled" });
    expect(await migrarConsultasAntigas()).toBe(0);
    expect(appointments.listar()).toHaveLength(1);
  });
});
