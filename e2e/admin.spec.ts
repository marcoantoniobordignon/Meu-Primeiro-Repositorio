import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 900 } });

/** Painel em modo demonstração (sem Supabase): criar, validar e publicar um conteúdo. */
test("admin: novo conteúdo é barrado pelas regras da spec 07 e depois publicado", async ({ page }) => {
  await page.goto("/admin/conteudo/novo");
  await page.getByLabel("Título", { exact: true }).fill("Teste do painel: sempre funciona");
  await expect(page.locator("#campo-slug")).toHaveValue("teste-do-painel-sempre-funciona");
  await page.getByRole("spinbutton", { name: "Da semana" }).fill("10");
  await page.getByRole("spinbutton", { name: "Até a semana" }).fill("20");
  await page.getByLabel("Cards", { exact: true }).fill("Um card só.");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();

  const alerta = page.getByRole("alert").filter({ hasText: "Antes de salvar" });
  await expect(alerta).toContainText('Evite "sempre"');
  await expect(alerta).toContainText("Pelo menos 2 cards");
  await expect(alerta).toContainText("Na dúvida, fale com quem te acompanha");

  await page.getByLabel("Título", { exact: true }).fill("Teste do painel");
  await page.getByLabel("Cards", { exact: true }).fill("Primeiro card.\n\n---\n\nSegundo card.");
  await page.getByRole("button", { name: "Inserir frase de encaminhamento" }).click();
  await expect(page.getByText("1 de 3")).toBeVisible();
  await page.getByRole("button", { name: "Salvar e publicar" }).click();

  await expect(page).toHaveURL(/\/admin\/conteudo$/);
  await page.getByLabel("Buscar por título").fill("Teste do painel");
  const linha = page.getByRole("row").filter({ hasText: "Teste do painel" });
  await expect(linha).toContainText("sem. 10–20");
  await expect(linha).toContainText("Publicado");
});

test("admin: visão geral e calendário renderizam com dados de demonstração", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByText("Dados de demonstração")).toBeVisible();
  await expect(page.getByRole("img", { name: "Famílias por dia" })).toBeVisible();
  await page.getByRole("radio", { name: "90 dias" }).click();
  await expect(page.getByText("Novas em 90 dias")).toBeVisible();

  await page.goto("/admin/conteudo");
  await page.getByRole("radio", { name: "Por dia" }).click();
  await expect(page.getByText("hoje")).toBeVisible();
  await expect(page.getByRole("link", { name: /Semana 20: o que muda/ }).first()).toBeVisible();
});
