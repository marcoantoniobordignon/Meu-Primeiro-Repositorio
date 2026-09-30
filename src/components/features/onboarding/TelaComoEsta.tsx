"use client";

import { useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { Chip } from "@/components/ui/Chip";
import { onboarding as copy } from "@/copy/onboarding";
import { paraISO, semanaGestacional } from "@/lib/dates";
import { frequentesNaSemana, frequentesPosParto } from "@/lib/sintomas/catalogo";

import type { PropsTela } from "./FluxoOnboarding";
import { Pergunta } from "./Pergunta";

/** Tela 5: os 4 sintomas mais frequentes da semana; "isso vira seu diário". */
export function TelaComoEsta({ estado, avancar }: PropsTela) {
  const semana = estado.dpp ? semanaGestacional(estado.dpp, paraISO(new Date())).semana : 0;
  const opcoes = (estado.momento === "bebe" ? frequentesPosParto() : frequentesNaSemana(semana))
    .filter((s) => !s.especial)
    .slice(0, 4);
  const [marcados, setMarcados] = useState<string[]>(estado.sintomas ?? []);

  function alternar(slug: string, ligado: boolean) {
    setMarcados((m) => (ligado ? [...m, slug] : m.filter((x) => x !== slug)));
  }

  return (
    <Pergunta
      titulo={copy.comoEsta.pergunta(estado.nome)}
      apoio={copy.comoEsta.apoio}
      rodape={
        <Botao tamanho="lg" largura="total" onClick={() => avancar({ sintomas: marcados })}>
          {copy.continuar}
        </Botao>
      }
    >
      <div className="flex flex-wrap gap-2.5">
        {opcoes.map((s) => (
          <Chip key={s.slug} cor="acento" selecionado={marcados.includes(s.slug)} onToggle={(v) => alternar(s.slug, v)}>
            {s.nome}
          </Chip>
        ))}
      </div>
      <button
        type="button"
        onClick={() => avancar({ sintomas: [] })}
        className="mt-5 min-h-11 text-[14px] font-medium text-texto-mudo underline-offset-4 hover:underline"
      >
        {copy.comoEsta.nada}
      </button>
    </Pergunta>
  );
}
