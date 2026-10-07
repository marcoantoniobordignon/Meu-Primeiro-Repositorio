"use client";

import { Scale, X } from "lucide-react";
import Link from "next/link";

import { direitosCopy as copy } from "@/copy/direitos";
import { dispensarDaHome } from "@/lib/direitos/acoes";
import type { CartaoVisivel } from "@/lib/direitos/useDireitos";

/** RN-03: até 2 direitos da fase na home, cada um com "dispensar"; o toque abre o cartão (origem "home"). */
export function CardDireitosDaFase({ cartoes, onToque }: { cartoes: CartaoVisivel[]; onToque: () => void }) {
  return (
    <section data-card aria-labelledby="home-direitos" className="rounded-card bg-superficie px-4 py-3 [[data-tema=escuro]_&]:border [[data-tema=escuro]_&]:border-fio">
      <h2 id="home-direitos" className="flex items-center gap-2 text-[15px] font-medium text-texto">
        <Scale size={16} aria-hidden className="text-primaria-texto" />
        {copy.paraEstaFase}: {copy.titulo.toLowerCase()}
      </h2>
      <ul className="mt-1 divide-y divide-fio">
        {cartoes.map((c) => (
          <li key={c.id} className="flex items-center">
            <Link href={`/direitos/cartao?slug=${c.slug}&de=home`} onClick={onToque} className="flex min-h-11 min-w-0 flex-1 items-center py-2 text-[14px] text-primaria-texto">
              {c.question}
            </Link>
            <button type="button" aria-label={copy.dispensar(c.question)} onClick={() => dispensarDaHome(c.slug)} className="grid size-11 shrink-0 place-items-center rounded-pilula text-texto-mudo">
              <X size={16} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
