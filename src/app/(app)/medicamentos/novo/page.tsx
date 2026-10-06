"use client";

import { FormMedicamento } from "@/components/features/medicamentos/FormMedicamento";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { medicamentosCopy as copy } from "@/copy/medicamentos";

export default function PaginaNovoMedicamento() {
  return (
    <div>
      <Cabecalho titulo={copy.novo} voltarPara="/medicamentos" />
      <FormMedicamento />
    </div>
  );
}
