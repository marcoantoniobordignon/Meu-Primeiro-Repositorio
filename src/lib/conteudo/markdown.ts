/**
 * Renderizador mínimo do markdown do banco: parágrafos, **negrito**, *itálico*
 * e listas com "- ". Sem HTML cru, sem links: o conteúdo é nosso e controlado.
 */
export type Trecho = { tipo: "texto"; valor: string } | { tipo: "negrito"; valor: string } | { tipo: "italico"; valor: string };
export type Bloco = { tipo: "paragrafo"; trechos: Trecho[] } | { tipo: "lista"; itens: Trecho[][] };

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

export function blocos(md: string): Bloco[] {
  const saida: Bloco[] = [];
  for (const bruto of md.split(/\n\s*\n/)) {
    const par = bruto.trim();
    if (!par) continue;
    const linhas = par.split("\n").map((l) => l.trim());
    if (linhas.every((l) => l.startsWith("- "))) {
      saida.push({ tipo: "lista", itens: linhas.map((l) => trechos(l.slice(2))) });
    } else {
      saida.push({ tipo: "paragrafo", trechos: trechos(linhas.join(" ")) });
    }
  }
  return saida;
}
