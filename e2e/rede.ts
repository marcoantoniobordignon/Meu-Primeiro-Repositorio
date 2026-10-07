import type { BrowserContext } from "@playwright/test";

/**
 * Sem rede de verdade, também para o service worker. `setOffline` sozinho não corta a rede do SW em todas as
 * versões do Chromium (no CI corta; em versões antigas, o SW seguia buscando no servidor e escondia falhas offline).
 * Com PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS (playwright.config.ts), a rota abaixo vale para o SW.
 */
export async function ficarSemRede(context: BrowserContext): Promise<void> {
  await context.setOffline(true);
  await context.route("**/*", (r) => r.abort("internetdisconnected"));
}

export async function voltarARede(context: BrowserContext): Promise<void> {
  await context.unrouteAll({ behavior: "ignoreErrors" });
  await context.setOffline(false);
}
