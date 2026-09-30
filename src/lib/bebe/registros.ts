import type { DadosMamada, RegistroBebe, TipoRegistroBebe } from "@/lib/dados/colecoes";
import { paraISO, type DataISO } from "@/lib/dates";

export type TipoTile = Exclude<TipoRegistroBebe, "outro">;
export const tiposTile: TipoTile[] = ["sono", "mamada", "fralda", "banho"];

export function doBebe(todos: RegistroBebe[], bebeId: string): RegistroBebe[] {
  return todos.filter((r) => r.bebe_id === bebeId);
}

/** BEB-01: registro mais recente de cada tipo (pelo início). */
export function ultimoDoTipo(todos: RegistroBebe[], bebeId: string, tipo: TipoRegistroBebe): RegistroBebe | undefined {
  return doBebe(todos, bebeId)
    .filter((r) => r.tipo === tipo)
    .sort((a, b) => b.inicio.localeCompare(a.inicio))[0];
}

/** BEB-02/03: o sono em andamento do bebê (fim null), se houver. */
export function sonoEmAndamento(todos: RegistroBebe[], bebeId: string): RegistroBebe | undefined {
  return doBebe(todos, bebeId).find((r) => r.tipo === "sono" && r.fim === null);
}

/** Mamada no peito com timer correndo. */
export function mamadaEmAndamento(todos: RegistroBebe[], bebeId: string): RegistroBebe | undefined {
  return doBebe(todos, bebeId).find((r) => r.tipo === "mamada" && r.fim === null);
}

/** Momento de referência do tile: fim (ou início se pontual). */
export function referenciaDoTile(r: RegistroBebe): string {
  return r.fim ?? r.inicio;
}

/** BEB-05: os 3 volumes mais usados na mamadeira nos últimos 7 dias. */
export function volumesFrequentes(todos: RegistroBebe[], bebeId: string, hoje: DataISO = paraISO(new Date())): number[] {
  const limite = new Date(`${hoje}T00:00:00`);
  limite.setDate(limite.getDate() - 7);
  const contagem = new Map<number, number>();
  for (const r of doBebe(todos, bebeId)) {
    if (r.tipo !== "mamada" || new Date(r.inicio) < limite) continue;
    const ml = (r.dados as DadosMamada).ml;
    if (ml) contagem.set(ml, (contagem.get(ml) ?? 0) + 1);
  }
  return [...contagem.entries()]
    .sort((a, b) => b[1] - a[1] || b[0] - a[0])
    .slice(0, 3)
    .map(([ml]) => ml);
}

/** BEB-04: segundos acumulados de cada lado, incluindo o lado que está correndo. */
export function segundosPorLado(d: DadosMamada, agora: Date = new Date()): { E: number; D: number } {
  const base = { E: d.segundos_E ?? 0, D: d.segundos_D ?? 0 };
  if (d.lado_desde && (d.lado === "E" || d.lado === "D")) {
    base[d.lado] += (agora.getTime() - new Date(d.lado_desde).getTime()) / 1000;
  }
  return base;
}

/** BEB-04: trocar de lado pausa um e inicia o outro. */
export function trocarLado(d: DadosMamada, novoLado: "E" | "D", agora: Date = new Date()): DadosMamada {
  const acumulado = segundosPorLado(d, agora);
  return { ...d, segundos_E: acumulado.E, segundos_D: acumulado.D, lado: novoLado, lado_desde: agora.toISOString() };
}

/** BEB-04: encerrar grava lado 'ambos' quando os dois correram. */
export function encerrarPeito(d: DadosMamada, agora: Date = new Date()): DadosMamada {
  const acumulado = segundosPorLado(d, agora);
  const lado = acumulado.E > 0 && acumulado.D > 0 ? "ambos" : acumulado.E > 0 ? "E" : "D";
  return { tipo: "peito", lado, segundos_E: Math.round(acumulado.E), segundos_D: Math.round(acumulado.D), lado_desde: null };
}

/** BEB-06/07: início nas últimas 24 h e não no futuro. */
export function validarInicio(inicio: Date, agora: Date = new Date()): "ok" | "futuro" | "antigo" {
  if (inicio.getTime() > agora.getTime() + 60_000) return "futuro";
  if (agora.getTime() - inicio.getTime() > 24 * 3_600_000) return "antigo";
  return "ok";
}

/** Arredonda para o múltiplo de 5 minutos mais próximo (BEB-06). */
export function arredondar5min(d: Date): Date {
  const r = new Date(d);
  r.setSeconds(0, 0);
  r.setMinutes(Math.round(r.getMinutes() / 5) * 5);
  return r;
}

export interface BlocoDia {
  registro: RegistroBebe;
  /** 0–1440, minutos desde 0h local. */
  inicioMin: number;
  fimMin: number;
  emAndamento: boolean;
}

/** BEB-08: blocos do dia das 0h às 24h locais; sono em andamento vai até "agora". */
export function blocosDoDia(todos: RegistroBebe[], bebeId: string, dia: DataISO, agora: Date = new Date()): BlocoDia[] {
  const inicioDia = new Date(`${dia}T00:00:00`);
  const fimDia = new Date(inicioDia.getTime() + 24 * 3_600_000);
  const min = (d: Date) => Math.max(0, Math.min(1440, (d.getTime() - inicioDia.getTime()) / 60_000));
  return doBebe(todos, bebeId)
    .map((r) => {
      const ini = new Date(r.inicio);
      const fim = r.fim ? new Date(r.fim) : agora;
      if (fim < inicioDia || ini >= fimDia) return null;
      return { registro: r, inicioMin: min(ini), fimMin: Math.max(min(ini) + 1, min(fim)), emAndamento: r.fim === null };
    })
    .filter((b): b is BlocoDia => b !== null)
    .sort((a, b) => a.inicioMin - b.inicioMin);
}

/** Texto curto do detalhe do registro (lado, ml, conteúdo). */
export function detalheDoRegistro(r: RegistroBebe): string {
  if (r.tipo === "mamada") {
    const d = r.dados as DadosMamada;
    if (d.tipo === "peito") {
      const s = segundosPorLado(d);
      const partes = [s.E > 0 ? `E ${Math.round(s.E / 60)} min` : "", s.D > 0 ? `D ${Math.round(s.D / 60)} min` : ""].filter(Boolean);
      return partes.join(" · ") || "peito";
    }
    if (d.tipo === "bomba") return `bomba${d.ml ? ` · ${d.ml} ml` : ""}`;
    return `${d.tipo === "formula" ? "fórmula" : "mamadeira"}${d.ml ? ` · ${d.ml} ml` : ""}`;
  }
  if (r.tipo === "fralda") {
    const c = (r.dados as { conteudo: string }).conteudo;
    return c === "coco" ? "cocô" : c;
  }
  if (r.tipo === "sono" && r.fim) {
    const min = (new Date(r.fim).getTime() - new Date(r.inicio).getTime()) / 60_000;
    return `${Math.round(min)} min`;
  }
  if (r.tipo === "outro") return (r.dados as { texto: string }).texto;
  return "";
}
