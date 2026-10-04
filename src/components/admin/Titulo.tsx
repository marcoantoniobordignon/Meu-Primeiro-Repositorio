import type { ReactNode } from "react";

interface Props {
  titulo: string;
  apoio?: string;
  acao?: ReactNode;
}

/** Título de seção do painel: uma linha, apoio mudo, ação à direita. */
export function Titulo({ titulo, apoio, acao }: Props) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[24px] font-medium tracking-[-0.01em] text-texto">{titulo}</h1>
        {apoio && <p className="tipo-corpo mt-0.5 text-texto-mudo">{apoio}</p>}
      </div>
      {acao}
    </header>
  );
}
