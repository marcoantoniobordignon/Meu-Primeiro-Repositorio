import { expect, test } from "@playwright/test";

/** Aba 3D: entrada pela Hoje, abre na semana do perfil, UI e ficha presentes; sem WebGL cai no texto. */
test("bebê 3D: card na Hoje leva à cena da semana, com ficha e enquadramentos", async ({ page }) => {
  const dpp = new Date();
  dpp.setDate(dpp.getDate() + 140); // semana 20
  await page.addInitScript((d) => {
    localStorage.setItem("ninho.sessao", JSON.stringify({ uid: "local", anonima: true }));
    localStorage.setItem("ninho.perfil", JSON.stringify({ nome: "Helena", modo: "gestacao", dpp: d, anonima: true, plano: "free", papel: "mae", onboardingConcluidoEm: new Date().toISOString() }));
  }, dpp.toISOString().slice(0, 10));

  await page.goto("/hoje");
  await page.getByRole("link", { name: /Veja seu bebê hoje/ }).click();
  await expect(page).toHaveURL(/\/hoje\/bebe-3d$/);

  // Com WebGL2: canvas e controles. Sem: descrição em texto. Nos dois casos, a ficha da semana.
  const canvas = page.locator("canvas");
  const semWebgl = page.getByText(/não consegue mostrar a cena 3D/);
  await expect(canvas.or(semWebgl).first()).toBeVisible({ timeout: 20000 });
  await expect(page.getByText("Do tamanho de uma banana")).toBeVisible();

  if (await canvas.isVisible()) {
    await expect(page.getByRole("banner").getByText("Semana 20")).toBeVisible();
    await page.getByRole("radio", { name: "Rosto" }).click();
    await expect(page.getByRole("radio", { name: "Rosto" })).toHaveAttribute("aria-checked", "true");
    await page.getByRole("button", { name: /banana/ }).click();
    await expect(page.getByText(/primeiros movimentos/)).toBeVisible();
    await expect(page.getByText(/Não substitui o acompanhamento pré-natal/)).toBeVisible();
  }
});
