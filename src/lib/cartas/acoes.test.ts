import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const esquecidos: string[] = [];
vi.mock("@/lib/supabase/client", () => ({ supabaseConfigurado: () => true, supabase: async () => ({}), chamarRpc: (...a: unknown[]) => rpc(...a) }));
vi.mock("@/lib/familia/servidor", () => ({ temServidor: () => true }));
vi.mock("@/lib/offline/sync", () => ({ sincronizar: async () => undefined }));
vi.mock("@/lib/offline/outbox", () => ({ pendentes: async () => [] }));
vi.mock("@/lib/familia/useFamilia", () => ({ meuId: () => "mae-1" }));
vi.mock("@/lib/arquivos/arquivos", () => ({
  algumPendente: async () => false,
  esquecerArquivoLocal: async (c: string | null) => void (c && esquecidos.push(c)),
  esquecerPastaLocal: async () => 0,
  extensaoDoMime: () => "webm",
  guardarArquivo: async () => undefined,
  lerArquivo: async () => null,
}));

import { cartas } from "@/lib/dados/colecoes";
import { aoEscrever } from "@/lib/dados/colecao";

import { ErroCarta, lacrar, salvarRascunho } from "./acoes";

describe("lacrar no aparelho (RN-03)", () => {
  beforeEach(() => {
    localStorage.clear();
    rpc.mockReset();
    esquecidos.length = 0;
  });

  it("critério: lacrada, só título e data ficam também no aparelho (texto, áudio e foto saem)", async () => {
    const c = await salvarRascunho({ title: "Para você", body: "Te espero com amor.", open_rule: "first_birthday", custom_open_on: null, delivery_email: "", audio: { blob: new Blob(["x"], { type: "audio/webm" }), segundos: 30 } });
    rpc.mockResolvedValue({ data: "2028-03-08", error: null });
    const escritas: string[] = [];
    const parar = aoEscrever((chave) => escritas.push(chave));
    expect(await lacrar(c.id)).toBe("2028-03-08");
    parar();
    expect(rpc).toHaveBeenCalledWith({}, "lacrar_carta", { p_id: c.id, p_atualizado_em: c.atualizado_em });
    const local = cartas.listarTodos().find((x) => x.id === c.id)!;
    expect(local).toMatchObject({ status: "sealed", open_on: "2028-03-08", title: "Para você", body: null, audio_path: null, photo_path: null });
    expect(JSON.stringify(localStorage)).not.toContain("Te espero com amor.");
    expect(esquecidos).toEqual([c.audio_path]);
    // O lacre veio do servidor: nada volta para a fila.
    expect(escritas).toEqual([]);
  });

  it("recusa do banco vira motivo legível e nada muda no aparelho", async () => {
    const c = await salvarRascunho({ title: "Sem texto", body: "", open_rule: "first_birthday", custom_open_on: null, delivery_email: "" });
    rpc.mockResolvedValue({ data: null, error: { message: "sem_conteudo" } });
    await expect(lacrar(c.id)).rejects.toEqual(new ErroCarta("sem_conteudo"));
    expect(cartas.listarTodos().find((x) => x.id === c.id)!.status).toBe("draft");
  });

  it("rascunho de carta lacrada não se edita", async () => {
    const c = await salvarRascunho({ title: "A", body: "b", open_rule: "age_5", custom_open_on: null, delivery_email: "" });
    rpc.mockResolvedValue({ data: "2032-03-08", error: null });
    await lacrar(c.id);
    await expect(salvarRascunho({ id: c.id, title: "Mudei", body: "x", open_rule: "age_5", custom_open_on: null, delivery_email: "" })).rejects.toEqual(new ErroCarta("carta_lacrada"));
  });
});
