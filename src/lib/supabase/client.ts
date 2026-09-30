import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./types.generated";

export type Cliente = SupabaseClient<Database>;

interface Resposta<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

/**
 * Enquanto `pnpm supabase:types` não gera o tipo oficial, o Database à mão não
 * casa com o generic do SDK. Estes dois helpers concentram o cast num lugar só;
 * a validação real é o schema e a RLS.
 */
export function chamarRpc<T>(sb: Cliente, nome: string, args?: Record<string, unknown>): PromiseLike<Resposta<T>> {
  const rpc = sb.rpc as unknown as (n: string, a?: Record<string, unknown>) => PromiseLike<Resposta<T>>;
  return rpc(nome, args);
}

export interface TabelaSolta {
  upsert(valores: unknown, opcoes?: { onConflict?: string }): PromiseLike<Resposta<unknown>>;
  update(valores: Record<string, unknown>): { eq(coluna: string, valor: unknown): PromiseLike<Resposta<unknown>> };
  select(colunas?: string): {
    gt(coluna: string, valor: unknown): { order(coluna: string, o: { ascending: boolean }): { limit(n: number): PromiseLike<Resposta<unknown[]>> } };
  };
}

export function tabela(sb: Cliente, nome: string): TabelaSolta {
  return (sb.from as unknown as (n: string) => TabelaSolta)(nome);
}

let cliente: Promise<Cliente | null> | undefined;

export function supabaseConfigurado(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * Cliente do navegador, carregado sob demanda para não pesar o bundle inicial.
 * Resolve null quando o projeto ainda não tem as variáveis de ambiente:
 * o app segue funcionando só com o estado local.
 */
export function supabase(): Promise<Cliente | null> {
  if (cliente) return cliente;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  cliente =
    url && chave
      ? import("@supabase/supabase-js").then(({ createClient }) =>
          createClient<Database>(url, chave, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }),
        )
      : Promise.resolve(null);
  return cliente;
}
