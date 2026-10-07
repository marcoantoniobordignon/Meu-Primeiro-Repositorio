import { expect, test, type Page } from "@playwright/test";

/**
 * Critérios de aceite da funcionalidade 12 · Modo parceiro, no build de produção sem servidor
 * (o convite vive no aparelho; com servidor, as mesmas telas usam as RPCs, testadas no pgTAP).
 */
test.use({ timezoneId: "America/Sao_Paulo" });

function hojeISO(desloc = 0) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(Date.now() + desloc * 86_400_000));
}
const dppNaSemana = (semana: number) => hojeISO(280 - semana * 7 - 1);
const agora = () => new Date().toISOString();

const mae = { id: "m-mae", profile_id: "mae-local", nome: "Helena", papel: "mae", ultimo_acesso_em: agora(), atualizado_em: agora() };
const pai = (permissoes: Record<string, boolean> = {}) => ({ id: "m-pai", profile_id: "pai-local", nome: "Rafa", papel: "parceiro", convidado_por: "mae-local", ultimo_acesso_em: agora(), atualizado_em: agora(), permissoes: { agenda: true, birth_plan: true, belly_photos: false, ...permissoes } });

async function semear(page: Page, uid: string, perfil: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  await page.addInitScript(
    (d) => {
      if (sessionStorage.getItem("semeado")) return;
      sessionStorage.setItem("semeado", "1");
      for (const [k, v] of Object.entries(d)) localStorage.setItem(k, JSON.stringify(v));
    },
    {
      "ninho.sessao": { uid, anonima: true, remota: false },
      "ninho.perfil": { nome: "Helena", modo: "gestacao", dpp: dppNaSemana(20), anonima: true, plano: "free", papel: "mae", onboardingConcluidoEm: agora(), tz: "America/Sao_Paulo", ...perfil },
      ...extra,
    },
  );
}

test("gero o convite (link e código), ele aceita e passa a ver a home do parceiro com semana, fruta e 'Como ajudar'", async ({ page }) => {
  await semear(page, "mae-local", {}, { "ninho.membros": [mae] });
  await page.goto("/eu");
  await page.getByRole("link", { name: "Parceiro" }).click();
  await page.getByRole("button", { name: "Convidar meu parceiro" }).click();
  await expect(page.getByText("Convite enviado, esperando aceitar")).toBeVisible();
  const link = (await page.getByTestId("link-convite").textContent())!.trim();
  const codigo = (await page.getByTestId("codigo-convite").textContent())!.trim();
  expect(link).toMatch(/\/convite\/[a-z0-9]{32}$/);
  expect(codigo).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  await expect(page.getByText(/Vale até/)).toBeVisible();

  // Gerar outro revoga o anterior (RN-01).
  await page.getByRole("button", { name: "Gerar outro convite" }).click();
  await expect(page.getByTestId("codigo-convite")).not.toHaveText(codigo);
  const linkNovo = (await page.getByTestId("link-convite").textContent())!.trim();
  await page.goto(new URL(link).pathname);
  await expect(page.getByText("Este convite foi cancelado. Peça um novo convite para ela.")).toBeVisible();

  await page.goto(new URL(linkNovo).pathname);
  await expect(page.getByRole("heading", { name: "Helena te convidou para acompanhar a gravidez" })).toBeVisible();
  await expect(page.getByText("Medicamentos, medidas das consultas e exames dela continuam só com ela.")).toBeVisible();
  await page.getByLabel("Seu nome").fill("Rafa");
  await page.getByRole("button", { name: "Aceitar e acompanhar" }).click();
  await expect(page).toHaveURL(/\/hoje$/);
  const home = page.getByTestId("home-parceiro");
  await expect(home.getByText("Semana 20")).toBeVisible();
  await expect(home.getByText(/O bebê está do tamanho de/)).toBeVisible();
  await expect(home.getByRole("heading", { name: "Como ajudar esta semana" })).toBeVisible();
  await expect(home.getByText("Ela ainda não adicionou compromissos.")).toBeVisible();
});

test("o código digitado à mão também leva ao convite; convite com mais de 7 dias mostra 'Convite expirado'", async ({ page }) => {
  const valido = { id: "c1", token: "a".repeat(32), code: "ABC234", papel: "parceiro", criado_por: "mae-local", expira_em: new Date(Date.now() + 86_400_000).toISOString(), atualizado_em: agora() };
  const vencido = { id: "c2", token: "b".repeat(32), code: "XYZ789", papel: "parceiro", criado_por: "mae-local", expira_em: new Date(Date.now() - 60_000).toISOString(), atualizado_em: agora() };
  await semear(page, "pai-local", { papel: "mae", nome: undefined }, { "ninho.membros": [mae], "ninho.convites": [valido, vencido] });
  await page.goto("/convite");
  await page.getByLabel("Código de 6 letras e números").fill("abc-234");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Helena te convidou para acompanhar a gravidez" })).toBeVisible();
  await page.goto(`/convite/${"b".repeat(32)}`);
  await expect(page.getByText("Convite expirado. Peça um novo convite para ela.")).toBeVisible();
});

test("ligo e desligo as permissões; ele nunca vê medicamentos e as fotos dependem da permissão", async ({ page }) => {
  await semear(page, "mae-local", {}, { "ninho.membros": [mae, pai()] });
  await page.goto("/eu/parceiro");
  const fotos = page.getByRole("switch", { name: /Fotos da barriga/ });
  await expect(fotos).toHaveAttribute("aria-checked", "false");
  await expect(page.getByRole("switch", { name: /Plano de parto e listas/ })).toHaveAttribute("aria-checked", "true");
  await fotos.click();
  await expect(fotos).toHaveAttribute("aria-checked", "true");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("ninho.membros")!).find((m: { papel: string }) => m.papel === "parceiro").permissoes)).toMatchObject({ belly_photos: true });

  // Do lado dele (mesmos dados, sessão dele): com a permissão, vê a barriga; medicamentos nunca.
  await page.evaluate(() => {
    localStorage.setItem("ninho.sessao", JSON.stringify({ uid: "pai-local", anonima: true, remota: false }));
    const p = JSON.parse(localStorage.getItem("ninho.perfil")!);
    localStorage.setItem("ninho.perfil", JSON.stringify({ ...p, papel: "parceiro", nome: "Rafa" }));
  });
  await page.goto("/eu");
  await expect(page.getByRole("link", { name: "Foto da barriga" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Medicamentos" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Exames", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Meus avisos" })).toBeVisible();

  // Ela desliga: na próxima abertura ele não vê mais.
  await page.evaluate(() => {
    const l = JSON.parse(localStorage.getItem("ninho.membros")!);
    l.find((m: { papel: string }) => m.papel === "parceiro").permissoes.belly_photos = false;
    localStorage.setItem("ninho.membros", JSON.stringify(l));
  });
  await page.reload();
  await expect(page.getByRole("link", { name: "Foto da barriga" })).toHaveCount(0);
});

test("ele adiciona uma pergunta à pauta e eu vejo com o nome dele", async ({ page }) => {
  await semear(page, "pai-local", { papel: "parceiro", nome: "Rafa" }, { "ninho.membros": [mae, pai()] });
  await page.goto("/consultas/pauta");
  await page.getByRole("textbox", { name: /Nova pergunta/ }).fill("Posso ir junto ao morfológico?");
  await page.getByRole("button", { name: "Anotar" }).click();
  await expect(page.getByText("Posso ir junto ao morfológico?")).toBeVisible();

  await page.evaluate(() => {
    localStorage.setItem("ninho.sessao", JSON.stringify({ uid: "mae-local", anonima: true, remota: false }));
    const p = JSON.parse(localStorage.getItem("ninho.perfil")!);
    localStorage.setItem("ninho.perfil", JSON.stringify({ ...p, papel: "mae", nome: "Helena" }));
  });
  await page.reload();
  const item = page.locator("li", { hasText: "Posso ir junto ao morfológico?" });
  await expect(item).toBeVisible();
  await expect(item.getByText(/Rafa/)).toBeVisible();
});

test("removo o parceiro: ele perde o acesso e o diário dele continua comigo, com o nome", async ({ page }) => {
  const entrada = { id: "e-pai", kind: "free", milestone_code: null, body: "Ouvi o coração hoje", entry_date: hojeISO(), audio_path: null, audio_seconds: null, shared_with_partner: false, photo_count: 0, criado_por: "pai-local", atualizado_em: agora() };
  await semear(page, "mae-local", {}, { "ninho.membros": [mae, pai()], "ninho.diary_entries": [entrada] });
  await page.goto("/eu/parceiro");
  await page.getByRole("button", { name: "Remover parceiro" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remover parceiro" }).click();
  await expect(page.getByText("Parceiro removido")).toBeVisible();
  await expect(page.getByRole("button", { name: "Convidar meu parceiro" })).toBeVisible();
  await page.goto("/diario");
  await expect(page.getByText("Ouvi o coração hoje")).toBeVisible();
  await expect(page.getByText(/Escrito por Rafa/)).toBeVisible();
});

test("ele sai da gestação: eu recebo o aviso na central, sem push", async ({ page }) => {
  await semear(page, "pai-local", { papel: "parceiro", nome: "Rafa" }, { "ninho.membros": [mae, pai()] });
  await page.goto("/eu");
  await page.getByRole("button", { name: "Sair da gestação" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Sair da gestação" }).click();
  await expect(page.getByText("Você saiu da gestação")).toBeVisible();

  await page.evaluate(() => {
    localStorage.setItem("ninho.sessao", JSON.stringify({ uid: "mae-local", anonima: true, remota: false }));
    const p = JSON.parse(localStorage.getItem("ninho.perfil")!);
    localStorage.setItem("ninho.perfil", JSON.stringify({ ...p, papel: "mae", nome: "Helena" }));
  });
  await page.goto("/eu");
  await page.getByRole("link", { name: /Avisos · 1 novo/ }).click();
  await expect(page.getByText("Rafa saiu da gestação")).toBeVisible();
  await page.goto("/eu");
  await expect(page.getByRole("link", { name: "Avisos", exact: true })).toBeVisible();
});

test("a home dele mostra os próximos compromissos e, depois de meses, a semana atual", async ({ page }) => {
  const consulta = { id: "c-1", starts_at: new Date(Date.now() + 3 * 86_400_000).toISOString(), kind: "prenatal", status: "scheduled", provider_name: "Dra. Ana", location: "Clínica Sol", notes: null, criado_por: "mae-local", atualizado_em: agora() };
  await semear(page, "pai-local", { papel: "parceiro", nome: "Rafa", dpp: dppNaSemana(32) }, { "ninho.membros": [mae, pai()], "ninho.appointments": [consulta] });
  await page.goto("/hoje");
  const home = page.getByTestId("home-parceiro");
  await expect(home.getByText("Semana 32")).toBeVisible();
  await expect(home.getByText("Consulta · Dra. Ana")).toBeVisible();
  await expect(home.getByRole("link", { name: "Pauta da consulta" })).toBeVisible();

  // Sem a permissão de agenda, nem compromissos nem pauta.
  await page.evaluate(() => {
    const l = JSON.parse(localStorage.getItem("ninho.membros")!);
    l.find((m: { papel: string }) => m.papel === "parceiro").permissoes.agenda = false;
    localStorage.setItem("ninho.membros", JSON.stringify(l));
  });
  await page.reload();
  await expect(home.getByText("Consulta · Dra. Ana")).toHaveCount(0);
  await expect(home.getByRole("link", { name: "Pauta da consulta" })).toHaveCount(0);
});
