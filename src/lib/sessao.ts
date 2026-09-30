import { supabase } from "@/lib/supabase/client";

const CHAVE = "ninho.sessao";

export interface Sessao {
  uid: string;
  anonima: boolean;
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
 * Com Supabase configurado usa signInAnonymously; sem ele, gera um uid local.
 * Nunca lança: sem rede, cai no uid local e sincroniza depois.
 */
export async function garantirSessaoAnonima(): Promise<Sessao> {
  const existente = lerLocal();
  if (existente) return existente;

  const sb = await supabase();
  if (sb) {
    try {
      const { data } = await sb.auth.signInAnonymously();
      if (data.user) {
        const s = { uid: data.user.id, anonima: true };
        guardarLocal(s);
        return s;
      }
    } catch {
      /* sem rede: segue local */
    }
  }

  const s = { uid: gerarUid(), anonima: true };
  guardarLocal(s);
  return s;
}

export function sessaoAtual(): Sessao | null {
  return lerLocal();
}
