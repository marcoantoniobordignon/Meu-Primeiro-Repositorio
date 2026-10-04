/** Formatação de números e datas do painel, sempre em pt-BR. */

export function formatarNumero(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "–";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (Math.abs(n) >= 10_000) return `${(n / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return n.toLocaleString("pt-BR");
}

export function formatarPercentual(parte: number, total: number): string {
  if (!total) return "–";
  return `${Math.round((parte / total) * 100)}%`;
}

/** Variação entre dois períodos, com sinal. Null quando não dá para comparar. */
export function variacao(atual: number, anterior: number): number | null {
  if (!anterior) return null;
  return Math.round(((atual - anterior) / anterior) * 100);
}

export function formatarVariacao(v: number | null): string {
  if (v === null) return "";
  return `${v > 0 ? "+" : ""}${v}%`;
}

export function formatarDiaCurto(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return "–";
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

export function formatarRelativo(iso: string | null | undefined, agora: Date = new Date()): string {
  if (!iso) return "nunca";
  const min = Math.round((agora.getTime() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return d === 1 ? "ontem" : `há ${d} dias`;
  const m = Math.round(d / 30);
  return m === 1 ? "há 1 mês" : `há ${m} meses`;
}

export function formatarMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "–";
  return ms >= 1000 ? `${(ms / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s` : `${Math.round(ms)} ms`;
}

/** Soma de um campo numa série. */
export function somar<T>(lista: T[], campo: (x: T) => number): number {
  return lista.reduce((acc, x) => acc + campo(x), 0);
}

/** Ticks "redondos" para um eixo: 0, 5, 10… ou 0, 100, 200… */
export function ticksRedondos(maximo: number, quantidade = 4): number[] {
  if (maximo <= 0) return [0, 1];
  const bruto = maximo / quantidade;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const passos = [1, 2, 2.5, 5, 10].map((p) => p * potencia);
  const passo = passos.find((p) => p >= bruto) ?? passos[passos.length - 1]!;
  const ticks: number[] = [];
  for (let v = 0; v <= maximo + passo * 0.999; v += passo) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}
