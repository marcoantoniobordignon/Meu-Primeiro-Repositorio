import { expect, test, type Page } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";

import { ficarSemRede, voltarARede } from "./rede";

/**
 * Critérios de aceite da funcionalidade 01 · Galeria de exames e ultrassons (specs/funcionalidades/01),
 * no build de produção, sem servidor (app 100 % local).
 */
test.use({ timezoneId: "America/Sao_Paulo" });

function hojeISO(desloc = 0) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(Date.now() + desloc * 86_400_000));
}
/** DPP que deixa hoje no início da semana `semana`. */
const dppNaSemana = (semana: number) => hojeISO(280 - semana * 7 - 1);

async function entrar(page: Page, semana: number, extra: Record<string, unknown> = {}, perfil: Record<string, unknown> = {}) {
  await page.addInitScript(
    (d) => {
      if (sessionStorage.getItem("semeado")) return;
      sessionStorage.setItem("semeado", "1");
      for (const [k, v] of Object.entries(d)) localStorage.setItem(k, JSON.stringify(v));
    },
    {
      "ninho.sessao": { uid: "mae-local", anonima: true, remota: false },
      "ninho.perfil": { nome: "Helena", modo: "gestacao", dpp: dppNaSemana(semana), anonima: true, plano: "free", papel: "mae", onboardingConcluidoEm: new Date().toISOString(), tz: "America/Sao_Paulo", ...perfil },
      ...extra,
    },
  );
}

/** Uma "foto" de laudo: um JPEG de verdade (a própria tela). */
async function fotos(page: Page, n: number) {
  const buf = await page.screenshot({ type: "jpeg", quality: 70 });
  return Array.from({ length: n }, (_, i) => ({ name: `laudo-${i + 1}.jpg`, mimeType: "image/jpeg", buffer: buf }));
}

async function pdfDe(paginas: number) {
  const pdf = await PDFDocument.create();
  const fonte = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= paginas; i++) pdf.addPage([595, 842]).drawText(`Laudo pagina ${i}`, { x: 50, y: 760, size: 24, font: fonte });
  return { name: "laudo.pdf", mimeType: "application/pdf", buffer: Buffer.from(await pdf.save()) };
}

/** Entradas escondidas atrás dos botões "Galeria" (várias fotos) e "PDF". */
const entrada = (page: Page, accept: string) => page.locator(accept === "image/*" ? 'input[type=file][accept="image/*"][multiple]' : `input[type=file][accept="${accept}"]`);

function doc(id: string, p: Record<string, unknown> = {}) {
  return { id, kind: "blood", title: null, exam_date: hojeISO(-10), notes: null, is_favorite: false, shared_with_partner: false, scheduled_exam_id: null, ai_status: "none", ai_summary: null, criado_por: "mae-local", atualizado_em: new Date().toISOString(), ...p };
}
function paginas(docId: string, n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `${docId}-p${i + 1}`, document_id: docId, position: i + 1, storage_path: `documentos/${docId}/p${i + 1}.jpg`, mime: "image/jpeg", bytes: 1000, width: 1500, height: 2000, atualizado_em: new Date().toISOString() }));
}

test("vazio pede o primeiro ultrassom; fotografo 2 páginas, salvo e vejo com a semana certa; folheio e volto na página em que parei", async ({ page }) => {
  await entrar(page, 22);
  await page.goto("/galeria");
  await expect(page.getByText("Guarde aqui o primeiro ultrassom")).toBeVisible();
  await page.getByRole("button", { name: "Adicionar documento" }).click();
  await expect(page).toHaveURL(/\/galeria\/adicionar$/);

  // Salvar sem nada: pede página e tipo.
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Junte ao menos uma página.")).toBeVisible();
  await expect(page.getByText("Escolha o tipo.")).toBeVisible();

  await entrada(page, "image/*").setInputFiles(await fotos(page, 2));
  await expect(page.getByRole("img", { name: "Página 2 de 2" })).toBeVisible();
  await page.getByRole("radio", { name: "Morfológico" }).click();
  await expect(page.getByLabel("Data do exame")).toHaveValue(hojeISO());
  await page.getByRole("button", { name: "Salvar" }).click();

  await expect(page).toHaveURL(/\/galeria\/[0-9a-f-]{36}$/);
  await expect(page.getByText("Guardado na galeria ✓")).toBeVisible();
  await expect(page.getByText(/Morfológico · .* · semana 22/)).toBeVisible();
  await expect(page.getByText("Página 1 de 2")).toBeVisible();
  await page.getByRole("button", { name: "Próxima página" }).click();
  await expect(page.getByText("Página 2 de 2")).toBeVisible();
  await page.getByRole("button", { name: "Ampliar" }).click();
  await expect(page.getByRole("button", { name: "Reduzir" })).toBeEnabled();
  // RN-12: ultrassom favorita.
  await page.getByRole("button", { name: "Favoritar" }).click();
  await expect(page.getByRole("button", { name: "Tirar dos favoritos" })).toBeVisible();

  await page.getByRole("button", { name: "Voltar" }).click();
  await expect(page).toHaveURL(/\/galeria$/);
  const item = page.getByRole("link", { name: /Morfológico/ });
  await expect(item).toContainText("semana 22");
  await expect(item).toContainText("2 páginas");

  // Volto depois e abre na página em que parei.
  await page.reload();
  await page.getByRole("link", { name: /Morfológico/ }).click();
  await expect(page.getByText("Página 2 de 2")).toBeVisible();
  await expect(page.getByRole("img", { name: "Página 2 de 2" })).toBeVisible();
});

test("anexo um PDF de 3 páginas e consigo folhear; sangue não tem favoritar", async ({ page }) => {
  await entrar(page, 30);
  await page.goto("/galeria/adicionar");
  await entrada(page, "application/pdf").setInputFiles(await pdfDe(3));
  await expect(page.getByRole("img", { name: "Página 3 de 3" })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("radio", { name: "Exame de sangue" }).click();
  await page.getByLabel("Título (opcional)").fill("Hemograma");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("heading", { name: "Hemograma" })).toBeVisible();
  await expect(page.getByText("Página 1 de 3")).toBeVisible();
  for (const n of [2, 3]) {
    await page.getByRole("button", { name: "Próxima página" }).click();
    await expect(page.getByText(`Página ${n} de 3`)).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Próxima página" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Favoritar" })).toHaveCount(0);
});

test("RN-01: data futura não salva; muito antes da DUM pede confirmação", async ({ page }) => {
  await entrar(page, 20);
  await page.goto("/galeria/adicionar");
  await entrada(page, "image/*").setInputFiles(await fotos(page, 1));
  await page.getByRole("radio", { name: "Urina" }).click();
  await page.getByLabel("Data do exame").fill(hojeISO(3));
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("A data não pode ser no futuro.")).toBeVisible();
  await page.getByLabel("Data do exame").fill(hojeISO(-20 * 7 - 120));
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Essa data é bem antes da gestação")).toBeVisible();
  await page.getByRole("button", { name: "Guardar assim" }).click();
  await expect(page).toHaveURL(/\/galeria\/[0-9a-f-]{36}$/);
});

test("RN-04: ao anexar o resultado de um exame marcado, pergunta se é dele e, aceitando, ele aparece como feito", async ({ page }) => {
  await entrar(page, 22);
  await page.goto("/exames");
  await expect(page.getByText("Ultrassom morfológico").first()).toBeVisible();
  // Ela marcou o morfológico para ontem.
  await page.evaluate((ontem) => {
    const lista = JSON.parse(localStorage.getItem("ninho.user_exams") ?? "[]") as Record<string, unknown>[];
    const m = lista.find((e) => e.catalog_code === "morpho")!;
    Object.assign(m, { status: "scheduled", scheduled_at: `${ontem}T13:00:00.000Z`, atualizado_em: new Date().toISOString() });
    localStorage.setItem("ninho.user_exams", JSON.stringify(lista));
  }, hojeISO(-1));

  await page.goto("/galeria/adicionar");
  await entrada(page, "image/*").setInputFiles(await fotos(page, 1));
  await page.getByRole("radio", { name: "Morfológico" }).click();
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Este é o resultado de Ultrassom morfológico?")).toBeVisible();
  await page.getByRole("button", { name: "Sim, é ele" }).click();
  await expect(page.getByText("Ultrassom morfológico marcado como feito ✓")).toBeVisible();
  await expect(page.getByRole("link", { name: "Resultado de Ultrassom morfológico" })).toBeVisible();

  await page.getByRole("link", { name: "Resultado de Ultrassom morfológico" }).click();
  await expect(page.getByText(/^feito · /)).toBeVisible();
  await page.getByRole("link", { name: "Ver resultado" }).click();
  await expect(page).toHaveURL(/\/galeria\/[0-9a-f-]{36}$/);
  // Um documento só: "Sim" não salvou duas vezes.
  await page.goto("/galeria");
  await expect(page.getByRole("link", { name: /Morfológico/ })).toHaveCount(1);
});

test("RN-04: responder 'Não' salva sem vínculo; da spec 03, 'Anexar resultado' chega com o exame e o tipo", async ({ page }) => {
  await entrar(page, 22);
  await page.goto("/exames");
  await expect(page.getByText("Ultrassom morfológico").first()).toBeVisible();
  await page.evaluate((ontem) => {
    const lista = JSON.parse(localStorage.getItem("ninho.user_exams") ?? "[]") as Record<string, unknown>[];
    Object.assign(lista.find((e) => e.catalog_code === "morpho")!, { status: "scheduled", scheduled_at: `${ontem}T13:00:00.000Z`, atualizado_em: new Date().toISOString() });
    localStorage.setItem("ninho.user_exams", JSON.stringify(lista));
  }, hojeISO(-1));
  await page.goto("/galeria/adicionar");
  await entrada(page, "image/*").setInputFiles(await fotos(page, 1));
  await page.getByRole("radio", { name: "Morfológico" }).click();
  await page.getByRole("button", { name: "Salvar" }).click();
  await page.getByRole("button", { name: "Não", exact: true }).click();
  await expect(page).toHaveURL(/\/galeria\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("link", { name: /Resultado de/ })).toHaveCount(0);
  await page.goto("/galeria");
  await expect(page.getByRole("link", { name: /Morfológico/ })).toHaveCount(1);

  // Pelo exame: "Concluir" → "Anexar resultado" abre o Adicionar já vinculado.
  await page.goto("/exames");
  await page.getByRole("link", { name: /^Ultrassom morfológico marcado/ }).click();
  await page.getByRole("button", { name: "Concluir" }).click();
  await page.getByRole("button", { name: "Anexar resultado" }).click();
  await expect(page).toHaveURL(/\/galeria\/adicionar\?exame=.+&tipo=us_morpho$/);
  await expect(page.getByText("Resultado de Ultrassom morfológico")).toBeVisible();
  await expect(page.getByRole("radio", { name: "Morfológico" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByLabel("Data do exame")).toHaveValue(hojeISO(-1));
  await entrada(page, "image/*").setInputFiles(await fotos(page, 1));
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Ultrassom morfológico marcado como feito ✓")).toBeVisible();
});

test("RN-05: 'Ler laudo' sem consentimento pede antes de enviar qualquer coisa; free vê o paywall", async ({ page }) => {
  let chamadas = 0;
  await page.route("**/functions/v1/**", (r) => {
    chamadas++;
    return r.abort();
  });
  await entrar(page, 25, { "ninho.medical_documents": [doc("d1000000-0000-4000-8000-000000000001", { title: "Glicemia" })], "ninho.document_pages": paginas("d1000000-0000-4000-8000-000000000001", 1) }, { plano: "ativo" });
  await page.goto("/galeria/d1000000-0000-4000-8000-000000000001");
  await page.getByRole("button", { name: "Ler laudo" }).click();
  await expect(page.getByRole("dialog", { name: "Ler o laudo com IA" })).toBeVisible();
  await expect(page.getByText(/enviadas a um provedor de inteligência artificial/)).toBeVisible();
  await page.getByRole("button", { name: "Agora não" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(chamadas).toBe(0);

  // Concordar grava o consentimento; sem servidor, avisa que precisa de internet.
  await page.getByRole("button", { name: "Ler laudo" }).click();
  await page.getByRole("button", { name: "Concordo, ler o laudo" }).click();
  await expect(page.getByText("A leitura do laudo precisa de internet.")).toBeVisible();
  const consents = await page.evaluate(() => JSON.parse(localStorage.getItem("ninho.perfil")!).consents);
  expect(consents.ai_document_reading.given_at).toBeTruthy();
  expect(chamadas).toBe(0);

  // Na segunda vez não pergunta de novo; em Eu dá para retirar.
  await page.getByRole("button", { name: "Ler laudo" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/eu");
  const chave = page.getByRole("switch", { name: /Leitura de laudo por IA/ });
  await expect(chave).toHaveAttribute("aria-checked", "true");
  await chave.click();
  await expect(chave).toHaveAttribute("aria-checked", "false");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("ninho.perfil")!).consents.ai_document_reading)).toBeNull();
});

test("RN-05: no free, 'Ler laudo' abre o paywall da leitura", async ({ page }) => {
  await entrar(page, 25, { "ninho.medical_documents": [doc("d2000000-0000-4000-8000-000000000001")], "ninho.document_pages": paginas("d2000000-0000-4000-8000-000000000001", 1) });
  await page.goto("/galeria/d2000000-0000-4000-8000-000000000001");
  await page.getByRole("button", { name: "Ler laudo" }).click();
  await expect(page.getByText("Isso é do Completo")).toBeVisible();
  await expect(page.getByText(/leitura do laudo e exportação em PDF/)).toBeVisible();
});

test("RN-06: depois do resumo, o aviso de transcrição; só o laudo marca destaque", async ({ page }) => {
  const resumo = {
    exam_name: "Hemograma completo",
    lab: "Lab Vida",
    exam_date: hojeISO(-3),
    items: [
      { name: "Hemoglobina", value: "10,9", unit: "g/dL", reference: "12,0 a 16,0", flagged_in_report: true },
      { name: "Plaquetas", value: "250.000", unit: "/mm³", reference: "150.000 a 450.000", flagged_in_report: false },
    ],
  };
  await entrar(page, 25, { "ninho.medical_documents": [doc("d3000000-0000-4000-8000-000000000001", { ai_status: "done", ai_summary: resumo })], "ninho.document_pages": paginas("d3000000-0000-4000-8000-000000000001", 1) }, { plano: "ativo" });
  await page.goto("/galeria/d3000000-0000-4000-8000-000000000001");
  await expect(page.getByRole("heading", { name: "O que está escrito" })).toBeVisible();
  await expect(page.getByText("Hemograma completo · Laboratório: Lab Vida")).toBeVisible();
  await expect(page.getByTestId("aviso-ia")).toHaveText("Transcrição automática. Confira com o documento original e converse com seu médico.");
  await expect(page.getByText("marcado no laudo")).toHaveCount(1);
  await expect(page.locator("li", { hasText: "Hemoglobina" })).toContainText("marcado no laudo");
  await expect(page.getByText("referência: 150.000 a 450.000")).toBeVisible();
  await expect(page.getByRole("button", { name: "Ler laudo" })).toHaveCount(0);
  // Página sem arquivo neste aparelho (e sem rede para baixar) não quebra a tela.
  await expect(page.getByRole("img", { name: "Esta página ainda não chegou neste aparelho." })).toBeVisible();
});

test("RN-02: no free, ao passar de 20 páginas vejo o paywall e nada do que já guardei some", async ({ page }) => {
  const id = "d4000000-0000-4000-8000-000000000001";
  await entrar(page, 28, { "ninho.medical_documents": [doc(id, { title: "Laudos antigos" })], "ninho.document_pages": paginas(id, 19) });
  await page.goto("/galeria/adicionar");
  await entrada(page, "image/*").setInputFiles(await fotos(page, 2));
  await page.getByRole("radio", { name: "Sorologias" }).click();
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Isso é do Completo")).toBeVisible();
  await page.getByRole("button", { name: "Agora não" }).click();
  await expect(page).toHaveURL(/\/galeria\/adicionar$/);

  // Com 1 página cabe (20 no total).
  await page.getByRole("button", { name: "Remover a página 2" }).click();
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page).toHaveURL(/\/galeria\/[0-9a-f-]{36}$/);
  await page.goto("/galeria");
  await expect(page.getByRole("link", { name: /Laudos antigos/ })).toContainText("19 páginas");
  await expect(page.getByRole("link", { name: /Sorologias/ })).toBeVisible();

  // Editar o antigo (sem página nova) continua livre.
  await page.goto(`/galeria/adicionar?id=${id}`);
  await page.getByLabel("Observação (opcional)").fill("pasta azul");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("pasta azul")).toBeVisible();
});

test("exportar é premium; com plano, seleciono, respeito 50 páginas e gero o PDF", async ({ page }) => {
  const a = "d5000000-0000-4000-8000-000000000001";
  const b = "d5000000-0000-4000-8000-000000000002";
  await entrar(page, 30, { "ninho.medical_documents": [doc(a, { title: "Morfológico", kind: "us_morpho" }), doc(b, { title: "Muitas páginas" })], "ninho.document_pages": [...paginas(a, 2), ...paginas(b, 49)] });
  await page.goto("/galeria");
  await page.getByRole("button", { name: "Exportar PDF" }).click();
  await page.getByRole("checkbox", { name: "Selecionar Morfológico" }).click();
  await expect(page.getByText("2 de 50 páginas")).toBeVisible();
  await page.getByRole("button", { name: "Gerar PDF" }).click();
  await expect(page.getByText("Isso é do Completo")).toBeVisible();

  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem("ninho.perfil")!);
    localStorage.setItem("ninho.perfil", JSON.stringify({ ...p, plano: "ativo" }));
  });
  await page.reload();
  await page.getByRole("checkbox", { name: "Selecionar Morfológico" }).click();
  await page.getByRole("checkbox", { name: "Selecionar Muitas páginas" }).click();
  await expect(page.getByText("Passou de 50 páginas. Tire algum documento.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Gerar PDF" })).toBeDisabled();
  await page.getByRole("checkbox", { name: "Selecionar Muitas páginas" }).click();
  await page.getByRole("button", { name: "Gerar PDF" }).click();
  await expect(page.getByText("PDF pronto ✓")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Baixar o PDF" }).click();
  expect((await download).suggestedFilename()).toBe("ninho-exames.pdf");
});

test("RN-03: excluo um documento e ele não reaparece", async ({ page }) => {
  const id = "d6000000-0000-4000-8000-000000000001";
  await entrar(page, 25, { "ninho.medical_documents": [doc(id, { title: "Para apagar" })], "ninho.document_pages": paginas(id, 1) });
  await page.goto(`/galeria/${id}`);
  await page.getByRole("button", { name: "Excluir" }).click();
  await expect(page.getByText("É definitivo: as páginas somem deste aparelho e do armazenamento.")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Excluir" }).click();
  await expect(page).toHaveURL(/\/galeria$/);
  await expect(page.getByText("Documento excluído")).toBeVisible();
  await expect(page.getByText("Guarde aqui o primeiro ultrassom")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Para apagar")).toHaveCount(0);
});

test("RN-10: o parceiro só vê o compartilhado e não edita; o atalho em Eu leva à galeria", async ({ page }) => {
  const a = "d7000000-0000-4000-8000-000000000001";
  const b = "d7000000-0000-4000-8000-000000000002";
  await entrar(
    page,
    25,
    {
      "ninho.medical_documents": [doc(a, { title: "Compartilhado", shared_with_partner: true }), doc(b, { title: "Só dela" })],
      "ninho.document_pages": [...paginas(a, 1), ...paginas(b, 1)],
      "ninho.sessao": { uid: "pai-local", anonima: true, remota: false },
    },
    { papel: "parceiro" },
  );
  await page.goto("/eu");
  await page.getByRole("link", { name: "Exames e ultrassons guardados" }).click();
  await expect(page.getByRole("link", { name: /Compartilhado/ })).toBeVisible();
  await expect(page.getByText("Só dela")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "+ Adicionar" })).toHaveCount(0);
  await page.getByRole("link", { name: /Compartilhado/ }).click();
  await expect(page.getByRole("button", { name: "Excluir" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ler laudo" })).toHaveCount(0);
});

test("sem internet, abro a galeria, vejo o que já carreguei e adiciono um documento", async ({ page, context }) => {
  const id = "d8000000-0000-4000-8000-000000000001";
  await entrar(page, 25, { "ninho.medical_documents": [doc(id, { title: "Já guardado" })], "ninho.document_pages": paginas(id, 1) });
  await page.goto("/galeria");
  // O service worker guarda as telas abertas (ARQ-04).
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await page.getByRole("button", { name: "+ Adicionar" }).click();
  await expect(page).toHaveURL(/\/galeria\/adicionar$/);
  const imagens = await fotos(page, 1);
  await page.goto("/galeria/adicionar");
  await page.goto("/galeria");
  await expect(page.getByRole("link", { name: /Já guardado/ })).toBeVisible();

  await ficarSemRede(context);
  await page.reload();
  await expect(page.getByRole("link", { name: /Já guardado/ })).toBeVisible();
  await page.getByRole("button", { name: "+ Adicionar" }).click();
  await entrada(page, "image/*").setInputFiles(imagens);
  await page.getByRole("radio", { name: "Glicemia" }).click();
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page).toHaveURL(/\/galeria$/);
  await expect(page.getByText("Guardado na galeria ✓")).toBeVisible();
  await expect(page.getByRole("link", { name: /Glicemia/ })).toBeVisible();
  await voltarARede(context);
});
