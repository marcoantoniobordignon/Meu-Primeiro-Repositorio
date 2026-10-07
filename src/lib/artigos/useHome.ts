"use client";

import { estadoDoCard } from "@/lib/consultas";
import { useColecao } from "@/lib/dados/colecao";
import { appointments, bellyPhotos, birthChecklistItems, birthPlans, diaryEntries, diaryMilestoneStates, medicationDoses, medications, userExams } from "@/lib/dados/colecoes";
import { cardsDoDiario, situacoes } from "@/lib/diario/regras";
import { agruparPorSecao } from "@/lib/exames/regras";
import { useFamilia } from "@/lib/familia/useFamilia";
import { useAgora } from "@/lib/hooks/useAgora";
import { useFuso } from "@/lib/hooks/useFuso";
import { ativos, dosesDoDia } from "@/lib/medicamentos/regras";
import { semanaDaFoto } from "@dominio/barriga.ts";
import { LISTAS_MALAS, progressoDaLista, progressoDoPlano } from "@dominio/plano-parto.ts";
import { prefsCompletas } from "@dominio/prefs.ts";
import { dataNoFuso } from "@dominio/tempo.ts";
import { cardsDaHome, paraEstaSemana, temArtigoParaASemana, trimestreDaSemana, type CardDaTabela } from "@dominio/trimestre.ts";
import { oracaoDaSemana } from "@dominio/fe.ts";

import { estadosDosCards } from "./home";
import { useDireitos } from "@/lib/direitos/useDireitos";
import { paraEstaFase } from "@dominio/direitos.ts";
import { useArtigos } from "./useArtigos";
import { useFe } from "@/lib/fe/useFe";
import { useNomes } from "@/lib/nomes/useNomes";

/** RN-02: junta o que cada feature tem e devolve os cards da home em ordem, com o que cada um mostra. */
export function useHomeDoTrimestre(dpp: string, semana: number, prefs: Parameters<typeof prefsCompletas>[0], nomeDoBebe?: string | null) {
  const tz = useFuso();
  const agora = useAgora(60_000);
  const hoje = dataNoFuso(agora, tz);
  const { permissoes, meuId, papel } = useFamilia();
  const exames = useColecao(userExams);
  const meds = useColecao(medications);
  const doses = useColecao(medicationDoses);
  const entradas = useColecao(diaryEntries);
  const estadosMarcos = useColecao(diaryMilestoneStates);
  const fotos = useColecao(bellyPhotos);
  const consultas = useColecao(appointments);
  const planos = useColecao(birthPlans);
  const itens = useColecao(birthChecklistItems);
  const { artigos, lidos } = useArtigos();
  const fe = useFe();
  const nomes = useNomes();
  // Funcionalidade 17 RN-02/03: com o modo ligado, a oração da semana (min(semana, 40)) na posição 3.
  const oracao = fe.ligado ? (oracaoDaSemana(fe.oracoes, semana) ?? null) : null;

  const tri = trimestreDaSemana(semana);
  const semanaFoto = semanaDaFoto(dpp, hoje);
  const dosesHoje = dosesDoDia(doses, hoje, tz).filter((d) => d.scheduled_at);
  const consulta = estadoDoCard(consultas, agora, tz);
  const mala = LISTAS_MALAS.map((l) => progressoDaLista(itens, l)).reduce((a, p) => ({ feitos: a.feitos + p.feitos, total: a.total + p.total }), { feitos: 0, total: 0 });
  const semana3 = paraEstaSemana(artigos, lidos, semana);
  const marcos = cardsDoDiario(semana, prefsCompletas(prefs).faith_mode, situacoes(entradas, estadosMarcos, meuId), agora);
  // Funcionalidade 16 RN-03: "Direitos para esta fase" = até 2 cartões da semana, ainda não dispensados.
  const { cartoes } = useDireitos();
  const direitos = paraEstaFase(cartoes, semana, prefs?.rights_dismissed ?? []);
  const semPermissao: CardDaTabela[] = [
    ...(!permissoes.verMedicamentos ? (["medicamentos"] as const) : []),
    ...(!permissoes.verDiario ? (["marco"] as const) : []),
    ...(!permissoes.tirarFotosBarriga ? (["foto"] as const) : []),
    ...(!permissoes.verPlanoParto ? (["plano_parto", "mala"] as const) : []),
    // Funcionalidade 15: a votação de nomes é do casal.
    ...(papel !== "mae" && papel !== "parceiro" ? (["nomes"] as const) : []),
  ];

  const estados = estadosDosCards({
    exames: { pode: permissoes.verExames, agora: agruparPorSecao(exames, hoje).agora.length, total: exames.filter((e) => !e.apagado_em).length },
    medicamentos: { ativos: ativos(meds).length, dosesHoje: dosesHoje.length, tomadasHoje: dosesHoje.filter((d) => d.status === "taken").length },
    marco: { aberto: marcos.length > 0, entradas: entradas.filter((e) => !e.apagado_em).length },
    fotoDaSemana: semanaFoto !== null && fotos.some((f) => !f.apagado_em && f.gest_week === semanaFoto),
    consulta: { pode: permissoes.verAgenda, tipo: consulta.tipo === "proxima" ? (consulta.iminente ? "iminente" : "proxima") : consulta.tipo },
    planoEtapas: planos[0] ? progressoDoPlano(planos[0].completed_steps).feitas : null,
    mala,
    artigo: { existe: temArtigoParaASemana(artigos, semana), naoLidos: semana3.length },
    direitos: direitos.length > 0,
    direitoNovo: direitos.some((c) => c.week_from === semana),
    nomes: { votos: nomes.votos.length, matches: nomes.matches.length, escolhido: Boolean(nomeDoBebe) },
    semPermissao,
  });

  return {
    tri,
    cards: cardsDaHome(tri, estados, undefined, { oracao: Boolean(oracao) }),
    detalhes: {
      exames: agruparPorSecao(exames, hoje).agora.length,
      doses: { total: dosesHoje.length, tomadas: dosesHoje.filter((d) => d.status === "taken").length },
      marco: marcos[0] ?? null,
      semanaFoto,
      plano: planos[0] ? progressoDoPlano(planos[0].completed_steps).feitas : 0,
      mala,
      artigo: semana3[0] ?? null,
      direitos,
      oracao,
      nomes: { curtidos: nomes.curtidos.length, matches: nomes.matches.length, escolhido: nomeDoBebe ?? null },
    },
  };
}
