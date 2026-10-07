import { expect, test, type Page } from "@playwright/test";

/**
 * Critérios de aceite da funcionalidade 17 · Modo fé, no build sem servidor (a semente de orações aparece
 * como rascunho). Publicação, favoritos por pessoa e contadores anônimos estão no pgTAP (supabase/tests/fe.test.sql).
 */
test.use({ timezoneId: "America/Sao_Paulo" });

function hojeISO(desloc = 0) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(Date.now() + desloc * 86_400_000));
}
const dppNaSemana = (semana: number) => hojeISO(280 - semana * 7 - 1);
const agora = () => new Date().toISOString();

async function entrar(page: Page, semana: number, perfil: Record<string, unknown> = {}) {
  await page.addInitScript(
    (d) => {
      // GA4 de mentira: guarda cada evento com a rota em que ele saiu (RN-10).
      const w = window as unknown as { __ga: { nome: string; rota: string; params: unknown }[]; gtag: unknown; __avisos: string[] };
      w.__ga = JSON.parse(sessionStorage.getItem("__ga") ?? "[]");
      w.gtag = (_c: string, nome: string, params: unknown) => {
        w.__ga.push({ nome, rota: location.pathname, params });
        sessionStorage.setItem("__ga", JSON.stringify(w.__ga));
      };
      w.__avisos = [];
      class Falsa {
        static permission = "granted";
        static requestPermission = async () => "granted";
        constructor(titulo: string) {
          w.__avisos.push(titulo);
        }
      }
      Object.defineProperty(window, "Notification", { value: Falsa, configurable: true });
      if (navigator.serviceWorker) navigator.serviceWorker.getRegistration = async () => undefined;
      if (sessionStorage.getItem("semeado")) return;
      sessionStorage.setItem("semeado", "1");
      for (const [k, v] of Object.entries(d)) localStorage.setItem(k, JSON.stringify(v));
    },
    {
      "ninho.sessao": { uid: "mae-local", anonima: true, remota: false },
      "ninho.perfil": { nome: "Helena", modo: "gestacao", dpp: dppNaSemana(semana), anonima: true, plano: "free", papel: "mae", onboardingConcluidoEm: agora(), tz: "America/Sao_Paulo", ...perfil },
    },
  );
}

const cardsDaHome = async (page: Page) => (await page.locator("[data-card]").allInnerTexts()).map((t) => t.split("\n")[0]!.trim());
const chaveFe = (page: Page) => page.getByRole("switch", { name: /^Modo fé/ });

test("ligo o modo em Eu e a home mostra a oração da semana atual na posição 3", async ({ page }) => {
  await entrar(page, 12);
  await page.goto("/hoje");
  await expect(page.locator("[data-card]").first()).toBeVisible();
  expect(await cardsDaHome(page)).not.toContain("Oração da semana");
  await page.goto("/eu");
  await chaveFe(page).click();
  await expect(chaveFe(page)).toHaveAttribute("aria-checked", "true");
  await page.goto("/hoje");
  const card = page.locator("[data-card]").filter({ hasText: "Oração da semana" });
  await expect(card).toContainText("Semana 12");
  // Posição 3 da home: o anel, um card, a oração.
  const ordem = await page.locator("[data-card], [role=img][aria-labelledby]").evaluateAll((els) => els.map((e) => (e.getAttribute("data-card") !== null ? (e as HTMLElement).innerText.split("\n")[0] : "anel")));
  expect(ordem.indexOf("Oração da semana")).toBe(2);
  await card.click();
  await expect(page).toHaveURL(/\/fe\/oracao\?semana=12$/);
  await expect(page.getByRole("heading", { level: 2 })).toContainText("Semana 12");
});

test("desligo e tudo some; ligo de novo e minhas favoritas estão lá", async ({ page }) => {
  await entrar(page, 20, { prefs: { faith_mode: true } });
  await page.goto("/fe");
  await page.getByRole("tab", { name: "Intercessores" }).click();
  await page.getByRole("link", { name: /São José/ }).click();
  await page.getByRole("button", { name: "Favoritar" }).click();
  await expect(page.getByText("Nas suas favoritas ✓")).toBeVisible();

  await page.goto("/eu");
  await chaveFe(page).click();
  await expect(page.getByRole("link", { name: "Biblioteca de fé" })).toHaveCount(0);
  await page.goto("/hoje");
  await expect(page.locator("[data-card]").first()).toBeVisible();
  expect(await cardsDaHome(page)).not.toContain("Oração da semana");
  await page.goto("/fe");
  await expect(page.getByText("O modo fé está desligado")).toBeVisible();

  await page.goto("/eu");
  await chaveFe(page).click();
  await page.getByRole("link", { name: "Biblioteca de fé" }).click();
  const favs = page.locator("section", { has: page.getByRole("heading", { name: "Minhas favoritas" }) });
  await expect(favs.getByRole("link", { name: /São José/ })).toBeVisible();
});

test("na biblioteca leio uma oração com a fonte grande e a favorito; a bênção traz o aviso", async ({ page }) => {
  await entrar(page, 20, { prefs: { faith_mode: true } });
  await page.goto("/fe");
  await page.getByRole("link", { name: /Ave-Maria/ }).click();
  const texto = page.locator("[data-texto-oracao]");
  await expect(texto).toHaveCSS("font-size", "18px");
  const mais = page.getByRole("button", { name: "Aumentar o texto" });
  while (await mais.isEnabled()) await mais.click();
  await expect(texto).toHaveCSS("font-size", "28px");
  await page.getByRole("button", { name: "Favoritar" }).click();
  await expect(page.getByRole("button", { name: "Tirar das favoritas" })).toBeVisible();
  await expect(page.getByText(/^Fonte: /)).toBeVisible();
  // A fonte escolhida vale para a próxima leitura.
  await page.goto("/fe?aba=blessing");
  await expect(page.getByRole("note")).toHaveText("Texto de oração. A bênção litúrgica é dada pelo sacerdote.");
  await page.getByRole("tabpanel").getByRole("link").first().click();
  await expect(page.getByRole("note")).toHaveText("Texto de oração. A bênção litúrgica é dada pelo sacerdote.");
  await expect(page.locator("[data-texto-oracao]")).toHaveCSS("font-size", "28px");
});

test("com o modo ligado, o diário oferece 'Primeira oração pelo bebê'; desligado, não", async ({ page }) => {
  await entrar(page, 10, { prefs: { faith_mode: true } });
  await page.goto("/diario/marcos");
  await expect(page.getByText("Primeira oração pelo bebê")).toBeVisible();
  await page.goto("/eu");
  await chaveFe(page).click();
  await page.goto("/diario/marcos");
  await expect(page.getByText("Quando descobri").first()).toBeVisible();
  await expect(page.getByText("Primeira oração pelo bebê")).toHaveCount(0);
});

test("registro o nascimento e a lista do batismo aparece; 14 dias depois chega o lembrete", async ({ page }) => {
  await page.clock.install({ time: new Date(`${hojeISO()}T09:00:00-03:00`) });
  await entrar(page, 39, { prefs: { faith_mode: true } });
  await page.goto("/registrar");
  await page.getByRole("button", { name: /Nasceu!/ }).click();
  await page.getByLabel("Nome do bebê").fill("Theo");
  await page.getByRole("button", { name: "Registrar nascimento" }).click();
  await expect(page).toHaveURL(/\/bebe\/bem-vindo$/);

  await page.goto("/eu");
  await page.getByRole("link", { name: "Batismo" }).click();
  for (const item of ["Conversar com a paróquia", "Escolher os padrinhos", "Definir a data", "Confirmar com a paróquia os documentos exigidos", "Roupa e vela de batismo", "Convidar a família"]) {
    await expect(page.getByText(item, { exact: true })).toBeVisible();
  }
  await page.getByRole("checkbox", { name: /Escolher os padrinhos/ }).click();
  await expect(page.getByRole("checkbox", { name: /Escolher os padrinhos/ })).toBeChecked();

  // 14 dias depois, às 10:00, o aparelho mostra o lembrete (sem servidor, o planejador roda no app).
  await page.clock.setSystemTime(new Date(`${hojeISO(14)}T10:05:00-03:00`));
  await page.goto("/hoje");
  await expect.poll(() => page.evaluate(() => (window as unknown as { __avisos: string[] }).__avisos)).toContain("Quando pensar no batismo?");
});

test("sem internet, leio as orações", async ({ page, context }) => {
  await entrar(page, 20, { prefs: { faith_mode: true } });
  await page.goto("/fe");
  await page.evaluate(() => navigator.serviceWorker?.ready.then(() => undefined));
  await page.goto("/fe/oracao?slug=ave-maria");
  await page.goto("/fe");
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("tab", { name: "Intercessores" }).click();
  await page.getByRole("link", { name: /Nossa Senhora do Bom Parto/ }).click();
  await expect(page.getByRole("heading", { name: /Nossa Senhora do Bom Parto/, level: 2 })).toBeVisible();
  await expect(page.locator("[data-texto-oracao] p").first()).not.toBeEmpty();
  await context.setOffline(false);
});

test("nenhum evento de analytics carrega dado do modo fé", async ({ page }) => {
  await entrar(page, 10, { prefs: { faith_mode: true } });
  await page.goto("/hoje");
  await page.locator("[data-card]").filter({ hasText: "Oração da semana" }).click();
  await expect(page).toHaveURL(/\/fe\/oracao/);
  await page.getByRole("button", { name: "Favoritar" }).click();
  await page.goto("/fe");
  await page.getByRole("searchbox").fill("parto");
  await page.goto("/diario/marcos");
  await page.getByText("Primeira oração pelo bebê").click();
  await page.goto("/eu");
  await chaveFe(page).click();
  await page.goto("/hoje");
  await expect(page.locator("[data-card]").first()).toBeVisible();

  const eventos = await page.evaluate(() => (window as unknown as { __ga: { nome: string; rota: string; params: unknown }[] }).__ga);
  expect(eventos.length).toBeGreaterThan(0);
  const tudo = JSON.stringify(eventos);
  expect(eventos.filter((e) => e.rota.startsWith("/fe"))).toEqual([]);
  for (const proibido of ["first_prayer", "oracao", "baptism", "faith"]) expect(tudo, proibido).not.toContain(proibido);
});
