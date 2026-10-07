import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

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
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
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
