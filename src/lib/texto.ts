/** Minúsculas, sem acento, sem pontuação, espaços simples. Para busca e comparação de nomes. */
export function normalizarTexto(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Corta no limite de caracteres sem deixar espaço sobrando. */
export function limitar(t: string, max: number): string {
  return t.trim().slice(0, max).trim();
}
