import { beforeEach, describe, expect, it } from "vitest";

import { bellyPhotos, type BellyPhoto } from "@/lib/dados/colecoes";
import { idDaFotoDaSemana, lembretesDaSemana, lembretesPausados, semanaDaFoto, semanaPermitida } from "@dominio/barriga.ts";
import { dumDaDpp, somarDiasISO } from "@dominio/tempo.ts";

import { excluirFoto, manterFotos, salvarFotoDaSemana } from "./acoes";
import {
  duplicadasPorSemana,
  escolherFormatoVideo,
  fotoFantasma,
  gradeDeSemanas,
  mostrarRetomar,
  nomeDoArquivo,
  perfilDeExportacao,
  quadrosDoTimelapse,
  recorteCover,
  timelapseDisponivel,
} from "./regras";

const DPP = "2027-03-08";
const DUM = dumDaDpp(DPP);
const semana = (s: number, d = 0) => somarDiasISO(DUM, s * 7 + d);

function foto(w: number, p: Partial<BellyPhoto> = {}): BellyPhoto {
  return { id: `f${w}`, gest_week: w, taken_on: semana(w), storage_path: `barriga/f${w}.jpg`, width: 1200, height: 1600, caption: null, atualizado_em: `2026-10-0${(w % 9) + 1}T00:00:00Z`, ...p };
}

describe("BAR RN-02 · semana da foto", () => {
  it("é ga_week(hoje), limitada a 4..42", () => {
    expect(semanaDaFoto(DPP, semana(22, 3))).toBe(22);
    expect(semanaDaFoto(DPP, semana(3, 6))).toBeNull();
    expect(semanaDaFoto(DPP, semana(4))).toBe(4);
    expect(semanaDaFoto(DPP, semana(43))).toBe(42);
  });

  it("pela grade: de 4 até a atual; futura não", () => {
    expect(semanaPermitida(10, 22)).toBe(true);
    expect(semanaPermitida(22, 22)).toBe(true);
    expect(semanaPermitida(23, 22)).toBe(false);
    expect(semanaPermitida(3, 22)).toBe(false);
    expect(semanaPermitida(10.5, 22)).toBe(false);
    expect(semanaPermitida(10, null)).toBe(false);
  });

  it("id por autora e semana (substituir reaproveita)", () => {
    expect(idDaFotoDaSemana("u", 22)).toBe(idDaFotoDaSemana("u", 22));
    expect(idDaFotoDaSemana("u", 22)).not.toBe(idDaFotoDaSemana("u", 23));
  });
});

describe("BAR · grade, fantasma e timelapse", () => {
  it("grade de 4 a 42, atual destacada, futuras bloqueadas, fotos no lugar", () => {
    const g = gradeDeSemanas([foto(20), foto(21), foto(22, { apagado_em: "x" })], 22);
    expect(g).toHaveLength(39);
    expect(g[0]).toEqual({ semana: 4, estado: "passada", foto: undefined });
    expect(g.find((s) => s.semana === 21)?.foto?.id).toBe("f21");
    expect(g.find((s) => s.semana === 22)).toMatchObject({ estado: "atual", foto: undefined });
    expect(g.find((s) => s.semana === 23)?.estado).toBe("futura");
    expect(gradeDeSemanas([], null).every((s) => s.estado === "futura")).toBe(true);
  });

  it("RN-03: fantasma é a última foto antes da semana (na 22, a da 21)", () => {
    const l = [foto(10), foto(21), foto(25)];
    expect(fotoFantasma(l, 22)?.gest_week).toBe(21);
    expect(fotoFantasma(l, 11)?.gest_week).toBe(10);
    expect(fotoFantasma(l, 10)).toBeUndefined();
  });

  it("RN-07: timelapse com 3 fotos ou mais, em ordem de semana", () => {
    expect(timelapseDisponivel([foto(10), foto(12)])).toBe(false);
    expect(timelapseDisponivel([foto(10), foto(12), foto(14, { apagado_em: "x" })])).toBe(false);
    expect(quadrosDoTimelapse([foto(14), foto(10), foto(12)]).map((f) => f.gest_week)).toEqual([10, 12, 14]);
  });

  it("RN-08: primeiro formato suportado na ordem mp4/avc1, webm/vp9, webm; nenhum, null", () => {
    expect(escolherFormatoVideo(() => true)).toBe("video/mp4;codecs=avc1");
    expect(escolherFormatoVideo((t) => t.startsWith("video/webm"))).toBe("video/webm;codecs=vp9");
    expect(escolherFormatoVideo((t) => t === "video/webm")).toBe("video/webm");
    expect(escolherFormatoVideo(() => false)).toBeNull();
    expect(
      escolherFormatoVideo(() => {
        throw new Error("x");
      }),
    ).toBeNull();
  });

  it("RN-08: free 720p com marca; premium 1080p sem marca", () => {
    expect(perfilDeExportacao("free")).toEqual({ largura: 720, altura: 960, marca: true });
    expect(perfilDeExportacao("premium")).toEqual({ largura: 1080, altura: 1440, marca: false });
    expect(nomeDoArquivo(22, "png")).toBe("ninho-semana-22.png");
  });

  it("recorte cover preenche o quadro sem distorcer", () => {
    expect(recorteCover(1200, 1600, 1080, 1350)).toEqual({ sx: 0, sy: 50, sw: 1200, sh: 1500 });
    const r = recorteCover(1600, 1200, 1080, 1350);
    expect(r.sw / r.sh).toBeCloseTo(1080 / 1350);
  });
});

describe("BAR RN-05 · pausa e 'Retomar as fotos?'", () => {
  it("três semanas seguidas sem foto (a partir da 8) pausam", () => {
    expect(lembretesPausados(12, new Set([8]))).toBe(true); // 9, 10, 11 vazias
    expect(lembretesPausados(12, new Set([10]))).toBe(false);
    expect(lembretesPausados(10, new Set())).toBe(false); // 7 é antes da régua
    expect(lembretesPausados(11, new Set())).toBe(true); // 8, 9, 10
    expect(lembretesPausados(30, new Set(), 28)).toBe(false); // retomou na 28
    expect(lembretesPausados(31, new Set(), 28)).toBe(true);
  });

  it("lembretes da semana: virada às 10:00 e reforço 2 dias depois às 19:00", () => {
    expect(lembretesDaSemana(DPP, semana(22, 4), new Set([21]), { ligados: true })).toEqual([
      { semana: 22, tipo: "virada", data: semana(22), hora: "10:00" },
      { semana: 22, tipo: "reforco", data: semana(22, 2), hora: "19:00" },
    ]);
  });

  it("card só com os lembretes ligados e pausados", () => {
    expect(mostrarRetomar(22, [foto(10)], {})).toBe(true);
    expect(mostrarRetomar(22, [foto(10)], { belly_reminders: false })).toBe(false);
    expect(mostrarRetomar(22, [foto(21)], {})).toBe(false);
    expect(mostrarRetomar(22, [foto(10)], { belly_resumed_week: 22 })).toBe(false);
    expect(mostrarRetomar(6, [], {})).toBe(false);
  });
});

describe("BAR · fotos na coleção", () => {
  beforeEach(() => {
    localStorage.clear();
    bellyPhotos.limpar();
  });
  const blob = new Blob(["jpeg"], { type: "image/jpeg" });

  it("RN-01: tirar outra na mesma semana substitui (mesmo registro, arquivo novo)", async () => {
    const a = await salvarFotoDaSemana({ blob, largura: 1200, altura: 1600, semana: 22, takenOn: semana(22), caption: " primeira " }, "u");
    expect(a.substituiu).toBe(false);
    expect(a.foto.caption).toBe("primeira");
    const b = await salvarFotoDaSemana({ blob, largura: 1200, altura: 1600, semana: 22, takenOn: semana(22, 1), caption: null }, "u");
    expect(b.substituiu).toBe(true);
    expect(b.foto.id).toBe(a.foto.id);
    expect(b.foto.storage_path).not.toBe(a.foto.storage_path);
    expect(bellyPhotos.listar()).toHaveLength(1);
  });

  it("RN-10: excluir libera a semana", async () => {
    const { foto: f } = await salvarFotoDaSemana({ blob, largura: 1, altura: 1, semana: 10, takenOn: semana(10), caption: null }, "u");
    await excluirFoto(f);
    expect(bellyPhotos.listar()).toEqual([]);
    const outra = await salvarFotoDaSemana({ blob, largura: 1, altura: 1, semana: 10, takenOn: semana(10), caption: null }, "u");
    expect(outra.substituiu).toBe(false);
  });

  it("duas fotos da mesma semana (dois aparelhos): fica a mais recente", () => {
    const velha = foto(12, { id: "a", atualizado_em: "2026-10-01T00:00:00Z" });
    const nova = foto(12, { id: "b", atualizado_em: "2026-10-02T00:00:00Z" });
    expect(duplicadasPorSemana([velha, nova, foto(13)]).map((f) => f.id)).toEqual(["a"]);
    bellyPhotos.mesclar([velha, nova]);
    manterFotos();
    expect(bellyPhotos.listar().map((f) => f.id)).toEqual(["b"]);
  });
});
