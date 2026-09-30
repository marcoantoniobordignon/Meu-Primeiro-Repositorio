"use client";

import { bebeCopy as copy } from "@/copy/bebe";
import { useBebes } from "@/lib/bebe/useBebes";

/** BEB-11: seletor no topo quando há mais de um bebê. */
export function SeletorBebe() {
  const { bebes, ativo, selecionar } = useBebes();
  if (bebes.length < 2 || !ativo) return null;
  return (
    <div role="radiogroup" aria-label={copy.seletorBebe} className="flex rounded-pilula bg-primaria-suave p-1">
      {bebes.map((b) => (
        <button
          key={b.id}
          type="button"
          role="radio"
          aria-checked={ativo.id === b.id}
          onClick={() => selecionar(b.id)}
          className={`min-h-10 flex-1 rounded-pilula text-[14px] font-medium transition-colors ${ativo.id === b.id ? "bg-superficie text-primaria-texto" : "text-primaria-texto/80"}`}
        >
          {b.nome}
        </button>
      ))}
    </div>
  );
}
