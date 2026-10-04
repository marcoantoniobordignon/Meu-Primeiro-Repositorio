"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { bebe3dCopy as copy } from "@/copy/bebe3d";
import type { SemanaBebe3D } from "@/lib/bebe3d/semanas";

interface Props {
  dados: SemanaBebe3D;
}

/** Ficha da semana sobre a cena: fruta, medidas e marcos, dobrável para não cobrir o bebê. */
export function Ficha({ dados }: Props) {
  const [aberta, setAberta] = useState(false);
  return (
    <section className="rounded-card bg-utero-vidro px-4 py-3 text-utero-texto backdrop-blur-md" aria-label={copy.semana(dados.semana)}>
      <button type="button" onClick={() => setAberta((v) => !v)} aria-expanded={aberta} className="flex min-h-11 w-full items-center gap-3 text-left">
        <span aria-hidden className="text-[28px] leading-none">
          {dados.emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium">{copy.ficha.comparacao(dados.comparacao)}</span>
          <span className="block text-[12px] text-utero-texto-mudo">
            {dados.comprimento_texto.split(",")[0]} · {dados.peso_texto}
          </span>
        </span>
        <ChevronDown size={18} aria-hidden className={`shrink-0 text-utero-texto-mudo transition-transform ${aberta ? "rotate-180" : ""}`} />
      </button>
      {aberta && (
        <div className="anim-surge mt-2 border-t border-utero-texto/10 pt-3">
          <p className="tipo-titulo-secao text-utero-texto-mudo">{copy.ficha.marcos}</p>
          <ul className="mt-2 flex flex-col gap-2">
            {dados.marcos.map((m) => (
              <li key={m} className="flex gap-2.5 text-[14px] leading-[1.4]">
                <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-utero-ambar" />
                {m}
              </li>
            ))}
          </ul>
          <p className="tipo-meta mt-3 text-utero-texto-mudo">
            {dados.revisao_medica === "pendente" && <span className="mr-2 rounded-pilula bg-utero-ambar/20 px-2 py-0.5 text-[10px] font-medium text-utero-ambar">{copy.ficha.revisao}</span>}
            {copy.aviso}
          </p>
        </div>
      )}
    </section>
  );
}
