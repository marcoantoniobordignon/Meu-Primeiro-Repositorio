/// <reference lib="webworker" />
import { gerarMalhaBebe, type BuffersMalha } from "./malha";

/**
 * Gera a malha fora da thread principal: a tela de carregamento continua
 * fluida enquanto o marching cubes roda (até ~1 s num celular intermediário).
 * Devolve só os buffers; o esqueleto é remontado no cliente (é barato).
 */
export interface PedidoMalha {
  resolucao: number;
}

self.onmessage = (e: MessageEvent<PedidoMalha>) => {
  const m = gerarMalhaBebe(e.data.resolucao);
  const g = m.geometria;
  const resposta: BuffersMalha = {
    posicoes: g.getAttribute("position").array as Float32Array,
    normais: g.getAttribute("normal").array as Float32Array,
    indices: new Uint32Array(g.getIndex()!.array),
    skinIndex: g.getAttribute("skinIndex").array as Uint16Array,
    skinWeight: g.getAttribute("skinWeight").array as Float32Array,
    espessura: g.getAttribute("espessura").array as Float32Array,
  };
  self.postMessage(resposta, [resposta.posicoes.buffer, resposta.normais.buffer, resposta.indices.buffer, resposta.skinIndex.buffer, resposta.skinWeight.buffer, resposta.espessura.buffer]);
};
