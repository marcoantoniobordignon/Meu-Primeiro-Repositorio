"use client";

import { CloudOff, Clock } from "lucide-react";
import { useEffect } from "react";

import { redeCopy as copy } from "@/copy/rede";
import { iniciarSincronizacao, useEstadoRede } from "@/lib/offline/sync";

import { Faixa } from "./Faixa";

/** ARQ-04: sem rede, faixa discreta "Sem conexão, salvando aqui"; nunca modal. */
export function FaixaRede() {
  const rede = useEstadoRede();
  useEffect(() => iniciarSincronizacao(), []);

  if (!rede.online) {
    return (
      <div className="px-5 pt-3">
        <Faixa icone={<CloudOff size={14} aria-hidden />}>{copy.semConexao}</Faixa>
      </div>
    );
  }
  if (rede.pendenteAntigo) {
    return (
      <div className="px-5 pt-3">
        <Faixa tom="alerta" icone={<Clock size={14} aria-hidden />}>
          {copy.pendenteAntigo(rede.pendentes)}
        </Faixa>
      </div>
    );
  }
  return null;
}
