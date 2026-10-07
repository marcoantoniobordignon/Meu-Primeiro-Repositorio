"use client";

import { Play } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { retroCopy as copy } from "@/copy/retrospectiva";
import { track } from "@/lib/analytics";
import { useRetrospectiva, useRetrospectivasDisponiveis } from "@/lib/retrospectiva/useRetrospectiva";
import type { TipoRetro } from "@dominio/retrospectiva.ts";

import { MiniaturaRetro } from "./Miniatura";

/** Dias depois do nascimento em que o card "pronta" fica na home (depois, mora em Memórias). */
const DIAS_NA_HOME = 30;

function Cartao({ kind }: { kind: TipoRetro }) {
  const r = useRetrospectiva(kind);
  useEffect(() => {
    if (kind === "preview") track("retro_preview_shown", {});
  }, [kind]);
  const titulo = kind === "final" ? copy.card.final : copy.card.previa;
  const apoio = kind === "final" ? copy.card.finalApoio : copy.card.previaApoio;
  return (
    <Link
      href={`/memorias/retrospectiva?kind=${kind}`}
      className="group relative flex items-center gap-4 overflow-hidden rounded-card bg-retro-noite p-3 pr-4 text-retro-luz transition-transform duration-200 active:scale-[0.985]"
    >
      {/* Luz quente no canto, como nos slides. */}
      <span aria-hidden className="pointer-events-none absolute -right-10 -top-16 size-48 rounded-full bg-retro-coral/25 blur-3xl" />
      <span aria-hidden className="pointer-events-none absolute -bottom-20 right-16 size-40 rounded-full bg-retro-ouro/15 blur-3xl" />
      <MiniaturaRetro slide={r.slides[0]} kind={kind} largura={64} />
      <span className="relative flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-retro-coral">{kind === "final" ? copy.final : copy.previa}</span>
        <span className="font-serifa text-[22px] leading-[1.1] text-retro-luz">{titulo}</span>
        <span className="text-[13px] leading-snug text-retro-luz-suave">{apoio}</span>
      </span>
      <span aria-hidden className="relative grid size-11 shrink-0 place-items-center rounded-full bg-retro-luz text-retro-noite transition-transform duration-300 group-hover:scale-105">
        <Play size={18} fill="currentColor" className="translate-x-px" />
      </span>
      <span className="sr-only">{copy.card.abrir}</span>
    </Link>
  );
}

/** Tela 1 · card na home: "Sua história até aqui" (36s0d+) ou "Sua retrospectiva está pronta" (depois do nascimento). */
export function CardRetrospectiva({ modo, nascidoEm }: { modo: "gestacao" | "bebe"; nascidoEm?: string | null }) {
  const { tipos, ehGestante } = useRetrospectivasDisponiveis();
  if (!ehGestante) return null;
  if (modo === "bebe") {
    if (!tipos.includes("final")) return null;
    if (nascidoEm && Date.now() - new Date(nascidoEm).getTime() > DIAS_NA_HOME * 86_400_000) return null;
    return <Cartao kind="final" />;
  }
  return tipos.includes("preview") ? <Cartao kind="preview" /> : null;
}
