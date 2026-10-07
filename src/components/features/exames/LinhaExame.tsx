"use client";

import { ChevronRight, FlaskConical } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { examesCopy as copy } from "@/copy/exames";
import type { UserExam } from "@/lib/dados/colecoes";
import { formatarQuando } from "@/lib/dates";
import { dataCurta } from "@/lib/exames/regras";
import { useFuso } from "@/lib/hooks/useFuso";
import { nomeDoExame } from "@dominio/exames.ts";
import { dataNoFuso } from "@dominio/tempo.ts";

/** Detalhe curto do exame: janela, data marcada ou data em que foi feito. */
export function resumoDoExame(e: UserExam, tz: string, agora: Date = new Date()): string {
  if (e.status === "done") return e.done_on ? copy.feitoEm(dataCurta(e.done_on)) : copy.feito;
  if (e.status === "scheduled" && e.scheduled_at) {
    const quando = e.scheduled_all_day ? `${dataCurta(dataNoFuso(new Date(e.scheduled_at), tz))} · ${copy.diaTodo}` : formatarQuando(e.scheduled_at, agora);
    return copy.marcadoPara(quando) + (e.location ? ` · ${e.location}` : "");
  }
  if (e.window_start_date && e.window_end_date) return copy.janela(dataCurta(e.window_start_date), dataCurta(e.window_end_date));
  return copy.semJanela;
}

export function LinhaExame({ exame, acao }: { exame: UserExam; acao?: ReactNode }) {
  const tz = useFuso();
  return (
    <li className="flex items-center gap-2 rounded-card bg-superficie py-2 pl-4 pr-2 [[data-tema=escuro]_&]:border [[data-tema=escuro]_&]:border-fio">
      <Link href={`/exames/${exame.id}`} className="flex min-h-11 min-w-0 flex-1 items-center gap-3">
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-primaria-suave text-primaria-texto">
          <FlaskConical size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium leading-snug text-texto">{nomeDoExame(exame)}</span>
          <span className="tipo-meta block">{resumoDoExame(exame, tz)}</span>
        </span>
        {!acao && <ChevronRight size={18} aria-hidden className="shrink-0 text-texto-mudo" />}
      </Link>
      {acao}
    </li>
  );
}
