"use client";

import { useParams } from "next/navigation";

import { FormMedicamento } from "@/components/features/medicamentos/FormMedicamento";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { medicamentosCopy as copy } from "@/copy/medicamentos";
import { useColecao } from "@/lib/dados/colecao";
import { medications } from "@/lib/dados/colecoes";

export default function PaginaEditarMedicamento() {
  const { id } = useParams<{ id: string }>();
  const lista = useColecao(medications);
  const med = lista.find((m) => m.id === id);
  return (
    <div>
      <Cabecalho titulo={copy.editar} voltarPara="/medicamentos/lista" />
      {med && <FormMedicamento key={med.id} existente={med} />}
    </div>
  );
}
