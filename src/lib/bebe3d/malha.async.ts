import { gerarMalhaBebe, malhaDeBuffers, type BuffersMalha, type MalhaBebe } from "./malha";

/**
 * Gera a malha no Web Worker quando dá; cai na thread principal se o worker
 * falhar (navegador antigo ou bundler sem suporte). Fica num módulo próprio
 * para o worker e a malha não dependerem um do outro em círculo.
 */
export function gerarMalhaBebeAsync(resolucao: number): Promise<MalhaBebe> {
  if (typeof Worker === "undefined") return Promise.resolve(gerarMalhaBebe(resolucao));
  return new Promise((resolve) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL("./malha.worker.ts", import.meta.url));
    } catch {
      resolve(gerarMalhaBebe(resolucao));
      return;
    }
    worker.onmessage = (e: MessageEvent<BuffersMalha>) => {
      resolve(malhaDeBuffers(e.data));
      worker.terminate();
    };
    worker.onerror = () => {
      resolve(gerarMalhaBebe(resolucao));
      worker.terminate();
    };
    worker.postMessage({ resolucao });
  });
}
