import { expect, test, type Page } from "@playwright/test";

/** Critérios de aceite da funcionalidade 08 · Calendário, no build de produção sem servidor. */
test.use({ timezoneId: "America/Sao_Paulo" });

function hojeISO(desloc = 0) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(Date.now() + desloc * 86_400_000));
}
const dppNaSemana = (semana: number) => hojeISO(280 - semana * 7 - 1);
const agora = () => new Date().toISOString();
const mae = { id: "m-mae", profile_id: "mae-local", nome: "Helena", papel: "mae", ultimo_acesso_em: agora(), atualizado_em: agora() };

async function entrar(page: Page, extra: Record<string, unknown> = {}, perfil: Record<string, unknown> = {}, uid = "mae-local") {
  await page.addInitScript(
    (d) => {
      // Notificações capturadas (sem service worker): o aviso local do evento (RN-06).
      (window as unknown as { __avisos: string[] }).__avisos = [];
      class Falsa {
        static permission = "granted";
        static requestPermission = async () => "granted";
        constructor(titulo: string) {
          (window as unknown as { __avisos: string[] }).__avisos.push(titulo);
        }
      }
      Object.defineProperty(window, "Notification", { value: Falsa, configurable: true });
      if (navigator.serviceWorker) navigator.serviceWorker.getRegistration = async () => undefined;
      if (sessionStorage.getItem("semeado")) return;
      sessionStorage.setItem("semeado", "1");
      for (const [k, v] of Object.entries(d)) localStorage.setItem(k, JSON.stringify(v));
    },
    {
      "ninho.sessao": { uid, anonima: true, remota: false },
      "ninho.perfil": { nome: "Helena", modo: "gestacao", dpp: dppNaSemana(22), anonima: true, plano: "free", papel: "mae", onboardingConcluidoEm: agora(), tz: "America/Sao_Paulo", ...perfil },
      "ninho.membros": [mae],
      ...extra,
    },
  );
}

const consulta = (dia: string) => ({ id: "c-1", starts_at: new Date(`${dia}T10:00:00-03:00`).toISOString(), kind: "prenatal", status: "scheduled", provider_name: "Dra. Ana", location: "Clínica Sol", criado_por: "mae-local", atualizado_em: agora() });
const exame = (dia: string) => ({ id: "e-1", catalog_code: "morpho", custom_name: null, status: "scheduled", window_start_date: null, window_end_date: null, past_window: false, window_start_week: null, window_end_week: null, scheduled_at: new Date(`${dia}T09:00:00-03:00`).toISOString(), scheduled_all_day: false, location: null, notes: null, done_on: null, document_id: null, atualizado_em: agora() });

test("no mês, ponto colorido nos dias com consulta e exame; tocar na consulta abre a tela dela", async ({ page }) => {
  const dia = hojeISO(2).slice(0, 7) === hojeISO().slice(0, 7) ? hojeISO(2) : hojeISO();
  await entrar(page, { "ninho.appointments": [consulta(dia)], "ninho.user_exams": [exame(dia)] });
  await page.goto("/calendario");
  const celula = page.getByRole("gridcell", { name: new RegExp("Ultrassom morfológico, Dra. Ana") });
  await expect(celula).toBeVisible();
  await expect(celula.locator("span.rounded-full")).toHaveCount(2);
  await celula.click();
  await expect(page).toHaveURL(new RegExp(`/calendario/dia\\?d=${dia}$`));
  await page.getByRole("button", { name: "Abrir Dra. Ana" }).click();
  await expect(page).toHaveURL(/\/consultas\/c-1$/);
});

test("marcador de virada de semana nos dias certos; agenda com 'Hoje, 22s…'", async ({ page }) => {
  await entrar(page);
  await page.goto("/calendario");
  // A DPP deixa hoje no dia 1 da semana 22: ontem foi a virada para a 22, e daqui a 6 dias, para a 23.
  const ontem = hojeISO(-1);
  const virada23 = hojeISO(6);
  const noMes = (d: string) => d.slice(0, 7) === hojeISO().slice(0, 7);
  if (noMes(ontem)) await expect(page.locator(`a[href="/calendario/dia?d=${ontem}"]`)).toHaveAttribute("aria-label", /começa a semana 22/);
  if (noMes(virada23)) await expect(page.locator(`a[href="/calendario/dia?d=${virada23}"]`)).toHaveAttribute("aria-label", /começa a semana 23/);
  await expect(page.locator(`a[href="/calendario/dia?d=${hojeISO()}"]`)).not.toHaveAttribute("aria-label", /começa a semana/);
  await page.getByRole("radio", { name: "Agenda" }).click();
  await expect(page.getByRole("heading", { name: "Hoje, 22s1d" })).toBeVisible();
});

test("sem nada marcado: o mês mostra a DPP e o convite para anotar a consulta", async ({ page }) => {
  await entrar(page, {}, { dpp: hojeISO(3) });
  await page.goto("/calendario");
  await expect(page.getByText("Nada marcado. Que tal anotar sua próxima consulta?")).toBeVisible();
  await page.goto(`/calendario/dia?d=${hojeISO(3)}`);
  await expect(page.getByText("Data provável do parto")).toBeVisible();
  await expect(page.getByRole("button", { name: /Adicionar "Data provável do parto" ao meu calendário/ })).toBeVisible();
});

test("crio 'Curso de gestantes' às 19:00 com lembrete de 1 hora antes, recebo o aviso e exporto o .ics", async ({ page }) => {
  const dia = hojeISO();
  await page.clock.install({ time: new Date(`${dia}T10:00:00-03:00`) });
  await entrar(page);
  await page.goto("/calendario");
  await page.getByRole("button", { name: "Novo evento" }).click();
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Dê um nome ao evento.")).toBeVisible();
  await page.getByLabel("Título").fill("Curso de gestantes");
  await page.getByRole("radio", { name: "Curso" }).click();
  await page.getByLabel("Data").fill(dia);
  await page.getByLabel("Hora").fill("19:00");
  await expect(page.getByRole("radio", { name: "1 hora antes" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page).toHaveURL(new RegExp(`/calendario/dia\\?d=${dia}$`));
  await expect(page.getByText("Curso de gestantes")).toBeVisible();
  await expect(page.getByText(/Evento · 19:00/)).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: 'Adicionar "Curso de gestantes" ao meu calendário' }).click();
  const arquivo = await download;
  expect(arquivo.suggestedFilename()).toBe("curso-de-gestantes.ics");

  // 18:01: o aviso sai (o app aberto mostra os lembretes sem servidor).
  await page.clock.setSystemTime(new Date(`${dia}T18:01:00-03:00`));
  await page.reload();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __avisos: string[] }).__avisos)).toContain("Curso de gestantes");
});

test("editar e excluir só o evento próprio; tocar em outro item abre a origem", async ({ page }) => {
  const ev = { id: "ev-1", title: "Compras do enxoval", category: "purchase", starts_at: null, all_day: true, all_day_date: hojeISO(1), notes: null, remind_offset_minutes: null, visible_to_partner: true, criado_por: "mae-local", atualizado_em: agora() };
  await entrar(page, { "ninho.calendar_events": [ev] });
  await page.goto(`/calendario/dia?d=${hojeISO(1)}`);
  await page.getByRole("button", { name: "Abrir Compras do enxoval" }).click();
  await expect(page).toHaveURL(/\/calendario\/evento\?id=ev-1$/);
  await expect(page.getByRole("heading", { name: "Editar evento" })).toBeVisible();
  await expect(page.getByRole("switch", { name: "Dia inteiro" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByLabel("Hora")).toHaveCount(0);
  await page.getByRole("button", { name: "Excluir evento" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Excluir evento" }).click();
  await expect(page).toHaveURL(/\/calendario$/);
  await page.goto(`/calendario/dia?d=${hojeISO(1)}`);
  await expect(page.getByText("Compras do enxoval")).toHaveCount(0);
});

test("o parceiro não vê medicamentos nem as fotos da barriga; vê consultas, DPP e eventos visíveis", async ({ page }) => {
  const dia = hojeISO();
  const doses = [{ id: "d1", medication_id: "m1", scheduled_at: new Date(`${dia}T20:00:00-03:00`).toISOString(), status: "pending", atualizado_em: agora() }];
  const eventos = [
    { id: "ev-a", title: "Curso de gestantes", category: "course", starts_at: new Date(`${dia}T19:00:00-03:00`).toISOString(), all_day: false, all_day_date: null, notes: null, remind_offset_minutes: null, visible_to_partner: true, atualizado_em: agora() },
    { id: "ev-b", title: "Só para mim", category: "other", starts_at: null, all_day: true, all_day_date: dia, notes: null, remind_offset_minutes: null, visible_to_partner: false, atualizado_em: agora() },
  ];
  const pai = { id: "m-pai", profile_id: "pai-local", nome: "Rafa", papel: "parceiro", ultimo_acesso_em: agora(), atualizado_em: agora(), permissoes: { agenda: true, belly_photos: false, birth_plan: true } };
  await entrar(page, { "ninho.membros": [mae, pai], "ninho.medication_doses": doses, "ninho.calendar_events": eventos, "ninho.appointments": [consulta(dia)] }, { papel: "parceiro", nome: "Rafa" }, "pai-local");
  await page.goto(`/calendario/dia?d=${dia}`);
  await expect(page.getByText("Dra. Ana")).toBeVisible();
  await expect(page.getByText("Curso de gestantes")).toBeVisible();
  await expect(page.getByText("Só para mim")).toHaveCount(0);
  await expect(page.getByText(/Medicamentos \(/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Adicionar evento neste dia" })).toHaveCount(0);
  await page.goto("/calendario");
  await expect(page.getByRole("gridcell", { name: /Foto da semana/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Ajustes do calendário" })).toHaveCount(0);
});

test("a gestante vê o resumo dos medicamentos e a foto da semana com check; volta no mês atual e 'Hoje' leva ao dia", async ({ page }) => {
  const dia = hojeISO();
  const doses = [{ id: "d1", medication_id: "m1", scheduled_at: new Date(`${dia}T20:00:00-03:00`).toISOString(), status: "pending", atualizado_em: agora() }];
  await entrar(page, { "ninho.medication_doses": doses, "ninho.calendario.modo": "month" });
  await page.goto(`/calendario/dia?d=${dia}`);
  await expect(page.getByText("Medicamentos (1)")).toBeVisible();
  await page.goto("/calendario");
  await page.getByRole("button", { name: "Próximo mês" }).click();
  await page.getByRole("button", { name: "Próximo mês" }).click();
  await page.getByRole("button", { name: "Hoje" }).click();
  await expect(page).toHaveURL(new RegExp(`/calendario/dia\\?d=${dia}$`));
  await page.goto("/calendario");
  const [, m] = dia.split("-");
  const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  await expect(page.getByRole("heading", { name: new RegExp(meses[Number(m) - 1]!, "i") })).toBeVisible();
  await expect(page.getByRole("gridcell", { name: /Foto da semana 22/ })).toBeVisible();
});

test("sem internet, vejo o que já carreguei e crio um evento", async ({ page, context }) => {
  await entrar(page, { "ninho.appointments": [consulta(hojeISO())] });
  await page.goto("/calendario");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.goto("/calendario/evento");
  await page.goto("/calendario/dia?d=" + hojeISO());
  await page.goto("/calendario");
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("gridcell", { name: /Dra. Ana/ })).toBeVisible();
  await page.getByRole("button", { name: "Novo evento" }).click();
  await page.getByLabel("Título").fill("Fisioterapia");
  await page.getByLabel("Hora").fill("08:30");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Evento salvo ✓")).toBeVisible();
  const salvos = await page.evaluate(() => JSON.parse(localStorage.getItem("ninho.calendar_events") ?? "[]").map((e: { title: string }) => e.title));
  expect(salvos).toContain("Fisioterapia");
  await context.setOffline(false);
});
