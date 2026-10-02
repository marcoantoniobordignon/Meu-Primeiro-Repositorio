"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { bebe3dCopy as copy } from "@/copy/bebe3d";
import { conteudoDaSemana } from "@/lib/conteudo-semanas";

interface Props {
  semana: number;
}

/** Entrada da aba 3D na Hoje: card quente, uma ação, sem 3D aqui (peso zero). */
export function CardHero3D({ semana }: Props) {
  const s = conteudoDaSemana(semana);
  return (
    <Link
      href="/hoje/bebe-3d"
      className="relative flex min-h-[112px] items-center gap-4 overflow-hidden rounded-card bg-utero-fundo px-4 py-4 text-utero-texto transition-transform active:scale-[0.985]"
      style={{ background: "radial-gradient(120% 140% at 85% 20%, var(--utero-rosa) 0%, var(--utero-fundo) 60%)" }}
    >
      <span aria-hidden className="anim-coracao grid size-14 shrink-0 place-items-center rounded-full bg-utero-ambar/25 text-[30px]">
        {s?.emoji ?? "🤍"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-medium">{copy.cardHero.titulo}</span>
        <span className="mt-0.5 block text-[13px] text-utero-texto-mudo">{copy.cardHero.apoio(s?.tamanho ?? "um bebê")}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1 rounded-pilula bg-utero-ambar px-3 py-2 text-[13px] font-medium text-utero-fundo">
        {copy.cardHero.cta}
        <ChevronRight size={16} aria-hidden />
      </span>
    </Link>
  );
}
