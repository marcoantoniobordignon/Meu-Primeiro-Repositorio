import { describe, expect, it } from "vitest";

import { assinarToken, verificarToken } from "@dominio/token.ts";

describe("MED RN-06 · token do 'Tomei' na notificação", () => {
  const carga = { dose: "11111111-1111-8111-8111-111111111111", familia: "22222222-2222-4222-8222-222222222222", exp: 2_000_000_000_000 };

  it("assina e confere", async () => {
    const t = await assinarToken(carga, "segredo");
    expect(await verificarToken(t, "segredo", 1_000)).toEqual(carga);
  });

  it("recusa outro segredo, adulteração e expirado", async () => {
    const t = await assinarToken(carga, "segredo");
    expect(await verificarToken(t, "outro", 1_000)).toBeNull();
    expect(await verificarToken(t.replace("1111", "1112"), "segredo", 1_000)).toBeNull();
    expect(await verificarToken(t, "segredo", carga.exp + 1)).toBeNull();
    expect(await verificarToken("lixo", "segredo")).toBeNull();
  });
});
