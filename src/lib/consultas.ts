import type { Consulta } from "@/lib/dados/colecoes";

export const tiposConsulta: Record<Consulta["tipo"], string> = {
  pre_natal: "Pré-natal",
  ultrassom: "Ultrassom",
  exame: "Exame",
  outro: "Outro",
};

const H24 = 86_400_000;
const D3 = 3 * H24;

export type EstadoCardConsulta =
  | { tipo: "nenhuma" }
  | { tipo: "proxima"; consulta: Consulta; iminente: boolean }
  | { tipo: "passada"; consulta: Consulta };

/**
 * HG-05/06: a próxima não realizada; a partir de 24 h antes fica iminente.
 * Passada e não realizada aparece por 3 dias perguntando "Foi bem?".
 */
export function estadoDoCard(todas: Consulta[], agora: Date = new Date()): EstadoCardConsulta {
  const t = agora.getTime();
  const pendentes = todas.filter((c) => !c.realizada).sort((a, b) => a.data.localeCompare(b.data));

  const passada = pendentes.find((c) => {
    const d = new Date(c.data).getTime();
    return d < t && t - d <= D3;
  });
  if (passada) return { tipo: "passada", consulta: passada };

  const proxima = pendentes.find((c) => new Date(c.data).getTime() >= t);
  if (!proxima) return { tipo: "nenhuma" };
  return { tipo: "proxima", consulta: proxima, iminente: new Date(proxima.data).getTime() - t <= H24 };
}

/** Futuras primeiro (mais próxima no topo), depois passadas (mais recente no topo). */
export function ordenarParaLista(todas: Consulta[], agora: Date = new Date()): { futuras: Consulta[]; passadas: Consulta[] } {
  const t = agora.getTime();
  const futuras = todas.filter((c) => new Date(c.data).getTime() >= t).sort((a, b) => a.data.localeCompare(b.data));
  const passadas = todas.filter((c) => new Date(c.data).getTime() < t).sort((a, b) => b.data.localeCompare(a.data));
  return { futuras, passadas };
}
