import type { ReactNode } from "react";

interface Props {
  icone: ReactNode;
  frase: string;
  acao?: ReactNode;
}

/** Vazio: ícone em círculo, uma frase, um botão. Toda lista tem um. */
export function Vazio({ icone, frase, acao }: Props) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span aria-hidden className="grid size-14 place-items-center rounded-full bg-primaria-suave text-primaria-texto">
        {icone}
      </span>
      <p className="tipo-corpo mt-4 max-w-[28ch] text-texto-mudo">{frase}</p>
      {acao && <div className="mt-5">{acao}</div>}
    </div>
  );
}
