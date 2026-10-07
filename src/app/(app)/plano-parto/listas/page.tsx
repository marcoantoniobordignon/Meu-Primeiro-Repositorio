"use client";

import { AberturaPorLembrete } from "@/components/features/plano/AberturaPorLembrete";
import { Checklist } from "@/components/features/plano/Checklist";
import { Etapa } from "@/components/features/plano/Etapa";
import { planoCopy as copy } from "@/copy/planoParto";
import { usePlano } from "@/lib/plano/usePlano";
import { LISTAS_MALAS } from "@dominio/plano-parto.ts";

/** Tela 6 "Malas e enxoval": as listas com progresso, adicionar item e quantidade (RN-06). */
export default function PaginaListas() {
  const { perfil, itens, anexos, meuId, papel } = usePlano();
  // Funcionalidade 17 RN-02: a lista do batismo só aparece com o modo fé ligado (desligado, fica guardada).
  const temBatismo = Boolean(perfil?.prefs?.faith_mode) && itens.some((i) => i.list === "baptism" && !i.apagado_em);
  return (
    <Etapa numero={5} titulo={copy.etapas.malas.titulo}>
      <AberturaPorLembrete />
      {perfil && (
        <div className="flex flex-col gap-8">
          {[...LISTAS_MALAS, ...(temBatismo ? (["baptism"] as const) : [])].map((l) => (
            <Checklist key={l} lista={l} itens={itens} anexos={anexos} autor={meuId} papel={papel} perfil={perfil} />
          ))}
        </div>
      )}
    </Etapa>
  );
}
