import { readFile } from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

import { ficarSemRede, voltarARede } from "./rede";

/** Critérios de aceite da funcionalidade 10 · Plano de parto, malas e enxoval (build de produção, sem servidor). */
test.use({ timezoneId: "America/Sao_Paulo" });

function hojeISO(desloc = 0) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(Date.now() + desloc * 86_400_000));
}
const dppNaSemana = (semana: number) => hojeISO(280 - semana * 7 - 1);
const agora = () => new Date().toISOString();
const mae = { id: "m-mae", profile_id: "mae-local", nome: "Helena", papel: "mae", ultimo_acesso_em: agora(), atualizado_em: agora() };
const pai = { id: "m-pai", profile_id: "pai-local", nome: "Rafa", papel: "parceiro", ultimo_acesso_em: agora(), atualizado_em: agora(), permissoes: { agenda: true, birth_plan: true, belly_photos: false } };

async function entrar(page: Page, semana: number, extra: Record<string, unknown> = {}, perfil: Record<string, unknown> = {}, uid = "mae-local") {
  await page.addInitScript(
    (d) => {
      (window as unknown as { __avisos: string[] }).__avisos = [];
      class Falsa {
        static permission = "granted";
        static requestPermission = async () => "granted";
        constructor(titulo: string) {
          (window as unknown as { __avisos: string[] }).__avisos.push(titulo);
        }
      }
      Object.defineProperty(window, "Notification", { value: Falsa, configurable: true });
      if (navigator.serviceWorker) navigator.serviceWorker.getRegistration = async () => undefined;
      if (sessionStorage.getItem("semeado")) return;
      sessionStorage.setItem("semeado", "1");
      for (const [k, v] of Object.entries(d)) localStorage.setItem(k, JSON.stringify(v));
    },
    {
      "ninho.sessao": { uid, anonima: true, remota: false },
      "ninho.perfil": { nome: "Helena", modo: "gestacao", dpp: dppNaSemana(semana), anonima: true, plano: "free", papel: "mae", onboardingConcluidoEm: agora(), tz: "America/Sao_Paulo", ...perfil },
      "ninho.membros": [mae],
      ...extra,
    },
  );
}

async function pdfBaixado(page: Page, acao: () => Promise<void>) {
  const download = page.waitForEvent("download");
  await acao();
  const d = await download;
  const bytes = await readFile((await d.path())!);
  return { nome: d.suggestedFilename(), pdf: await PDFDocument.load(bytes), bytes };
}

test("plano recém-aberto: 5 etapas e listas semeadas; preencho maternidade e acompanhante e o progresso mostra 2", async ({ page }) => {
  await entrar(page, 30);
  await page.goto("/eu");
  await page.getByRole("link", { name: "Plano de parto, malas e enxoval" }).click();
  await expect(page.getByText("0 de 5 etapas")).toBeVisible();
  for (const e of ["Onde", "Como", "Quem", "Documentos", "Malas e enxoval"]) await expect(page.getByRole("link", { name: new RegExp(`^${e}`) })).toBeVisible();
  await page.getByRole("link", { name: /^Malas e enxoval/ }).click();
  for (const [l, n] of [["Mala da mãe", 12], ["Mala do bebê", 10], ["Mala do acompanhante", 6], ["Enxoval", 20]] as const) {
    await expect(page.getByLabel(`${l}: 0 de ${n}`)).toBeVisible();
  }
  await page.getByRole("button", { name: "Voltar" }).click();

  await page.getByRole("link", { name: /^Onde/ }).click();
  await expect(page.getByText(/Lei 11.634\/2007/)).toBeVisible();
  await page.getByLabel("Maternidade", { exact: true }).fill("Maternidade Sol");
  await page.getByLabel("Telefone da maternidade").fill("(11) 3333-4444");
  await page.getByRole("radio", { name: "Plano de saúde" }).click();
  await page.getByLabel("Médico(a)", { exact: true }).fill("Dra. Ana");
  await page.getByRole("button", { name: "Concluir etapa" }).click();
  await expect(page.getByText("1 de 5 etapas")).toBeVisible();

  await page.getByRole("link", { name: /^Quem/ }).click();
  await expect(page.getByText(/Lei 11.108\/2005/)).toBeVisible();
  await page.getByLabel("Nome · Acompanhante").fill("Rafa");
  await page.getByRole("button", { name: "Concluir etapa" }).click();
  await expect(page.getByText("2 de 5 etapas")).toBeVisible();

  // Volto depois: tudo intacto (o salvamento é automático, sem botão).
  await page.reload();
  await page.getByRole("link", { name: /^Onde/ }).click();
  await expect(page.getByLabel("Maternidade", { exact: true })).toHaveValue("Maternidade Sol");
});

test("gero o PDF com maternidade, equipe e preferências marcadas, em uma página, também em modo avião", async ({ page, context }) => {
  const plano = {
    id: "p1", maternity_name: "Maternidade Sol", maternity_address: "Rua das Flores, 10", maternity_phone: "11 3333-4444", maternity_maps_url: null, coverage: "private", insurer_name: "Saúde Mais",
    doctor_name: "Dra. Ana", doctor_phone: null, wished_delivery: "vaginal", prefs: { analgesia: "epidural", skin_to_skin: true, breastfeeding_first_hour: true }, notes: "Música calma", companion_name: "Rafa", companion_phone: "11 99999-0000",
    doula_name: null, doula_phone: null, emergency_name: null, emergency_phone: null, completed_steps: [1, 2, 3], atualizado_em: agora(),
  };
  await entrar(page, 33, { "ninho.birth_plans": [plano] });
  await page.goto("/plano-parto");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.getByRole("button", { name: "Gerar PDF" }).click();
  const previa = page.getByTestId("previa-pdf");
  await expect(previa.getByText("Maternidade Sol")).toBeVisible();
  await expect(previa.getByText("Dra. Ana", { exact: false })).toBeVisible();
  await expect(previa.getByText("✓ Contato pele a pele logo após o nascimento")).toBeVisible();
  await expect(previa.getByText("feito com Ninho")).toBeVisible();
  const { nome, pdf, bytes } = await pdfBaixado(page, () => page.getByRole("button", { name: /PDF/ }).click());
  expect(nome).toBe("plano-de-parto.pdf");
  expect(pdf.getPageCount()).toBe(1);
  expect(bytes.byteLength).toBeGreaterThan(1000);

  // Modo avião numa tela já aberta: o PDF é montado no aparelho.
  await page.goto("/plano-parto/pdf");
  await ficarSemRede(context);
  await page.reload();
  const offline = await pdfBaixado(page, () => page.getByRole("button", { name: /PDF/ }).click());
  expect(offline.pdf.getPageCount()).toBe(1);
  await voltarARede(context);
});

test("marco itens da mala (também sem internet) e o progresso sobe; adiciono 'Almofada de amamentação' e fica salvo", async ({ page, context }) => {
  await entrar(page, 33);
  await page.goto("/plano-parto/listas");
  await expect(page.getByLabel("Mala da mãe: 0 de 12")).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await ficarSemRede(context);
  await page.getByRole("checkbox", { name: "Marcar Chinelo" }).click();
  await page.getByRole("checkbox", { name: "Marcar Meias" }).first().click();
  await expect(page.getByLabel("Mala da mãe: 2 de 12")).toBeVisible();
  await page.getByLabel("Novo item em Mala da mãe").fill("Almofada de amamentação");
  await page.getByRole("button", { name: "Adicionar item" }).first().click();
  await expect(page.getByLabel("Mala da mãe: 2 de 13")).toBeVisible();
  await page.getByRole("button", { name: "Uma a mais de Almofada de amamentação" }).click();
  await voltarARede(context);
  await page.goto("/plano-parto");
  await page.goto("/plano-parto/listas");
  await expect(page.getByRole("checkbox", { name: "Marcar Almofada de amamentação" })).toBeVisible();
  await expect(page.getByLabel("Mala da mãe: 2 de 13")).toBeVisible();
  const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem("ninho.birth_checklist_items")!).find((i: { title: string }) => i.title === "Almofada de amamentação"));
  expect(salvo).toMatchObject({ list: "bag_mother", is_custom: true, quantity: 2 });
});

test("toco em 'Ligar para a maternidade' e o discador abre com o número", async ({ page }) => {
  const plano = { id: "p1", maternity_name: "Maternidade Sol", maternity_address: null, maternity_phone: "(11) 3333-4444", maternity_maps_url: null, coverage: null, insurer_name: null, doctor_name: null, doctor_phone: null, wished_delivery: "undecided", prefs: {}, notes: null, companion_name: null, companion_phone: null, doula_name: null, doula_phone: null, emergency_name: null, emergency_phone: null, completed_steps: [], atualizado_em: agora() };
  await entrar(page, 38, { "ninho.birth_plans": [plano] });
  await page.goto("/plano-parto");
  await expect(page.getByRole("link", { name: "Ligar para a maternidade" })).toHaveAttribute("href", "tel:1133334444");
});

test("o parceiro marca itens da mala, mas não consegue editar as preferências", async ({ page }) => {
  const plano = { id: "p1", maternity_name: "Maternidade Sol", maternity_address: null, maternity_phone: null, maternity_maps_url: null, coverage: null, insurer_name: null, doctor_name: null, doctor_phone: null, wished_delivery: "vaginal", prefs: { skin_to_skin: true }, notes: null, companion_name: null, companion_phone: null, doula_name: null, doula_phone: null, emergency_name: null, emergency_phone: null, completed_steps: [], atualizado_em: agora() };
  const itens = [{ id: "i1", list: "bag_baby", title: "Body", quantity: null, note: null, is_done: false, is_custom: false, position: 1, atualizado_em: agora() }];
  await entrar(page, 35, { "ninho.membros": [mae, pai], "ninho.birth_plans": [plano], "ninho.birth_checklist_items": itens }, { papel: "parceiro", nome: "Rafa" }, "pai-local");
  await page.goto("/plano-parto/listas");
  await page.getByRole("checkbox", { name: "Marcar Body" }).click();
  await expect(page.getByRole("checkbox", { name: "Marcar Body" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("button", { name: "Concluir etapa" })).toHaveCount(0);

  await page.goto("/plano-parto/como");
  await expect(page.getByText("Só ela edita esta parte.", { exact: false })).toBeVisible();
  await expect(page.getByRole("switch", { name: /Contato pele a pele/ })).toBeDisabled();
  await expect(page.getByRole("radio", { name: "Cesárea" })).toBeDisabled();
  await page.goto("/plano-parto/onde");
  await expect(page.getByLabel("Maternidade", { exact: true })).toBeDisabled();
});

test("semana 34: com a mala incompleta recebo o lembrete; com a mala completa, não", async ({ page }) => {
  const dpp = dppNaSemana(30);
  // Relógio na virada da semana 34, às 10:01.
  const dia34 = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(new Date(`${dpp}T12:00:00-03:00`).getTime() - (280 - 34 * 7) * 86_400_000));
  await page.clock.install({ time: new Date(`${dia34}T10:01:00-03:00`) });
  await entrar(page, 30, {}, { dpp });
  await page.goto("/plano-parto/listas");
  await expect.poll(() => page.evaluate(() => (window as unknown as { __avisos: string[] }).__avisos)).toContain("Faltam itens na mala");

  // Com tudo marcado, no mesmo instante, nenhum aviso da mala.
  await page.evaluate(() => {
    const l = JSON.parse(localStorage.getItem("ninho.birth_checklist_items")!).map((i: Record<string, unknown>) => ({ ...i, is_done: true }));
    localStorage.setItem("ninho.birth_checklist_items", JSON.stringify(l));
    localStorage.removeItem("ninho.lembretes.enviados");
  });
  await page.reload();
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as unknown as { __avisos: string[] }).__avisos)).not.toContain("Faltam itens na mala");
});

test("volto na semana 39 sem maternidade e a home mostra 'Qual maternidade?'; a aba Enxoval abre as listas", async ({ page }) => {
  await entrar(page, 39);
  await page.goto("/hoje");
  await page.getByRole("link", { name: /Qual maternidade\?/ }).click();
  await expect(page).toHaveURL(/\/plano-parto\/onde$/);
  await page.getByLabel("Maternidade", { exact: true }).fill("Maternidade Sol");
  await page.waitForTimeout(1000);
  await page.goto("/hoje");
  await expect(page.getByText("Qual maternidade?")).toHaveCount(0);
  await page.getByRole("link", { name: "Enxoval", exact: true }).click();
  await expect(page).toHaveURL(/\/plano-parto\/listas$/);
});

test("documentos: anexo foto (até 3 por item) e no free o 11º anexo abre o paywall", async ({ page }) => {
  const docs = Array.from({ length: 4 }, (_, i) => ({ id: `d${i}`, list: "documents", title: `Doc ${i}`, quantity: null, note: null, is_done: false, is_custom: false, position: i + 1, atualizado_em: agora() }));
  const anexos = Array.from({ length: 9 }, (_, i) => ({ id: `a${i}`, item_id: `d${Math.floor(i / 3)}`, storage_path: `plano/d/a${i}.jpg`, position: (i % 3) + 1, atualizado_em: agora() }));
  await entrar(page, 33, { "ninho.birth_checklist_items": docs, "ninho.birth_item_attachments": anexos });
  await page.goto("/plano-parto/documentos");
  await page.getByRole("button", { name: "Anexar foto de Doc 0" }).click();
  await expect(page.getByText("Até 3 fotos por documento.")).toBeVisible();
  const foto = await page.screenshot({ type: "jpeg", quality: 60 });
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("button", { name: "Anexar foto de Doc 3" }).click()]);
  await chooser.setFiles({ name: "rg.jpg", mimeType: "image/jpeg", buffer: foto });
  await expect(page.getByRole("img", { name: "Foto 1 de Doc 3" })).toBeVisible();
  await page.getByRole("button", { name: "Anexar foto de Doc 3" }).click();
  await expect(page.getByText("Isso é do Completo")).toBeVisible();
});
