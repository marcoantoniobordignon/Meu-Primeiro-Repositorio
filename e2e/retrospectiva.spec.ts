import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

import { ficarSemRede, voltarARede } from "./rede";

/**
 * Critérios de aceite da funcionalidade 07 · Retrospectiva, no build sem servidor. As regras do domínio (slides,
 * frases, ocultos, push) estão no Vitest (src/lib/dominio/retrospectiva.test.ts); a RLS (só a gestante), no pgTAP.
 */
test.use({ timezoneId: "America/Sao_Paulo" });

function hojeISO(desloc = 0) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(Date.now() + desloc * 86_400_000));
}
const agora = () => new Date().toISOString();

const entrada = (id: string, o: Record<string, unknown>) => ({ id, kind: "free", milestone_code: null, body: null, entry_date: hojeISO(-100), audio_path: null, audio_seconds: null, shared_with_partner: false, photo_count: 0, criado_por: "mae-local", atualizado_em: agora(), ...o });
const fotos = [14, 20, 30].map((w, i) => ({ id: `f${i}`, gest_week: w, taken_on: hojeISO(-100 + i), storage_path: `fam/belly/${i}.jpg`, width: 900, height: 1200, caption: null, criado_por: "mae-local", atualizado_em: agora() }));

/** Semana 36 em ponto (DPP daqui a 28 dias), gestação criada agora. */
async function entrar(page: Page, o: { perfil?: Record<string, unknown>; extra?: Record<string, unknown> } = {}) {
  await page.addInitScript(
    (d) => {
      if (sessionStorage.getItem("semeado")) return;
      sessionStorage.setItem("semeado", "1");
      for (const [k, v] of Object.entries(d)) localStorage.setItem(k, JSON.stringify(v));
    },
    {
      "ninho.sessao": { uid: "mae-local", anonima: true, remota: false },
      "ninho.perfil": { nome: "Helena", modo: "gestacao", dpp: hojeISO(28), anonima: true, plano: "free", papel: "mae", onboardingConcluidoEm: agora(), tz: "America/Sao_Paulo", ...o.perfil },
      "ninho.membros": [{ id: "m-mae", profile_id: "mae-local", nome: "Helena", papel: "mae", ultimo_acesso_em: agora(), atualizado_em: agora() }],
      ...o.extra,
    },
  );
}

const player = (page: Page) => page.getByRole("dialog", { name: "Retrospectiva em stories" });
/** O total de slides, pelo texto que o leitor de tela lê. */
async function totalDeSlides(page: Page): Promise<number> {
  const texto = await player(page).locator("[aria-live]").textContent();
  return Number(/Slide \d+ de (\d+)/.exec(texto ?? "")?.[1]);
}

test("na semana 36 vejo o card da prévia e abro a história; quase sem dados há capa, duração, números e encerramento", async ({ page }) => {
  await entrar(page);
  await page.goto("/hoje");
  await page.getByRole("link", { name: /Sua história até aqui/ }).click();
  await expect(player(page)).toBeVisible();
  await expect(player(page).locator("[aria-live]")).toContainText("Slide 1 de 4. A história de vocês");
  await page.keyboard.press("ArrowRight");
  await expect(player(page).locator("[aria-live]")).toContainText("Slide 2 de 4. 36 semanas certinhas");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(player(page).locator("[aria-live]")).toContainText("Slide 4 de 4. Até logo,");
  await page.getByRole("button", { name: "Fechar" }).click();
  await expect(page).toHaveURL(/\/memorias$/);
});

test("uma semana antes da 36 não há card nem retrospectiva", async ({ page }) => {
  await entrar(page, { perfil: { dpp: hojeISO(35) } });
  await page.goto("/hoje");
  await expect(page.getByText("Helena")).toBeVisible();
  await expect(page.getByRole("link", { name: /Sua história até aqui/ })).toHaveCount(0);
  await page.goto("/memorias");
  await expect(page.getByText("A retrospectiva aparece a partir da semana 36.")).toBeVisible();
});

test("registro o nascimento só com nome e data; a final abre com os slides possíveis e a ponte", async ({ page }) => {
  await entrar(page, { perfil: { dpp: hojeISO(3) } });
  await page.goto("/bebe");
  await page.getByRole("button", { name: "Registrar nascimento" }).first().click();
  const sheet = page.getByRole("dialog", { name: "Nasceu!" });
  // RN-02/10: peso fora da faixa avisa; vazio, não é obrigatório.
  await sheet.getByLabel("Peso (g, opcional)").fill("300");
  await sheet.getByLabel("Nome do bebê").fill("Theo");
  await sheet.getByRole("button", { name: "Registrar nascimento" }).click();
  await expect(sheet.getByText("Peso entre 500 e 7.000 g.")).toBeVisible();
  await sheet.getByLabel("Peso (g, opcional)").fill("");
  await sheet.getByRole("button", { name: "Registrar nascimento" }).click();
  await expect(page).toHaveURL(/\/bebe\/bem-vindo/);

  await page.goto("/hoje");
  await page.getByRole("link", { name: /Sua retrospectiva está pronta/ }).click();
  await expect(player(page).locator("[aria-live]")).toContainText("A história de Theo");
  const n = await totalDeSlides(page);
  expect(n).toBe(5);
  for (let i = 1; i < n; i++) await page.keyboard.press("ArrowRight");
  await expect(player(page).locator("[aria-live]")).toContainText("Começar o diário de Theo");
  await player(page).getByRole("link", { name: "Abrir a home do bebê" }).click();
  await expect(page).toHaveURL(/\/hoje$/);

  // Volto depois: as duas ficam em Memórias.
  await page.goto("/memorias");
  await expect(page.getByRole("link", { name: /Retrospectiva final/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Sua história até aqui/ })).toBeVisible();
});

test("oculto um slide e ele sai do player; troco a frase do diário por outra entrada", async ({ page }) => {
  await entrar(page, {
    extra: {
      "ninho.belly_photos": fotos,
      "ninho.diary_entries": [entrada("e1", { kind: "milestone", milestone_code: "discovery", body: "Duas listras. Depois liguei para ele." }), entrada("e2", { body: "Hoje dobrei as roupinhas." })],
    },
  });
  await page.goto("/memorias/retrospectiva?kind=preview");
  expect(await totalDeSlides(page)).toBe(6);

  await page.getByRole("link", { name: "Editar" }).click();
  await expect(page.getByRole("heading", { name: "Editar a retrospectiva" })).toBeVisible();
  // RN-05: os essenciais não têm interruptor.
  await expect(page.getByRole("switch", { name: /Capa/ })).toHaveCount(0);
  await page.getByRole("switch", { name: /Fotos da barriga/ }).click();
  await expect(page.getByRole("switch", { name: /Fotos da barriga/ })).toHaveAttribute("aria-checked", "false");

  // RN-04: a frase padrão é a primeira frase do marco; troco por outra entrada.
  await expect(page.getByText("“Duas listras.”")).toBeVisible();
  await page.getByRole("button", { name: "Trocar frase: Quando descobri" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Hoje dobrei as roupinhas/ }).click();
  await expect(page.getByText("“Hoje dobrei as roupinhas.”")).toBeVisible();

  await page.goto("/memorias/retrospectiva?kind=preview");
  expect(await totalDeSlides(page)).toBe(5);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(player(page).locator("[aria-live]")).toContainText("Quando descobri: Hoje dobrei as roupinhas.");
});

test("exporto as imagens: sem Web Share, baixa um ZIP de PNGs; no free há marca d'água", async ({ page }) => {
  await entrar(page);
  await page.goto("/memorias/retrospectiva/exportar?kind=preview");
  await expect(page.getByText("No grátis, sai com a marca Ninho.")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar" }).nth(1).click();
  const arquivo = await download;
  expect(arquivo.suggestedFilename()).toBe("retrospectiva-ninho.zip");
  const zip = readFileSync((await arquivo.path())!);
  expect(zip.subarray(0, 4).toString("hex")).toBe("504b0304");
  expect(zip.toString("latin1")).toContain("retrospectiva-ninho-04.png");
  await expect(page.getByText("Pronto ✓")).toBeVisible();
});

test("sem internet, assisto à retrospectiva; exportar pede conexão", async ({ page, context }) => {
  await entrar(page, { extra: { "ninho.belly_photos": fotos } });
  await page.goto("/memorias/retrospectiva?kind=preview");
  await page.evaluate(() => navigator.serviceWorker?.ready.then(() => undefined));
  await page.goto("/memorias/retrospectiva/exportar?kind=preview");
  await page.goto("/memorias/retrospectiva?kind=preview");
  await ficarSemRede(context);
  await page.reload();
  await expect(player(page).locator("[aria-live]")).toContainText("Slide 1 de 5");
  await page.goto("/memorias/retrospectiva/exportar?kind=preview");
  await page.getByRole("button", { name: "Exportar" }).nth(1).click();
  await expect(page.getByRole("alert").filter({ hasText: "Conecte-se" })).toHaveText("Conecte-se para baixar as fotos.");
  await voltarARede(context);
});

test("o parceiro não vê a retrospectiva", async ({ page }) => {
  await entrar(page, {
    perfil: { papel: "parceiro" },
    extra: { "ninho.membros": [{ id: "m-p", profile_id: "mae-local", nome: "Rafa", papel: "parceiro", ultimo_acesso_em: agora(), atualizado_em: agora() }] },
  });
  await page.goto("/memorias/retrospectiva?kind=preview");
  await expect(page.getByText("A retrospectiva é de quem gestou. Ela pode compartilhar o vídeo com você.")).toBeVisible();
  await expect(player(page)).toHaveCount(0);
});
