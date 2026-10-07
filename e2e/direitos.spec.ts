import { expect, test, type Page } from "@playwright/test";

/**
 * Critérios de aceite da funcionalidade 16 · Direitos da gestante, no build sem servidor (a semente aparece como
 * rascunho). Selos de revisão e de atualização dependem de cartões publicados: Vitest (direitos.test.ts) e pgTAP.
 */
test.use({ timezoneId: "America/Sao_Paulo" });

function hojeISO(desloc = 0) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(Date.now() + desloc * 86_400_000));
}
const dppNaSemana = (semana: number) => hojeISO(280 - semana * 7 - 1);
const agora = () => new Date().toISOString();

async function entrar(page: Page, semana: number, o: { papel?: string; extra?: Record<string, unknown> } = {}) {
  const uid = o.papel === "parceiro" ? "pai-local" : "mae-local";
  await page.addInitScript(
    (d) => {
      const w = window as unknown as { __compartilhado: string[] };
      w.__compartilhado = [];
      Object.defineProperty(navigator, "share", { value: async (x: { text: string }) => void w.__compartilhado.push(x.text), configurable: true });
      if (sessionStorage.getItem("semeado")) return;
      sessionStorage.setItem("semeado", "1");
      for (const [k, v] of Object.entries(d)) localStorage.setItem(k, JSON.stringify(v));
    },
    {
      "ninho.sessao": { uid, anonima: true, remota: false },
      "ninho.perfil": { nome: o.papel === "parceiro" ? "Rafa" : "Helena", modo: "gestacao", dpp: dppNaSemana(semana), anonima: true, plano: "free", papel: o.papel ?? "mae", onboardingConcluidoEm: agora(), tz: "America/Sao_Paulo" },
      "ninho.membros": [
        { id: "m-mae", profile_id: "mae-local", nome: "Helena", papel: "mae", ultimo_acesso_em: agora(), atualizado_em: agora() },
        ...(o.papel === "parceiro" ? [{ id: "m-pai", profile_id: "pai-local", nome: "Rafa", papel: "parceiro", ultimo_acesso_em: agora(), atualizado_em: agora(), permissoes: { agenda: true, birth_plan: true, belly_photos: false } }] : []),
      ],
      ...o.extra,
    },
  );
}

test("busco 'demissão' e acho o cartão de estabilidade com a base legal; 'Se não respeitarem' leva à ajuda", async ({ page }) => {
  await entrar(page, 20);
  await page.goto("/eu");
  await page.getByRole("link", { name: "Seus direitos" }).click();
  await page.getByRole("searchbox", { name: "Buscar direito" }).fill("demissão");
  await page.getByRole("link", { name: /Posso ser demitida durante a gravidez\?/ }).click();
  await expect(page.getByRole("heading", { name: "Posso ser demitida durante a gravidez?" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Base legal" })).toBeVisible();
  await expect(page.getByRole("link", { name: /ADCT art\. 10/ })).toHaveAttribute("href", /planalto\.gov\.br/);
  await expect(page.getByRole("heading", { name: "Se não respeitarem" })).toBeVisible();
  await expect(page.getByRole("note")).toHaveText("Informação geral, não é orientação jurídica. Em caso de dúvida, procure a Defensoria Pública, o sindicato ou um advogado.");
  await expect(page.getByText("Rascunho: aguarda revisão jurídica")).toBeVisible();
  await page.getByRole("link", { name: "Onde buscar ajuda" }).click();
  await expect(page).toHaveURL(/\/direitos\/ajuda$/);
  // Toco em Ligue 180 e o discador abre (link tel:).
  await expect(page.getByRole("link", { name: /Ligar para Ligue 180/ })).toHaveAttribute("href", "tel:180");
  await expect(page.getByRole("link", { name: /Ligar para ANS/ })).toContainText("0800 701 9656");
});

test("filtro por tema", async ({ page }) => {
  await entrar(page, 20);
  await page.goto("/direitos");
  await page.getByRole("radio", { name: "Benefícios" }).click();
  await expect(page.getByText("1 direito")).toBeVisible();
  await expect(page.getByRole("link", { name: /salário-maternidade/ })).toBeVisible();
});

test("na semana 28 a home sugere o cartão do acompanhante; dispensado, sai", async ({ page }) => {
  await entrar(page, 28);
  await page.goto("/hoje");
  const card = page.locator("[data-card]").filter({ hasText: "Para esta fase" });
  await expect(card.getByRole("link", { name: "Posso ter acompanhante no parto?" })).toBeVisible();
  await card.getByRole("button", { name: "Dispensar: Posso ter acompanhante no parto?" }).click();
  await expect(page.getByRole("link", { name: "Posso ter acompanhante no parto?" })).toHaveCount(0);
});

test("compartilho um cartão e o texto sai com a lei citada", async ({ page }) => {
  await entrar(page, 30);
  await page.goto("/direitos/cartao?slug=acompanhante-no-parto");
  await page.getByRole("button", { name: "Compartilhar" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __compartilhado: string[] }).__compartilhado[0] ?? "")).toMatch(/^Posso ter acompanhante no parto\? .+ Base legal: .*Lei 11\.108\/2005.*\. Via Ninho\.$/);
});

test("sem favoritos, a aba mostra o convite e atalhos; favorito e ele aparece", async ({ page }) => {
  await entrar(page, 20);
  await page.goto("/direitos");
  await page.getByRole("tab", { name: "Favoritos" }).click();
  await expect(page.getByText("Salve aqui os direitos que mais importam.")).toBeVisible();
  await page.getByRole("tabpanel").getByRole("link", { name: /Posso ser demitida/ }).click();
  await page.getByRole("button", { name: "Favoritar" }).click();
  await expect(page.getByText("Nos seus favoritos ✓")).toBeVisible();
  await page.goto("/direitos?aba=favoritos");
  await expect(page.getByRole("tabpanel").getByRole("link", { name: /Posso ser demitida/ })).toBeVisible();
  await expect(page.getByText("Salve aqui os direitos que mais importam.")).toHaveCount(0);
});

test("sem internet, leio todos os cartões e os canais", async ({ page, context }) => {
  await entrar(page, 20);
  await page.goto("/direitos");
  await page.evaluate(() => navigator.serviceWorker?.ready.then(() => undefined));
  await page.goto("/direitos/cartao?slug=testes-do-bebe");
  await page.goto("/direitos/ajuda");
  await page.goto("/direitos");
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("list", { name: "Seus direitos" }).getByRole("link")).toHaveCount(17);
  await page.getByRole("link", { name: /O registro de nascimento é gratuito\?/ }).click();
  await expect(page.getByRole("heading", { name: "O registro de nascimento é gratuito?" })).toBeVisible();
  await context.setOffline(false);
});

test("o parceiro vê o cartão da licença-paternidade, mas não os cartões só da gestante", async ({ page }) => {
  await entrar(page, 30, { papel: "parceiro" });
  await page.goto("/direitos");
  const lista = page.getByRole("list", { name: "Seus direitos" });
  await expect(lista.getByRole("link", { name: /E a licença do pai ou parceiro\?/ })).toBeVisible();
  await expect(lista.getByRole("link", { name: /Posso ter acompanhante no parto\?/ })).toBeVisible();
  await expect(lista.getByRole("link", { name: /Posso ser demitida/ })).toHaveCount(0);
  await page.goto("/direitos/cartao?slug=estabilidade-gestante");
  await expect(page.getByText("Esse direito não está disponível agora.")).toBeVisible();
});

test("o plano de parto leva direto aos cartões do acompanhante e da maternidade", async ({ page }) => {
  await entrar(page, 30);
  await page.goto("/plano-parto/quem");
  await page.getByRole("link", { name: "Ver o cartão deste direito" }).click();
  await expect(page.getByRole("heading", { name: "Posso ter acompanhante no parto?" })).toBeVisible();
  await page.goto("/plano-parto/onde");
  await page.getByRole("link", { name: "Ver o cartão deste direito" }).click();
  await expect(page.getByRole("heading", { name: /maternidade/ })).toBeVisible();
});
