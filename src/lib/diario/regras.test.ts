import { beforeEach, describe, expect, it } from "vitest";

import { diaryEntries, diaryMilestoneStates, diaryPhotos, type DiaryEntry } from "@/lib/dados/colecoes";
import { escolherFormatoAudio } from "@/lib/midia/audio";
import { CATALOGO_MARCOS, cardsDeMarco, estadoDoMarco, idDaEntradaDoMarco, marcoDoCatalogo, perguntaDoMarco, type SituacaoMarco } from "@dominio/diario.ts";
import { dumDaDpp, somarDiasISO } from "@dominio/tempo.ts";

import { adiarMarco, alternarCompartilhamento, excluirEntrada, manterDiario, pularMarco, reabrirMarco, salvarEntrada } from "./acoes";
import {
  audioPassaDoLimite,
  dataValida,
  entradaValida,
  entradasComAudio,
  linhaDoTempo,
  listaDeMarcos,
  marcosDuplicados,
  podeEditar,
  semanaDaEntrada,
  situacoes,
  visivelPara,
} from "./regras";

const DPP = "2027-03-08";
const DUM = dumDaDpp(DPP);
const semana = (s: number, d = 0) => somarDiasISO(DUM, s * 7 + d);
const agora = new Date("2026-10-06T15:00:00.000Z");
const nada: SituacaoMarco = { respondido: false };

function e(id: string, p: Partial<DiaryEntry> = {}): DiaryEntry {
  return { id, kind: "free", milestone_code: null, body: "texto", entry_date: "2026-10-01", audio_path: null, audio_seconds: null, shared_with_partner: false, photo_count: 0, criado_por: "mae", atualizado_em: "2026-10-01T00:00:00Z", ...p };
}

describe("DIA · catálogo de marcos", () => {
  it("12 sementes com as janelas e pushes da tabela", () => {
    expect(CATALOGO_MARCOS.map((m) => [m.code, m.window_start_week, m.window_end_week, m.push_on_open])).toEqual([
      ["discovery", null, null, true],
      ["told_partner", 5, 14, false],
      ["first_ultrasound", 6, 12, false],
      ["heartbeat", 6, 12, false],
      ["belly_shows", 12, 20, false],
      ["sex_known", 14, 22, true],
      ["first_kick", 16, 24, true],
      ["name_chosen", 16, 36, false],
      ["baby_shower", 28, 36, false],
      ["bag_ready", 34, 38, false],
      ["feelings_before", 36, 41, false],
      ["first_prayer", 5, 20, false],
    ]);
    expect(CATALOGO_MARCOS.filter((m) => m.faith_only).map((m) => m.code)).toEqual(["first_prayer"]);
  });
});

describe("DIA RN-03 · cards de marco", () => {
  it("na semana 17, 'Primeiro chute' está aberto", () => {
    const kick = marcoDoCatalogo("first_kick")!;
    expect(estadoDoMarco(kick, 15, nada, agora)).toBe("em_breve");
    expect(estadoDoMarco(kick, 17, nada, agora)).toBe("aberto");
    expect(estadoDoMarco(kick, 28, nada, agora)).toBe("aberto"); // até 4 semanas depois do fim
    expect(estadoDoMarco(kick, 29, nada, agora)).toBe("passou");
  });

  it("responder, pular (de vez) e 'Mais tarde' (3 dias)", () => {
    const kick = marcoDoCatalogo("first_kick")!;
    expect(estadoDoMarco(kick, 17, { respondido: true }, agora)).toBe("respondido");
    expect(estadoDoMarco(kick, 17, { respondido: false, skipped_at: "2026-10-01T00:00:00Z" }, agora)).toBe("pulado");
    const adiado = { respondido: false, snoozed_until: new Date(agora.getTime() + 1000).toISOString() };
    expect(estadoDoMarco(kick, 17, adiado, agora)).toBe("adiado");
    expect(estadoDoMarco(kick, 17, adiado, new Date(agora.getTime() + 2000))).toBe("aberto");
  });

  it("no máximo 3 cards; 'Quando descobri' primeiro, depois a janela aberta mais recente", () => {
    expect(cardsDeMarco(18, false, () => nada, agora).map((m) => m.code)).toEqual(["discovery", "first_kick", "name_chosen"]);
    // Semana 17 com a descoberta respondida: "Primeiro chute" no topo (critério de aceite).
    const respondida = (c: string) => ({ respondido: c === "discovery" });
    expect(cardsDeMarco(17, false, respondida, agora).map((m) => m.code)).toEqual(["first_kick", "name_chosen", "sex_known"]);
    // Respondidos os novos, os antigos ainda abertos aparecem (volta depois de meses).
    const novos = new Set(["discovery", "first_kick", "name_chosen", "sex_known"]);
    expect(cardsDeMarco(17, false, (c) => ({ respondido: novos.has(c) }), agora).map((m) => m.code)).toEqual(["belly_shows", "told_partner"]);
  });

  it("modo fé: 'Primeira oração' aparece e a pergunta de fé substitui", () => {
    expect(cardsDeMarco(10, false, () => nada, agora, 20).some((m) => m.code === "first_prayer")).toBe(false);
    expect(cardsDeMarco(10, true, () => nada, agora, 20).some((m) => m.code === "first_prayer")).toBe(true);
    const descoberta = marcoDoCatalogo("discovery")!;
    expect(perguntaDoMarco(descoberta, true)).toBe(descoberta.prompt_text_faith);
    expect(perguntaDoMarco(descoberta, false)).toBe(descoberta.prompt_text);
    expect(perguntaDoMarco(marcoDoCatalogo("told_partner")!, true)).toBe(marcoDoCatalogo("told_partner")!.prompt_text);
  });

  it("lista de marcos com o estado de cada um", () => {
    const l = listaDeMarcos(17, false, (c) => ({ respondido: c === "discovery" }), agora);
    expect(l).toHaveLength(11);
    expect(Object.fromEntries(l.map((x) => [x.marco.code, x.estado]))).toMatchObject({ discovery: "respondido", first_kick: "aberto", baby_shower: "em_breve", told_partner: "aberto", first_ultrasound: "passou" });
    expect(listaDeMarcos(17, true, () => nada, agora)).toHaveLength(12);
  });
});

describe("DIA RN-01/06/07 · entrada", () => {
  it("precisa de texto, áudio ou foto", () => {
    expect(entradaValida({ body: "  ", temAudio: false, fotos: 0 })).toBe(false);
    expect(entradaValida({ body: "oi", temAudio: false, fotos: 0 })).toBe(true);
    expect(entradaValida({ body: null, temAudio: true, fotos: 0 })).toBe(true);
    expect(entradaValida({ body: null, temAudio: false, fotos: 1 })).toBe(true);
  });

  it("data não pode ser futura; a semana vem da data", () => {
    expect(dataValida("2026-10-06", "2026-10-06")).toBe(true);
    expect(dataValida("2026-10-07", "2026-10-06")).toBe(false);
    expect(dataValida("", "2026-10-06")).toBe(false);
    expect(semanaDaEntrada(DPP, semana(17, 3))).toBe(17);
    expect(semanaDaEntrada(null, semana(17))).toBeNull();
  });

  it("free: até 10 entradas com áudio; a 11ª passa do limite; premium não", () => {
    const dez = Array.from({ length: 10 }, (_, i) => e(`a${i}`, { audio_path: `diario/a${i}/audio.webm` }));
    expect(entradasComAudio(dez, "mae")).toBe(10);
    expect(audioPassaDoLimite(dez.slice(0, 9), "mae", false)).toBe(false);
    expect(audioPassaDoLimite(dez, "mae", false)).toBe(true);
    expect(audioPassaDoLimite(dez, "mae", true)).toBe(false);
    expect(audioPassaDoLimite(dez, "mae", false, dez[0])).toBe(false); // editar uma que já tinha áudio
    expect(audioPassaDoLimite(dez.map((x) => ({ ...x, criado_por: "pai" })), "mae", false)).toBe(false);
  });

  it("RN-05: áudio em webm (Chrome) ou mp4 (Safari)", () => {
    expect(escolherFormatoAudio((t) => t.startsWith("audio/webm"))).toBe("audio/webm;codecs=opus");
    expect(escolherFormatoAudio((t) => t === "audio/mp4")).toBe("audio/mp4");
    expect(escolherFormatoAudio(() => false)).toBeNull();
  });
});

describe("DIA RN-09/10 · parceiro e busca", () => {
  const minha = e("m1", { body: "Senti o coração acelerar" });
  const compartilhada = e("m2", { body: "Para você", shared_with_partner: true, entry_date: "2026-10-03" });
  const dele = e("p1", { body: "Escrevi também", criado_por: "pai", entry_date: "2026-10-02" });

  it("parceiro só vê as compartilhadas e as dele; a gestante vê as dele sempre", () => {
    expect(linhaDoTempo([minha, compartilhada, dele], "pai", "parceiro", {}).map((x) => x.id)).toEqual(["m2", "p1"]);
    expect(linhaDoTempo([minha, compartilhada, dele], "mae", "mae", {}).map((x) => x.id)).toEqual(["m2", "p1", "m1"]);
    expect(visivelPara(minha, "avo", "avo")).toBe(false);
    expect(podeEditar(dele, "mae")).toBe(false);
    expect(podeEditar(dele, "pai")).toBe(true);
  });

  it("busca normalizada (sem acento, maiúscula) só nas da própria usuária", () => {
    expect(linhaDoTempo([minha, dele], "mae", "mae", { busca: "CORACAO" }).map((x) => x.id)).toEqual(["m1"]);
    expect(linhaDoTempo([minha, dele], "mae", "mae", { busca: "escrevi" })).toEqual([]);
  });

  it("filtro por marco", () => {
    const kick = e("k", { kind: "milestone", milestone_code: "first_kick" });
    expect(linhaDoTempo([minha, kick], "mae", "mae", { marco: "first_kick" }).map((x) => x.id)).toEqual(["k"]);
    expect(linhaDoTempo([kick], "mae", "mae", { busca: "primeiro chute" }).map((x) => x.id)).toEqual(["k"]);
  });

  it("dois aparelhos com o mesmo marco: fica o mais recente", () => {
    const a = e("a", { kind: "milestone", milestone_code: "discovery", atualizado_em: "2026-10-01T00:00:00Z" });
    const b = e("b", { kind: "milestone", milestone_code: "discovery", atualizado_em: "2026-10-02T00:00:00Z" });
    const doPai = e("c", { kind: "milestone", milestone_code: "discovery", criado_por: "pai" });
    expect(marcosDuplicados([a, b, doPai]).map((x) => x.id)).toEqual(["a"]);
  });
});

describe("DIA · ações na coleção", () => {
  beforeEach(() => {
    localStorage.clear();
    diaryEntries.limpar();
    diaryPhotos.limpar();
    diaryMilestoneStates.limpar();
  });
  const jpeg = () => new Blob(["jpeg"], { type: "image/jpeg" });

  it("na semana 17, responde 'Primeiro chute' com foto: vira entrada com data", async () => {
    const r = await salvarEntrada({ milestone_code: "first_kick", body: "No ônibus!", entry_date: semana(17), fotos: [{ tipo: "nova", id: "f1", blob: jpeg() }] }, "mae");
    expect(r).toMatchObject({ id: idDaEntradaDoMarco("mae", "first_kick"), kind: "milestone", photo_count: 1, entry_date: semana(17) });
    expect(semanaDaEntrada(DPP, r.entry_date)).toBe(17);
    expect(diaryPhotos.listar()).toMatchObject([{ entry_id: r.id, position: 1, storage_path: `diario/${r.id}/f1.jpg` }]);
    expect(situacoes(diaryEntries.listar(), [], "mae")("first_kick").respondido).toBe(true);
  });

  it("RN-02: reabrir o marco edita a mesma entrada", async () => {
    const a = await salvarEntrada({ milestone_code: "discovery", body: "primeira", entry_date: "2026-10-01", fotos: [] }, "mae");
    const b = await salvarEntrada({ milestone_code: "discovery", body: "editada", entry_date: "2026-10-01", fotos: [] }, "mae");
    expect(b.id).toBe(a.id);
    expect(diaryEntries.listar()).toHaveLength(1);
  });

  it("RN-01: vazia não salva", async () => {
    await expect(salvarEntrada({ milestone_code: null, body: "  ", entry_date: "2026-10-01", fotos: [] }, "mae")).rejects.toThrow("vazia");
    expect(diaryEntries.listar()).toEqual([]);
  });

  it("áudio de 1 minuto entra; trocar remove o antigo; null tira", async () => {
    const audio = { blob: new Blob(["a"], { type: "audio/webm" }), segundos: 60.4 };
    const a = await salvarEntrada({ milestone_code: null, body: "", entry_date: "2026-10-01", audio, fotos: [] }, "mae");
    expect(a.audio_seconds).toBe(60);
    expect(a.audio_path).toMatch(new RegExp(`^diario/${a.id}/audio-\\w+\\.webm$`));
    const b = await salvarEntrada({ milestone_code: null, body: "agora com texto", entry_date: "2026-10-01", fotos: [] }, "mae", a);
    expect(b.audio_path).toBe(a.audio_path); // undefined mantém
    const c = await salvarEntrada({ milestone_code: null, body: "agora com texto", entry_date: "2026-10-01", audio: null, fotos: [] }, "mae", b);
    expect(c).toMatchObject({ audio_path: null, audio_seconds: null });
  });

  it("até 3 fotos, posições reorganizadas ao tirar uma", async () => {
    const a = await salvarEntrada({ milestone_code: null, body: "fotos", entry_date: "2026-10-01", fotos: ["a", "b", "c", "d"].map((id) => ({ tipo: "nova" as const, id, blob: jpeg() })) }, "mae");
    expect(a.photo_count).toBe(3);
    const [, segunda, terceira] = diaryPhotos.listar().sort((x, y) => x.position - y.position);
    await salvarEntrada({ milestone_code: null, body: "fotos", entry_date: "2026-10-01", fotos: [{ tipo: "existente", foto: segunda! }, { tipo: "existente", foto: terceira! }] }, "mae", a);
    expect(diaryPhotos.listar().map((f) => [f.id, f.position]).sort()).toEqual([["b", 1], ["c", 2]]);
    expect(diaryEntries.obter(a.id)?.photo_count).toBe(2);
  });

  it("RN-08: excluir apaga a entrada, o áudio e as fotos", async () => {
    const a = await salvarEntrada({ milestone_code: null, body: "x", entry_date: "2026-10-01", audio: { blob: new Blob(["a"], { type: "audio/mp4" }), segundos: 5 }, fotos: [{ tipo: "nova", id: "f", blob: jpeg() }] }, "mae");
    expect(a.audio_path).toMatch(/\.m4a$/);
    await excluirEntrada(a);
    expect(diaryEntries.listar()).toEqual([]);
    expect(diaryPhotos.listar()).toEqual([]);
  });

  it("compartilhar com o parceiro liga e desliga", async () => {
    const a = await salvarEntrada({ milestone_code: null, body: "x", entry_date: "2026-10-01", fotos: [] }, "mae");
    expect(alternarCompartilhamento(a, true).shared_with_partner).toBe(true);
    const editada = await salvarEntrada({ milestone_code: null, body: "y", entry_date: "2026-10-01", fotos: [] }, "mae", diaryEntries.obter(a.id));
    expect(editada.shared_with_partner).toBe(true);
  });

  it("'Pular' some de vez; 'Mais tarde' por 3 dias; reabrir desfaz", () => {
    pularMarco("mae", "heartbeat", agora);
    adiarMarco("mae", "told_partner", agora);
    const s = situacoes([], diaryMilestoneStates.listar(), "mae");
    expect(estadoDoMarco(marcoDoCatalogo("heartbeat")!, 8, s("heartbeat"), agora)).toBe("pulado");
    expect(estadoDoMarco(marcoDoCatalogo("told_partner")!, 8, s("told_partner"), new Date(agora.getTime() + 2 * 86_400_000))).toBe("adiado");
    expect(estadoDoMarco(marcoDoCatalogo("told_partner")!, 8, s("told_partner"), new Date(agora.getTime() + 3 * 86_400_000))).toBe("aberto");
    reabrirMarco("mae", "heartbeat");
    expect(estadoDoMarco(marcoDoCatalogo("heartbeat")!, 8, situacoes([], diaryMilestoneStates.listar(), "mae")("heartbeat"), agora)).toBe("aberto");
    expect(diaryMilestoneStates.listar()).toHaveLength(2);
  });

  it("manter: duplicado de marco sai", async () => {
    diaryEntries.mesclar([e("x", { kind: "milestone", milestone_code: "discovery", atualizado_em: "2026-10-01T00:00:00Z" }), e("y", { kind: "milestone", milestone_code: "discovery", atualizado_em: "2026-10-02T00:00:00Z" })]);
    manterDiario();
    expect(diaryEntries.listar().map((x) => x.id)).toEqual(["y"]);
  });
});
