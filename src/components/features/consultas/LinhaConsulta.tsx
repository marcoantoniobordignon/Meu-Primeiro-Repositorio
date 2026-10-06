"use client";

import { CalendarDays, Check, ChevronRight, X } from "lucide-react";
import Link from "next/link";

import { consultasCopy as copy } from "@/copy/consultas";
import { papeisProfissional, tiposConsulta } from "@/lib/consultas";
import type { Appointment } from "@/lib/dados/colecoes";
import { formatarQuando } from "@/lib/dates";

export function detalheDaConsulta(c: Appointment): string {
  return [tiposConsulta[c.kind], c.provider_name ?? (c.provider_role ? papeisProfissional[c.provider_role] : null), c.location].filter(Boolean).join(" · ");
}

export function LinhaConsulta({ consulta, agora }: { consulta: Appointment; agora: Date }) {
  const c = consulta;
  return (
    <li>
      <Link href={`/consultas/${c.id}`} className="flex min-h-14 items-center gap-3 rounded-card bg-superficie px-4 py-3 [[data-tema=escuro]_&]:border [[data-tema=escuro]_&]:border-fio">
        <span aria-hidden className={`grid size-10 shrink-0 place-items-center rounded-full ${c.status === "done" ? "bg-sucesso text-white" : c.status === "cancelled" ? "bg-fio text-texto-mudo" : "bg-primaria-suave text-primaria-texto"}`}>
          {c.status === "done" ? <Check size={18} strokeWidth={3} /> : c.status === "cancelled" ? <X size={18} /> : <CalendarDays size={18} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium text-texto">{formatarQuando(c.starts_at, agora)}</span>
          <span className="tipo-meta block truncate">
            {detalheDaConsulta(c)}
            {c.status !== "scheduled" ? ` · ${copy.status[c.status]}` : ""}
          </span>
        </span>
        <ChevronRight size={18} aria-hidden className="text-texto-mudo" />
      </Link>
    </li>
  );
}
