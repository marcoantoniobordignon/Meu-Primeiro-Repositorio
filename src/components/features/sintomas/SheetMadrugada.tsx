"use client";

import { Botao } from "@/components/ui/Botao";
import { Sheet } from "@/components/ui/Sheet";
import { sintomasCopy as copy } from "@/copy/sintomas";

interface Props {
  aberto: boolean;
  onResponder: (escolha: "hoje" | "ontem") => void;
  onCancelar: () => void;
}

/** SIN-05: "Ainda é ontem?" */
export function SheetMadrugada({ aberto, onResponder, onCancelar }: Props) {
  return (
    <Sheet aberto={aberto} onFechar={onCancelar} titulo={copy.madrugada.titulo}>
      <p className="tipo-corpo text-texto-mudo">{copy.madrugada.apoio}</p>
      <div className="mt-5 flex gap-2">
        <Botao largura="total" variant="secundario" onClick={() => onResponder("ontem")}>
          {copy.madrugada.ontem}
        </Botao>
        <Botao largura="total" onClick={() => onResponder("hoje")}>
          {copy.madrugada.hoje}
        </Botao>
      </div>
    </Sheet>
  );
}
