"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { nav as copy } from "@/copy/nav";

interface Props {
  titulo: string;
  voltarPara?: string;
  acao?: ReactNode;
}

/** Cabeçalho de subtela: seta, título e uma ação opcional à direita. */
export function Cabecalho({ titulo, voltarPara, acao }: Props) {
  const router = useRouter();
  return (
    <header className="safe-top sticky top-0 z-10 flex items-center gap-1 bg-fundo px-2 pb-2">
      <button
        type="button"
        aria-label={copy.voltar}
        onClick={() => (voltarPara ? router.push(voltarPara) : router.back())}
        className="grid size-11 place-items-center rounded-pilula text-texto active:bg-primaria-suave"
      >
        <ArrowLeft size={22} />
      </button>
      <h1 className="tipo-saudacao flex-1 truncate text-texto">{titulo}</h1>
      {acao && <div className="mr-2">{acao}</div>}
    </header>
  );
}
