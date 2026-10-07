"use client";

import { useState } from "react";

import { onboarding as copy } from "@/copy/onboarding";
import type { RespostaFe } from "@/lib/onboarding/estado";

import type { PropsTela } from "./FluxoOnboarding";
import { Pergunta } from "./Pergunta";

const opcoes: { valor: RespostaFe; rotulo: string }[] = [
  { valor: "sim", rotulo: copy.fe.sim },
  { valor: "nao", rotulo: copy.fe.nao },
  { valor: "depois", rotulo: copy.fe.depois },
];

/**
 * Funcionalidade 17 · Tela 1: "Quer incluir conteúdo de fé católica?". Nenhuma opção vem marcada (RN-01);
 * "Decidir depois" deixa desligado e a chave fica em Eu. Tocar já avança, como na tela 1.
 */
export function TelaFe({ estado, avancar }: PropsTela) {
  const [escolhido, setEscolhido] = useState<RespostaFe | undefined>(estado.fe);

  function escolher(fe: RespostaFe) {
    setEscolhido(fe);
    window.setTimeout(() => avancar({ fe }), 160);
  }

  return (
    <Pergunta titulo={copy.fe.pergunta} apoio={copy.fe.apoio}>
      <div role="radiogroup" aria-label={copy.fe.pergunta} className="flex flex-col gap-3">
        {opcoes.map(({ valor, rotulo }) => {
          const ativo = escolhido === valor;
          return (
            <button
              key={valor}
              type="button"
              role="radio"
              aria-checked={ativo}
              onClick={() => escolher(valor)}
              className={`flex min-h-14 w-full items-center rounded-card border-2 bg-superficie px-4 text-left text-[16px] font-medium text-texto active:scale-[0.985] ${
                ativo ? "border-acento bg-acento-suave" : "border-transparent [[data-tema=escuro]_&]:border-fio"
              }`}
            >
              {rotulo}
            </button>
          );
        })}
      </div>
    </Pergunta>
  );
}
