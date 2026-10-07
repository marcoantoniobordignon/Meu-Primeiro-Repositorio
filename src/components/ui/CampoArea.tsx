"use client";

import { forwardRef, type ReactNode, type TextareaHTMLAttributes } from "react";

interface Props extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> {
  rotulo: string;
  erro?: string;
  /** Mostra "12/280" quando há maxLength. */
  contador?: boolean;
  /** Ação dentro do campo, no canto (ex.: microfone do ditado). */
  acessorio?: ReactNode;
  semRotulo?: boolean;
}

/** Texto longo com a mesma régua do CampoTexto. */
export const CampoArea = forwardRef<HTMLTextAreaElement, Props>(function CampoArea(
  { rotulo, erro, contador = false, acessorio, semRotulo = false, id, value, maxLength, rows = 3, ...rest },
  ref,
) {
  const campoId = id ?? `area-${rotulo.toLowerCase().replace(/\s+/g, "-")}`;
  const tamanho = typeof value === "string" ? value.length : 0;
  return (
    <label htmlFor={campoId} className="block">
      <span className={semRotulo ? "sr-only" : "tipo-titulo-secao mb-1.5 block text-texto-mudo"}>{rotulo}</span>
      <span className="relative block">
        <textarea
          ref={ref}
          id={campoId}
          value={value}
          maxLength={maxLength}
          rows={rows}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? `${campoId}-erro` : undefined}
          className={
            "block w-full resize-none rounded-card border bg-superficie px-4 py-3 text-[16px] text-texto " +
            "placeholder:text-texto-mudo/70 focus:outline-none focus:ring-2 focus:ring-primaria " +
            (acessorio ? "pr-14 " : "") +
            (erro ? "border-erro" : "border-fio")
          }
          {...rest}
        />
        {acessorio && <span className="absolute right-1.5 top-1.5">{acessorio}</span>}
      </span>
      <span className="mt-1.5 flex gap-2 text-[12px]">
        {erro && (
          <span id={`${campoId}-erro`} className="flex-1 text-erro">
            {erro}
          </span>
        )}
        {contador && maxLength && <span className="ml-auto text-texto-mudo">{`${tamanho}/${maxLength}`}</span>}
      </span>
    </label>
  );
});
