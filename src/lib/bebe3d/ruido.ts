/**
 * Ruído 1D suave e determinístico (value noise com interpolação cúbica),
 * para deriva orgânica, soluços e variação de tempo entre movimentos.
 */
function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function ruido1d(t: number, semente = 0): number {
  const i = Math.floor(t);
  const f = t - i;
  const u = f * f * (3 - 2 * f);
  const a = hash(i + semente * 57);
  const b = hash(i + 1 + semente * 57);
  return (a + (b - a) * u) * 2 - 1;
}

/** Soma de oitavas: mais "vivo" que um seno, sem repetição perceptível. */
export function fbm1d(t: number, semente = 0, oitavas = 3): number {
  let soma = 0;
  let amp = 0.6;
  let freq = 1;
  for (let o = 0; o < oitavas; o++) {
    soma += ruido1d(t * freq, semente + o * 11) * amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return soma;
}

/** Gerador determinístico para escolhas de movimento (mesma semente, mesma sequência). */
export function prng(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
