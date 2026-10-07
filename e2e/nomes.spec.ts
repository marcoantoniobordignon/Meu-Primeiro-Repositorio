import { expect, test, type Page } from "@playwright/test";

import { ficarSemRede, voltarARede } from "./rede";

/**
 * Critérios de aceite da funcionalidade 15 · Lista de nomes, no build sem servidor. Match entre os dois, privacidade
 * dos votos e o push `name_match` dependem do banco: pgTAP (supabase/tests/nomes.test.sql).
 */
test.use({ timezoneId: "America/Sao_Paulo" });

function hojeISO(desloc = 0) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(Date.now() + desloc * 86_400_000));
}
const agora = () => new Date().toISOString();

async function entrar(page: Page, extra: Record<string, unknown> = {}) {
  await page.addInitScript(
    (d) => {
      const w = window as unknown as { __falado: string[] };
      w.__falado = [];
      class Fala {
        lang = "";
        constructor(public text: string) {}
      }
      Object.defineProperty(window, "SpeechSynthesisUtterance", { value: Fala, configurable: true });
      Object.defineProperty(window, "speechSynthesis", { value: { cancel() {}, speak: (u: Fala) => w.__falado.push(`${u.lang}:${u.text}`) }, configurable: true });
      if (sessionStorage.getItem("semeado")) return;
      sessionStorage.setItem("semeado", "1");
      for (const [k, v] of Object.entries(d)) localStorage.setItem(k, JSON.stringify(v));
    },
    {
      "ninho.sessao": { uid: "mae-local", anonima: true, remota: false },
      "ninho.perfil": { nome: "Helena", modo: "gestacao", dpp: hojeISO(140), anonima: true, plano: "free", papel: "mae", onboardingConcluidoEm: agora(), tz: "America/Sao_Paulo" },
      "ninho.membros": [{ id: "m-mae", profile_id: "mae-local", nome: "Helena", papel: "mae", ultimo_acesso_em: agora(), atualizado_em: agora() }],
      ...extra,
    },
  );
}

const carta = (page: Page) => page.locator("[data-carta-nome]");
const nomeDaCarta = async (page: Page) => (await carta(page).getAttribute("data-carta-nome"))!;

test("sem voto, vejo 'Comece a descobrir nomes' e o baralho já montado; deslizo 20 e curto 5, que aparecem em Curtidos", async ({ page }) => {
  await entrar(page);
  await page.goto("/eu");
  await page.getByRole("link", { name: "Nomes do bebê" }).click();
  await expect(page.getByRole("heading", { name: "Comece a descobrir nomes" })).toBeVisible();
  await expect(page.getByText("1 de 20")).toBeVisible();
  const curtidos: string[] = [];
  for (let i = 0; i < 20; i++) {
    const nome = await nomeDaCarta(page);
    if (i % 4 === 0) {
      curtidos.push(nome);
      if (i === 0) {
        // Gesto: arrastar para a direita curte.
        const box = (await carta(page).boundingBox())!;
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 160, box.y + box.height / 2, { steps: 8 });
        await page.mouse.up();
      } else await page.getByRole("button", { name: "Curtir", exact: true }).click();
    } else if (i === 1) {
      // Arrastar para a esquerda descarta.
      const box = (await carta(page).boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 - 160, box.y + box.height / 2, { steps: 8 });
      await page.mouse.up();
    } else await page.getByRole("button", { name: "Descartar", exact: true }).click();
    if (i < 19) await expect(carta(page)).not.toHaveAttribute("data-carta-nome", nome);
  }
  await expect(page.getByText("Você viu os 20 desta rodada.")).toBeVisible();
  await page.getByRole("link", { name: "Meus nomes" }).click();
  const painel = page.getByRole("tabpanel", { name: "Curtidos" });
  for (const n of curtidos) await expect(painel.getByRole("link", { name: n, exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Descartados" }).click();
  await expect(page).toHaveURL(/aba=descartados$/);
  await expect(page.getByRole("tabpanel", { name: "Descartados" }).getByRole("listitem")).toHaveCount(15);
  // Volto depois e os votos estão intactos.
  await page.reload();
  await expect(page.getByRole("tabpanel", { name: "Descartados" }).getByRole("listitem")).toHaveCount(15);
});

test("filtro por 'começa com M' e só vejo nomes com M", async ({ page }) => {
  await entrar(page);
  await page.goto("/nomes");
  await page.getByRole("button", { name: "Filtros" }).click();
  await page.getByLabel("Começa com").selectOption("M");
  await page.getByRole("button", { name: "Ver nomes" }).click();
  for (let i = 0; i < 6; i++) {
    const nome = await nomeDaCarta(page);
    expect(nome.normalize("NFD").replace(/[̀-ͯ]/g, "")[0]).toBe("M");
    await page.getByRole("button", { name: "Descartar", exact: true }).click();
    await expect(carta(page)).not.toHaveAttribute("data-carta-nome", nome);
  }
});

test("desfaço o último voto e ele volta ao baralho", async ({ page }) => {
  await entrar(page);
  await page.goto("/nomes");
  const primeiro = await nomeDaCarta(page);
  await page.getByRole("button", { name: "Curtir", exact: true }).click();
  await expect(carta(page)).not.toHaveAttribute("data-carta-nome", primeiro);
  await page.getByRole("button", { name: "Desfazer" }).click();
  await expect(carta(page)).toHaveAttribute("data-carta-nome", primeiro);
  await expect(page.getByText("1 de 20")).toBeVisible();
  await page.goto("/nomes/meus");
  await expect(page.getByText("Os nomes que você curtir aparecem aqui.")).toBeVisible();
});

test("digito 'Joaquim', ele entra nos curtidos; no detalhe ouço o nome com sobrenomes", async ({ page }) => {
  await entrar(page);
  await page.goto("/nomes/adicionar");
  await page.getByLabel("Nome").fill("R2-D2");
  await page.getByRole("button", { name: "Adicionar" }).click();
  await expect(page.getByText("Use só letras, espaço e hífen, até 40 caracteres.")).toBeVisible();
  await page.getByLabel("Nome").fill("joaquim");
  await page.getByRole("button", { name: "Adicionar" }).click();
  await expect(page).toHaveURL(/\/nomes\/meus\?aba=curtidos$/);
  await page.getByRole("tabpanel").getByRole("link", { name: "Joaquim", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Joaquim" })).toBeVisible();
  await expect(page.getByText("Significado em breve")).toBeVisible();
  await page.getByLabel("Sobrenome 1").fill("Souza");
  await page.getByLabel("Sobrenome 2").fill("da Lima");
  await expect(page.locator("[data-nome-completo]")).toHaveText("Joaquim Souza da Lima");
  await expect(page.getByText("Iniciais: J. S. L. · 8 sílabas")).toBeVisible();
  await page.getByRole("button", { name: "Ouvir" }).click();
  expect(await page.evaluate(() => (window as unknown as { __falado: string[] }).__falado)).toEqual(["pt-BR:Joaquim Souza da Lima"]);
});

test("ranking: ponho dois no top 10 e troco a ordem", async ({ page }) => {
  await entrar(page);
  await page.goto("/nomes/adicionar");
  for (const n of ["Joaquim", "Benedita"]) {
    await page.goto("/nomes/adicionar");
    await page.getByLabel("Nome").fill(n);
    await page.getByRole("button", { name: "Adicionar" }).click();
    await expect(page).toHaveURL(/aba=curtidos/);
  }
  await page.getByRole("button", { name: "Pôr no top 10: Benedita" }).click();
  await page.getByRole("button", { name: "Pôr no top 10: Joaquim" }).click();
  const top = page.getByRole("list", { name: "Seu top 10" });
  await expect(top.getByRole("listitem")).toHaveText([/1\.\s*Benedita/, /2\.\s*Joaquim/]);
  await page.getByRole("button", { name: "Subir Joaquim" }).click();
  await expect(top.getByRole("listitem")).toHaveText([/1\.\s*Joaquim/, /2\.\s*Benedita/]);
  await page.reload();
  await expect(page.getByRole("list", { name: "Seu top 10" }).getByRole("listitem")).toHaveText([/1\.\s*Joaquim/, /2\.\s*Benedita/]);
});

test("sem parceiro, confirmo 'Este é o nome!' num curtido: o diário abre o marco e a home mostra o nome", async ({ page }) => {
  await entrar(page);
  await page.goto("/nomes/adicionar");
  await page.getByLabel("Nome").fill("Joaquim");
  await page.getByRole("button", { name: "Adicionar" }).click();
  await page.getByRole("tabpanel").getByRole("link", { name: "Joaquim", exact: true }).click();
  await page.getByRole("button", { name: "Este é o nome!" }).click();
  await expect(page.getByRole("heading", { name: "Joaquim é o nome?" })).toBeVisible();
  await page.getByRole("button", { name: "Sim, é este" }).click();
  await expect(page).toHaveURL(/\/diario\/escrever\?marco=name_chosen$/);
  await expect(page.getByText("Escolhemos o nome").first()).toBeVisible();
  await page.goto("/hoje");
  await expect(page.getByText("Esperando Joaquim")).toBeVisible();
  await page.goto("/eu");
  await expect(page.getByText("Nome escolhido: Joaquim")).toBeVisible();
  await page.getByRole("button", { name: "Desfazer a escolha" }).click();
  await expect(page.getByText("Nome escolhido: Joaquim")).toHaveCount(0);
});

test("o match chega e quem curtiu por último vê 'Deu match!'; a aba Match lista o nome", async ({ page }) => {
  await entrar(page, {
    "ninho.membros": [
      { id: "m-mae", profile_id: "mae-local", nome: "Helena", papel: "mae", ultimo_acesso_em: agora(), atualizado_em: agora() },
      { id: "m-pai", profile_id: "pai-local", nome: "Rafa", papel: "parceiro", ultimo_acesso_em: agora(), atualizado_em: agora(), permissoes: { agenda: true, birth_plan: true, belly_photos: false } },
    ],
    "ninho.name_votes": [{ id: "v1", name_id: null, custom_name: "Joaquim", vote: "like", rank: null, criado_por: "mae-local", atualizado_em: agora() }],
    "ninho.name_matches": [{ id: "f:c:joaquim", chave: "c:joaquim", name_id: null, custom_name: "Joaquim", primeiro: "pai-local", segundo: "mae-local", criado_em: agora(), atualizado_em: agora() }],
  });
  await page.goto("/hoje");
  await expect(page.getByRole("heading", { name: "Deu match!" })).toBeVisible();
  await expect(page.getByText("Vocês dois curtiram Joaquim.")).toBeVisible();
  await page.getByRole("button", { name: "Ver os matches" }).click();
  await expect(page.getByRole("tabpanel", { name: "Match" }).getByRole("link", { name: /Joaquim/ })).toBeVisible();
  // Uma vez só.
  await page.goto("/hoje");
  await expect(page.locator("[data-card]").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Deu match!" })).toHaveCount(0);
});

test("sem internet, deslizo nomes e os votos ficam guardados", async ({ page, context }) => {
  await entrar(page);
  await page.goto("/nomes");
  await page.evaluate(() => navigator.serviceWorker?.ready.then(() => undefined));
  await page.goto("/nomes/meus");
  await page.goto("/nomes");
  await ficarSemRede(context);
  await page.reload();
  const nome = await nomeDaCarta(page);
  await page.getByRole("button", { name: "Curtir", exact: true }).click();
  await page.reload();
  await page.getByRole("link", { name: "Meus nomes" }).click();
  await expect(page.getByRole("tabpanel").getByRole("link", { name: nome, exact: true })).toBeVisible();
  await voltarARede(context);
});
