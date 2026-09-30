"use client";

import { useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { Chip } from "@/components/ui/Chip";
import { onboarding as copy } from "@/copy/onboarding";
import { sintomasDaSemana, sintomasPosParto } from "@/copy/sintomas";
import { paraISO, semanaGestacional } from "@/lib/dates";

import type { PropsTela } from "./FluxoOnboarding";
import { Pergunta } from "./Pergunta";

/** Tela 5: os 4 sintomas mais frequentes da semana; "isso vira seu diário". */
export function TelaComoEsta({ estado, avancar }: PropsTela) {
  const semana = estado.dpp ? semanaGestacional(estado.dpp, paraISO(new Date())).semana : 0;
  const opcoes = estado.momento === "bebe" ? sintomasPosParto() : sintomasDaSemana(semana);
  const [marcados, setMarcados] = useState<string[]>(estado.sintomas ?? []);

  function alternar(id: string, ligado: boolean) {
    setMarcados((m) => (ligado ? [...m, id] : m.filter((x) => x !== id)));
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
          <Chip key={s.id} cor="acento" selecionado={marcados.includes(s.id)} onToggle={(v) => alternar(s.id, v)}>
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
