"use client";

import { Check } from "lucide-react";

type Cor = "primaria" | "acento" | "sono" | "mamada" | "fralda" | "banho";

interface Props {
  children: React.ReactNode;
  selecionado?: boolean;
  cor?: Cor;
  onToggle?: (selecionado: boolean) => void;
}

const circulo: Record<Cor, string> = {
  primaria: "bg-primaria",
  acento: "bg-acento",
  sono: "bg-sono",
  mamada: "bg-mamada",
  fralda: "bg-fralda",
  banho: "bg-banho",
};

/**
 * Chip: pílula com círculo colorido 18 px à esquerda.
 * Selecionado troca a borda para coral ("você agora") e mostra o check.
 */
export function Chip({ children, selecionado = false, cor = "primaria", onToggle }: Props) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selecionado}
      onClick={() => onToggle?.(!selecionado)}
      className={
        "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-pilula border px-3.5 text-[14px] font-medium " +
        "transition-[background-color,border-color,transform] duration-150 active:scale-[0.97] " +
        (selecionado
          ? "border-acento bg-acento-suave text-texto"
          : "border-fio bg-superficie text-texto [[data-tema=escuro]_&]:border-fio")
      }
    >
      <span
        aria-hidden
        className={`grid size-[18px] place-items-center rounded-full text-white ${selecionado ? "bg-acento" : circulo[cor]}`}
      >
        {selecionado && <Check size={12} strokeWidth={3} />}
      </span>
      {children}
    </button>
  );
}
