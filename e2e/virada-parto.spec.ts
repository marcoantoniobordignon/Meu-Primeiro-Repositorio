import { expect, test } from "@playwright/test";

/** Fluxo crítico 3: na semana 39, "Nasceu!" vira o app para o bebê e libera a cortesia (spec 11). */
test("virada do parto: Nasceu! → celebração → home do bebê, com cortesia e check-in", async ({ page }) => {
  const dpp = new Date();
  dpp.setDate(dpp.getDate() + 7);
  const iso = dpp.toISOString().slice(0, 10);
  await page.addInitScript(
    (d) => {
      for (const [k, v] of Object.entries(d)) localStorage.setItem(k, v as string);
    },
    { "ninho.perfil": JSON.stringify({ nome: "Helena", modo: "gestacao", dpp: iso, anonima: true, plano: "free", onboardingConcluidoEm: new Date(Date.now() - 10 * 86400000).toISOString() }) },
  );

  await page.goto("/registrar");
  await page.getByRole("button", { name: /Nasceu!/ }).click();
  await page.getByLabel("Nome do bebê").fill("Theo");
  await page.getByRole("button", { name: "Registrar nascimento" }).click();

  await expect(page).toHaveURL(/\/bebe\/bem-vindo$/);
  await expect(page.getByText("Theo")).toBeVisible();
  await expect(page.getByText("bem-vindo ao mundo")).toBeVisible();
  await page.getByRole("button", { name: "Ver o bebê" }).click();

  await expect(page).toHaveURL(/\/hoje$/);
  await expect(page.getByText(/Theo · /)).toBeVisible();
  await expect(page.getByText("Como você está?")).toBeVisible();
  await expect(page.getByText("Registre o próximo sono para eu começar a prever.")).toBeVisible();

  const perfil = await page.evaluate(() => JSON.parse(localStorage.getItem("ninho.perfil")!));
  expect(perfil.modo).toBe("bebe");
  expect(new Date(perfil.cortesiaFim).getTime()).toBeGreaterThan(Date.now() + 6 * 86400000);

  // VIR-06: nas primeiras 24 h dá para desfazer.
  await page.goto("/eu/bebe");
  await page.getByRole("button", { name: "Não nasceu ainda" }).click();
  await expect(page).toHaveURL(/\/hoje$/);
  await expect(page.getByText(/semanas para o parto|pode ser a qualquer momento/)).toBeVisible();
});
