import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

/**
 * Critérios de aceite da funcionalidade 14 · Cartas, no build sem servidor. O lacre de verdade (conteúdo fora da API),
 * a abertura na data, o link de leitura e o recálculo no nascimento estão no pgTAP (supabase/tests/cartas.test.sql);
 * o efeito do lacre no aparelho, no Vitest (src/lib/cartas/acoes.test.ts).
 */
test.use({ timezoneId: "America/Sao_Paulo" });

function hojeISO(desloc = 0) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(Date.now() + desloc * 86_400_000));
}
const agora = () => new Date().toISOString();

async function entrar(page: Page, o: { perfil?: Record<string, unknown>; extra?: Record<string, unknown> } = {}) {
  await page.addInitScript(
    (d) => {
      if (sessionStorage.getItem("semeado")) return;
      sessionStorage.setItem("semeado", "1");
      for (const [k, v] of Object.entries(d)) localStorage.setItem(k, JSON.stringify(v));
    },
    {
      "ninho.sessao": { uid: "mae-local", anonima: true, remota: false },
      "ninho.perfil": { nome: "Helena", modo: "gestacao", dpp: hojeISO(140), anonima: true, plano: "free", papel: "mae", onboardingConcluidoEm: agora(), tz: "America/Sao_Paulo", nomeDoBebe: "Theo", ...o.perfil },
      "ninho.membros": [{ id: "m-mae", profile_id: "mae-local", nome: "Helena", papel: "mae", ultimo_acesso_em: agora(), atualizado_em: agora() }],
      ...o.extra,
    },
  );
}

async function escrever(page: Page, titulo: string, texto: string) {
  await page.getByLabel("Título").fill(titulo);
  await page.getByLabel("Carta", { exact: true }).fill(texto);
  await page.getByRole("radio", { name: "1º aniversário" }).click();
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(page).toHaveURL(/\/cartas\/escrever\?id=/);
}

test("sem cartas, vejo 'Escreva a primeira carta para Theo'; escrevo, salvo e ela fica nos rascunhos", async ({ page }) => {
  await entrar(page);
  await page.goto("/eu");
  await page.getByRole("link", { name: "Cartas para o bebê" }).click();
  await expect(page.getByRole("heading", { name: "Escreva a primeira carta para Theo" })).toBeVisible();
  await page.getByRole("button", { name: "Escrever carta" }).click();
  await expect(page.getByText("Para Theo")).toBeVisible();
  await escrever(page, "Para o seu primeiro aniversário", "Te espero com amor.");
  // RN-02: antes do nascimento, a data sai da DPP.
  await expect(page.getByText(/Abriria em .* Pela data prevista do parto/)).toBeVisible();
  await page.goto("/cartas");
  const rascunhos = page.locator("section", { has: page.getByRole("heading", { name: "Rascunhos" }) });
  await expect(rascunhos.getByRole("link", { name: /Para o seu primeiro aniversário/ })).toBeVisible();
  await page.reload();
  await rascunhos.getByRole("link", { name: /Para o seu primeiro aniversário/ }).click();
  await expect(page.getByRole("textbox", { name: "Carta", exact: true })).toHaveValue("Te espero com amor.");
});

test("sem internet escrevo um rascunho; lacrar exige conexão (e conta com servidor)", async ({ page, context }) => {
  await entrar(page);
  await page.goto("/cartas");
  await page.evaluate(() => navigator.serviceWorker?.ready.then(() => undefined));
  await page.goto("/cartas/escrever");
  await page.goto("/cartas");
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "Escrever carta" }).click();
  await escrever(page, "Escrita no avião", "Sem internet também.");
  await page.getByRole("button", { name: "Lacrar" }).click();
  const sheet = page.getByRole("dialog", { name: "Lacrar a carta?" });
  await expect(sheet.getByText(/Esta carta só poderá ser lida em/)).toBeVisible();
  await sheet.getByRole("button", { name: "Lacrar" }).click();
  await expect(sheet.getByRole("alert")).toContainText("precisa de conta com internet");
  await context.setOffline(false);
});

test("no free, ao criar a 3ª carta vejo o paywall; áudio e foto também são do Completo", async ({ page }) => {
  await entrar(page);
  for (const t of ["Primeira", "Segunda"]) {
    await page.goto("/cartas");
    await page.getByRole("button", { name: "Escrever carta" }).click();
    if (t === "Primeira") {
      await page.getByRole("button", { name: "Gravar áudio" }).click();
      await expect(page.getByText("Isso é do Completo")).toBeVisible();
      await page.getByRole("button", { name: "Agora não" }).click();
    }
    await escrever(page, t, "Texto.");
  }
  await page.goto("/cartas");
  await page.getByRole("button", { name: "Escrever carta" }).click();
  await expect(page.getByText("No grátis, cada pessoa escreve até 2 cartas, só com texto.")).toBeVisible();
  await expect(page).toHaveURL(/\/cartas$/);
});

test("lacrada mostra só título e data; abrir antes da hora pede duas confirmações", async ({ page }) => {
  const lacrada = { id: "c-1", title: "Para os seus 18 anos", body: null, audio_path: null, audio_seconds: null, photo_path: null, open_rule: "age_18", custom_open_on: null, open_on: "2045-03-08", status: "sealed", delivery_email: null, criado_por: "mae-local", atualizado_em: agora() };
  await entrar(page, { extra: { "ninho.letters": [lacrada] } });
  await page.goto("/cartas");
  const secao = page.locator("section", { has: page.getByRole("heading", { name: "Lacradas" }) });
  await expect(secao.getByRole("link", { name: /Para os seus 18 anos/ })).toContainText("Abre em 8 de março de 2045");
  await secao.getByRole("link", { name: /Para os seus 18 anos/ }).click();
  await expect(page.getByRole("heading", { name: "Para os seus 18 anos" })).toBeVisible();
  await expect(page.getByText("Lacrada. O conteúdo aparece no dia de abrir.")).toBeVisible();
  await page.getByRole("button", { name: "Abrir antes da hora" }).click();
  await expect(page.getByRole("dialog", { name: "Quer mesmo abrir antes da hora?" })).toBeVisible();
  await page.getByRole("button", { name: "Sim, abrir" }).click();
  await expect(page.getByRole("dialog", { name: "Tem certeza?" })).toBeVisible();
  await page.getByRole("button", { name: "Abrir agora" }).click();
  // Sem servidor, nada abre: o lacre mora no banco.
  await expect(page.getByRole("alert").filter({ hasText: "conta com internet" })).toContainText("Isso precisa de conta com internet");
  await expect(page.getByText("Lacrada. O conteúdo aparece no dia de abrir.")).toBeVisible();
});

test("exporto rascunhos e abertas num ZIP; a lacrada fica de fora", async ({ page }) => {
  const aberta = { id: "c-2", title: "Aberta", body: "Já pode ler.", audio_path: null, audio_seconds: null, photo_path: null, open_rule: "custom", custom_open_on: hojeISO(-1), open_on: hojeISO(-1), status: "opened", opened_at: agora(), delivery_email: null, criado_por: "mae-local", atualizado_em: agora() };
  const lacrada = { id: "c-3", title: "Segredo", body: null, audio_path: null, audio_seconds: null, photo_path: null, open_rule: "age_5", custom_open_on: null, open_on: "2032-03-08", status: "sealed", delivery_email: null, criado_por: "mae-local", atualizado_em: agora() };
  await entrar(page, { extra: { "ninho.letters": [aberta, lacrada] } });
  await page.goto("/cartas/ler?id=c-2");
  await expect(page.getByText("Já pode ler.")).toBeVisible();
  await page.goto("/cartas");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar cartas (ZIP)" }).click();
  const zip = readFileSync((await (await download).path())!);
  expect(zip.subarray(0, 4).toString("hex")).toBe("504b0304");
  expect(zip.toString("utf8")).toContain("aberta/carta.txt");
  expect(zip.toString("utf8")).toContain("Já pode ler.");
  expect(zip.toString("utf8")).not.toContain("segredo");
});

test("o link de leitura de um token que não existe não abre nada", async ({ page }) => {
  await page.goto(`/carta/${"a".repeat(64)}`);
  await expect(page.getByText("Este link não abre mais. Pode ter vencido ou sido revogado.")).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("excluir pede confirmação e é definitivo", async ({ page }) => {
  await entrar(page);
  await page.goto("/cartas/escrever");
  await escrever(page, "Rascunho a apagar", "x");
  await page.getByRole("button", { name: "Excluir carta" }).click();
  await expect(page.getByRole("dialog", { name: "Excluir a carta?" })).toContainText("É definitivo");
  await page.getByRole("dialog").getByRole("button", { name: "Excluir" }).click();
  await expect(page).toHaveURL(/\/cartas$/);
  await expect(page.getByRole("heading", { name: "Escreva a primeira carta para Theo" })).toBeVisible();
});
