"use client";

import { useColecao } from "@/lib/dados/colecao";
import { documentPages, medicalDocuments } from "@/lib/dados/colecoes";
import { useFamilia } from "@/lib/familia/useFamilia";
import { useFuso } from "@/lib/hooks/useFuso";
import { usePerfil } from "@/lib/perfil";
import { dataNoFuso } from "@dominio/tempo.ts";

import { visivelPara } from "./regras";

export function useGaleria() {
  const todos = useColecao(medicalDocuments);
  const paginas = useColecao(documentPages);
  const perfil = usePerfil();
  const familia = useFamilia();
  const tz = useFuso();
  const docs = todos.filter((d) => visivelPara(d, familia.meuId, familia.papel));
  return { docs, todos, paginas, perfil, tz, hoje: dataNoFuso(new Date(), tz), ...familia, podeEditar: familia.papel === "mae" };
}
