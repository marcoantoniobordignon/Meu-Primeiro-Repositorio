import { supabase, supabaseConfigurado } from "@/lib/supabase/client";

const CHAVE = "ninho.sessao";

export interface Sessao {
  uid: string;
  anonima: boolean;
  /** true quando o uid é do Supabase; false quando foi gerado neste aparelho. */
  remota: boolean;
}

function gerarUid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function lerLocal(): Sessao | null {
  try {
    const bruto = localStorage.getItem(CHAVE);
    return bruto ? (JSON.parse(bruto) as Sessao) : null;
  } catch {
    return null;
  }
}

function guardarLocal(sessao: Sessao) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(sessao));
  } catch {
    /* storage cheio ou bloqueado: seguimos só em memória */
  }
}

/**
 * ARQ-03 / spec 04: sessão anônima criada silenciosamente na primeira tela.
 * Com Supabase configurado usa signInAnonymously e, se já houver sessão salva
 * pelo SDK, reaproveita. Sem rede, cai num uid local e o `promoverSessao`
 * troca pelo uid remoto quando a rede volta. Nunca lança.
 */
export async function garantirSessaoAnonima(): Promise<Sessao> {
  const existente = lerLocal();
  if (existente?.remota) return existente;

  const sb = await supabase();
  if (sb) {
    try {
      const { data: atual } = await sb.auth.getSession();
      const user = atual.session?.user ?? (await sb.auth.signInAnonymously()).data.user;
      if (user) {
        const s: Sessao = { uid: user.id, anonima: user.is_anonymous ?? true, remota: true };
        guardarLocal(s);
        return s;
      }
    } catch {
      /* sem rede: segue local e tenta de novo depois */
    }
  }

  if (existente) return existente;
  const s: Sessao = { uid: gerarUid(), anonima: true, remota: false };
  guardarLocal(s);
  return s;
}

export function sessaoAtual(): Sessao | null {
  return lerLocal();
}

/** Atualiza o cache local depois de um login/logout do SDK (linkIdentity, magic link). */
export async function sincronizarSessao(): Promise<Sessao | null> {
  if (!supabaseConfigurado()) return lerLocal();
  const sb = await supabase();
  if (!sb) return lerLocal();
  const { data } = await sb.auth.getSession();
  const user = data.session?.user;
  if (!user) return lerLocal();
  const s: Sessao = { uid: user.id, anonima: user.is_anonymous ?? false, remota: true };
  guardarLocal(s);
  return s;
}
