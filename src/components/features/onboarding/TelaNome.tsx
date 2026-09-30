"use client";

import { useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { onboarding as copy } from "@/copy/onboarding";

import type { PropsTela } from "./FluxoOnboarding";
import { Pergunta } from "./Pergunta";

/** Tela 4: nome, opcional. Enter no teclado também avança. */
export function TelaNome({ estado, avancar }: PropsTela) {
  const [nome, setNome] = useState(estado.nome ?? "");
  const limpo = nome.trim();

  return (
    <form
      className="flex flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        avancar({ nome: limpo || undefined });
      }}
    >
      <Pergunta
        titulo={copy.nome.pergunta}
        apoio={copy.nome.apoio}
        rodape={
          <Botao tamanho="lg" largura="total" type="submit" disabled={!limpo}>
            {copy.continuar}
          </Botao>
        }
      >
        <CampoTexto
          rotulo={copy.nome.rotulo}
          placeholder={copy.nome.placeholder}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          autoComplete="given-name"
          autoCapitalize="words"
          enterKeyHint="next"
          maxLength={40}
          autoFocus
        />
      </Pergunta>
    </form>
  );
}
