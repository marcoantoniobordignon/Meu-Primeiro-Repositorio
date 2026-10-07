import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Enquanto `pnpm supabase:types` não roda no CI, este teste garante que
 * toda tabela da migration existe em types.generated.ts (e vice-versa).
 */
describe("types.generated.ts ↔ migration", () => {
  const pasta = path.resolve(__dirname, "../../../supabase/migrations");
  const sql = readdirSync(pasta)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(path.join(pasta, f), "utf8"))
    .join("\n");
  const tipos = readFileSync(path.resolve(__dirname, "./types.generated.ts"), "utf8");

  const apagadas = new Set([...sql.matchAll(/drop table public\.(\w+)/g)].map((m) => m[1]!));
  const tabelasSql = [...sql.matchAll(/create table public\.(\w+)/g)].map((m) => m[1]!).filter((t) => !apagadas.has(t)).sort();
  const tabelasTs = [...tipos.matchAll(/^\s{6}(\w+): Tabela</gm)].map((m) => m[1]!).sort();

  it("mesmas tabelas nos dois lados", () => {
    expect(tabelasTs).toEqual(tabelasSql);
  });

  it("toda coluna das tabelas da 0003 e 0004 está nos tipos", () => {
    const m3 = ["0003_funcionalidades.sql", "0004_galeria.sql"].map((f) => readFileSync(path.join(pasta, f), "utf8")).join("\n");
    const blocoTs = (t: string) => {
      const i = tipos.indexOf(`      ${t}: Tabela<`);
      const fim = tipos.indexOf(">;\n", i);
      return tipos.slice(i, fim);
    };
    const tabelas = [...m3.matchAll(/create table public\.(\w+) \(([\s\S]*?)\n\);/g)];
    expect(tabelas.length).toBe(17);
    for (const [, tabela, corpo] of tabelas) {
      const colunas = corpo!
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => /^[a-z_0-9]+ /.test(l) && !/^(check|primary|unique|constraint)\b/.test(l))
        .map((l) => l.split(" ")[0]!);
      const ts = blocoTs(tabela!);
      const usaBase = ts.includes("Base &");
      for (const c of colunas) {
        const naBase = usaBase && ["id", "familia_id", "criado_por", "criado_em", "atualizado_em", "apagado_em"].includes(c);
        expect(naBase || new RegExp(`\\b${c}\\??:`).test(ts), `${tabela}.${c}`).toBe(true);
      }
    }
  });

  it("toda RPC da migration está tipada", () => {
    const rpcs = [...sql.matchAll(/create or replace function public\.(\w+)\(/g)].map((m) => m[1]!);
    const publicas = rpcs.filter((r) => new RegExp(`grant execute on function [^;]*public\\.${r}\\(`).test(sql));
    for (const r of publicas) expect(tipos, r).toContain(`${r}:`);
  });
});
