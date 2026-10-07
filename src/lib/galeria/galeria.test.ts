import { PDFDocument } from "pdf-lib";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { lerArquivo, guardarArquivo } from "@/lib/arquivos/arquivos";
import { documentPages, medicalDocuments, userExams, type DocumentPage, type MedicalDocument, type Membro, type UserExam } from "@/lib/dados/colecoes";
import { CHAVE_PERFIL, type Perfil } from "@/lib/onboarding/estado";
import { dumDaDpp, somarDiasISO } from "@dominio/tempo.ts";

import { compartilharComParceiro, excluirDocumento, favoritar, salvarDocumento, type PaginaDoForm } from "./acoes";
import { cabeNaExportacao, montarPdf, paginasSelecionadas } from "./exportar";
import { darConsentimento, lerLaudo, retirarConsentimento, temConsentimento } from "./ia";
import type { PaginaNova } from "./paginas";
import { exameParaVincular, filtrar, ordenar, paginasDo, paginasGuardadas, semanaDoDocumento, temParceiro, visivelPara } from "./regras";

const DPP = "2027-03-08";
const DUM = dumDaDpp(DPP);
const semana = (s: number, d = 0) => somarDiasISO(DUM, s * 7 + d);

// JPEG 1×1 válido (o pdf-lib precisa de um de verdade).
const JPEG_1X1 =
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
const jpeg = () => new Blob([Uint8Array.from(atob(JPEG_1X1), (c) => c.charCodeAt(0))], { type: "image/jpeg" });

function doc(id: string, p: Partial<MedicalDocument> = {}): MedicalDocument {
  return { id, kind: "blood", title: null, exam_date: "2026-10-01", notes: null, is_favorite: false, shared_with_partner: false, scheduled_exam_id: null, ai_status: "none", ai_summary: null, criado_por: "mae", atualizado_em: "2026-10-01T00:00:00Z", ...p };
}
function pagina(id: string, document_id: string, position: number, p: Partial<DocumentPage> = {}): DocumentPage {
  return { id, document_id, position, storage_path: `documentos/${document_id}/${id}.jpg`, mime: "image/jpeg", bytes: 100, width: 1, height: 1, atualizado_em: "2026-10-01T00:00:00Z", ...p };
}
function exame(id: string, p: Partial<UserExam> = {}): UserExam {
  return {
    id,
    catalog_code: "morpho",
    custom_name: null,
    status: "scheduled",
    window_start_date: null,
    window_end_date: null,
    past_window: false,
    window_start_week: null,
    window_end_week: null,
    scheduled_at: `${semana(22)}T12:00:00.000Z`,
    scheduled_all_day: false,
    location: null,
    notes: null,
    done_on: null,
    document_id: null,
    atualizado_em: "2026-10-01T00:00:00Z",
    ...p,
  };
}
const nova = (id: string): PaginaDoForm => ({ tipo: "nova", pagina: { id, blob: jpeg(), mime: "image/jpeg", bytes: 3, width: 1, height: 1 } satisfies PaginaNova });
const dados = { kind: "us_morpho" as const, exam_date: semana(22), title: "", notes: "", scheduled_exam_id: null };

describe("GAL · regras do app", () => {
  it("semana calculada da data do exame, não gravada", () => {
    expect(semanaDoDocumento(DPP, semana(22, 3))).toBe(22);
    expect(semanaDoDocumento(DPP, semana(0))).toBe(0);
    expect(semanaDoDocumento(DPP, somarDiasISO(DUM, -1))).toBeNull(); // antes da DUM
    expect(semanaDoDocumento(null, semana(10))).toBeNull();
  });

  it("páginas vivas, em ordem, e a soma da RN-02 ignora excluídos", () => {
    const docs = [doc("a"), doc("b", { apagado_em: "2026-10-02T00:00:00Z" })];
    const pags = [pagina("p2", "a", 2), pagina("p1", "a", 1), pagina("px", "a", 3, { apagado_em: "x" }), pagina("q1", "b", 1)];
    expect(paginasDo("a", pags).map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(paginasGuardadas(docs, pags)).toBe(2);
  });

  it("RN-10: gestante vê tudo; parceiro só o compartilhado; cuidadora nada; excluído ninguém", () => {
    const meu = doc("a");
    const comp = doc("b", { shared_with_partner: true });
    const exc = doc("c", { shared_with_partner: true, apagado_em: "x" });
    expect([meu, comp, exc].filter((d) => visivelPara(d, "mae", "mae")).map((d) => d.id)).toEqual(["a", "b"]);
    expect([meu, comp, exc].filter((d) => visivelPara(d, "pai", "parceiro")).map((d) => d.id)).toEqual(["b"]);
    expect([meu, comp].filter((d) => visivelPara(d, "baba", "cuidador"))).toEqual([]);
    expect([meu, comp].filter((d) => visivelPara(d, "avo", "avo"))).toEqual([]);
  });

  it("RN-10: compartilhar só tem efeito com parceiro na família", () => {
    const m = (papel: Membro["papel"], p: Partial<Membro> = {}): Membro => ({ id: papel, profile_id: papel, nome: papel, papel, ultimo_acesso_em: "", atualizado_em: "", ...p });
    expect(temParceiro([m("mae")])).toBe(false);
    expect(temParceiro([m("mae"), m("cuidador")])).toBe(false);
    expect(temParceiro([m("mae"), m("parceiro", { apagado_em: "x" })])).toBe(false);
    expect(temParceiro([m("mae"), m("parceiro")])).toBe(true);
  });

  it("filtro por tipo (e 'Ultrassons' juntando os us_*) e linha do tempo do mais recente", () => {
    const docs = [doc("a", { kind: "us_morpho", exam_date: "2026-08-01" }), doc("b", { kind: "blood", exam_date: "2026-09-01" }), doc("c", { kind: "us_nuchal", exam_date: "2026-07-01" })];
    expect(filtrar(docs, "us").map((d) => d.id)).toEqual(["a", "c"]);
    expect(filtrar(docs, "blood").map((d) => d.id)).toEqual(["b"]);
    expect(filtrar(docs, "todos")).toHaveLength(3);
    expect(ordenar(docs).map((d) => d.id)).toEqual(["b", "a", "c"]);
    const mesmoDia = [doc("x", { atualizado_em: "2026-10-01T00:00:00Z" }), doc("y", { atualizado_em: "2026-10-02T00:00:00Z" })];
    expect(ordenar(mesmoDia).map((d) => d.id)).toEqual(["y", "x"]);
  });

  it("RN-04: acha o exame marcado do mesmo tipo, o mais perto da data", () => {
    const exames = [
      exame("morfo"),
      exame("cresc", { catalog_code: "us_growth", scheduled_at: `${semana(33)}T12:00:00Z` }),
      exame("datacao", { catalog_code: "us_dating", scheduled_at: `${semana(8)}T12:00:00Z` }),
    ];
    expect(exameParaVincular(exames, "us_morpho", semana(22))?.id).toBe("morfo");
    expect(exameParaVincular(exames, "us_obstetric", semana(31))?.id).toBe("cresc");
    expect(exameParaVincular(exames, "us_obstetric", semana(9))?.id).toBe("datacao");
    expect(exameParaVincular(exames, "blood", semana(22))).toBeUndefined();
  });

  it("RN-04: só pergunta de exame pendente e marcado", () => {
    expect(exameParaVincular([exame("a", { status: "done" })], "us_morpho", semana(22))).toBeUndefined();
    expect(exameParaVincular([exame("a", { status: "to_schedule", scheduled_at: null })], "us_morpho", semana(22))).toBeUndefined();
    expect(exameParaVincular([exame("a", { apagado_em: "x" })], "us_morpho", semana(22))).toBeUndefined();
  });
});

describe("GAL · ações na coleção", () => {
  beforeEach(() => {
    localStorage.clear();
    medicalDocuments.limpar();
    documentPages.limpar();
    userExams.limpar();
  });

  it("fotografo um laudo com 2 páginas e salvo: documento e páginas em ordem, arquivos na fila", async () => {
    const d = await salvarDocumento({ ...dados, title: "  Morfo  " }, [nova("p1"), nova("p2")], "mae");
    expect(d).toMatchObject({ kind: "us_morpho", title: "Morfo", notes: null, ai_status: "none", shared_with_partner: false, is_favorite: false, criado_por: "mae" });
    expect(paginasDo(d.id, documentPages.listar()).map((p) => [p.position, p.storage_path])).toEqual([
      [1, `documentos/${d.id}/p1.jpg`],
      [2, `documentos/${d.id}/p2.jpg`],
    ]);
    expect(await lerArquivo(`documentos/${d.id}/p2.jpg`)).not.toBeNull();
    expect(semanaDoDocumento(DPP, d.exam_date)).toBe(22);
  });

  it("sem página não salva", async () => {
    await expect(salvarDocumento(dados, [], "mae")).rejects.toThrow("sem_paginas");
    expect(medicalDocuments.listar()).toEqual([]);
  });

  it("no máximo 20 páginas por documento", async () => {
    const d = await salvarDocumento(dados, Array.from({ length: 22 }, (_, i) => nova(`p${i}`)), "mae");
    expect(paginasDo(d.id, documentPages.listar())).toHaveLength(20);
  });

  it("editar: reordena, remove (e apaga o arquivo) e acrescenta, mantendo o que já tinha", async () => {
    const d = await salvarDocumento(dados, [nova("p1"), nova("p2"), nova("p3")], "mae");
    const [p1, , p3] = paginasDo(d.id, documentPages.listar());
    const e = await salvarDocumento({ ...dados, notes: "ok" }, [{ tipo: "existente", pagina: p3! }, { tipo: "existente", pagina: p1! }, nova("p4")], "mae", d);
    expect(e.id).toBe(d.id);
    expect(paginasDo(d.id, documentPages.listar()).map((p) => [p.id, p.position])).toEqual([
      ["p3", 1],
      ["p1", 2],
      ["p4", 3],
    ]);
    expect(await lerArquivo(`documentos/${d.id}/p2.jpg`)).toBeNull();
  });

  it("editar preserva favorito, compartilhamento e resumo; trocar para tipo não-ultrassom tira o favorito (RN-12)", async () => {
    const d = await salvarDocumento(dados, [nova("p1")], "mae");
    const f = compartilharComParceiro(favoritar(d, true), true);
    const pags = paginasDo(d.id, documentPages.listar()).map((pagina) => ({ tipo: "existente" as const, pagina }));
    expect(await salvarDocumento(dados, pags, "mae", f)).toMatchObject({ is_favorite: true, shared_with_partner: true });
    expect(await salvarDocumento({ ...dados, kind: "blood" }, pags, "mae", medicalDocuments.obter(d.id))).toMatchObject({ is_favorite: false, shared_with_partner: true });
  });

  it("RN-12: favoritar só ultrassom; desfavoritar sempre", () => {
    const sangue = medicalDocuments.salvar(doc("s"));
    expect(favoritar(sangue, true).is_favorite).toBe(false);
    const us = medicalDocuments.salvar(doc("u", { kind: "us_obstetric" }));
    expect(favoritar(us, true).is_favorite).toBe(true);
    expect(favoritar(medicalDocuments.obter("u")!, false).is_favorite).toBe(false);
  });

  it("RN-04: aceitar o vínculo marca o exame como feito, com o documento e a data", async () => {
    userExams.salvar(exame("morfo"));
    const d = await salvarDocumento({ ...dados, scheduled_exam_id: "morfo" }, [nova("p1")], "mae");
    expect(userExams.obter("morfo")).toMatchObject({ status: "done", done_on: semana(22), document_id: d.id });
    expect(d.scheduled_exam_id).toBe("morfo");
  });

  it("RN-04: sem vínculo o exame não muda", async () => {
    userExams.salvar(exame("morfo"));
    await salvarDocumento(dados, [nova("p1")], "mae");
    expect(userExams.obter("morfo")).toMatchObject({ status: "scheduled", document_id: null });
  });

  it("RN-03: excluir tira documento, páginas, arquivos e o vínculo do exame; não reaparece", async () => {
    userExams.salvar(exame("morfo"));
    const d = await salvarDocumento({ ...dados, scheduled_exam_id: "morfo" }, [nova("p1"), nova("p2")], "mae");
    await excluirDocumento(d);
    expect(medicalDocuments.listar().filter((x) => !x.apagado_em)).toEqual([]);
    expect(documentPages.listar().filter((x) => !x.apagado_em)).toEqual([]);
    expect(await lerArquivo(`documentos/${d.id}/p1.jpg`)).toBeNull();
    expect(userExams.obter("morfo")).toMatchObject({ status: "done", document_id: null });
    // Uma cópia antiga que chegue do servidor não ressuscita o excluído.
    medicalDocuments.mesclar([{ ...d, atualizado_em: "2020-01-01T00:00:00Z" }]);
    expect(medicalDocuments.obter(d.id)?.apagado_em).toBeTruthy();
  });

  it("RN-10: compartilhar liga e desliga", () => {
    const d = medicalDocuments.salvar(doc("a"));
    expect(compartilharComParceiro(d, true).shared_with_partner).toBe(true);
    expect(compartilharComParceiro(medicalDocuments.obter("a")!, false).shared_with_partner).toBe(false);
  });
});

describe("GAL RN-09 · exportar", () => {
  beforeAll(() => {
    // O Blob do jsdom não tem arrayBuffer(); o do navegador tem.
    if (!Blob.prototype.arrayBuffer) {
      Blob.prototype.arrayBuffer = function (this: Blob) {
        return new Promise<ArrayBuffer>((ok) => {
          const r = new FileReader();
          r.onload = () => ok(r.result as ArrayBuffer);
          r.readAsArrayBuffer(this);
        });
      };
    }
  });
  beforeEach(() => {
    medicalDocuments.limpar();
    documentPages.limpar();
  });

  it("até 50 páginas somadas", () => {
    const docs = [doc("a"), doc("b")];
    const pags = [...Array.from({ length: 30 }, (_, i) => pagina(`a${i}`, "a", i + 1)), ...Array.from({ length: 20 }, (_, i) => pagina(`b${i}`, "b", i + 1))];
    expect(paginasSelecionadas(docs, pags)).toBe(50);
    expect(cabeNaExportacao(docs, pags)).toBe(true);
    expect(cabeNaExportacao(docs, [...pags, pagina("b99", "b", 20)])).toBe(false);
  });

  it("capa, uma seção por documento e as páginas; acentos não quebram o PDF", async () => {
    await guardarArquivo("documentos/a/p1.jpg", jpeg());
    await guardarArquivo("documentos/a/p2.jpg", jpeg());
    await guardarArquivo("documentos/b/p1.jpg", jpeg());
    const pags = [pagina("p1", "a", 1), pagina("p2", "a", 2), pagina("p1", "b", 1)];
    const blob = await montarPdf(
      { titulo: "Exames e ultrassons", linhas: ["Nome: Júlia", "Data prevista do parto: 8 de março de 2027", "Semana da gestação: 22 🤰"] },
      [
        { documento: doc("a"), cabecalho: ["Morfológico", "Ultrassom · 1 de outubro", "observação ".repeat(40)] },
        { documento: doc("b"), cabecalho: ["Hemograma"] },
      ],
      pags,
    );
    expect(blob.type).toBe("application/pdf");
    const pdf = await PDFDocument.load(await blob.arrayBuffer());
    expect(pdf.getPageCount()).toBe(1 + (1 + 2) + (1 + 1));
  });

  it("página sem arquivo neste aparelho é pulada, sem quebrar", async () => {
    const blob = await montarPdf({ titulo: "x", linhas: [] }, [{ documento: doc("z"), cabecalho: ["z"] }], [pagina("p1", "z", 1)]);
    const pdf = await PDFDocument.load(await blob.arrayBuffer());
    expect(pdf.getPageCount()).toBe(2);
  });
});

describe("GAL RN-05 · consentimento e leitura", () => {
  const base: Perfil = { modo: "gestacao", dpp: DPP, anonima: true, onboardingConcluidoEm: "2026-10-01T00:00:00Z" };
  beforeAll(() => localStorage.setItem(CHAVE_PERFIL, JSON.stringify(base)));

  it("sem consentimento, a leitura não envia nada", async () => {
    expect(temConsentimento(base)).toBe(false);
    expect(await lerLaudo("doc", base)).toEqual({ tipo: "sem_consentimento" });
  });

  it("dar e retirar o consentimento grava em consents.ai_document_reading", () => {
    const dado = darConsentimento(base);
    expect(dado?.consents?.ai_document_reading?.given_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(temConsentimento(dado)).toBe(true);
    retirarConsentimento(dado!);
    const atual = JSON.parse(localStorage.getItem(CHAVE_PERFIL)!) as Perfil;
    expect(atual.consents?.ai_document_reading).toBeNull();
    expect(temConsentimento(atual)).toBe(false);
  });

  it("com consentimento mas sem servidor, avisa que precisa de internet", async () => {
    const com = { ...base, consents: { ai_document_reading: { given_at: "2026-10-01T00:00:00Z" } } };
    expect(await lerLaudo("doc", com)).toEqual({ tipo: "sem_rede" });
  });
});
