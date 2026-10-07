"use client";

import { dataNoFuso } from "@dominio/tempo.ts";
import { itensParaEnviar, somarPendente, type ChaveAnonima, type Pendentes } from "@dominio/fe.ts";

/**
 * Funcionalidade 17 RN-10: métricas do modo fé só como contagem anônima por dia (nunca GA4, nunca usuário).
 * Ficam no aparelho até a próxima sincronização e sobem numa chamada só.
 */
const CHAVE = "ninho.fe.contadores";

function ler(): Pendentes {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) ?? "{}") as Pendentes;
  } catch {
    return {};
  }
}

function guardar(p: Pendentes) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(p));
  } catch {
    /* sem storage: a contagem se perde, e tudo bem */
  }
}

export function contarAnonimo(chave: ChaveAnonima, agora = new Date()): void {
  // O dia em UTC: sem fuso, que já diria algo sobre quem é.
  guardar(somarPendente(ler(), dataNoFuso(agora, "UTC"), chave));
}

export function contadoresPendentes(): Pendentes {
  return ler();
}

/**
 * Sobe sem a sessão: só a chave anônima do projeto vai no cabeçalho, então nem a requisição diz quem contou.
 * Erro de validação (dia velho, chave desconhecida) descarta, para não travar; erro de rede tenta depois.
 */
export async function enviarContadores(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const itens = itensParaEnviar(ler());
  if (!url || !chave || !itens.length) return;
  try {
    const r = await fetch(`${url}/rest/v1/rpc/somar_contadores_anonimos`, {
      method: "POST",
      headers: { apikey: chave, Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_itens: itens }),
      credentials: "omit",
    });
    if (r.ok || r.status === 400) guardar({});
  } catch {
    /* sem rede: fica para a próxima */
  }
}
