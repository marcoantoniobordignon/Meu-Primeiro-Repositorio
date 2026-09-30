import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Enquanto `pnpm supabase:types` não roda no CI, este teste garante que
 * toda tabela da migration existe em types.generated.ts (e vice-versa).
 */
describe("types.generated.ts ↔ migration", () => {
  const sql = readFileSync(path.resolve(__dirname, "../../../supabase/migrations/0001_schema.sql"), "utf8");
  const tipos = readFileSync(path.resolve(__dirname, "./types.generated.ts"), "utf8");

  const tabelasSql = [...sql.matchAll(/create table public\.(\w+)/g)].map((m) => m[1]!).sort();
  const tabelasTs = [...tipos.matchAll(/^\s{6}(\w+): Tabela</gm)].map((m) => m[1]!).sort();

  it("mesmas tabelas nos dois lados", () => {
    expect(tabelasTs).toEqual(tabelasSql);
  });

  it("toda RPC da migration está tipada", () => {
    const rpcs = [...sql.matchAll(/create or replace function public\.(\w+)\(/g)].map((m) => m[1]!);
    const publicas = rpcs.filter((r) => new RegExp(`grant execute on function [^;]*public\\.${r}\\(`).test(sql));
    for (const r of publicas) expect(tipos, r).toContain(`${r}:`);
  });
});
