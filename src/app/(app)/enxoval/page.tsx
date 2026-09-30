"use client";

import { ShoppingBag } from "lucide-react";
import { useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { Vazio } from "@/components/ui/Vazio";
import { euCopy as copy } from "@/copy/eu";
import { nav } from "@/copy/nav";

/** Placeholder visível para medir interesse (decisão da spec 03). */
export default function PaginaEnxoval() {
  const [avisado, setAvisado] = useState(false);
  return (
    <div>
      <header className="safe-top px-5">
        <h1 className="tipo-saudacao text-texto">{nav.enxoval}</h1>
      </header>
      <Vazio
        icone={<ShoppingBag size={24} />}
        frase={copy.placeholders.enxoval}
        acao={
          <Botao variant={avisado ? "secundario" : "primario"} disabled={avisado} onClick={() => setAvisado(true)}>
            {avisado ? copy.placeholders.avisado : copy.placeholders.meAvise}
          </Botao>
        }
      />
    </div>
  );
}
