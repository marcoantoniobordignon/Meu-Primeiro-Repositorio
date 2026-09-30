import type { Contracao, SessaoChutes } from "@/lib/dados/colecoes";

export const CHUTES_MAXIMO = 10;
export const CHUTES_TEMPO_MAXIMO_MS = 2 * 60 * 60_000;

/** HG-07: encerra sozinho com 10 chutes ou 2 h. */
export function sessaoDeveEncerrar(s: SessaoChutes, agora: Date = new Date()): boolean {
  if (s.fim) return false;
  if (s.total >= CHUTES_MAXIMO) return true;
  return agora.getTime() - new Date(s.inicio).getTime() >= CHUTES_TEMPO_MAXIMO_MS;
}

export function sessaoAtiva(todas: SessaoChutes[]): SessaoChutes | undefined {
  return todas.find((s) => !s.fim);
}

export interface ContracaoResumo {
  id: string;
  inicio: string;
  duracaoS: number | null;
  /** Segundos desde o início da anterior; null na primeira. */
  intervaloS: number | null;
}

/** Últimas `n` contrações, mais recente primeiro, com duração e intervalo. */
export function resumirContracoes(todas: Contracao[], n = 6, agora: Date = new Date()): ContracaoResumo[] {
  const ordenadas = [...todas].sort((a, b) => a.inicio.localeCompare(b.inicio));
  const saida: ContracaoResumo[] = ordenadas.map((c, i) => {
    const ini = new Date(c.inicio).getTime();
    const fim = c.fim ? new Date(c.fim).getTime() : null;
    const anterior = ordenadas[i - 1];
    return {
      id: c.id,
      inicio: c.inicio,
      duracaoS: fim ? (fim - ini) / 1000 : (agora.getTime() - ini) / 1000,
      intervaloS: anterior ? (ini - new Date(anterior.inicio).getTime()) / 1000 : null,
    };
  });
  return saida.slice(-n).reverse();
}

export function contracaoEmAndamento(todas: Contracao[]): Contracao | undefined {
  return todas.find((c) => !c.fim);
}

/**
 * HG-08: 6 contrações na última hora, todas com 45 s ou mais e intervalo
 * de 5 min ou menos entre elas. Só sinaliza um padrão; não diagnostica.
 */
export function padraoDeTrabalhoDeParto(todas: Contracao[], agora: Date = new Date()): boolean {
  const limite = agora.getTime() - 60 * 60_000;
  const recentes = todas
    .filter((c) => c.fim && new Date(c.inicio).getTime() >= limite)
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
  if (recentes.length < 6) return false;
  const ultimas = recentes.slice(-6);
  for (let i = 0; i < ultimas.length; i++) {
    const c = ultimas[i]!;
    const dur = (new Date(c.fim!).getTime() - new Date(c.inicio).getTime()) / 1000;
    if (dur < 45) return false;
    if (i > 0) {
      const intervalo = (new Date(c.inicio).getTime() - new Date(ultimas[i - 1]!.inicio).getTime()) / 1000;
      if (intervalo > 5 * 60) return false;
    }
  }
  return true;
}
