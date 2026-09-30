import { expect, test } from "@playwright/test";

function iso(d: Date) {
  return d.toISOString();
}

/** Fluxo crítico 2: registrar o bebê em um toque e ver o tile (spec 09). */
test.beforeEach(async ({ page }) => {
  const nascido = new Date();
  nascido.setDate(nascido.getDate() - 56);
  const agora = new Date().toISOString();
  await page.addInitScript(
    (d) => {
      for (const [k, v] of Object.entries(d)) localStorage.setItem(k, v as string);
    },
    {
      "ninho.sessao": JSON.stringify({ uid: "local", anonima: true, remota: false }),
      "ninho.perfil": JSON.stringify({ nome: "Helena", modo: "bebe", anonima: true, plano: "free", papel: "mae", onboardingConcluidoEm: agora }),
      "ninho.bebes": JSON.stringify([{ id: "b1", nome: "Theo", nascido_em: iso(nascido), prematuro_semanas: null, ordem: 0, aviso_soneca: false, registrado_em: iso(nascido), atualizado_em: agora }]),
    },
  );
});

test("fralda em um toque: tile mostra 'agora · cocô' e o dia lista o registro", async ({ page }) => {
  await page.goto("/hoje");
  await expect(page.getByRole("button", { name: /^Fralda/ })).toContainText("ainda não registrado");
  await page.getByRole("button", { name: /^Fralda/ }).click();
  await page.getByRole("button", { name: "Cocô" }).click();
  await expect(page.getByText("Fralda registrada ✓")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Fralda/ })).toContainText("cocô");

  await page.goto("/bebe/dia");
  await expect(page.getByText("Fralda")).toBeVisible();
  await expect(page.getByText(/cocô/)).toBeVisible();
});

test("sono: timer roda, sobrevive a recarregar e 'Acordou agora' encerra; apagar tem desfazer", async ({ page }) => {
  await page.goto("/hoje");
  await page.getByRole("button", { name: /^Sono/ }).click();
  await page.getByRole("button", { name: "Começar agora" }).click();
  await expect(page.getByRole("button", { name: /^Dormindo/ })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: /^Dormindo/ })).toBeVisible();
  await page.getByRole("button", { name: /^Dormindo/ }).click();
  await page.getByRole("button", { name: "Acordou agora" }).click();
  await expect(page.getByRole("button", { name: /^Sono/ })).toContainText("agora");

  await page.goto("/bebe/dia");
  await page.getByRole("button", { name: /Sono/ }).first().click();
  await page.getByRole("button", { name: "Apagar" }).click();
  await expect(page.getByText("Sono apagado")).toBeVisible();
  await page.getByRole("button", { name: "Desfazer" }).click();
  await expect(page.getByRole("button", { name: /Sono/ }).first()).toBeVisible();
});
