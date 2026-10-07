"use client";

import { useEffect } from "react";

import { FeDesligado } from "@/components/features/fe/FeDesligado";
import { Checklist } from "@/components/features/plano/Checklist";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { Card } from "@/components/ui/Card";
import { feCopy as copy } from "@/copy/fe";
import { useColecao } from "@/lib/dados/colecao";
import { birthChecklistItems, birthItemAttachments } from "@/lib/dados/colecoes";
import { garantirBatismo } from "@/lib/fe/acoes";
import { useFe } from "@/lib/fe/useFe";
import { useFamilia } from "@/lib/familia/useFamilia";

/**
 * Tela 4 "Batismo": a lista `baptism` do plano de parto (RN-07). Nasce ao registrar o nascimento com o modo
 * ligado; quem ligou o modo depois do nascimento ganha a lista ao abrir esta tela (ids determinísticos).
 */
export default function PaginaBatismo() {
  const { perfil, ligado } = useFe();
  const { papel, meuId } = useFamilia();
  const itens = useColecao(birthChecklistItems);
  const anexos = useColecao(birthItemAttachments);
  const depoisDoNascimento = perfil?.modo === "bebe";

  useEffect(() => {
    if (ligado && depoisDoNascimento && papel === "mae") garantirBatismo();
  }, [ligado, depoisDoNascimento, papel]);

  if (!perfil) return null;
  return (
    <div>
      <Cabecalho titulo={copy.batismo.titulo} voltarPara="/eu" />
      {!ligado ? (
        <FeDesligado />
      ) : (
        <div className="flex flex-col gap-4 px-5 pb-8 pt-1">
          <p className="tipo-corpo text-texto-mudo">{copy.batismo.apoio}</p>
          {itens.some((i) => i.list === "baptism") ? (
            <Checklist lista="baptism" itens={itens} anexos={anexos} autor={meuId} papel={papel} perfil={perfil} />
          ) : (
            <Card>
              <p className="tipo-corpo text-texto-mudo">{copy.batismo.vazio}</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
