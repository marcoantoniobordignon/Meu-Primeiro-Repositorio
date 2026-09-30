import type { Convite, Membro, Papel } from "@/lib/dados/colecoes";

export const nomePapel: Record<Papel, string> = {
  mae: "Mãe",
  parceiro: "Parceiro(a)",
  avo: "Avó/Avô",
  cuidador: "Cuidador(a)",
};

export interface Permissoes {
  verSintomas: boolean;
  verCheckinPosParto: boolean;
  verAssinatura: boolean;
  registrar: boolean;
  apagarRegistrosDeOutros: boolean;
  gerarConvite: boolean;
  removerMembro: boolean;
  /** Papéis que este papel pode convidar (CUI-01). */
  podeConvidar: Exclude<Papel, "mae">[];
}

/** CUI-01/04: permissões por papel. Parceiro vê sintomas por padrão (decisão da spec). */
export function permissoes(papel: Papel): Permissoes {
  switch (papel) {
    case "mae":
      return { verSintomas: true, verCheckinPosParto: true, verAssinatura: true, registrar: true, apagarRegistrosDeOutros: true, gerarConvite: true, removerMembro: true, podeConvidar: ["parceiro", "avo", "cuidador"] };
    case "parceiro":
      return { verSintomas: true, verCheckinPosParto: true, verAssinatura: true, registrar: true, apagarRegistrosDeOutros: true, gerarConvite: true, removerMembro: false, podeConvidar: ["cuidador"] };
    default:
      return { verSintomas: false, verCheckinPosParto: false, verAssinatura: false, registrar: true, apagarRegistrosDeOutros: false, gerarConvite: false, removerMembro: false, podeConvidar: [] };
  }
}

export const CONVITE_VALIDADE_MS = 72 * 3_600_000;

export function gerarToken(): string {
  const alfabeto = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(32);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) crypto.getRandomValues(bytes);
  else for (let i = 0; i < 32; i++) bytes[i] = Math.floor(Math.random() * 256);
  return [...bytes].map((b) => alfabeto[b % alfabeto.length]).join("");
}

export type EstadoConvite = "valido" | "expirado" | "usado" | "inexistente";

/** CUI-02: 72 h e uma vez só. */
export function estadoDoConvite(c: Convite | undefined, agora: Date = new Date()): EstadoConvite {
  if (!c) return "inexistente";
  if (c.usado_em) return "usado";
  if (new Date(c.expira_em).getTime() < agora.getTime()) return "expirado";
  return "valido";
}

/** CUI-07: inicial do autor quando não é quem está olhando. */
export function inicialDoAutor(criadoPor: string, meuId: string, lista: Membro[]): string | null {
  if (criadoPor === meuId) return null;
  const m = lista.find((x) => x.profile_id === criadoPor);
  return (m?.nome.trim()[0] ?? "?").toUpperCase();
}

export function nomeDoAutor(criadoPor: string, meuId: string, lista: Membro[]): string {
  if (criadoPor === meuId) return "você";
  return lista.find((x) => x.profile_id === criadoPor)?.nome ?? "alguém";
}
