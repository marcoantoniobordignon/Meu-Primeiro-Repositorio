import type { ReactNode } from "react";

interface Props {
  titulo: ReactNode;
  apoio?: ReactNode;
  children: ReactNode;
  /** Área fixa no rodapé (CTA). */
  rodape?: ReactNode;
}

/** Esqueleto de toda tela do onboarding: pergunta, apoio, conteúdo e CTA no rodapé. */
export function Pergunta({ titulo, apoio, children, rodape }: Props) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="pt-4">
        <h1 className="tipo-pergunta text-texto">{titulo}</h1>
        {apoio && <p className="tipo-corpo mt-2 text-texto-mudo">{apoio}</p>}
      </div>
      <div className="mt-6 flex-1">{children}</div>
      {rodape ? <Rodape>{rodape}</Rodape> : <div className="safe-bottom" />}
    </div>
  );
}

/** Rodapé que gruda no fim da área visível; sobe o fundo para cobrir o conteúdo rolando por baixo. */
export function Rodape({ children }: { children: ReactNode }) {
  return <div className="safe-bottom sticky bottom-0 -mx-5 mt-6 bg-fundo px-5 pt-3">{children}</div>;
}
