import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig, SerwistPlugin } from "serwist";
import { NetworkFirst, Serwist } from "serwist";

import { idbSalvar, STORE_ACOES_PUSH } from "@/lib/offline/idb";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * Service worker (spec 01): pré-cache do build, cache de runtime padrão do Serwist
 * e fallback de navegação para /~offline. Os dados vivem no localStorage/IndexedDB,
 * então toda tela já aberta renderiza sem rede (ARQ-04).
 */
/**
 * Todas as telas são estáticas: a query (`?id=`, `?slug=`, `?kind=`) só é lida no aparelho. Guardar a página pelo
 * caminho, sem a query, faz `/cartas/escrever?id=…` abrir sem rede depois de `/cartas/escrever` ter sido aberta
 * (e o Next cai numa navegação de documento quando o RSC falha offline).
 */
const semQuery: SerwistPlugin = {
  cacheKeyWillBeUsed: async ({ request }) => {
    const url = new URL(request.url);
    url.search = "";
    return url.href;
  },
  // Abriu a tela com rede: guarda também o RSC dela, para a navegação do app (sem recarregar) funcionar offline.
  // (cacheDidUpdate também vale para a resposta do navigation preload, que não passa pelo fetchDidSucceed.)
  cacheDidUpdate: async ({ request, event }) => {
    event.waitUntil(aquecerRsc(request.url).catch(() => undefined));
  },
};

/** O RSC de uma tela estática é o mesmo para qualquer origem e query: uma chave por caminho. */
const CACHE_RSC = "paginas-rsc";
const chaveRsc = (url: string) => {
  const u = new URL(url);
  return `${u.origin}${u.pathname}?__rsc`;
};
const rscPeloCaminho: SerwistPlugin = { cacheKeyWillBeUsed: async ({ request }) => chaveRsc(request.url) };

async function aquecerRsc(url: string): Promise<void> {
  const resposta = await fetch(new URL(url).pathname, { headers: { RSC: "1" } });
  if (resposta.ok) await (await caches.open(CACHE_RSC)).put(chaveRsc(url), resposta);
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ request, sameOrigin }) => sameOrigin && request.mode === "navigate",
      handler: new NetworkFirst({ cacheName: "paginas", networkTimeoutSeconds: 5, plugins: [semQuery] }),
    },
    {
      matcher: ({ request, sameOrigin }) => sameOrigin && request.headers.get("RSC") === "1" && !request.headers.has("Next-Router-Segment-Prefetch"),
      handler: new NetworkFirst({ cacheName: CACHE_RSC, networkTimeoutSeconds: 5, plugins: [rscPeloCaminho], matchOptions: { ignoreVary: true } }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();

// ---------------------------------------------------------------------------
// Lembretes (funcionalidades 02–06). O job `enviar-lembretes` manda:
// { titulo, corpo, url, tag, acoes, ref, categoria, token?, acaoUrl? }.
// ---------------------------------------------------------------------------
interface CargaLembrete {
  titulo: string;
  corpo: string;
  url: string;
  tag: string;
  acoes?: ("tomei" | "adiar" | "ja_fiz" | "remarquei")[];
  ref: string;
  categoria: string;
  token?: string;
  acaoUrl?: string;
}

const ROTULOS: Record<string, string> = { tomei: "Tomei", adiar: "Adiar", ja_fiz: "Já fiz", remarquei: "Remarquei" };

self.addEventListener("push", (evento) => {
  let carga: CargaLembrete | null = null;
  try {
    carga = evento.data?.json() as CargaLembrete;
  } catch {
    carga = null;
  }
  if (!carga) return;
  // Medicamentos RN-06: no iPhone não há botões; o toque abre o sheet da dose pela URL.
  const opcoes: NotificationOptions & { actions?: { action: string; title: string }[] } = {
    body: carga.corpo,
    tag: carga.tag,
    icon: "/icons/icone.svg",
    badge: "/icons/icone.svg",
    data: carga,
    actions: (carga.acoes ?? []).map((a) => ({ action: a, title: ROTULOS[a] ?? a })),
  };
  evento.waitUntil(self.registration.showNotification(carga.titulo, opcoes));
});

async function abrir(url: string) {
  const janelas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const aberta = janelas[0];
  if (aberta) {
    await aberta.focus();
    return (aberta as WindowClient).navigate(url);
  }
  return self.clients.openWindow(url);
}

async function aplicarAcao(carga: CargaLembrete, acao: "tomei" | "adiar") {
  const quando = new Date().toISOString();
  // Offline-first: guarda a ação; o app aplica na coleção (e ela sobe pela outbox).
  await idbSalvar(STORE_ACOES_PUSH, { id: `${carga.ref}:${acao}:${quando}`, acao, ref: carga.ref, quando });
  const janelas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  janelas.forEach((j) => j.postMessage({ tipo: "acao-push" }));
  // Com rede, o servidor já registra, mesmo com o app fechado.
  if (carga.acaoUrl && carga.token) {
    try {
      await fetch(carga.acaoUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: carga.token, acao, quando }) });
    } catch {
      /* sem rede: o app aplica quando abrir */
    }
  }
}

self.addEventListener("notificationclick", (evento) => {
  const carga = evento.notification.data as CargaLembrete | undefined;
  evento.notification.close();
  if (!carga) return;
  if (evento.action === "tomei" || evento.action === "adiar") {
    evento.waitUntil(aplicarAcao(carga, evento.action));
    return;
  }
  if (evento.action === "ja_fiz" || evento.action === "remarquei") {
    const sep = carga.url.includes("?") ? "&" : "?";
    evento.waitUntil(abrir(`${carga.url}${sep}acao=${evento.action}`));
    return;
  }
  evento.waitUntil(abrir(carga.url));
});
