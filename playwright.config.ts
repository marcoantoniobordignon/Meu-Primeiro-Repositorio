import { defineConfig, devices } from "@playwright/test";

// e2e/rede.ts: as rotas também valem para o service worker (offline de verdade em qualquer Chromium).
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS ??= "1";

/** Spec 01: Playwright para 3 fluxos críticos. `pnpm e2e` (usa o build de produção). */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    // O descritor do iPhone pede WebKit; aqui é Chromium emulando o aparelho.
    ...devices["iPhone 13"],
    browserName: "chromium",
    locale: "pt-BR",
    // Em container como root (CI, sessão remota) o Chromium exige --no-sandbox.
    launchOptions: {
      ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}),
      ...(process.env.PLAYWRIGHT_NO_SANDBOX ? { args: ["--no-sandbox"] } : {}),
    },
  },
  webServer: {
    command: "pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
