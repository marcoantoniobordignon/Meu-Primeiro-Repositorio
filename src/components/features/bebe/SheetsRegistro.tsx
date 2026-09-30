"use client";

import type { RegistroBebe, TipoRegistroBebe } from "@/lib/dados/colecoes";

import { SheetBanho } from "./SheetBanho";
import { SheetFralda } from "./SheetFralda";
import { SheetMamada } from "./SheetMamada";
import { SheetSono } from "./SheetSono";

export interface EstadoSheet {
  tipo: TipoRegistroBebe | null;
  registro?: RegistroBebe | null;
}

interface Props {
  estado: EstadoSheet;
  onFechar: () => void;
  bebeId: string;
}

/** Os quatro sheets de registro do bebê, abertos por tipo. */
export function SheetsRegistro({ estado, onFechar, bebeId }: Props) {
  return (
    <>
      <SheetSono aberto={estado.tipo === "sono"} onFechar={onFechar} bebeId={bebeId} registro={estado.registro} />
      <SheetMamada aberto={estado.tipo === "mamada"} onFechar={onFechar} bebeId={bebeId} registro={estado.registro} />
      <SheetFralda aberto={estado.tipo === "fralda"} onFechar={onFechar} bebeId={bebeId} registro={estado.registro} />
      <SheetBanho aberto={estado.tipo === "banho"} onFechar={onFechar} bebeId={bebeId} registro={estado.registro} />
    </>
  );
}
