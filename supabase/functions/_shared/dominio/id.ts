/**
 * UUID determinístico a partir de uma chave ("dose:<med>:<instante>").
 * O app e o servidor geram o mesmo id para a mesma coisa, então gerar duas vezes
 * (dois aparelhos, ou aparelho e job do servidor) converge num registro só (ARQ-02).
 * Não é criptográfico: só precisa espalhar bem e ser estável.
 */
function misturar128(chave: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < chave.length; i++) {
    const k = chave.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

const hex8 = (n: number) => n.toString(16).padStart(8, "0");

export function idDeterministico(chave: string): string {
  // Duas passadas com sal diferente para não depender só de 4 palavras correlacionadas.
  const [a, b] = misturar128(chave);
  const [c, d] = misturar128(`ninho|${chave}`);
  const h = hex8(a) + hex8(b) + hex8(c) + hex8(d);
  // Versão 8 (RFC 9562, "custom") e variante 10xx: um UUID válido para o Postgres.
  const versao = "8" + h.slice(13, 16);
  const variante = ((parseInt(h[16]!, 16) & 0x3) | 0x8).toString(16) + h.slice(17, 20);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${versao}-${variante}-${h.slice(20, 32)}`;
}
