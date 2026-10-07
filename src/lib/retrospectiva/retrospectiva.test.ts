import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { retrospectivas, type Bebe, type DiaryEntry, type DocumentPage, type MedicalDocument } from "@/lib/dados/colecoes";
import { idDaRetrospectiva, slidesVisiveis } from "@dominio/retrospectiva.ts";

import { alternarSlide, escolherFrase, marcarExportada } from "./acoes";
import { configDe, disponiveis, montarDados, nascimentoDosBebes, type Fontes } from "./dados";

/** Funcionalidade 07 · do aparelho para o domínio (dados vivos) e a configuração gravada (RN-04/05). */
const TZ = "America/Sao_Paulo";
const bebe = (o: Partial<Bebe> = {}): Bebe => ({ id: "b1", nome: "Theo", nascido_em: "2026-11-25T11:15:00.000Z", ordem: 0, aviso_soneca: false, registrado_em: "x", atualizado_em: "x", ...o });

function fontes(o: Partial<Fontes> = {}): Fontes {
  return { kind: "final", autora: "mae", dpp: "2026-12-01", hoje: "2026-12-10", tz: TZ, nomeDoBebe: null, bebes: [], entradas: [], fotos: [], documentos: [], paginas: [], consultas: [], ...o };
}

describe("nascimento a partir dos bebês (RN-02/10)", () => {
  it("data e hora no fuso; peso e comprimento opcionais", () => {
    expect(nascimentoDosBebes([bebe({ peso_g: 3250, comprimento_cm: 49.5 })], TZ)).toEqual({ nome: "Theo", data: "2026-11-25", hora: "08:15", peso_g: 3250, comprimento_cm: 49.5 });
    expect(nascimentoDosBebes([bebe()], TZ)).toMatchObject({ peso_g: null, comprimento_cm: null });
    expect(nascimentoDosBebes([], TZ)).toBeNull();
  });

  it("gêmeos: os nomes juntos e sem um peso só", () => {
    const n = nascimentoDosBebes([bebe({ id: "b2", nome: "Bia", ordem: 1, peso_g: 2400 }), bebe({ peso_g: 2500 })], TZ);
    expect(n).toMatchObject({ nome: "Theo e Bia", peso_g: null, comprimento_cm: null });
  });

  it("o 'Bebê' provisório não vira nome", () => {
    expect(nascimentoDosBebes([bebe({ nome: "Bebê" })], TZ)?.nome).toBeNull();
  });
});

describe("dados vivos → slides", () => {
  it("RN-01: final só com nascimento; prévia a partir de 36s0d", () => {
    expect(disponiveis("2026-12-01", "2026-11-02", false)).toEqual([]);
    expect(disponiveis("2026-12-01", "2026-11-03", false)).toEqual(["preview"]);
    expect(disponiveis("2026-12-01", "2026-11-26", true)).toEqual(["final", "preview"]);
    // Volto um ano depois: as duas continuam em Memórias.
    expect(disponiveis("2026-12-01", "2027-11-26", true)).toEqual(["final", "preview"]);
  });

  it("a prévia vista depois do nascimento para no nascimento", () => {
    const d = montarDados(fontes({ kind: "preview", bebes: [bebe()], hoje: "2027-11-26" }));
    expect(d.hoje).toBe("2026-11-25");
    expect(d.nascimento).toBeNull();
  });

  it("números: consultas feitas, documentos, fotos e as páginas do diário dela", () => {
    const e = (id: string, criado_por: string, apagado_em: string | null = null) => ({ id, criado_por, apagado_em, body: "x", entry_date: "2026-05-01", milestone_code: null }) as unknown as DiaryEntry;
    const d = montarDados(
      fontes({
        consultas: [{ status: "done" }, { status: "done", apagado_em: "x" }, { status: "scheduled" }, { status: "cancelled" }] as never,
        documentos: [{ id: "a" }, { id: "b" }, { id: "c", apagado_em: "x" }] as never,
        fotos: [{ id: "f", gest_week: 20, storage_path: "p" }] as never,
        entradas: [e("1", "mae"), e("2", "mae"), e("3", "pai"), e("4", "mae", "x")],
      }),
    );
    expect(d.numeros).toEqual({ consultas: 1, documentos: 2, fotos: 1, entradas: 2 });
    // A entrada do parceiro fica disponível para ela escolher (RN-04), mas não conta como dela.
    expect(d.entradas.map((x) => x.id)).toEqual(["1", "2", "3"]);
  });

  it("o retrato do ultrassom é a primeira página em imagem", () => {
    const doc = { id: "u", kind: "us_morpho", exam_date: "2026-07-01", is_favorite: true } as MedicalDocument;
    const pag = (position: number, mime: string, storage_path: string) => ({ id: storage_path, document_id: "u", position, mime, storage_path }) as DocumentPage;
    const d = montarDados(fontes({ documentos: [doc], paginas: [pag(1, "application/pdf", "a.pdf"), pag(3, "image/jpeg", "c.jpg"), pag(2, "image/jpeg", "b.jpg")] }));
    expect(d.ultrassons[0]?.storage_path).toBe("b.jpg");
  });
});

describe("configuração gravada", () => {
  beforeEach(() => {
    localStorage.clear();
    retrospectivas.limpar();
  });

  it("RN-05: ocultar e mostrar; obrigatório não muda", () => {
    expect(alternarSlide("mae", "final", "cover", "mae")).toBeNull();
    expect(retrospectivas.listarTodos()).toHaveLength(0);
    expect(alternarSlide("mae", "final", "belly", "mae")).toEqual({ oculto: true });
    const r = retrospectivas.obter(idDaRetrospectiva("mae", "final"))!;
    expect(r).toMatchObject({ kind: "final", hidden_slides: ["belly"], criado_por: "mae" });
    expect(alternarSlide("mae", "final", "belly", "mae")).toEqual({ oculto: false });
    expect(retrospectivas.obter(r.id)!.hidden_slides).toEqual([]);
    // A prévia é outra configuração.
    expect(retrospectivas.obter(idDaRetrospectiva("mae", "preview"))).toBeUndefined();
  });

  it("RN-04: troco a frase por outra entrada; escolher traz o slide oculto de volta; null volta ao padrão", () => {
    alternarSlide("mae", "final", "discovery", "mae");
    escolherFrase("mae", "final", "discovery", { entrada: "e2" }, "mae");
    let r = retrospectivas.obter(idDaRetrospectiva("mae", "final"))!;
    expect(r.chosen_entries).toEqual({ discovery: { entrada: "e2" } });
    expect(r.hidden_slides).toEqual([]);
    escolherFrase("mae", "final", "quote", { texto: `  ${"a".repeat(150)}  ` }, "mae");
    r = retrospectivas.obter(r.id)!;
    expect((r.chosen_entries.quote as { texto: string }).texto).toHaveLength(140);
    escolherFrase("mae", "final", "discovery", null, "mae");
    expect(retrospectivas.obter(r.id)!.chosen_entries).toEqual({ quote: { texto: "a".repeat(140) } });
  });

  it("o slide oculto sai do player (configuração + dados vivos)", () => {
    alternarSlide("mae", "final", "belly", "mae");
    const d = montarDados(fontes({ bebes: [bebe()], fotos: [1, 2, 3].map((i) => ({ id: `${i}`, gest_week: 20 + i, storage_path: `${i}` })) as never }));
    expect(slidesVisiveis(d, configDe(undefined)).some((s) => s.tipo === "belly")).toBe(true);
    expect(slidesVisiveis(d, configDe(retrospectivas.listarTodos()[0])).some((s) => s.tipo === "belly")).toBe(false);
  });

  it("exportar grava last_exported_at", () => {
    marcarExportada("mae", "preview", "mae");
    expect(retrospectivas.obter(idDaRetrospectiva("mae", "preview"))!.last_exported_at).toBeTruthy();
  });
});

describe("paleta da retrospectiva (contraste AA do texto nos slides)", () => {
  const css = readFileSync(path.resolve(__dirname, "../../styles/tokens.css"), "utf8");
  const cor = (n: string) => new RegExp(`--retro-${n}:\\s*(#[0-9a-f]{6})`, "i").exec(css)![1]!;
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const contraste = (a: string, b: string) => {
    const [x, y] = [lum(cor(a)), lum(cor(b))].sort((p, q) => q - p);
    return (x! + 0.05) / (y! + 0.05);
  };

  it.each([
    ["tinta", "papel"],
    ["tinta-suave", "papel"],
    ["tinta-suave", "papel-fundo"],
    ["coral-tinta", "papel"],
    ["luz", "noite"],
    ["luz-suave", "noite"],
    ["luz-suave", "noite-fundo"],
    ["coral", "noite"],
    ["coral", "noite-fundo"],
  ])("%s sobre %s ≥ 4,5", (texto, fundo) => {
    expect(contraste(texto, fundo)).toBeGreaterThanOrEqual(4.5);
  });
});
