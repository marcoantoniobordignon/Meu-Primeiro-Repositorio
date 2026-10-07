import { describe, expect, it } from "vitest";

import { gerarExamesPadrao, type ExameBase } from "@dominio/exames.ts";
import { planejar as planejarTudo, selecionarParaEnvio, TOLERANCIA_MS, type EstadoParaLembretes, type Lembrete } from "@dominio/lembretes.ts";
import type { DoseBase } from "@dominio/medicamentos.ts";
import { dumDaDpp, horaNoFuso, dataNoFuso, instanteLocal, MS_HORA, MS_MIN, somarDiasISO } from "@dominio/tempo.ts";

// A virada de trimestre (funcionalidade 11) tem os testes dela em trimestre.test.ts; aqui, as outras categorias.
const planejar = (e: EstadoParaLembretes) => planejarTudo(e).filter((l) => l.categoria !== "trimester");

const SP = "America/Sao_Paulo";
const DPP = "2027-03-08";
const DUM = dumDaDpp(DPP); // 2026-06-01
const semana = (s: number, d = 0) => somarDiasISO(DUM, s * 7 + d);

function estado(p: Partial<EstadoParaLembretes> = {}): EstadoParaLembretes {
  return {
    agora: new Date("2026-10-06T15:00:00.000Z"),
    tz: SP,
    dpp: DPP,
    criadaEm: "2026-07-01T12:00:00.000Z",
    prefs: { belly_reminders: false },
    medicamentos: [],
    doses: [],
    exames: [],
    consultas: [],
    perguntas: [],
    semanasComFoto: [],
    // Por padrão, os marcos com push já respondidos: cada bloco testa só a sua categoria.
    marcos: { respondidos: ["discovery", "sex_known", "first_kick"], estados: [] },
    ...p,
  };
}

/** Roda o planejador minuto a minuto entre dois instantes, como o job, e devolve o que saiu. */
function simular(base: EstadoParaLembretes, de: Date, ate: Date, passoMin = 1): (Lembrete & { saiuEm: Date })[] {
  const enviados: (Lembrete & { saiuEm: Date })[] = [];
  for (let t = de.getTime(); t <= ate.getTime(); t += passoMin * MS_MIN) {
    const agora = new Date(t);
    const novos = selecionarParaEnvio(planejar({ ...base, agora }), {
      agora,
      tz: base.tz,
      prefs: base.prefs,
      enviados: enviados.map((l) => ({ chave: l.chave, categoria: l.categoria, ref: l.ref, enviado_em: l.saiuEm.toISOString(), essencial: l.essencial })),
    });
    enviados.push(...novos.map((l) => ({ ...l, saiuEm: agora })));
  }
  return enviados;
}

const ferro = { id: "ferro", name: "Sulfato ferroso", dose: "1 comprimido", is_active: true, reminders_on: true };
function dose(id: string, em: string, p: Partial<DoseBase> = {}): DoseBase {
  return { id, medication_id: "ferro", scheduled_at: em, status: "pending", snooze_count: 0, snoozed_until: null, ...p };
}

describe("MED RN-04/05/13 · lembretes de dose", () => {
  const as8 = instanteLocal("2026-10-06", "08:00", SP);
  const as20 = instanteLocal("2026-10-06", "20:00", SP);

  it("08:00 e 20:00: dois lembretes na hora, mais um reforço de cada sem resposta", () => {
    const e = estado({ medicamentos: [ferro], doses: [dose("d8", as8.toISOString()), dose("d20", as20.toISOString())] });
    const saiu = simular(e, new Date(as8.getTime() - 5 * MS_MIN), new Date(as20.getTime() + 60 * MS_MIN));
    expect(saiu.map((l) => [l.tipo, horaNoFuso(l.saiuEm, SP)])).toEqual([
      ["med_dose_principal", "08:00"],
      ["med_dose_reforco", "08:30"],
      ["med_dose_principal", "20:00"],
      ["med_dose_reforco", "20:30"],
    ]);
    expect(saiu[0]).toMatchObject({ titulo: "Hora do Sulfato ferroso", acoes: ["tomei", "adiar"], url: expect.stringContaining("/medicamentos?dose=d8") });
  });

  it("tomada antes do reforço: o reforço não sai", () => {
    const e = estado({ medicamentos: [ferro], doses: [dose("d8", as8.toISOString())] });
    const primeiro = simular(e, as8, as8);
    expect(primeiro).toHaveLength(1);
    const tomada = { ...e, doses: [dose("d8", as8.toISOString(), { status: "taken" })] };
    expect(planejar({ ...tomada, agora: new Date(as8.getTime() + 30 * MS_MIN) })).toEqual([]);
  });

  it("adiada: sai de novo no horário adiado; a terceira não oferece 'Adiar'", () => {
    const adiada = dose("d8", as8.toISOString(), { snooze_count: 2, snoozed_until: new Date(as8.getTime() + 31 * MS_MIN).toISOString() });
    const [l] = selecionarParaEnvio(planejar(estado({ medicamentos: [ferro], doses: [adiada], agora: new Date(as8.getTime() + 31 * MS_MIN) })), { agora: new Date(as8.getTime() + 31 * MS_MIN), tz: SP, prefs: {}, enviados: [{ chave: "med:d8:principal", categoria: "med", ref: "d8", enviado_em: as8.toISOString() }] });
    expect(l).toMatchObject({ tipo: "med_dose_adiada", acoes: ["tomei"] });
  });

  it("lembrete desligado (RN-15), arquivado ou 'se necessário' não avisam", () => {
    const base = { doses: [dose("d8", as8.toISOString()), dose("solta", as8.toISOString(), { scheduled_at: null })] };
    expect(planejar(estado({ ...base, medicamentos: [{ ...ferro, reminders_on: false }], agora: as8 }))).toEqual([]);
    expect(planejar(estado({ ...base, medicamentos: [{ ...ferro, is_active: false }], agora: as8 }))).toEqual([]);
    expect(planejar(estado({ doses: [dose("solta", as8.toISOString(), { scheduled_at: null })], medicamentos: [ferro], agora: as8 }))).toEqual([]);
  });

  it("modo discreto: o push não mostra o nome do remédio", () => {
    const [l] = planejar(estado({ medicamentos: [ferro], doses: [dose("d8", as8.toISOString())], agora: as8, prefs: { notifications_discreet: true, belly_reminders: false } }));
    expect(l!.titulo).toBe("Hora do seu lembrete");
    expect(`${l!.titulo} ${l!.corpo}`).not.toMatch(/ferroso|comprimido/i);
  });

  it("RN-13: ignora o silêncio e o limite diário, mas respeita a suspensão", () => {
    const madrugada = instanteLocal("2026-10-06", "03:00", SP);
    const e = estado({ medicamentos: [ferro], doses: [dose("d3", madrugada.toISOString())] });
    const cheio = Array.from({ length: 5 }, (_, i) => ({ chave: `x${i}`, categoria: "belly" as const, ref: `r${i}`, enviado_em: madrugada.toISOString() }));
    expect(selecionarParaEnvio(planejar({ ...e, agora: madrugada }), { agora: madrugada, tz: SP, prefs: {}, enviados: cheio })).toHaveLength(1);
    expect(selecionarParaEnvio(planejar({ ...e, agora: madrugada }), { agora: madrugada, tz: SP, prefs: { notifications_suspended: true }, enviados: [] })).toEqual([]);
  });

  it("10 dias sem abrir: nada atrasado sai de uma vez (tolerância de 30 min)", () => {
    const doses = Array.from({ length: 10 }, (_, i) => dose(`d${i}`, instanteLocal(somarDiasISO("2026-09-26", i), "08:00", SP).toISOString()));
    const agora = instanteLocal("2026-10-06", "09:00", SP);
    const saiu = selecionarParaEnvio(planejar(estado({ medicamentos: [ferro], doses, agora })), { agora, tz: SP, prefs: {}, enviados: [] });
    expect(saiu).toEqual([]);
    expect(TOLERANCIA_MS).toBe(30 * MS_MIN);
  });
});

describe("EXA RN-03/04/05 · lembretes de exame", () => {
  const exames = gerarExamesPadrao(DPP, semana(9), "u");
  const morfo = exames.find((x) => x.catalog_code === "morpho")!;

  it("14 dias antes de a janela do morfológico abrir, às 09:00", () => {
    const e = estado({ exames: [morfo] });
    const dia = somarDiasISO(morfo.window_start_date!, -14);
    const saiu = simular(e, instanteLocal(dia, "08:00", SP), instanteLocal(dia, "12:00", SP));
    expect(saiu.map((l) => [l.tipo, dataNoFuso(l.saiuEm, SP), horaNoFuso(l.saiuEm, SP)])).toEqual([["window_opens", dia, "09:00"]]);
  });

  it("7 e 2 dias antes de fechar, só se continua 'a marcar'; dispensar para, restaurar volta", () => {
    const dia7 = somarDiasISO(morfo.window_end_date!, -7);
    const as9 = instanteLocal(dia7, "09:00", SP);
    expect(selecionarParaEnvio(planejar(estado({ exames: [morfo], agora: as9 })), { agora: as9, tz: SP, prefs: {}, enviados: [] }).map((l) => l.tipo)).toEqual(["window_closes_7d"]);
    for (const status of ["scheduled", "done", "dismissed"] as const) {
      const outro = { ...morfo, status, scheduled_at: status === "scheduled" ? "2030-01-01T12:00:00Z" : null };
      expect(planejar(estado({ exames: [outro], agora: as9 })).filter((l) => l.tipo.startsWith("window"))).toEqual([]);
    }
  });

  it("personalizado não tem lembrete de janela (RN-09), mas tem os de agendamento", () => {
    const meu: ExameBase = { ...morfo, id: "meu", catalog_code: null, custom_name: "TSH" };
    expect(planejar(estado({ exames: [meu] })).filter((l) => l.tipo.startsWith("window"))).toEqual([]);
    const marcado = { ...meu, status: "scheduled" as const, scheduled_at: instanteLocal("2026-10-20", "08:00", SP).toISOString() };
    expect(planejar(estado({ exames: [marcado] })).map((l) => l.tipo).sort()).toEqual(["eve", "how_was_it", "two_hours"]);
  });

  it("marcado: véspera às 18:00, 2 h antes e 'Como foi?' no dia seguinte às 10:00", () => {
    const quando = instanteLocal("2026-10-20", "15:00", SP);
    const e = estado({ exames: [{ ...morfo, status: "scheduled", scheduled_at: quando.toISOString() }] });
    const saiu = simular(e, instanteLocal("2026-10-19", "00:00", SP), instanteLocal("2026-10-21", "23:00", SP), 5);
    expect(saiu.map((l) => [l.tipo, dataNoFuso(l.saiuEm, SP), horaNoFuso(l.saiuEm, SP)])).toEqual([
      ["eve", "2026-10-19", "18:00"],
      ["two_hours", "2026-10-20", "13:00"],
      ["how_was_it", "2026-10-21", "10:00"],
    ]);
    expect(saiu[2]!.acoes).toEqual(["ja_fiz", "remarquei"]);
    expect(saiu[0]!.url).toContain("code=morpho");
  });

  it("dia todo: sem o de 2 h; RN-05: no máximo 1 por exame por dia", () => {
    const quando = instanteLocal("2026-10-20", "12:00", SP);
    expect(planejar(estado({ exames: [{ ...morfo, status: "scheduled", scheduled_at: quando.toISOString(), scheduled_all_day: true }] })).map((l) => l.tipo).sort()).toEqual(["eve", "how_was_it"]);
    // Marcado para 20:00: véspera 18:00 do dia 19 e 2 h antes às 18:00 do dia 20 — dias diferentes, saem os dois.
    // Marcado às 20:30 de hoje com véspera "perdida": o de 2 h sai; um segundo do mesmo exame no mesmo dia, não.
    const agora = instanteLocal("2026-10-20", "18:30", SP);
    const marcado = { ...morfo, status: "scheduled" as const, scheduled_at: instanteLocal("2026-10-20", "20:30", SP).toISOString() };
    const r = selecionarParaEnvio(planejar(estado({ exames: [marcado], agora })), { agora, tz: SP, prefs: {}, enviados: [{ chave: "outro", categoria: "exam", ref: morfo.id, enviado_em: instanteLocal("2026-10-20", "09:00", SP).toISOString() }] });
    expect(r).toEqual([]);
  });

  it("mudar a DUM ajusta o horário e não repete o que já saiu", () => {
    const novaDpp = somarDiasISO(DPP, 7);
    const deslocado = { ...morfo, window_start_date: somarDiasISO(morfo.window_start_date!, 7), window_end_date: somarDiasISO(morfo.window_end_date!, 7) };
    const [antes] = planejar(estado({ exames: [morfo] })).filter((l) => l.tipo === "window_opens");
    const [depois] = planejar(estado({ dpp: novaDpp, exames: [deslocado] })).filter((l) => l.tipo === "window_opens");
    expect(depois!.chave).toBe(antes!.chave);
    expect(depois!.em.getTime() - antes!.em.getTime()).toBe(7 * 24 * MS_HORA);
    const enviados = [{ chave: antes!.chave, categoria: "exam" as const, ref: morfo.id, enviado_em: antes!.em.toISOString() }];
    expect(selecionarParaEnvio([depois!], { agora: depois!.em, tz: SP, prefs: {}, enviados })).toEqual([]);
  });
});

describe("CRO RN-06 · lembretes de consulta", () => {
  const consulta = { id: "c1", starts_at: instanteLocal("2026-10-16", "10:00", SP).toISOString(), kind: "prenatal" as const, status: "scheduled" as const, location: "Clínica Sol" };

  it("véspera às 18:00 com a contagem de perguntas; 2 h antes", () => {
    const perguntas = [1, 2, 3].map((i) => ({ id: `p${i}`, appointment_id: null, text: "x", was_asked: false, position: i }));
    const e = estado({ consultas: [consulta], perguntas, agora: instanteLocal("2026-10-06", "12:00", SP) });
    const saiu = simular(e, instanteLocal("2026-10-15", "17:00", SP), instanteLocal("2026-10-16", "10:00", SP), 5);
    expect(saiu.map((l) => [l.tipo, dataNoFuso(l.saiuEm, SP), horaNoFuso(l.saiuEm, SP), l.corpo])).toEqual([
      ["eve", "2026-10-15", "18:00", "3 perguntas na sua pauta"],
      ["two_hours", "2026-10-16", "08:00", "Clínica Sol"],
    ]);
  });

  it("cancelar ou concluir apaga os pendentes", () => {
    for (const status of ["cancelled", "done"] as const) expect(planejar(estado({ consultas: [{ ...consulta, status }] }))).toEqual([]);
  });

  it("silêncio: o de 2 h de uma consulta às 07:00 (05:00) não sai", () => {
    const cedo = { ...consulta, starts_at: instanteLocal("2026-10-16", "07:00", SP).toISOString() };
    const agora = instanteLocal("2026-10-16", "05:00", SP);
    expect(selecionarParaEnvio(planejar(estado({ consultas: [cedo], agora })), { agora, tz: SP, prefs: {}, enviados: [] })).toEqual([]);
  });
});

describe("BAR RN-05/06 · lembretes da barriga", () => {
  const ligado = { belly_reminders: true };

  it("na virada da semana às 10:00 e um reforço 2 dias depois às 19:00, só sem foto", () => {
    const e = estado({ prefs: ligado, semanasComFoto: [20, 21] });
    const saiu = simular(e, instanteLocal(semana(22), "00:00", SP), instanteLocal(semana(22, 6), "23:00", SP), 10);
    expect(saiu.map((l) => [l.tipo, dataNoFuso(l.saiuEm, SP), horaNoFuso(l.saiuEm, SP), l.titulo])).toEqual([
      ["week_turn", semana(22), "10:00", "Semana 22: hora da foto da barriga"],
      ["nudge", semana(22, 2), "19:00", "Ainda dá tempo da foto da semana 22"],
    ]);
    expect(planejar(estado({ prefs: ligado, semanasComFoto: [20, 21, 22], agora: instanteLocal(semana(22), "10:00", SP) }))).toEqual([]);
  });

  it("antes da semana 8 não lembra; desligado não lembra", () => {
    expect(planejar(estado({ prefs: ligado, agora: instanteLocal(semana(7), "10:00", SP) }))).toEqual([]);
    expect(planejar(estado({ prefs: { belly_reminders: false }, agora: instanteLocal(semana(22), "10:00", SP) }))).toEqual([]);
  });

  it("três semanas seguidas sem foto pausam; retomar volta", () => {
    expect(planejar(estado({ prefs: ligado, semanasComFoto: [18], agora: instanteLocal(semana(22), "10:00", SP) }))).toEqual([]);
    expect(planejar(estado({ prefs: { ...ligado, belly_resumed_week: 22 }, semanasComFoto: [18], agora: instanteLocal(semana(22), "10:00", SP) }))).toHaveLength(2);
  });
});

describe("DIA RN-04 · push dos marcos", () => {
  const as19 = (d: string) => instanteLocal(d, "19:00", SP);

  it("'Quando descobri' 2 dias depois do cadastro, se vazio", () => {
    const e = estado({ marcos: { respondidos: [], estados: [] }, agora: as19("2026-07-03") });
    const [l] = selecionarParaEnvio(planejar(e), { agora: e.agora, tz: SP, prefs: {}, enviados: [] });
    expect(l).toMatchObject({ chave: "diary:discovery", tipo: "diary_milestone", url: expect.stringContaining("/diario/escrever?marco=discovery") });
    expect(planejar({ ...e, marcos: { respondidos: ["discovery"], estados: [] } })).toEqual([]);
  });

  it("só os marcos com push_on_open, no dia em que a janela abre; os demais só como card", () => {
    const abertos = { respondidos: ["discovery"], estados: [] };
    const e = estado({ agora: as19(semana(16)), marcos: abertos });
    const r = selecionarParaEnvio(planejar(e), { agora: e.agora, tz: SP, prefs: {}, enviados: [] });
    expect(r.map((l) => l.ref)).toEqual(["first_kick"]);
    const todos = planejar(estado({ agora: as19(semana(20)), marcos: abertos })).map((l) => l.ref).sort();
    expect(todos).toEqual(["first_kick", "sex_known"]);
  });

  it("pulado não avisa; adiado não avisa enquanto adiado", () => {
    const pulado = estado({ agora: as19(semana(16)), marcos: { respondidos: ["discovery"], estados: [{ milestone_code: "first_kick", skipped_at: "2026-09-01T00:00:00Z", snoozed_until: null }] } });
    expect(planejar(pulado).map((l) => l.ref)).toEqual(["sex_known"]);
  });
});
