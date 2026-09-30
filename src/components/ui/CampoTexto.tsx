"use client";

import type { InputHTMLAttributes } from "react";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "className"> {
  rotulo: string;
  ajuda?: string;
  erro?: string;
}

/** Campo de texto/data: mesma régua dos cards, foco em teal, erro em uma linha. */
export function CampoTexto({ rotulo, ajuda, erro, id, ...rest }: Props) {
  const campoId = id ?? `campo-${rotulo.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <label htmlFor={campoId} className="block">
      <span className="tipo-titulo-secao mb-1.5 block text-texto-mudo">{rotulo}</span>
      <input
        id={campoId}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro || ajuda ? `${campoId}-ajuda` : undefined}
        className={
          "block min-h-13 w-full rounded-card border bg-superficie px-4 text-[16px] text-texto " +
          "placeholder:text-texto-mudo/70 focus:outline-none focus:ring-2 focus:ring-primaria " +
          (erro ? "border-erro" : "border-fio")
        }
        {...rest}
      />
      {(erro || ajuda) && (
        <span id={`${campoId}-ajuda`} className={`mt-1.5 block text-[12px] ${erro ? "text-erro" : "text-texto-mudo"}`}>
          {erro ?? ajuda}
        </span>
      )}
    </label>
  );
}
