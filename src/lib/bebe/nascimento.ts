import type { PosPartoCheckin } from "@/lib/dados/colecoes";
import { diasEntre, paraISO, somarDias, type DataISO } from "@/lib/dates";

/** VIR-04: futuro é rejeitado; mais de 12 meses no passado pede confirmação. */
export function validarNascimento(nascido: Date, agora: Date = new Date()): "ok" | "futuro" | "confirmar_antigo" {
  if (nascido.getTime() > agora.getTime() + 60_000) return "futuro";
  if (diasEntre(paraISO(nascido), paraISO(agora)) > 365) return "confirmar_antigo";
  return "ok";
}

/** VIR-05: se nasceu antes de DPP − 21 dias, sugere as semanas de gestação. */
export function semanasSeprematuro(nascido: DataISO, dpp: DataISO): number | null {
  if (diasEntre(nascido, dpp) <= 21) return null;
  const diasGestacao = 280 - diasEntre(nascido, dpp);
  return Math.max(20, Math.floor(diasGestacao / 7));
}

/** Semanas de gestação no nascimento (para o evento). */
export function semanasNoNascimento(nascido: DataISO, dpp: DataISO): number {
  return Math.max(0, Math.floor((280 - diasEntre(nascido, dpp)) / 7));
}

/** VIR-02: cortesia = nascimento + 7 dias, só sem plano ativo. */
export function cortesiaFim(nascidoEm: string, planoAtivo: boolean): string | null {
  if (planoAtivo) return null;
  return new Date(new Date(nascidoEm).getTime() + 7 * 86_400_000).toISOString();
}

export function emCortesia(cortesia: string | null | undefined, agora: Date = new Date()): boolean {
  return Boolean(cortesia && new Date(cortesia).getTime() > agora.getTime());
}

/** VIR-06: desfazer o nascimento só nas primeiras 24 h após registrar. */
export function podeDesfazer(registradoEm: string, agora: Date = new Date()): boolean {
  return agora.getTime() - new Date(registradoEm).getTime() <= 24 * 3_600_000;
}

/** VIR-07: card de check-in nas 6 primeiras semanas, 1 por dia. */
export function mostraCheckin(nascidoEm: string, checkins: PosPartoCheckin[], hoje: DataISO = paraISO(new Date())): boolean {
  const dias = diasEntre(nascidoEm.slice(0, 10), hoje);
  if (dias < 0 || dias > 42) return false;
  return !checkins.some((c) => c.data === hoje);
}

/**
 * VIR-07: humor 1 ou 2 por 3 dias seguidos, ou sangramento intenso, ou dor 3
 * (no check-in de hoje) mostra a orientação de falar com a equipe. Sem diagnóstico.
 */
export function sinalDeAlerta(checkins: PosPartoCheckin[], hoje: DataISO): boolean {
  const deHoje = checkins.find((c) => c.data === hoje);
  if (deHoje && (deHoje.dor === 3 || deHoje.sangramento === "intenso")) return true;
  for (let i = 0; i < 3; i++) {
    const d = somarDias(hoje, -i);
    const c = checkins.find((x) => x.data === d);
    if (!c || c.humor > 2) return false;
  }
  return true;
}
