import { expect, test, type Page } from "@playwright/test";

import { ficarSemRede, voltarARede } from "./rede";

/**
 * Critérios de aceite da funcionalidade 09 · FAQ de comidas, no build sem servidor: aparece a semente
 * em rascunho (com o selo); publicar, perguntar e votar com servidor estão no pgTAP (supabase/tests/faq.test.sql).
 */
test.use({ timezoneId: "America/Sao_Paulo" });

async function entrar(page: Page) {
  const agora = new Date().toISOString();
  await page.addInitScript(
    (d) => {
      if (sessionStorage.getItem("semeado")) return;
      sessionStorage.setItem("semeado", "1");
      for (const [k, v] of Object.entries(d)) localStorage.setItem(k, JSON.stringify(v));
    },
    {
      "ninho.sessao": { uid: "mae-local", anonima: true, remota: false },
      "ninho.perfil": { nome: "Helena", modo: "gestacao", dpp: "2027-03-08", anonima: true, plano: "free", papel: "mae", onboardingConcluidoEm: agora, tz: "America/Sao_Paulo" },
    },
  );
}

test("antes de qualquer coisa, o FAQ mostra categorias e mais buscados; busco 'acai' sem acento e acho 'Açaí'", async ({ page }) => {
  await entrar(page);
  await page.goto("/eu");
  await page.getByRole("link", { name: "Posso comer?" }).click();
  await expect(page.getByRole("heading", { name: "Categorias" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Chás e ervas" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mais buscados" })).toBeVisible();
  await page.getByRole("searchbox", { name: "Buscar alimento, bebida ou chá" }).fill("acai");
  await expect(page.getByText(/\d+ resultados?/)).toBeVisible();
  await page.getByRole("link", { name: /^Açaí/ }).first().click();
  await expect(page.getByRole("heading", { name: "Açaí" })).toBeVisible();
});

test("no verbete vejo o semáforo, a condição, a fonte e o aviso fixo; rascunho vem marcado", async ({ page }) => {
  await entrar(page);
  await page.goto("/faq/verbete?slug=queijo-minas-frescal");
  await expect(page.getByText("Com cuidado", { exact: true })).toBeVisible();
  await expect(page.getByText("Com uma condição")).toBeVisible();
  await expect(page.getByText(/^Fonte: /)).toBeVisible();
  await expect(page.getByText("Informação geral. Em caso de dúvida, confirme com seu médico ou nutricionista.")).toBeVisible();
  await expect(page.getByText("Rascunho: aguarda revisão profissional")).toBeVisible();
  await page.goto("/faq/verbete?slug=peixe-cru");
  await expect(page.getByText("Evite", { exact: true })).toBeVisible();
});

test("busco algo que não existe, toco em 'Perguntar' e o texto vem preenchido; sem internet, perguntar pede conexão", async ({ page }) => {
  await entrar(page);
  await page.goto("/faq");
  await page.getByRole("searchbox").fill("xilofone voador");
  await expect(page.getByText("Não achei.")).toBeVisible();
  await page.getByRole("button", { name: "Perguntar" }).click();
  await expect(page).toHaveURL(/\/faq\/perguntar\?texto=xilofone/);
  await expect(page.getByLabel("Sua pergunta")).toHaveValue("xilofone voador");
  await page.getByRole("button", { name: "Enviar pergunta" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Perguntar precisa" })).toHaveText("Perguntar precisa de internet. A busca e os favoritos funcionam sem.");
});

test("uma pergunta ofensiva é bloqueada antes de sair do aparelho", async ({ page }) => {
  await entrar(page);
  await page.goto("/faq/perguntar");
  await page.getByLabel("Sua pergunta").fill("Posso comer essa PÔRRA de pequi?");
  await page.getByRole("button", { name: "Enviar pergunta" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "palavras" })).toHaveText("Essa pergunta tem palavras que a gente não aceita. Tenta reescrever?");
  await page.getByLabel("Sua pergunta").fill("oi");
  await page.getByRole("button", { name: "Enviar pergunta" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "caracteres" })).toHaveText("Escreva de 3 a 140 caracteres.");
});

test("favorito um verbete e o encontro sem internet; a busca também funciona offline", async ({ page, context }) => {
  await entrar(page);
  await page.goto("/faq");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.goto("/faq/verbete?slug=cafe");
  await page.getByRole("button", { name: "Favoritar" }).click();
  await expect(page.getByText("Nos seus favoritos ✓")).toBeVisible();
  await page.goto("/faq");
  await ficarSemRede(context);
  await page.reload();
  const favs = page.locator("section", { has: page.getByRole("heading", { name: "Meus favoritos" }) });
  await expect(favs.getByRole("link", { name: /^Café/ })).toBeVisible();
  await page.getByRole("searchbox").fill("kombuxa");
  await expect(page.getByRole("link", { name: /^Kombucha/ })).toBeVisible();
  await voltarARede(context);
});

test("navego por categoria", async ({ page }) => {
  await entrar(page);
  await page.goto("/faq");
  await page.getByRole("link", { name: "Peixes e frutos do mar" }).click();
  await expect(page.getByRole("heading", { name: "Peixes e frutos do mar" })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Peixe cru/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Açaí/ })).toHaveCount(0);
});
