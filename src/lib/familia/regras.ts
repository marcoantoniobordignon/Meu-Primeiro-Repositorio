import type { Convite, Membro, Papel } from "@/lib/dados/colecoes";

export const nomePapel: Record<Papel, string> = {
  mae: "Mãe",
  parceiro: "Parceiro(a)",
  avo: "Avó/Avô",
  cuidador: "Cuidador(a)",
};

/** Permissões que a gestante liga e desliga para o parceiro (funcionalidades 04 RN-10 e 05 RN-11). */
export interface PermissoesParceiro {
  agenda?: boolean;
  belly_photos?: boolean;
  /** Funcionalidades 10 e 12: plano de parto e listas (ler e marcar itens). */
  birth_plan?: boolean;
}

/** Padrões (funcionalidade 12): agenda e plano de parto ligados; fotos da barriga desligadas (spec 05 RN-11). */
export const PERMISSOES_PARCEIRO_PADRAO: Required<PermissoesParceiro> = { agenda: true, belly_photos: false, birth_plan: true };

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
  /** Funcionalidade 02 RN-14: só a gestante. */
  verMedicamentos: boolean;
  /** Funcionalidade 03: a lista de exames é da gestante (funcionalidade 12: o parceiro vê só os marcados, na agenda). */
  verExames: boolean;
  /** Funcionalidade 04 RN-10: data, local, profissional e pauta. */
  verAgenda: boolean;
  /** Funcionalidade 04: editar consultas, concluir, medidas e "Levar para a consulta". */
  gerirConsultas: boolean;
  /** Funcionalidade 04 RN-10: medidas e orientações; parceiro nunca. */
  verMedidas: boolean;
  /** Funcionalidade 05 RN-11. */
  verFotosBarriga: boolean;
  tirarFotosBarriga: boolean;
  /** Funcionalidade 06 RN-09: mãe e parceiro escrevem; cada um edita só o seu. */
  verDiario: boolean;
  /** Funcionalidade 01 RN-10: a gestante vê tudo; o parceiro, só o compartilhado. */
  verGaleria: boolean;
  /** Funcionalidade 10 RN-10: ler o plano e marcar/adicionar itens das listas (parceiro com `birth_plan`). */
  verPlanoParto: boolean;
  /** Funcionalidade 10 RN-10: preferências e contatos, só a gestante. */
  editarPlanoParto: boolean;
}

/** CUI-01/04: permissões por papel. Parceiro vê sintomas por padrão (decisão da spec). */
export function permissoes(papel: Papel, doParceiro: PermissoesParceiro = {}): Permissoes {
  const parc = { ...PERMISSOES_PARCEIRO_PADRAO, ...doParceiro };
  const semFuncionalidades = { verMedicamentos: false, verExames: false, verAgenda: false, gerirConsultas: false, verMedidas: false, verFotosBarriga: false, tirarFotosBarriga: false, verDiario: false, verGaleria: false, verPlanoParto: false, editarPlanoParto: false };
  switch (papel) {
    case "mae":
      return { verSintomas: true, verCheckinPosParto: true, verAssinatura: true, registrar: true, apagarRegistrosDeOutros: true, gerarConvite: true, removerMembro: true, podeConvidar: ["avo", "cuidador"], verMedicamentos: true, verExames: true, verAgenda: true, gerirConsultas: true, verMedidas: true, verFotosBarriga: true, tirarFotosBarriga: true, verDiario: true, verGaleria: true, verPlanoParto: true, editarPlanoParto: true };
    case "parceiro":
      return { verSintomas: true, verCheckinPosParto: true, verAssinatura: true, registrar: true, apagarRegistrosDeOutros: true, gerarConvite: true, removerMembro: false, podeConvidar: ["cuidador"], ...semFuncionalidades, verAgenda: parc.agenda, verFotosBarriga: parc.belly_photos, verDiario: true, verGaleria: true, verPlanoParto: parc.birth_plan };
    default:
      return { verSintomas: false, verCheckinPosParto: false, verAssinatura: false, registrar: true, apagarRegistrosDeOutros: false, gerarConvite: false, removerMembro: false, podeConvidar: [], ...semFuncionalidades };
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

/** Funcionalidade 12 RN-06: quem saiu continua na lista (apagado) para o "Escrito por {nome}". */
export function nomeDoAutor(criadoPor: string, meuId: string, lista: Membro[]): string {
  if (criadoPor === meuId) return "você";
  return lista.find((x) => x.profile_id === criadoPor)?.nome ?? "alguém";
}

/** Funcionalidade 12 RN-03: um parceiro ativo por gestação. */
export function parceiroAtivo(lista: Membro[]): Membro | undefined {
  return lista.find((m) => m.papel === "parceiro" && !m.apagado_em);
}
