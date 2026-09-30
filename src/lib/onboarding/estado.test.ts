import { beforeEach, describe, expect, it } from "vitest";

import {
  CHAVE_ESTADO,
  concluir,
  estadoInicial,
  guardarEstado,
  lerEstado,
  lerPerfil,
  podePular,
  podeVoltar,
} from "./estado";

beforeEach(() => localStorage.clear());

describe("ONB-04 · retomar onde parou", () => {
  it("guarda e lê o estado na mesma tela", () => {
    const e = guardarEstado({ ...estadoInicial(), tela: 4, dpp: "2027-02-02" });
    expect(lerEstado()?.tela).toBe(4);
    expect(lerEstado()?.dpp).toBe("2027-02-02");
    expect(e.tela).toBe(4);
  });

  it("recomeça depois de 7 dias parado", () => {
    const agora = Date.now();
    guardarEstado({ ...estadoInicial(agora), tela: 5 }, agora);
    expect(lerEstado(agora + 6 * 86_400_000)).not.toBeNull();
    expect(lerEstado(agora + 8 * 86_400_000)).toBeNull();
    expect(localStorage.getItem(CHAVE_ESTADO)).toBeNull();
  });
});

describe("ONB-08 · voltar", () => {
  it("nunca da tela 1, nem da 3 para a 2 depois de gravar a DPP", () => {
    expect(podeVoltar({ ...estadoInicial(), tela: 1 })).toBe(false);
    expect(podeVoltar({ ...estadoInicial(), tela: 2 })).toBe(true);
    expect(podeVoltar({ ...estadoInicial(), tela: 3, dpp: "2027-02-02" })).toBe(false);
    expect(podeVoltar({ ...estadoInicial(), tela: 3, nascidoEm: "2026-08-01" })).toBe(false);
    expect(podeVoltar({ ...estadoInicial(), tela: 4, dpp: "2027-02-02" })).toBe(true);
  });
});

describe("telas puláveis", () => {
  it("só da 4 em diante", () => {
    expect([1, 2, 3].map(podePular)).toEqual([false, false, false]);
    expect([4, 5, 6, 7].map(podePular)).toEqual([true, true, true, true]);
  });
});

describe("concluir", () => {
  it("grava o perfil, limpa o rascunho e mantém sessão anônima (ONB-06)", () => {
    guardarEstado({ ...estadoInicial(), tela: 7, dpp: "2027-02-02", nome: "  Helena ", sintomas: ["enjoo"] });
    const p = concluir(lerEstado()!, true, "2026-09-30");
    expect(p.nome).toBe("Helena");
    expect(p.modo).toBe("gestacao");
    expect(p.sintomasHoje).toEqual({ data: "2026-09-30", ids: ["enjoo"] });
    expect(p.anonima).toBe(true);
    expect(lerEstado()).toBeNull();
    expect(lerPerfil()?.dpp).toBe("2027-02-02");
  });

  it("ONB-01: já com o bebê nasce em modo bebê", () => {
    const p = concluir({ ...estadoInicial(), tela: 7, momento: "bebe", nascidoEm: "2026-08-01" }, true, "2026-09-30");
    expect(p.modo).toBe("bebe");
    expect(p.nascidoEm).toBe("2026-08-01");
  });
});
