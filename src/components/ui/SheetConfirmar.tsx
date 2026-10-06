"use client";

import { Botao } from "./Botao";
import { Sheet } from "./Sheet";

interface Props {
  aberto: boolean;
  titulo: string;
  texto: string;
  confirmar: string;
  cancelar: string;
  onConfirmar: () => void;
  onFechar: () => void;
}

/** Confirmação de ação definitiva (apagar). Nunca modal bloqueante: é um sheet que fecha por arraste. */
export function SheetConfirmar({ aberto, titulo, texto, confirmar, cancelar, onConfirmar, onFechar }: Props) {
  return (
    <Sheet aberto={aberto} onFechar={onFechar} titulo={titulo}>
      <p className="tipo-corpo text-texto-mudo">{texto}</p>
      <div className="mt-5 flex gap-2">
        <Botao largura="total" variant="secundario" onClick={onFechar}>
          {cancelar}
        </Botao>
        <Botao
          largura="total"
          onClick={() => {
            onConfirmar();
            onFechar();
          }}
        >
          {confirmar}
        </Botao>
      </div>
    </Sheet>
  );
}
