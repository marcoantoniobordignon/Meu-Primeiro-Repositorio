export type ResultadoCompartilhar = "compartilhado" | "copiado" | "cancelado" | "falhou";

/** Web Share API com texto; sem suporte, copia (funcionalidade 02 e 04 RN-09). */
export async function compartilharTexto(texto: string, titulo?: string): Promise<ResultadoCompartilhar> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ text: texto, ...(titulo ? { title: titulo } : {}) });
      return "compartilhado";
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return "cancelado";
    }
  }
  try {
    await navigator.clipboard.writeText(texto);
    return "copiado";
  } catch {
    return "falhou";
  }
}

/**
 * Compartilha um arquivo (Web Share API nível 2); sem suporte, baixa (funcionalidade 05 RN-09).
 * Devolve "copiado" no sentido de "salvo no aparelho" quando cai no download.
 */
export async function compartilharArquivo(arquivo: File): Promise<ResultadoCompartilhar> {
  const nav = typeof navigator === "undefined" ? undefined : navigator;
  if (nav?.canShare?.({ files: [arquivo] }) && typeof nav.share === "function") {
    try {
      await nav.share({ files: [arquivo] });
      return "compartilhado";
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return "cancelado";
    }
  }
  try {
    const url = URL.createObjectURL(arquivo);
    const a = document.createElement("a");
    a.href = url;
    a.download = arquivo.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return "copiado";
  } catch {
    return "falhou";
  }
}
