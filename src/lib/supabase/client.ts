import type { SupabaseClient } from "@supabase/supabase-js";

let cliente: Promise<SupabaseClient | null> | undefined;

/**
 * Cliente do navegador, carregado sob demanda para não pesar o bundle inicial.
 * Resolve null quando o projeto ainda não tem as variáveis de ambiente:
 * o app segue funcionando só com o estado local.
 */
export function supabase(): Promise<SupabaseClient | null> {
  if (cliente) return cliente;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  cliente =
    url && chave
      ? import("@supabase/supabase-js").then(({ createClient }) => createClient(url, chave))
      : Promise.resolve(null);
  return cliente;
}
