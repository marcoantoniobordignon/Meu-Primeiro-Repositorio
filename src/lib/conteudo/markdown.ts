/**
 * Renderizador mínimo do markdown do banco: parágrafos, **negrito**, *itálico*
 * e listas com "- ". Sem HTML cru, sem links: o conteúdo é nosso e controlado.
 */
export type Trecho = { tipo: "texto"; valor: string } | { tipo: "negrito"; valor: string } | { tipo: "italico"; valor: string };
export type Bloco = { tipo: "paragrafo"; trechos: Trecho[] } | { tipo: "lista"; itens: Trecho[][]; ordenada?: boolean } | { tipo: "titulo"; trechos: Trecho[] };

export function trechos(linha: string): Trecho[] {
  const saida: Trecho[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let ultimo = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(linha))) {
    if (m.index > ultimo) saida.push({ tipo: "texto", valor: linha.slice(ultimo, m.index) });
    if (m[1] !== undefined) saida.push({ tipo: "negrito", valor: m[1] });
    else if (m[2] !== undefined) saida.push({ tipo: "italico", valor: m[2] });
    ultimo = m.index + m[0].length;
  }
  if (ultimo < linha.length) saida.push({ tipo: "texto", valor: linha.slice(ultimo) });
  return saida;
}

/** `titulos`: "## " vira subtítulo e "1. " lista numerada (artigos, funcionalidade 11); nas stories fica desligado. */
export function blocos(md: string, opcoes: { titulos?: boolean } = {}): Bloco[] {
  const saida: Bloco[] = [];
  for (const bruto of md.split(/\n\s*\n/)) {
    const par = bruto.trim();
    if (!par) continue;
    let linhas = par.split("\n").map((l) => l.trim());
    if (opcoes.titulos && /^#{2,3} /.test(linhas[0]!)) {
      saida.push({ tipo: "titulo", trechos: trechos(linhas[0]!.replace(/^#{2,3} /, "")) });
      linhas = linhas.slice(1);
      if (!linhas.length) continue;
    }
    if (opcoes.titulos && linhas.every((l) => /^\d+\. /.test(l))) {
      saida.push({ tipo: "lista", itens: linhas.map((l) => trechos(l.replace(/^\d+\. /, ""))), ordenada: true });
    } else if (linhas.every((l) => l.startsWith("- "))) {
      saida.push({ tipo: "lista", itens: linhas.map((l) => trechos(l.slice(2))) });
    } else {
      saida.push({ tipo: "paragrafo", trechos: trechos(linhas.join(" ")) });
    }
  }
  return saida;
}
