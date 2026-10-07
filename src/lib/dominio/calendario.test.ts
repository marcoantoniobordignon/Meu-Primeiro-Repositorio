import { describe, expect, it } from "vitest";

import {
  dobrar,
  eventoDosDados,
  gerarIcs,
  gradeDoMes,
  horaDoLembrete,
  itensDoCalendario,
  itensDoDia,
  itensDoFeed,
  lembretesDeEventos,
  mesSeguinte,
  pontosDoDia,
  rotuloGestacional,
  uidDoItem,
  validarEvento,
  viradaDeSemana,
  type DadosEvento,
  type EventoCalendario,
  type FonteCalendario,
  type ItemCalendario,
} from "@dominio/calendario.ts";
import { planejar } from "@dominio/lembretes.ts";
import { dumDaDpp, inicioDaSemana, instanteLocal, somarDiasISO } from "@dominio/tempo.ts";

const TZ = "America/Sao_Paulo";
const DPP = "2027-03-08";
const HOJE = "2026-10-07";

function evento(id: string, p: Partial<EventoCalendario> = {}): EventoCalendario {
  return { id, title: "Curso de gestantes", category: "course", starts_at: "2026-10-15T22:00:00.000Z", all_day: false, all_day_date: null, notes: null, remind_offset_minutes: 60, visible_to_partner: true, ...p };
}

const fonte = (p: Partial<FonteCalendario> = {}): FonteCalendario => ({
  consultas: [{ id: "c1", starts_at: "2026-10-09T13:00:00Z", kind: "prenatal", status: "scheduled", provider_name: "Dra. Ana", location: "Clínica Sol" }],
  exames: [
    { id: "e1", catalog_code: "morpho", custom_name: null, status: "scheduled", scheduled_at: "2026-10-09T12:00:00Z" },
    { id: "e2", catalog_code: "gbs", custom_name: null, status: "done", scheduled_at: "2026-09-01T12:00:00Z" },
  ],
  eventos: [evento("ev1"), evento("ev2", { title: "Só minha", visible_to_partner: false })],
  doses: [
    { id: "d1", medication_id: "m", scheduled_at: "2026-10-06T11:00:00Z", status: "taken" },
    { id: "d2", medication_id: "m", scheduled_at: "2026-10-06T23:00:00Z", status: "missed" },
    { id: "d3", medication_id: "m", scheduled_at: "2026-10-08T11:00:00Z", status: "pending" },
  ],
  semanasComFoto: [18],
  dpp: DPP,
  ...p,
});

const mae = { tz: TZ, hoje: HOJE, papel: "mae" as const, agenda: true };

describe("CAL · itens de todas as funcionalidades, sem cópia", () => {
  const itens = itensDoCalendario(fonte(), mae);

  it("consulta e exame marcados no dia, com a cor do tipo (critério: ponto colorido)", () => {
    const dia = itensDoDia(itens, "2026-10-09");
    expect(dia.map((i) => [i.tipo, i.cor])).toEqual([
      ["exam", "acento"],
      ["appointment", "primaria"],
    ]);
    expect(dia[1]).toMatchObject({ titulo: "Dra. Ana", local: "Clínica Sol", link: "/consultas/c1" });
    expect(itens.some((i) => i.id === "e2")).toBe(false); // feito não entra
  });

  it("RN-03: derivados abrem a origem; só o evento próprio abre a edição", () => {
    const links = Object.fromEntries(itens.map((i) => [i.tipo, i.link]));
    expect(links).toMatchObject({ appointment: "/consultas/c1", exam: "/exames/e1", custom: "/calendario/evento?id=ev2", med_day: "/medicamentos", belly_photo: "/barriga", edd: "/hoje" });
  });

  it("RN-04: medicamentos, um por dia; no dia passado, a adesão", () => {
    const meds = itens.filter((i) => i.tipo === "med_day");
    expect(meds.map((i) => [i.data, i.titulo, i.detalhe ?? null])).toEqual([
      ["2026-10-06", "Medicamentos (2)", "1 de 2 tomadas"],
      ["2026-10-08", "Medicamentos (1)", null],
    ]);
  });

  it("RN-05: foto no dia da virada de semana, com check se existe", () => {
    const fotos = itens.filter((i) => i.tipo === "belly_photo");
    expect(fotos).toHaveLength(39); // semanas 4 a 42
    expect(fotos.find((f) => f.titulo === "Foto da semana 18")).toMatchObject({ data: inicioDaSemana(DPP, 18), feito: true });
    expect(fotos.find((f) => f.titulo === "Foto da semana 19")?.feito).toBe(false);
  });

  it("RN-07: a DPP aparece como 'Data provável do parto'", () => {
    expect(itensDoDia(itens, DPP).find((i) => i.tipo === "edd")?.titulo).toBe("Data provável do parto");
  });

  it("RN-10: datas no fuso dela (22h em São Paulo ainda é o mesmo dia)", () => {
    const tarde = itensDoCalendario(fonte({ consultas: [{ id: "c", starts_at: "2026-10-10T01:00:00Z", kind: "prenatal", status: "scheduled" }] }), mae);
    expect(tarde.find((i) => i.id === "c")?.data).toBe("2026-10-09");
  });

  it("RN-11: o parceiro nunca vê medicamentos nem fotos; eventos só os visíveis", () => {
    const dele = itensDoCalendario(fonte(), { ...mae, papel: "parceiro" });
    expect(new Set(dele.map((i) => i.tipo))).toEqual(new Set(["appointment", "exam", "custom", "edd"]));
    expect(dele.filter((i) => i.tipo === "custom").map((i) => i.id)).toEqual(["ev1"]);
    const semAgenda = itensDoCalendario(fonte(), { ...mae, papel: "parceiro", agenda: false });
    expect(semAgenda.map((i) => i.tipo)).toEqual(["edd"]);
  });

  it("sem nada marcado, só a DPP e as fotos (o mês nunca fica vazio)", () => {
    const vazio = itensDoCalendario({ consultas: [], exames: [], eventos: [], doses: [], semanasComFoto: [], dpp: DPP }, mae);
    expect(new Set(vazio.map((i) => i.tipo))).toEqual(new Set(["belly_photo", "edd"]));
  });
});

describe("CAL RN-01/02 · mês e agenda", () => {
  const item = (cor: ItemCalendario["cor"]): ItemCalendario => ({ tipo: "custom", id: cor, titulo: "", data: HOJE, inicio: null, diaInteiro: true, cor, link: "" });
  it("até 3 pontos e '+n'", () => {
    expect(pontosDoDia([item("primaria")])).toEqual({ cores: ["primaria"], mais: 0 });
    expect(pontosDoDia(["primaria", "acento", "sono", "banho", "fralda"].map((c) => item(c as ItemCalendario["cor"])))).toEqual({ cores: ["primaria", "acento", "sono"], mais: 2 });
  });

  it("marcador '22s' só no dia em que a semana muda", () => {
    expect(viradaDeSemana(DPP, inicioDaSemana(DPP, 22))).toBe(22);
    expect(viradaDeSemana(DPP, somarDiasISO(inicioDaSemana(DPP, 22), 1))).toBeNull();
    expect(viradaDeSemana(DPP, dumDaDpp(DPP))).toBeNull();
    expect(viradaDeSemana(DPP, inicioDaSemana(DPP, 43))).toBeNull();
    expect(viradaDeSemana(null, HOJE)).toBeNull();
  });

  it("cabeçalho da agenda '22s3d'", () => {
    expect(rotuloGestacional(DPP, somarDiasISO(inicioDaSemana(DPP, 22), 3))).toBe("22s3d");
    expect(rotuloGestacional(DPP, somarDiasISO(dumDaDpp(DPP), -1))).toBeNull();
    expect(rotuloGestacional(undefined, HOJE)).toBeNull();
  });

  it("grade do mês de domingo a sábado", () => {
    const out = gradeDoMes(2026, 10); // 1/10/2026 é quinta
    expect(out[0]).toEqual([null, null, null, null, "2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(out.flat().filter(Boolean)).toHaveLength(31);
    expect(out.every((s) => s.length === 7)).toBe(true);
    expect(gradeDoMes(2027, 2).flat().filter(Boolean)).toHaveLength(28);
  });

  it("navegar meses atravessa o ano", () => {
    expect(mesSeguinte(2026, 12, 1)).toEqual({ ano: 2027, mes: 1 });
    expect(mesSeguinte(2026, 1, -1)).toEqual({ ano: 2025, mes: 12 });
  });
});

describe("CAL RN-06 · evento próprio", () => {
  const base: DadosEvento = { title: "Curso de gestantes", category: "course", all_day: false, data: "2026-10-15", hora: "19:00", notes: "", remind_offset_minutes: 60, visible_to_partner: true };

  it("título obrigatório; com hora, a hora é obrigatória; dia inteiro dispensa", () => {
    expect(validarEvento(base)).toEqual([]);
    expect(validarEvento({ ...base, title: "   " })).toEqual(["sem_titulo"]);
    expect(validarEvento({ ...base, title: "x".repeat(81) })).toEqual(["titulo_longo"]);
    expect(validarEvento({ ...base, hora: null })).toEqual(["sem_hora"]);
    expect(validarEvento({ ...base, all_day: true, hora: null })).toEqual([]);
    expect(validarEvento({ ...base, notes: "x".repeat(501) })).toEqual(["notas_longas"]);
  });

  it("dia inteiro sem hora; com hora, o instante no fuso dela", () => {
    expect(eventoDosDados(base, TZ)).toMatchObject({ all_day: false, all_day_date: null, starts_at: "2026-10-15T22:00:00.000Z", notes: null });
    expect(eventoDosDados({ ...base, all_day: true, hora: "19:00" }, TZ)).toMatchObject({ all_day: true, all_day_date: "2026-10-15", starts_at: null });
  });

  it("lembrete: na hora, 1 hora antes, 1 dia antes às 09:00", () => {
    expect(horaDoLembrete(evento("a", { remind_offset_minutes: 0 }), TZ)?.toISOString()).toBe("2026-10-15T22:00:00.000Z");
    expect(horaDoLembrete(evento("a", { remind_offset_minutes: 60 }), TZ)?.toISOString()).toBe("2026-10-15T21:00:00.000Z");
    expect(horaDoLembrete(evento("a", { remind_offset_minutes: 1440 }), TZ)?.toISOString()).toBe(instanteLocal("2026-10-14", "09:00", TZ).toISOString());
    expect(horaDoLembrete(evento("a", { remind_offset_minutes: null }), TZ)).toBeNull();
    expect(horaDoLembrete(evento("a", { all_day: true, starts_at: null, all_day_date: "2026-10-20", remind_offset_minutes: 0 }), TZ)?.toISOString()).toBe(instanteLocal("2026-10-20", "09:00", TZ).toISOString());
  });

  it("critério: 'Curso de gestantes' às 19:00 com lembrete de 1 hora antes vira aviso calendar_event às 18:00", () => {
    const [l] = lembretesDeEventos([evento("ev")], TZ);
    expect(l).toMatchObject({ categoria: "calendar", tipo: "calendar_event", titulo: "Curso de gestantes", corpo: "Daqui a 1 hora, às 19:00", url: "/calendario/evento?id=ev&origem=lembrete&categoria=calendar" });
    const planejados = planejar({ agora: new Date("2026-10-15T21:00:00Z"), tz: TZ, dpp: null, criadaEm: "2026-01-01", prefs: null, medicamentos: [], doses: [], exames: [], consultas: [], perguntas: [], semanasComFoto: [], marcos: { respondidos: [], estados: [] }, eventos: [evento("ev")] });
    expect(planejados.filter((x) => x.categoria === "calendar")).toHaveLength(1);
    expect(lembretesDeEventos([evento("x", { apagado_em: "y" })], TZ)).toEqual([]);
  });
});

describe("CAL RN-08/09 · iCal", () => {
  const agora = new Date("2026-10-07T12:00:00Z");
  const itens = itensDoCalendario(fonte(), mae);

  it("o feed leva consultas, exames marcados, eventos próprios e DPP; nunca medicamentos, fotos nem notas", () => {
    const feed = itensDoFeed(itens);
    expect(new Set(feed.map((i) => i.item_type))).toEqual(new Set(["appointment", "exam", "custom", "edd"]));
    const ics = gerarIcs(itensDoFeed(itensDoCalendario(fonte({ eventos: [evento("n", { notes: "segredo" })] }), mae)), agora);
    expect(ics).not.toContain("segredo");
    expect(ics).not.toContain("Medicamentos");
  });

  it("UID estável, título e local, dia inteiro como DATE, CRLF", () => {
    const ics = gerarIcs(itensDoFeed(itens), agora);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("UID:appointment-c1@ninho");
    expect(ics).toContain("DTSTART:20261009T130000Z");
    expect(ics).toContain("DTEND:20261009T140000Z");
    expect(ics).toContain("LOCATION:Clínica Sol");
    expect(ics).toContain("UID:edd-dpp@ninho\r\nDTSTAMP:20261007T120000Z\r\nDTSTART;VALUE=DATE:20270308\r\nDTEND;VALUE=DATE:20270309");
    expect(uidDoItem({ item_type: "custom", item_id: "x" })).toBe("custom-x@ninho");
  });

  it("escapa vírgula, ponto e vírgula e quebra de linha; dobra linhas longas em 75 octetos", () => {
    const ics = gerarIcs([{ item_type: "custom", item_id: "1", title: "Compras; fraldas, lenços\nmamadeira", all_day: true, all_day_date: "2026-10-10", starts_at: null }], agora);
    expect(ics).toContain("SUMMARY:Compras\\; fraldas\\, lenços\\nmamadeira");
    const longa = dobrar(`SUMMARY:${"á".repeat(80)}`);
    for (const l of longa.split("\r\n")) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    expect(longa.replace(/\r\n /g, "")).toBe(`SUMMARY:${"á".repeat(80)}`);
  });
});
