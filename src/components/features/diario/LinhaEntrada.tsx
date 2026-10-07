"use client";

import { ChevronRight, Mic, NotebookPen, Sparkles } from "lucide-react";
import Link from "next/link";

import { diarioCopy as copy } from "@/copy/diario";
import type { DiaryEntry, Membro } from "@/lib/dados/colecoes";
import { rotuloDia } from "@/lib/dates";
import { semanaDaEntrada } from "@/lib/diario/regras";
import { nomeDoAutor } from "@/lib/familia/regras";
import { marcoDoCatalogo } from "@dominio/diario.ts";

interface Props {
  entrada: DiaryEntry;
  dpp: string | null | undefined;
  hoje: string;
  eu: string;
  membros: Membro[];
}

export function metaDaEntrada(e: DiaryEntry, dpp: string | null | undefined, hoje: string, eu: string, membros: Membro[]): string {
  const semana = semanaDaEntrada(dpp, e.entry_date);
  return [
    rotuloDia(e.entry_date, hoje),
    semana !== null ? copy.semana(semana) : null,
    e.audio_path ? copy.comAudio : null,
    e.photo_count ? copy.fotos(e.photo_count) : null,
    e.criado_por && e.criado_por !== eu ? copy.escritoPor(nomeDoAutor(e.criado_por, eu, membros)) : null,
    e.shared_with_partner && e.criado_por === eu ? copy.compartilhada : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function LinhaEntrada({ entrada: e, dpp, hoje, eu, membros }: Props) {
  const marco = marcoDoCatalogo(e.milestone_code);
  const Icone = marco ? Sparkles : e.body ? NotebookPen : Mic;
  return (
    <li>
      <Link href={`/diario/${e.id}`} className="flex items-start gap-3 rounded-card bg-superficie px-4 py-3 [[data-tema=escuro]_&]:border [[data-tema=escuro]_&]:border-fio">
        <span aria-hidden className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-full ${marco ? "bg-acento-suave text-texto" : "bg-primaria-suave text-primaria-texto"}`}>
          <Icone size={16} />
        </span>
        <span className="min-w-0 flex-1">
          {marco && <span className="block text-[15px] font-medium text-texto">{marco.title}</span>}
          {e.body && <span className={`block line-clamp-2 ${marco ? "tipo-corpo text-texto-mudo" : "text-[15px] text-texto"}`}>{e.body}</span>}
          <span className="tipo-meta mt-0.5 block">{metaDaEntrada(e, dpp, hoje, eu, membros)}</span>
        </span>
        <ChevronRight size={18} aria-hidden className="mt-2 shrink-0 text-texto-mudo" />
      </Link>
    </li>
  );
}
