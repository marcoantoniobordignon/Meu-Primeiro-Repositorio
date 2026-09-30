import type { Bebe, RegistroBebe } from "@/lib/dados/colecoes";
import { paraISO } from "@/lib/dates";

/** Tabela de referência (spec 10): semanas de idade → minutos de vigília min/max. Precisa de revisão clínica. */
export const janelasPorIdade: { ate: number; min: number; max: number }[] = [
  { ate: 5, min: 35, max: 60 },
  { ate: 11, min: 60, max: 90 },
  { ate: 17, min: 75, max: 120 },
  { ate: 25, min: 90, max: 150 },
  { ate: 34, min: 120, max: 180 },
  { ate: 51, min: 150, max: 240 },
  { ate: Infinity, min: 180, max: 300 },
];

const MARGEM = 12;

export type EstadoPrevisao = "sem_dados" | "antes" | "na_janela" | "passou" | "dormindo";

export interface Previsao {
  estado: EstadoPrevisao;
  base: "tabela" | "mediana";
  /** Início e fim da janela provável (ms epoch). */
  janelaInicio?: number;
  janelaFim?: number;
  /** Último despertar. */
  acordouEm?: string;
  /** Minutos de vigília da janela (centro). */
  vigiliaMin?: number;
  /** Minutos dormindo, no estado 'dormindo'. */
  dormindoHa?: number;
}

/** SON-02: idade em semanas, corrigida se prematuro. */
export function semanasParaJanela(bebe: Pick<Bebe, "nascido_em" | "prematuro_semanas">, agora: Date): number {
  const dias = (agora.getTime() - new Date(bebe.nascido_em).getTime()) / 86_400_000;
  const ajuste = bebe.prematuro_semanas ? Math.max(0, 40 - bebe.prematuro_semanas) * 7 : 0;
  return Math.max(0, Math.floor((dias - ajuste) / 7));
}

export function faixaDaTabela(semanas: number): { min: number; max: number } {
  const f = janelasPorIdade.find((x) => semanas <= x.ate) ?? janelasPorIdade[janelasPorIdade.length - 1]!;
  return { min: f.min, max: f.max };
}

function mediana(v: number[]): number {
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/**
 * Vigílias dos últimos 7 dias: intervalo entre o fim de um sono e o início do
 * seguinte. Marca a primeira do dia (SON-04).
 */
export function vigilias(sonos: RegistroBebe[], agora: Date): { minutos: number; primeiraDoDia: boolean }[] {
  const limite = agora.getTime() - 7 * 86_400_000;
  const ordenados = sonos
    .filter((s) => s.tipo === "sono" && s.fim && new Date(s.fim).getTime() >= limite)
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
  const saida: { minutos: number; primeiraDoDia: boolean }[] = [];
  for (let i = 0; i < ordenados.length - 1; i++) {
    const fim = new Date(ordenados[i]!.fim!);
    const prox = new Date(ordenados[i + 1]!.inicio);
    const minutos = (prox.getTime() - fim.getTime()) / 60_000;
    if (minutos <= 0 || minutos > 12 * 60) continue;
    const primeiraDoDia = paraISO(fim) !== paraISO(new Date(ordenados[i]!.inicio)) || fim.getHours() < 9;
    saida.push({ minutos, primeiraDoDia });
  }
  return saida;
}

/**
 * SON-01..06, SON-09: função pura. Entrada: registros de sono do bebê, o bebê e o agora.
 */
export function preverSoneca(registros: RegistroBebe[], bebe: Pick<Bebe, "nascido_em" | "prematuro_semanas">, agora: Date = new Date()): Previsao {
  const sonos = registros.filter((r) => r.tipo === "sono");
  const emAndamento = sonos.find((s) => s.fim === null);
  if (emAndamento) {
    return { estado: "dormindo", base: "tabela", dormindoHa: Math.floor((agora.getTime() - new Date(emAndamento.inicio).getTime()) / 60_000) };
  }

  const ultimo = sonos.filter((s) => s.fim).sort((a, b) => b.fim!.localeCompare(a.fim!))[0];
  if (!ultimo || agora.getTime() - new Date(ultimo.fim!).getTime() > 24 * 3_600_000) {
    return { estado: "sem_dados", base: "tabela" };
  }

  const faixa = faixaDaTabela(semanasParaJanela(bebe, agora));
  const acordou = new Date(ultimo.fim!);
  const todas = vigilias(sonos, agora);
  // SON-04: a primeira vigília do dia usa a mediana das primeiras.
  const ehPrimeiraDoDia = paraISO(acordou) !== paraISO(new Date(ultimo.inicio)) || acordou.getHours() < 9;
  const amostra = ehPrimeiraDoDia ? todas.filter((v) => v.primeiraDoDia) : todas;
  const usar = amostra.length >= 3 && todas.length >= 5 ? amostra : todas;

  let centro: number;
  let base: Previsao["base"];
  if (todas.length >= 5) {
    centro = Math.min(faixa.max, Math.max(faixa.min, mediana(usar.map((v) => v.minutos))));
    base = "mediana";
  } else {
    centro = (faixa.min + faixa.max) / 2;
    base = "tabela";
  }
  const janelaInicio = acordou.getTime() + (centro - MARGEM) * 60_000;
  const janelaFim = acordou.getTime() + (centro + MARGEM) * 60_000;
  const t = agora.getTime();
  const estado: EstadoPrevisao = t < janelaInicio ? "antes" : t <= janelaFim ? "na_janela" : "passou";
  return { estado, base, janelaInicio, janelaFim, acordouEm: ultimo.fim!, vigiliaMin: Math.round(centro) };
}

/** SON-08: aviso só se ligado, sem sono em andamento, e nunca entre 22h e 6h. */
export function podeAvisar(ligado: boolean, previsao: Previsao, agora: Date): boolean {
  if (!ligado || previsao.estado !== "antes" || !previsao.janelaInicio) return false;
  const h = agora.getHours();
  if (h >= 22 || h < 6) return false;
  const faltam = (previsao.janelaInicio - agora.getTime()) / 60_000;
  return faltam <= 10 && faltam > 0;
}

/** Resumo dos últimos 7 dias para /bebe/sono: minutos de soneca (6h–20h) e noite por dia. */
export function resumoSono7Dias(sonos: RegistroBebe[], agora: Date = new Date()): { dia: string; sonecaMin: number; noiteMin: number }[] {
  const dias: { dia: string; sonecaMin: number; noiteMin: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(agora);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const inicioDia = d.getTime();
    const fimDia = inicioDia + 86_400_000;
    let sonecaMin = 0;
    let noiteMin = 0;
    for (const s of sonos) {
      if (s.tipo !== "sono") continue;
      const ini = Math.max(inicioDia, new Date(s.inicio).getTime());
      const fim = Math.min(fimDia, s.fim ? new Date(s.fim).getTime() : agora.getTime());
      if (fim <= ini) continue;
      // Divide em fatias de 30 min para classificar soneca (6h–20h) ou noite.
      for (let t = ini; t < fim; t += 30 * 60_000) {
        const fatia = Math.min(30, (fim - t) / 60_000);
        const h = new Date(t).getHours();
        if (h >= 6 && h < 20) sonecaMin += fatia;
        else noiteMin += fatia;
      }
    }
    dias.push({ dia: paraISO(d), sonecaMin: Math.round(sonecaMin), noiteMin: Math.round(noiteMin) });
  }
  return dias;
}
