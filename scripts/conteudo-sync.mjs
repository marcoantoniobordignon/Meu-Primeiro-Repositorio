/**
 * `pnpm conteudo:sync`: faz upsert do banco de conteúdo (src/conteudo/banco.json) e do
 * catálogo de sintomas (supabase/seed/sintomas.json) no Supabase, com a service role.
 * Variáveis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !chave) {
  console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const sb = createClient(url, chave, { auth: { persistSession: false } });

const banco = JSON.parse(await readFile(path.join(raiz, "src", "conteudo", "banco.json"), "utf8"));
const { error: e1 } = await sb.from("conteudos").upsert(
  banco.map((c) => ({ ...c, atualizado_em: new Date().toISOString() })),
  { onConflict: "id" },
);
if (e1) throw e1;
console.log(`conteudos: ${banco.length} upserts`);

const catalogo = JSON.parse(await readFile(path.join(raiz, "supabase", "seed", "sintomas.json"), "utf8"));
const { error: e2 } = await sb.from("sintomas_catalogo").upsert(
  catalogo.map((s) => ({
    slug: s.slug,
    nome: s.nome,
    grupo: s.grupo,
    especial: s.especial ?? null,
    // O JSON guarda faixas [min, max]; o banco guarda a lista de semanas (spec 06).
    semanas_frequentes: s.semanas_frequentes.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => a + i)),
  })),
  { onConflict: "slug" },
);
if (e2) throw e2;
console.log(`sintomas_catalogo: ${catalogo.length} upserts`);
