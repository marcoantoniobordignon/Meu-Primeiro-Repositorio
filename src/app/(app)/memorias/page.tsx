"use client";

import { BookHeart, ChevronRight } from "lucide-react";
import Link from "next/link";

import { MiniaturaRetro } from "@/components/features/retrospectiva/Miniatura";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { Vazio } from "@/components/ui/Vazio";
import { retroCopy as copy } from "@/copy/retrospectiva";
import { useRetrospectiva, useRetrospectivasDisponiveis } from "@/lib/retrospectiva/useRetrospectiva";
import type { TipoRetro } from "@dominio/retrospectiva.ts";

function Item({ kind }: { kind: TipoRetro }) {
  const r = useRetrospectiva(kind);
  return (
    <Link
      href={`/memorias/retrospectiva?kind=${kind}`}
      className="flex items-center gap-4 rounded-card bg-superficie p-3 pr-4 transition-transform active:scale-[0.985] [[data-tema=escuro]_&]:border [[data-tema=escuro]_&]:border-fio"
    >
      <MiniaturaRetro slide={r.slides[0]} kind={kind} largura={84} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="tipo-meta">{copy.quantos(r.slides.length)}</span>
        <span className="font-serifa text-[22px] leading-tight text-texto">{kind === "final" ? copy.final : copy.card.previa}</span>
        <span className="tipo-corpo text-texto-mudo">{kind === "final" ? copy.card.finalApoio : copy.card.previaApoio}</span>
      </span>
      <ChevronRight size={18} aria-hidden className="shrink-0 text-texto-mudo" />
    </Link>
  );
}

/** "Memórias": a retrospectiva fica aqui para sempre (RN-01). Só a gestante vê. */
export default function PaginaMemorias() {
  const { tipos, ehGestante } = useRetrospectivasDisponiveis();
  return (
    <div className="flex flex-col gap-4">
      <Cabecalho titulo={copy.memorias} voltarPara="/eu" />
      <div className="flex flex-col gap-3 px-5">
        {!ehGestante ? (
          <Vazio icone={<BookHeart size={24} />} frase={copy.player.soGestante} />
        ) : tipos.length === 0 ? (
          <Vazio icone={<BookHeart size={24} />} frase={copy.memoriasVazio} />
        ) : (
          <>
            <p className="tipo-corpo text-texto-mudo">{copy.memoriasApoio}</p>
            {tipos.map((k) => (
              <Item key={k} kind={k} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
