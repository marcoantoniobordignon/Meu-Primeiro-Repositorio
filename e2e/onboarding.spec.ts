import { expect, test } from "@playwright/test";

/** Fluxo crítico 1: primeiro valor antes do cadastro (spec 04). */
test("onboarding: DUM → valor em 4 toques, sem conta, e chega na Hoje", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByRole("radio", { name: /Estou grávida/ }).click(); // toque 1
  await page.getByRole("tab", { name: /última menstruação/ }).click(); // toque 2
  const dum = new Date();
  dum.setDate(dum.getDate() - 157);
  await page.locator('input[type="date"]').first().fill(dum.toISOString().slice(0, 10)); // toque 3
  await expect(page.getByText(/o parto deve ser por volta de/)).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click(); // toque 4

  await expect(page.locator("p.tipo-heroi")).toHaveText("22");
  await expect(page.getByText(/semanas para o parto/)).toBeVisible();
  await expect(page.getByText(/Do tamanho de/)).toBeVisible();

  await page.getByRole("button", { name: "Quero acompanhar" }).click();
  await page.getByLabel("Seu nome").fill("Helena");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Pular" }).click(); // sintomas
  await page.getByRole("button", { name: "Pular" }).click(); // instalar
  await page.getByRole("button", { name: "Agora não" }).click(); // guardar

  await expect(page).toHaveURL(/\/hoje$/);
  await expect(page.getByText(/Helena/)).toBeVisible();
  await expect(page.getByText("Guardar minha linha do tempo")).toBeVisible();
});
