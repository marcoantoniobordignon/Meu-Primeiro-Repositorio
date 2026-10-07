"use client";

import { CalendarDays, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { CardComoFoi } from "@/components/features/consultas/CardComoFoi";
import { detalheDaConsulta } from "@/components/features/consultas/LinhaConsulta";
import { SheetConsulta } from "@/components/features/consultas/SheetConsulta";
import { Botao } from "@/components/ui/Botao";
import { home as copy } from "@/copy/home";
import { consultasCopy } from "@/copy/consultas";
import { estadoDoCard } from "@/lib/consultas";
import { useColecao } from "@/lib/dados/colecao";
import { appointmentQuestions, appointments } from "@/lib/dados/colecoes";
import { formatarQuando } from "@/lib/dates";
import { useFamilia } from "@/lib/familia/useFamilia";
import { useAgora } from "@/lib/hooks/useAgora";
import { useFuso } from "@/lib/hooks/useFuso";
import { pautaDaConsulta } from "@dominio/consultas.ts";

/** Próxima consulta na home (HG-05: coral a partir de 24 h antes) e "Como foi a consulta?" (funcionalidade 04 RN-07). */
export function CardConsulta() {
  const todas = useColecao(appointments);
  const perguntas = useColecao(appointmentQuestions);
  const { permissoes } = useFamilia();
  const tz = useFuso();
  const agora = useAgora(60_000);
  const estado = estadoDoCard(todas, agora, tz);
  const [nova, setNova] = useState(false);

  if (!permissoes.verAgenda) return null;
  if (estado.tipo === "como_foi") return <CardComoFoi consulta={estado.consulta} agora={agora} podeConcluir={permissoes.gerirConsultas} />;

  const borda = estado.tipo === "proxima" && estado.iminente ? "border-acento" : "border-transparent [[data-tema=escuro]_&]:border-fio";
  const pendentes = estado.tipo === "proxima" ? pautaDaConsulta(estado.consulta, estado.consulta, perguntas).length : 0;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="tipo-titulo-secao text-texto">{copy.consulta.titulo}</h2>
        <Link href="/consultas" className="tipo-titulo-secao flex min-h-11 items-center gap-0.5 text-primaria-texto">
          {copy.consulta.verTodas}
          <ChevronRight size={16} aria-hidden />
        </Link>
      </div>

      <div className={`rounded-card border-2 bg-superficie px-4 py-3.5 ${borda}`}>
        {estado.tipo === "nenhuma" ? (
          <div className="flex items-center gap-3">
            <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-primaria-suave text-primaria-texto">
              <CalendarDays size={18} />
            </span>
            <p className="tipo-corpo flex-1 text-texto-mudo">{consultasCopy.vazio}</p>
            {permissoes.gerirConsultas && (
              <Botao variant="secundario" onClick={() => setNova(true)}>
                {copy.consulta.adicionar}
              </Botao>
            )}
          </div>
        ) : (
          <Link href={`/consultas/${estado.consulta.id}`} className="flex w-full items-center gap-3 text-left">
            <span aria-hidden className={`grid size-10 shrink-0 place-items-center rounded-full ${estado.iminente ? "bg-acento text-white" : "bg-primaria-suave text-primaria-texto"}`}>
              <CalendarDays size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-medium text-texto">{formatarQuando(estado.consulta.starts_at, agora)}</span>
              <span className="tipo-meta block truncate">
                {detalheDaConsulta(estado.consulta)}
                {pendentes > 0 ? ` · ${consultasCopy.perguntasNaPauta(pendentes)}` : ""}
              </span>
            </span>
            <ChevronRight size={18} aria-hidden className="text-texto-mudo" />
          </Link>
        )}
      </div>

      <SheetConsulta aberto={nova} onFechar={() => setNova(false)} />
    </section>
  );
}
