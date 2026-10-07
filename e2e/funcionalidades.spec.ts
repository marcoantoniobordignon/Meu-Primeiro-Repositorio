import { expect, test, type Page } from "@playwright/test";

/**
 * Critérios de aceite das funcionalidades 02–06 (specs/funcionalidades), no build de produção,
 * sem servidor (app 100 % local). A câmera é a falsa do Chromium.
 */
test.use({
  timezoneId: "America/Sao_Paulo",
  permissions: ["camera", "microphone"],
  launchOptions: {
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", ...(process.env.PLAYWRIGHT_NO_SANDBOX ? ["--no-sandbox"] : [])],
    ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}),
  },
});

/** Data de calendário em São Paulo (o fuso do navegador e do perfil no teste). */
function hojeISO(desloc = 0) {
  const d = new Date(Date.now() + desloc * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
}

/** DPP que deixa hoje no início da semana `semana` (dia 1, longe da virada). */
function dppNaSemana(semana: number) {
  return hojeISO(280 - semana * 7 - 1);
}

async function entrar(page: Page, semana: number, extra: Record<string, unknown> = {}, prefs: Record<string, unknown> = {}) {
  const agora = new Date().toISOString();
  await page.addInitScript(
    (d) => {
      if (sessionStorage.getItem("semeado")) return;
      sessionStorage.setItem("semeado", "1");
      for (const [k, v] of Object.entries(d)) localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
    },
    {
      "ninho.sessao": { uid: "mae-local", anonima: true, remota: false },
      "ninho.perfil": { nome: "Helena", modo: "gestacao", dpp: dppNaSemana(semana), anonima: true, plano: "free", papel: "mae", onboardingConcluidoEm: agora, tz: "America/Sao_Paulo", prefs },
      ...extra,
    },
  );
}

test("medicamentos: vazio, cadastro 08:00 e 20:00, 'Tomei' e paywall no 4º", async ({ page }) => {
  // Relógio às 07:00 de hoje (São Paulo): as duas doses do dia ainda vão acontecer.
  await page.clock.install({ time: new Date(`${hojeISO()}T07:00:00-03:00`) });
  await entrar(page, 20);
  await page.goto("/medicamentos");
  await expect(page.getByText("Cadastre o primeiro lembrete")).toBeVisible();
  await page.getByRole("button", { name: "Cadastrar medicamento" }).click();
  await expect(page.getByText("Anote exatamente o que seu médico receitou. O app só lembra e registra.")).toBeVisible();
  await page.getByRole("combobox", { name: "Nome" }).fill("ferr");
  await page.getByRole("option", { name: "Sulfato ferroso" }).click();
  await page.locator("#horario-0").fill("08:00");
  await page.getByRole("button", { name: "Mais um horário" }).click();
  await page.locator("#horario-1").fill("20:00");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page).toHaveURL(/\/medicamentos$/);
  const linhas = page.locator("li", { hasText: "Sulfato ferroso" });
  await expect(linhas).toHaveCount(2);
  await expect(linhas.nth(0)).toContainText("08:00");
  await expect(linhas.nth(1)).toContainText("20:00");
  await linhas.nth(0).getByRole("button", { name: "Tomei", exact: true }).click();
  await expect(page.getByText("Dose registrada ✓")).toBeVisible();
  await expect(linhas.nth(0)).toContainText("tomei às 07:00");

  // Free: 3 ativos; o 4º abre o paywall e os existentes seguem.
  for (const n of ["Vitamina D", "Ômega 3"]) {
    await page.goto("/medicamentos/novo");
    await page.getByRole("combobox", { name: "Nome" }).fill(n);
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page).toHaveURL(/\/medicamentos$/);
  }
  await page.goto("/medicamentos/lista");
  await page.getByRole("button", { name: "Adicionar" }).click();
  await expect(page.getByText("Isso é do Completo")).toBeVisible();
  await page.getByRole("button", { name: "Agora não" }).click();
  await expect(page.locator("li", { hasText: "Ômega 3" })).toBeVisible();
});

test("exames: criada na semana 9, translucência em 'Agora' e morfológico em 'Próximos'; dispensar e restaurar", async ({ page }) => {
  await entrar(page, 9);
  await page.goto("/exames");
  await expect(page.getByText("Calendário de referência. Seu médico define quais exames você precisa e quando.")).toBeVisible();
  const agora = page.locator("section", { has: page.getByRole("heading", { name: "Agora" }) });
  const proximos = page.locator("section", { has: page.getByRole("heading", { name: "Próximos" }) });
  await expect(agora.getByText("Ultrassom de translucência nucal")).toBeVisible();
  await expect(proximos.getByText("Ultrassom morfológico")).toBeVisible();

  await page.getByText("Ultrassom morfológico").click();
  await page.getByRole("button", { name: "O médico não pediu" }).click();
  await page.goto("/exames");
  const dispensados = page.locator("section", { has: page.getByRole("heading", { name: "Dispensados" }) });
  await expect(dispensados.getByText("Ultrassom morfológico")).toBeVisible();
  await dispensados.getByRole("button", { name: "Restaurar" }).click();
  await expect(proximos.getByText("Ultrassom morfológico")).toBeVisible();
});

test("exames: criada na semana 20, os do 1º trimestre em 'Anteriores' com 'Já fiz'", async ({ page }) => {
  await entrar(page, 20);
  await page.goto("/exames");
  const anteriores = page.locator("section", { has: page.getByRole("heading", { name: "Anteriores" }) });
  await expect(anteriores.getByText("Ultrassom inicial")).toBeVisible();
  await anteriores.locator("li", { hasText: "Ultrassom inicial" }).getByRole("button", { name: "Já fiz" }).click();
  await page.getByRole("button", { name: "Só marcar como feito" }).click();
  const feitos = page.locator("section", { has: page.getByRole("heading", { name: "Feitos" }) });
  await expect(feitos.getByText("Ultrassom inicial")).toBeVisible();
});

test("consultas: sem consulta dá para anotar; concluir com 2 feitas leva a 3ª para a próxima; medida fora da faixa; retorno de 14 dias na semana 30", async ({ page }) => {
  await entrar(page, 30);
  await page.goto("/consultas");
  await expect(page.getByText("Cadastre sua próxima consulta")).toBeVisible();
  for (const p of ["Posso viajar de avião?", "Posso tomar café?", "Quando faço a curva glicêmica?"]) {
    await page.getByRole("textbox", { name: "Nova pergunta" }).fill(p);
    await page.getByRole("button", { name: "Anotar" }).click();
    await expect(page.getByText(p)).toBeVisible();
  }

  // Consulta hoje às 23:59 (marcada) e outra daqui a 10 dias.
  for (const [data, hora] of [[hojeISO(), "23:59"], [hojeISO(10), "10:00"]]) {
    await page.getByRole("button", { name: "Nova consulta" }).first().click();
    await page.getByLabel("Data").fill(data!);
    await page.getByLabel("Hora", { exact: true }).fill(hora!);
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Consulta salva ✓")).toBeVisible();
  }
  await expect(page.getByText("3 perguntas na pauta")).toBeVisible();

  await page.getByRole("link", { name: /hoje às 23:59/ }).click();
  await page.getByRole("button", { name: "Concluir consulta" }).click();
  await page.getByLabel("Peso (kg)").fill("29");
  await expect(page.getByText("Confira o valor").first()).toBeVisible();
  await page.getByLabel("Peso (kg)").fill("72,5");
  await page.getByLabel("Máxima").fill("110");
  await page.getByLabel("Mínima").fill("70");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("switch", { name: "Posso viajar de avião?" }).click();
  await page.getByRole("switch", { name: "Posso tomar café?" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText(/Retorno em 14 dias/)).toBeVisible();
  await expect(page.getByText("Ritmo comum no pré-natal. Seu médico pode orientar diferente.")).toBeVisible();
  await page.getByRole("button", { name: "Concluir", exact: true }).click();
  await expect(page.getByText("72,5 kg · 110/70 mmHg")).toBeVisible();
  await expect(page.getByText(/alta|baixa|alerta/i)).toHaveCount(0);

  await page.goto("/consultas/pauta");
  await expect(page.getByText("Quando faço a curva glicêmica?")).toBeVisible();
  await expect(page.getByText("Posso viajar de avião?")).toHaveCount(0);

  await page.goto("/consultas/levar");
  await expect(page.getByText("Quando faço a curva glicêmica?")).toBeVisible();
  await expect(page.getByText(/72,5 kg/)).toBeVisible();
});

test("barriga: câmera na semana 22 com a silhueta da 21, foto na grade, substituir pergunta, arquivo sem EXIF", async ({ page }) => {
  await entrar(page, 22, {
    "ninho.belly_photos": [{ id: "f21", gest_week: 21, taken_on: hojeISO(-7), storage_path: "barriga/f21.jpg", width: 1200, height: 1600, caption: null, atualizado_em: new Date().toISOString() }],
  });
  await page.goto("/barriga");
  await expect(page.getByText("Tire a foto da semana 22")).toBeVisible();
  await page.getByRole("button", { name: "Tirar a foto" }).click();
  await expect(page).toHaveURL(/\/barriga\/camera\?semana=22/);
  await expect(page.getByText("Silhueta da semana 21")).toBeVisible();
  await page.getByRole("button", { name: "Tirar a foto" }).click();
  await page.getByLabel("Legenda (opcional)").fill("22 semanas!");
  await page.getByRole("button", { name: "Usar esta" }).click();
  await expect(page).toHaveURL(/\/barriga$/);
  await expect(page.getByRole("button", { name: "Ver a foto da semana 22" })).toBeVisible();

  // O arquivo guardado (e que sobe para o Storage) não tem EXIF.
  const semExif = await page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((res, rej) => {
      const r = indexedDB.open("ninho");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const itens: { id: string; blob: Blob }[] = await new Promise((res) => {
      const r = db.transaction("arquivos").objectStore("arquivos").getAll();
      r.onsuccess = () => res(r.result);
    });
    const b = new Uint8Array(await itens[0]!.blob.arrayBuffer());
    let i = 2;
    while (i + 4 < b.length && b[i] === 0xff && b[i + 1] !== 0xda) {
      if (b[i + 1] === 0xe1 && String.fromCharCode(...b.slice(i + 4, i + 8)) === "Exif") return false;
      i += 2 + ((b[i + 2]! << 8) | b[i + 3]!);
    }
    return b[0] === 0xff && b[1] === 0xd8 && itens.length === 1;
  });
  expect(semExif).toBe(true);

  // Outra na mesma semana: o app pergunta antes de substituir.
  await page.goto("/barriga/camera?semana=22");
  await page.getByRole("button", { name: "Tirar a foto" }).click();
  await page.getByRole("button", { name: "Usar esta" }).click();
  await expect(page.getByText("Substituir a foto da semana 22?")).toBeVisible();
});

test("barriga: sem câmera, foto da galeria com EXIF de localização sai limpa; semana passada sem cobrança", async ({ browser }) => {
  const contexto = await browser.newContext({ permissions: [], timezoneId: "America/Sao_Paulo", baseURL: "http://localhost:3000" });
  const page = await contexto.newPage();
  await entrar(page, 22);
  await page.goto("/barriga");
  // JPEG com segmento EXIF (onde moraria o GPS) montado no navegador.
  const jpeg = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 300;
    c.height = 400;
    c.getContext("2d")!.fillRect(0, 0, 300, 400);
    const b = new Uint8Array(await (await new Promise<Blob>((r) => c.toBlob((x) => r(x!), "image/jpeg"))).arrayBuffer());
    const tiff = [0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
    const corpo = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff];
    const app1 = [0xff, 0xe1, (corpo.length + 2) >> 8, (corpo.length + 2) & 0xff, ...corpo];
    return [0xff, 0xd8, ...app1, ...b.slice(2)];
  });
  await page.getByRole("button", { name: "Adicionar foto da semana 15" }).click();
  const seletor = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Galeria" }).click();
  await (await seletor).setFiles({ name: "gps.jpg", mimeType: "image/jpeg", buffer: Buffer.from(jpeg) });
  await page.getByRole("button", { name: "Usar esta" }).click();
  await expect(page.getByRole("button", { name: "Ver a foto da semana 15" })).toBeVisible();
  await expect(page.getByText("Isso é do Completo")).toHaveCount(0);
  const temExif = await page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((res) => {
      const r = indexedDB.open("ninho");
      r.onsuccess = () => res(r.result);
    });
    const itens: { blob: Blob }[] = await new Promise((res) => {
      const r = db.transaction("arquivos").objectStore("arquivos").getAll();
      r.onsuccess = () => res(r.result);
    });
    const texto = new TextDecoder("latin1").decode(await itens[0]!.blob.arrayBuffer());
    return texto.includes("Exif");
  });
  expect(temExif).toBe(false);

  // Sem permissão de câmera: oferece a galeria e a câmera do celular.
  await page.goto("/barriga/camera?semana=22");
  await expect(page.getByRole("button", { name: "Escolher da galeria" }).first()).toBeVisible();
  await contexto.close();
});

test("diário: vazio pede a descoberta; na semana 17 'Primeiro chute' vira entrada com semana; 'Mais tarde' esconde; modo fé mostra a oração", async ({ page }) => {
  await entrar(page, 17);
  await page.goto("/diario");
  await expect(page.getByText("Registre como foi descobrir a gravidez")).toBeVisible();
  await page.getByRole("button", { name: "Escrever agora" }).click();
  await page.getByRole("textbox", { name: "Como foi" }).fill("Fiz o teste no banheiro do trabalho.");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText(/semana 17/)).toBeVisible();

  await page.goto("/diario");
  const chute = page.locator("section", { has: page.getByRole("heading", { name: "Primeiro chute" }) });
  await expect(chute).toBeVisible();
  await chute.getByRole("button", { name: "Responder" }).click();
  await page.getByRole("textbox", { name: "Como foi" }).fill("Senti no ônibus!");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Senti no ônibus!")).toBeVisible();
  await expect(page.getByText(/semana 17/)).toBeVisible();

  await page.goto("/diario");
  await expect(page.getByRole("heading", { name: "Primeiro chute" })).toHaveCount(0);
  const nome = page.locator("section", { has: page.getByRole("heading", { name: "Escolhemos o nome" }) });
  await nome.getByRole("button", { name: "Mais tarde" }).click();
  await expect(page.getByRole("heading", { name: "Escolhemos o nome" })).toHaveCount(0);

  // Busca normalizada.
  await page.getByRole("searchbox", { name: "Buscar no diário" }).fill("ONIBUS");
  await expect(page.getByText("Senti no ônibus!")).toBeVisible();
  await expect(page.getByText("Fiz o teste no banheiro do trabalho.")).toHaveCount(0);

  await page.goto("/eu");
  await page.getByRole("switch", { name: /Modo fé/ }).click();
  await page.goto("/diario/marcos");
  await expect(page.getByText("Primeira oração pelo bebê")).toBeVisible();
  await page.getByText("Primeira oração pelo bebê").click();
  await expect(page.getByText("Escreva a sua primeira oração pelo bebê. Pode ser curtinha.")).toBeVisible();
});

test("barriga: com 3 fotos, timelapse toca e exporta vídeo 720p no free (com marca)", async ({ page }) => {
  await entrar(page, 22);
  for (const semana of [20, 21, 22]) {
    await page.goto(`/barriga/camera?semana=${semana}`);
    await page.getByRole("button", { name: "Tirar a foto" }).click();
    await page.getByRole("button", { name: "Usar esta" }).click();
    await expect(page).toHaveURL(/\/barriga$/);
  }
  await page.getByRole("link", { name: "Timelapse" }).click();
  await page.getByRole("button", { name: "Tocar" }).click();
  await expect(page.getByText("Semana 2", { exact: false }).first()).toBeVisible();
  await page.getByRole("radio", { name: "Rápido" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar vídeo (720p)" }).click();
  const arquivo = await download;
  expect(arquivo.suggestedFilename()).toMatch(/^ninho-barriga\.(mp4|webm)$/);
  const caminho = await arquivo.path();
  const fs = await import("node:fs");
  expect(fs.statSync(caminho!).size).toBeGreaterThan(1000);
  // Free com marca; o 1080p sem marca passa pelo paywall.
  await page.getByRole("button", { name: "Em 1080p, sem marca" }).click();
  await expect(page.getByText("No grátis, o vídeo sai em 720p com a marca Ninho. No Completo, em 1080p e sem marca.")).toBeVisible();
});
