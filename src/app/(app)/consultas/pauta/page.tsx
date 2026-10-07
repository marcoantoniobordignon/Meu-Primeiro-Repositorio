"use client";

import { Pauta } from "@/components/features/consultas/Pauta";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { consultasCopy as copy } from "@/copy/consultas";

/** Pauta da próxima consulta: perguntas pendentes e o campo para escrever ou ditar. */
export default function PaginaPauta() {
  return (
    <div>
      <Cabecalho titulo={copy.pauta} voltarPara="/consultas" />
      <div className="flex flex-col gap-3 px-5 pt-1">
        <p className="tipo-meta">{copy.pautaApoio}</p>
        <Pauta />
      </div>
    </div>
  );
}
