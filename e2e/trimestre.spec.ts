import { expect, test, type Page } from "@playwright/test";

/**
 * Critérios de aceite da funcionalidade 11 · Adaptação por trimestre, no build sem servidor (a semente de
 * artigos aparece como rascunho). Publicação e privacidade das leituras estão no pgTAP (supabase/tests/trimestre.test.sql).
 */
test.use({ timezoneId: "America/Sao_Paulo" });

function hojeISO(desloc = 0) {
  const d = new Date(Date.now() + desloc * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
}
/** DPP que deixa hoje no início da semana `semana` (dia 1, longe da meia-noite da virada). */
const dppNaSemana = (semana: number) => hojeISO(280 - semana * 7 - 1);
const agora = () => new Date().toISOString();

async function entrar(page: Page, semana: number, o: { criadaHaSemanas?: number; perfil?: Record<string, unknown>; extra?: Record<string, unknown> } = {}) {
  const criada = new Date(Date.now() - (o.criadaHaSemanas ?? 0) * 7 * 86_400_000).toISOString();
  await page.addInitScript(
    (d) => {
      if (sessionStorage.getItem("semeado")) return;
      sessionStorage.setItem("semeado", "1");
      for (const [k, v] of Object.entries(d)) localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
    },
    {
      "ninho.sessao": { uid: "mae-local", anonima: true, remota: false },
      "ninho.perfil": { nome: "Helena", modo: "gestacao", dpp: dppNaSemana(semana), anonima: true, plano: "free", papel: "mae", onboardingConcluidoEm: criada, tz: "America/Sao_Paulo", ...o.perfil },
      ...o.extra,
    },
  );
}

/** Títulos dos cards da home (fora o anel e a consulta), na ordem da tela. */
async function cardsDaHome(page: Page): Promise<string[]> {
  const cards = page.locator("[data-card]");
  await expect(cards.first()).toBeVisible();
  return (await cards.allInnerTexts()).map((t) => t.split("\n")[0]!.trim());
}

test("semana 10: exames a marcar e medicamentos antes; plano de parto e mala nem aparecem", async ({ page }) => {
  await entrar(page, 10);
  await page.goto("/hoje");
  await expect(page.getByRole("img", { name: "10 semanas" })).toBeVisible();
  const cards = await cardsDaHome(page);
  expect(cards.indexOf("Exames a marcar")).toBeGreaterThanOrEqual(0);
  expect(cards.indexOf("Exames a marcar")).toBeLessThan(cards.indexOf("Medicamentos de hoje"));
  expect(cards).not.toContain("Plano de parto");
  expect(cards).not.toContain("Mala e enxoval");
  await expect(page.locator("html")).toHaveAttribute("data-trimestre", "1");
});

test("semana 30: plano de parto e mala no topo; o card leva ao plano", async ({ page }) => {
  await entrar(page, 30, { criadaHaSemanas: 1 });
  await page.goto("/hoje");
  const cards = await cardsDaHome(page);
  expect(cards.slice(0, 2)).toEqual(["Plano de parto", "Mala e enxoval"]);
  await expect(page.locator("html")).toHaveAttribute("data-trimestre", "3");
  await page.locator("[data-card]").first().click();
  await expect(page).toHaveURL(/\/plano-parto$/);
});

test("foto da semana já tirada: o card desce para o fim e mostra o check", async ({ page }) => {
  const foto = { id: "f20", gest_week: 20, taken_on: hojeISO(), storage_path: "barriga/f20.jpg", width: 1200, height: 1600, caption: null, atualizado_em: agora() };
  await entrar(page, 20, { extra: { "ninho.belly_photos": [foto] } });
  await page.goto("/hoje");
  const ultimo = page.locator("[data-card]").last();
  await expect(ultimo).toContainText("Foto da semana 20 guardada");
  await expect(ultimo).toContainText("Feito");
});

test("conta nova sem dados: anel, artigo da semana e estados vazios, sem buracos", async ({ page }) => {
  await entrar(page, 6);
  await page.goto("/hoje");
  await expect(page.getByRole("img", { name: "6 semanas" })).toBeVisible();
  const cards = await cardsDaHome(page);
  expect(cards).toHaveLength(5);
  await expect(page.locator("[data-card]").filter({ hasText: "Artigo da semana" })).toBeVisible();
  await expect(page.getByText("Cadastre um lembrete de remédio ou vitamina")).toBeVisible();
  for (const t of cards) expect(t.length).toBeGreaterThan(0);
});

test("'Para esta semana' mostra 3 artigos e o que li sai da lista; a biblioteca marca 'Lido'", async ({ page }) => {
  await entrar(page, 10);
  await page.goto("/artigos");
  const secao = page.locator("section", { has: page.getByRole("heading", { name: "Para esta semana" }) });
  await expect(secao.getByRole("link")).toHaveCount(3);
  const primeiro = (await secao.getByRole("link").first().innerText()).split("\n")[1]!;
  expect(primeiro).toBe("Semana 10: os órgãos estão no lugar");
  await secao.getByRole("link").first().click();
  await expect(page.getByRole("heading", { name: primeiro, level: 2 })).toBeVisible();
  await expect(page.getByText("Rascunho: aguarda revisão profissional")).toBeVisible();
  await expect(page.getByText("Este texto ainda não passou pela revisão de um profissional de saúde.")).toBeVisible();
  // RN-04: rolar até 80% marca como lido.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => page.evaluate(() => (JSON.parse(localStorage.getItem("ninho.article_reads") ?? "[]") as { read_at: string | null }[]).some((l) => l.read_at))).toBe(true);
  await page.goto("/artigos");
  await expect(secao.getByRole("link")).toHaveCount(3);
  await expect(secao.getByRole("link", { name: new RegExp(primeiro) })).toHaveCount(0);
  const aba = page.getByRole("tabpanel");
  await expect(page.getByRole("tab", { name: "1º trimestre" })).toHaveAttribute("aria-selected", "true");
  await expect(aba.getByRole("link", { name: new RegExp(primeiro) })).toContainText("Lido");
  // RN-05: trimestres futuros abertos; busca simples.
  await page.getByRole("tab", { name: "3º trimestre" }).click();
  await expect(aba.getByRole("link", { name: /Mala da maternidade/ })).toBeVisible();
  await page.getByRole("searchbox", { name: "Buscar artigo" }).fill("acido folico");
  await expect(page.getByRole("link", { name: /Ácido fólico e outros suplementos/ })).toBeVisible();
});

test("ficar 20 s num artigo também conta como lido", async ({ page }) => {
  await page.clock.install();
  await entrar(page, 22);
  await page.goto("/artigos/ler?slug=semana-22&de=biblioteca");
  await expect(page.getByRole("heading", { name: /^Semana 22/, level: 2 })).toBeVisible();
  const lido = () => page.evaluate(() => (JSON.parse(localStorage.getItem("ninho.article_reads") ?? "[]") as { read_at: string | null }[]).some((l) => l.read_at));
  await page.clock.runFor(15_000);
  expect(await lido()).toBe(false);
  await page.clock.runFor(6_000);
  await expect.poll(lido).toBe(true);
});

test("na virada para o 2º trimestre a celebração aparece uma única vez", async ({ page }) => {
  await entrar(page, 14, { criadaHaSemanas: 6 });
  await page.goto("/hoje");
  await expect(page).toHaveURL(/\/virada\?t=2$/);
  await expect(page.getByRole("heading", { name: "Bem-vinda ao 2º trimestre!" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Números do trimestre" })).toContainText("fotos da barriga");
  await expect(page.getByRole("heading", { name: "O que esperar" })).toBeVisible();
  await page.getByRole("button", { name: "Ir para a home" }).click();
  await expect(page).toHaveURL(/\/hoje$/);
  await page.reload();
  await expect(page.getByRole("img", { name: "14 semanas" })).toBeVisible();
  await expect(page).toHaveURL(/\/hoje$/);
  const perfil = await page.evaluate(() => JSON.parse(localStorage.getItem("ninho.perfil")!) as { t2VistoEm?: string });
  expect(perfil.t2VistoEm).toBeTruthy();
});

test("volto depois de 6 semanas: home no trimestre certo e a virada perdida aparece uma vez", async ({ page }) => {
  // Estava na semana 24 (2º, já celebrado); volta na 30.
  await entrar(page, 30, { criadaHaSemanas: 20, perfil: { t2VistoEm: agora() } });
  await page.goto("/hoje");
  await expect(page).toHaveURL(/\/virada\?t=3$/);
  await expect(page.getByRole("heading", { name: "Bem-vinda ao 3º trimestre!" })).toBeVisible();
  await page.getByRole("button", { name: "Ver todos os artigos" }).click();
  await expect(page.getByRole("tab", { name: "3º trimestre" })).toHaveAttribute("aria-selected", "true");
  await page.goto("/hoje");
  await expect(page).toHaveURL(/\/hoje$/);
  expect((await cardsDaHome(page))[0]).toBe("Plano de parto");
});

test("quem entra no app já no 2º trimestre não vê a celebração dele", async ({ page }) => {
  await entrar(page, 20);
  await page.goto("/hoje");
  await expect(page.getByRole("img", { name: "20 semanas" })).toBeVisible();
  await expect(page).toHaveURL(/\/hoje$/);
});

test("sem internet, leio artigos já abertos e os favoritos", async ({ page, context }) => {
  await entrar(page, 10);
  await page.goto("/artigos");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.goto("/artigos/ler?slug=enjoo-no-primeiro-trimestre&de=biblioteca");
  await page.getByRole("button", { name: "Favoritar" }).click();
  await expect(page.getByText("Nos seus favoritos ✓")).toBeVisible();
  await page.goto("/artigos");
  await context.setOffline(true);
  await page.reload();
  const favs = page.locator("section", { has: page.getByRole("heading", { name: "Meus favoritos" }) });
  await favs.getByRole("link", { name: /Enjoo no primeiro trimestre/ }).click();
  await expect(page.getByRole("heading", { name: /Enjoo no primeiro trimestre/, level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "O que costuma ajudar", level: 3 })).toBeVisible();
  await context.setOffline(false);
});

for (const [semana, tri] of [[10, "1"], [20, "2"], [30, "3"]] as const) {
  test(`modo escuro, ${tri}º trimestre: anel e texto legíveis, com a troca em 400 ms`, async ({ page }) => {
    await entrar(page, semana, { extra: { "ninho.tema": "escuro" } });
    await page.goto("/hoje");
    await expect(page.locator("html")).toHaveAttribute("data-trimestre", tri);
    await expect(page.locator("html")).toHaveAttribute("data-tema", "escuro");
    const r = await page.evaluate(() => {
      const css = getComputedStyle(document.documentElement);
      const stop = document.querySelector("linearGradient stop") as SVGStopElement;
      return { inicio: css.getPropertyValue("--anel-inicio").trim(), fim: css.getPropertyValue("--anel-fim").trim(), fundo: css.getPropertyValue("--fundo").trim(), texto: css.getPropertyValue("--texto").trim(), transicao: getComputedStyle(stop).transitionDuration };
    });
    expect(r.fundo).toBe("#171513");
    expect(r.transicao).toBe("0.4s");
    for (const cor of [r.inicio, r.fim]) expect(contraste(cor, r.fundo), `${cor} × fundo`).toBeGreaterThanOrEqual(3);
    expect(contraste(r.texto, r.fundo)).toBeGreaterThanOrEqual(4.5);
  });
}

function contraste(a: string, b: string): number {
  const l = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [x, y] = [l(a), l(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}
