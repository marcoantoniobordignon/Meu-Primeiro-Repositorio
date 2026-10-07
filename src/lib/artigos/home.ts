import type { CardDaTabela, EstadoCard } from "@dominio/trimestre.ts";

/**
 * Funcionalidade 11 RN-02: o que cada feature conta para a home (só números e flags), e o estado de
 * cada card a partir disso. Puro, para testar sem montar a tela.
 */
export interface DadosDaHome {
  /** Exames a marcar: com permissão (o parceiro não vê exames), quantos estão em "Agora" e quantos existem. */
  exames: { pode: boolean; agora: number; total: number };
  medicamentos: { ativos: number; dosesHoje: number; tomadasHoje: number };
  /** Algum marco do diário aberto para responder; quantas entradas o diário já tem. */
  marco: { aberto: boolean; entradas: number };
  fotoDaSemana: boolean;
  consulta: { pode: boolean; tipo: "nenhuma" | "proxima" | "iminente" | "como_foi" };
  /** Etapas concluídas do plano (de 5); null = plano ainda não começou. */
  planoEtapas: number | null;
  mala: { feitos: number; total: number };
  artigo: { existe: boolean; naoLidos: number };
  direitos: boolean;
  /**
   * Funcionalidade 16 RN-03: um direito que entrou na fase nesta semana conta como pendente (+10). Sem isso, na
   * semana 28 a tabela da spec 11 deixaria o card fora dos 6, e a spec 16 pede que a home sugira o acompanhante.
   */
  direitoNovo?: boolean;
  /** Cards de features que este papel não vê (avó e cuidador não veem medicamentos, exames, plano...). */
  semPermissao?: CardDaTabela[];
}

export function estadosDosCards(d: DadosDaHome): Record<CardDaTabela, EstadoCard> {
  const estados: Record<CardDaTabela, EstadoCard> = {
    resumo: "normal",
    exames: !d.exames.pode ? "oculto" : d.exames.total === 0 ? "vazio" : d.exames.agora > 0 ? "pendente" : "normal",
    medicamentos: d.medicamentos.ativos === 0 ? "vazio" : d.medicamentos.dosesHoje === 0 ? "normal" : d.medicamentos.tomadasHoje >= d.medicamentos.dosesHoje ? "feito" : "pendente",
    marco: d.marco.aberto ? "pendente" : d.marco.entradas === 0 ? "vazio" : "normal",
    foto: d.fotoDaSemana ? "feito" : "pendente",
    consulta: !d.consulta.pode ? "oculto" : d.consulta.tipo === "nenhuma" ? "vazio" : d.consulta.tipo === "proxima" ? "normal" : "pendente",
    plano_parto: d.planoEtapas !== null && d.planoEtapas >= 5 ? "feito" : "pendente",
    mala: d.mala.total > 0 && d.mala.feitos >= d.mala.total ? "feito" : "pendente",
    // RN-08: sem artigo para a semana nem para o trimestre, o card some.
    artigo: !d.artigo.existe ? "oculto" : d.artigo.naoLidos > 0 ? "pendente" : "feito",
    faq: "normal",
    direitos: !d.direitos ? "oculto" : d.direitoNovo ? "pendente" : "normal",
    // A funcionalidade de nomes ainda não existe: o card fica de fora até ela ter spec.
    nomes: "oculto",
  };
  for (const c of d.semPermissao ?? []) estados[c] = "oculto";
  return estados;
}
