"use client";

import { Baby, Heart, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { onboarding as copy } from "@/copy/onboarding";
import type { Momento } from "@/lib/onboarding/estado";

import type { PropsTela } from "./FluxoOnboarding";

const opcoes: { momento: Momento; titulo: string; desc: string; Icone: typeof Heart; cor: string }[] = [
  { momento: "gestacao", titulo: copy.boasVindas.gravida.titulo, desc: copy.boasVindas.gravida.desc, Icone: Heart, cor: "bg-acento" },
  { momento: "bebe", titulo: copy.boasVindas.bebe.titulo, desc: copy.boasVindas.bebe.desc, Icone: Baby, cor: "bg-primaria" },
];

/** Tela 1: dois cards; tocar já avança (menos toques até o valor). */
export function TelaBoasVindas({ estado, avancar }: PropsTela) {
  const [escolhido, setEscolhido] = useState<Momento | undefined>(estado.momento);

  function escolher(momento: Momento) {
    setEscolhido(momento);
    // Deixa o estado selecionado aparecer antes de trocar de tela.
    window.setTimeout(() => avancar({ momento }), 160);
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="pt-6">
        <p className="tipo-titulo-secao uppercase tracking-[0.18em] text-primaria-texto">{copy.boasVindas.marca}</p>
        <h1 className="mt-3 font-sans text-[34px] font-light leading-[1.1] tracking-[-0.02em] text-texto">
          {copy.boasVindas.titulo}
        </h1>
      </div>

      <div className="mt-10">
        <p className="tipo-saudacao text-texto">{copy.boasVindas.pergunta}</p>
        <div role="radiogroup" aria-label={copy.boasVindas.pergunta} className="mt-4 flex flex-col gap-3">
          {opcoes.map(({ momento, titulo, desc, Icone, cor }) => {
            const ativo = escolhido === momento;
            return (
              <button
                key={momento}
                type="button"
                role="radio"
                aria-checked={ativo}
                onClick={() => escolher(momento)}
                className={
                  "flex w-full items-center gap-4 rounded-card border-2 bg-superficie p-4 text-left " +
                  "transition-[border-color,transform,background-color] duration-150 active:scale-[0.985] " +
                  (ativo ? "border-acento bg-acento-suave" : "border-transparent [[data-tema=escuro]_&]:border-fio")
                }
              >
                <span aria-hidden className={`grid size-12 shrink-0 place-items-center rounded-full text-white ${cor}`}>
                  <Icone size={22} />
                </span>
                <span className="flex-1">
                  <span className="block text-[17px] font-medium text-texto">{titulo}</span>
                  <span className="tipo-corpo mt-0.5 block text-texto-mudo">{desc}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="tipo-meta safe-bottom mt-auto flex items-center justify-center gap-1.5 pt-8 text-center">
        <ShieldCheck size={14} aria-hidden />
        {copy.boasVindas.privacidade}
      </p>
    </div>
  );
}
