"use client";

import { useState } from "react";

import { AceitarConviteParceiro } from "@/components/features/parceiro/AceitarConviteParceiro";
import { Botao } from "@/components/ui/Botao";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { parceiroCopy as copy } from "@/copy/parceiro";
import { codigoValido, normalizarCodigo } from "@dominio/parceiro.ts";

/** RN-10: o código de 6 caracteres, para digitar à mão. */
export default function PaginaCodigo() {
  const [codigo, setCodigo] = useState("");
  const [enviado, setEnviado] = useState<string | null>(null);
  if (enviado) return <AceitarConviteParceiro chave={{ code: enviado }} />;
  return (
    <form
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 bg-fundo px-5 py-10"
      onSubmit={(e) => {
        e.preventDefault();
        if (codigoValido(codigo)) setEnviado(normalizarCodigo(codigo));
      }}
    >
      <h1 className="tipo-pergunta text-texto">{copy.digiteCodigo}</h1>
      <CampoTexto rotulo={copy.codigoRotulo} value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="one-time-code" maxLength={9} />
      <Botao type="submit" largura="total" tamanho="lg" disabled={!codigoValido(codigo)}>
        {copy.continuar}
      </Botao>
    </form>
  );
}
