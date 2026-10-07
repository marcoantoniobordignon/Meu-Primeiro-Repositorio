"use client";

import { useMemo } from "react";

import { useColecao } from "@/lib/dados/colecao";
import { appointments, bebes, bellyPhotos, diaryEntries, documentPages, medicalDocuments, retrospectivas } from "@/lib/dados/colecoes";
import { useFamilia } from "@/lib/familia/useFamilia";
import { useFuso } from "@/lib/hooks/useFuso";
import { temPlano, usePerfil } from "@/lib/perfil";
import { idDaRetrospectiva, slidesParaExportar, slidesPossiveis, slidesVisiveis, type TipoRetro } from "@dominio/retrospectiva.ts";
import { dataNoFuso } from "@dominio/tempo.ts";

import { configDe, disponiveis, montarDados } from "./dados";

/** O que está disponível agora (RN-01): para o card da home e "Memórias". */
export function useRetrospectivasDisponiveis(): { tipos: TipoRetro[]; ehGestante: boolean } {
  const perfil = usePerfil();
  const { papel } = useFamilia();
  const tz = useFuso();
  const lista = useColecao(bebes);
  const hoje = dataNoFuso(new Date(), tz);
  const ehGestante = papel === "mae";
  return { tipos: ehGestante ? disponiveis(perfil?.dpp, hoje, lista.length > 0 || Boolean(perfil?.nascidoEm)) : [], ehGestante };
}

/** Slides (dados vivos, RN-03) e configuração gravada de uma retrospectiva. Lê só o aparelho (RN-11). */
export function useRetrospectiva(kind: TipoRetro) {
  const perfil = usePerfil();
  const { meuId, membros } = useFamilia();
  const tz = useFuso();
  const semente = membros.find((m) => m.papel === "mae")?.profile_id ?? meuId;
  const listaBebes = useColecao(bebes);
  const entradas = useColecao(diaryEntries);
  const fotos = useColecao(bellyPhotos);
  const documentos = useColecao(medicalDocuments);
  const paginas = useColecao(documentPages);
  const consultas = useColecao(appointments);
  const configs = useColecao(retrospectivas);
  const hoje = dataNoFuso(new Date(), tz);

  return useMemo(() => {
    const dados = montarDados({ kind, autora: meuId, dpp: perfil?.dpp, hoje, tz, nomeDoBebe: perfil?.nomeDoBebe, bebes: listaBebes, entradas, fotos, documentos, paginas, consultas });
    const registro = configs.find((c) => c.id === idDaRetrospectiva(semente, kind));
    const config = configDe(registro);
    return {
      perfil,
      semente,
      meuId,
      dados,
      config,
      registro,
      possiveis: slidesPossiveis(dados, config),
      slides: slidesVisiveis(dados, config),
      paraExportar: slidesParaExportar(dados, config),
      premium: temPlano(perfil),
      disponivel: disponiveis(perfil?.dpp, hoje, listaBebes.length > 0 || Boolean(perfil?.nascidoEm)).includes(kind),
    };
  }, [kind, meuId, perfil, hoje, tz, listaBebes, entradas, fotos, documentos, paginas, consultas, configs, semente]);
}
