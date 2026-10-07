"use client";

import { AberturaPorLembrete } from "@/components/features/plano/AberturaPorLembrete";
import { Checklist } from "@/components/features/plano/Checklist";
import { Etapa } from "@/components/features/plano/Etapa";
import { planoCopy as copy } from "@/copy/planoParto";
import { usePlano } from "@/lib/plano/usePlano";

/** Tela 5 "Documentos": checklist com foto por item (RN-09). */
export default function PaginaDocumentos() {
  const { perfil, itens, anexos, meuId, papel } = usePlano();
  return (
    <Etapa numero={4} titulo={copy.etapas.documentos.titulo}>
      <AberturaPorLembrete />
      {perfil && <Checklist lista="documents" itens={itens} anexos={anexos} autor={meuId} papel={papel} perfil={perfil} comAnexos />}
    </Etapa>
  );
}
