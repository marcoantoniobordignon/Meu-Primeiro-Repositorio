"use client";

import { suportaPush } from "@/lib/plataforma";
import { supabase, supabaseConfigurado, tabela } from "@/lib/supabase/client";

/**
 * Web Push dos lembretes (funcionalidades 02–06). Com Supabase e a chave VAPID pública,
 * a inscrição vai para `push_subscriptions` e o job `enviar-lembretes` manda os avisos.
 * Sem servidor, o app mostra os avisos sozinho enquanto está aberto (`useLembretesLocais`).
 */
export function chaveVapid(): string | undefined {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || undefined;
}

export type EstadoPush = "sem_suporte" | "negado" | "ativo" | "inativo";

export function estadoPush(): EstadoPush {
  if (!suportaPush()) return "sem_suporte";
  if (Notification.permission === "denied") return "negado";
  return Notification.permission === "granted" ? "ativo" : "inativo";
}

function base64UrlParaBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const bruto = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const saida = new Uint8Array(new ArrayBuffer(bruto.length));
  for (let i = 0; i < bruto.length; i++) saida[i] = bruto.charCodeAt(i);
  return saida;
}

/** Guarda (ou renova) a inscrição deste aparelho. Silencioso: sem servidor, sem chave ou sem rede, não faz nada. */
export async function garantirInscricao(): Promise<boolean> {
  const chave = chaveVapid();
  if (!chave || !supabaseConfigurado() || estadoPush() !== "ativo") return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlParaBytes(chave) }));
    const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return false;
    const sb = await supabase();
    if (!sb) return false;
    const { error } = await tabela(sb, "push_subscriptions").upsert(
      { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, atualizado_em: new Date().toISOString() },
      { onConflict: "endpoint" },
    );
    return !error;
  } catch {
    return false;
  }
}

/** Pede a permissão (só com toque da pessoa) e inscreve. */
export async function ativarPush(): Promise<EstadoPush> {
  if (!suportaPush()) return "sem_suporte";
  try {
    const r = await Notification.requestPermission();
    if (r === "granted") await garantirInscricao();
  } catch {
    /* navegador antigo */
  }
  return estadoPush();
}
