"use client";

import type { ReactNode } from "react";

type Cor = "sono" | "mamada" | "fralda" | "banho";

interface Props {
  cor: Cor;
  icone: ReactNode;
  nome: string;
  /** "há 1 h 12" ou "ainda não registrado". */
  contador: string;
  meta?: string;
  /** Inverte: fundo na cor, texto branco, contador correndo. */
  aoVivo?: boolean;
  /** CUI-07: inicial de quem registrou, quando não fui eu. */
  inicial?: string | null;
  onClick: () => void;
}

const fundo: Record<Cor, string> = { sono: "bg-sono", mamada: "bg-mamada", fralda: "bg-fralda", banho: "bg-banho" };

/** Tile: card com ícone circular na cor do registro, nome, contador "há X" e meta. */
export function Tile({ cor, icone, nome, contador, meta, aoVivo = false, inicial, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex min-h-[124px] flex-col justify-between rounded-card p-4 text-left transition-transform active:scale-[0.97] ${
        aoVivo ? `${fundo[cor]} text-white` : "bg-superficie text-texto [[data-tema=escuro]_&]:border [[data-tema=escuro]_&]:border-fio"
      }`}
    >
      <div className="flex items-center gap-2">
        <span aria-hidden className={`grid size-7 place-items-center rounded-full ${aoVivo ? "bg-white/25 text-white" : `${fundo[cor]} text-white`}`}>
          {icone}
        </span>
        <span className="text-[13px] font-medium">{nome}</span>
        {inicial && (
          <span aria-label={`registrado por ${inicial}`} className={`ml-auto grid size-5 place-items-center rounded-full text-[10px] font-medium ${aoVivo ? "bg-white/25" : "bg-primaria-suave text-primaria-texto"}`}>
            {inicial}
          </span>
        )}
      </div>
      <div>
        <p className={`font-sans text-[15px] font-light leading-tight ${aoVivo ? "text-[20px] font-normal" : ""}`}>{contador}</p>
        {meta && <p className={`tipo-meta mt-0.5 ${aoVivo ? "text-white/85" : ""}`}>{meta}</p>}
      </div>
    </button>
  );
}
