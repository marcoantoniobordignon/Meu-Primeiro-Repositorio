import { describe, expect, it } from "vitest";

import type { Convite, Membro } from "@/lib/dados/colecoes";

import { estadoDoConvite, gerarToken, inicialDoAutor, nomeDoAutor, permissoes } from "./regras";

describe("CUI-01/04 · permissões por papel", () => {
  it("mãe e parceiro veem tudo; avó e cuidador registram sem ver sintomas nem assinatura", () => {
    expect(permissoes("mae")).toMatchObject({ verSintomas: true, removerMembro: true, podeConvidar: ["parceiro", "avo", "cuidador"] });
    expect(permissoes("parceiro")).toMatchObject({ verSintomas: true, gerarConvite: true, removerMembro: false, podeConvidar: ["cuidador"] });
    for (const p of ["avo", "cuidador"] as const) {
      expect(permissoes(p)).toMatchObject({ verSintomas: false, verCheckinPosParto: false, verAssinatura: false, registrar: true, apagarRegistrosDeOutros: false, gerarConvite: false });
    }
  });
});

describe("Funcionalidades 02–06 · o que cada papel vê", () => {
  it("medicamentos e medidas só a gestante; parceiro vê exames, diário e agenda", () => {
    expect(permissoes("mae")).toMatchObject({ verMedicamentos: true, verMedidas: true, gerirConsultas: true, verAgenda: true, verFotosBarriga: true, tirarFotosBarriga: true, verDiario: true, verExames: true });
    expect(permissoes("parceiro")).toMatchObject({ verMedicamentos: false, verMedidas: false, gerirConsultas: false, verAgenda: true, verFotosBarriga: false, tirarFotosBarriga: false, verDiario: true, verExames: true });
  });

  it("a gestante liga as fotos e desliga a agenda do parceiro", () => {
    expect(permissoes("parceiro", { belly_photos: true })).toMatchObject({ verFotosBarriga: true, tirarFotosBarriga: false, verAgenda: true });
    expect(permissoes("parceiro", { agenda: false })).toMatchObject({ verAgenda: false });
  });

  it("avó e cuidador não veem nada de saúde da gestação, nem com permissões", () => {
    for (const p of ["avo", "cuidador"] as const) {
      expect(permissoes(p, { agenda: true, belly_photos: true })).toMatchObject({ verMedicamentos: false, verExames: false, verAgenda: false, verMedidas: false, verFotosBarriga: false, verDiario: false });
    }
  });
});

describe("CUI-02 · convite", () => {
  const agora = new Date("2026-09-30T10:00:00Z");
  const base: Convite = { id: "c", token: "t", papel: "cuidador", criado_por: "mae", expira_em: "2026-10-03T10:00:00Z", atualizado_em: "" };

  it("válido por 72 h e uma vez", () => {
    expect(estadoDoConvite(base, agora)).toBe("valido");
    expect(estadoDoConvite({ ...base, usado_em: "2026-09-30T11:00:00Z" }, agora)).toBe("usado");
    expect(estadoDoConvite(base, new Date("2026-10-04T00:00:00Z"))).toBe("expirado");
    expect(estadoDoConvite(undefined, agora)).toBe("inexistente");
  });

  it("token com 32 caracteres", () => {
    expect(gerarToken()).toMatch(/^[a-z0-9]{32}$/);
    expect(gerarToken()).not.toBe(gerarToken());
  });
});

describe("CUI-07 · autor do registro", () => {
  const lista: Membro[] = [
    { id: "1", profile_id: "mae", nome: "Helena", papel: "mae", ultimo_acesso_em: "", atualizado_em: "" },
    { id: "2", profile_id: "pai", nome: "rafael", papel: "parceiro", ultimo_acesso_em: "", atualizado_em: "" },
  ];
  it("inicial só quando não sou eu; nome na linha do tempo", () => {
    expect(inicialDoAutor("mae", "mae", lista)).toBeNull();
    expect(inicialDoAutor("pai", "mae", lista)).toBe("R");
    expect(inicialDoAutor("x", "mae", lista)).toBe("?");
    expect(nomeDoAutor("pai", "mae", lista)).toBe("rafael");
    expect(nomeDoAutor("mae", "mae", lista)).toBe("você");
  });
});
