"use client";

import { CalendarDays, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { SheetConsulta } from "@/components/features/consultas/SheetConsulta";
import { Botao } from "@/components/ui/Botao";
import { useToast } from "@/components/ui/Toast";
import { consultasCopy } from "@/copy/consultas";
import { home as copy } from "@/copy/home";
import { track } from "@/lib/analytics";
import { estadoDoCard, tiposConsulta } from "@/lib/consultas";
import { useColecao } from "@/lib/dados/colecao";
import { consultas, type Consulta } from "@/lib/dados/colecoes";
import { formatarQuando } from "@/lib/dates";
import { useAgora } from "@/lib/hooks/useAgora";

/** HG-05/06: próxima consulta; iminente ganha borda coral; passada pergunta "Foi bem?". */
export function CardConsulta() {
  const todas = useColecao(consultas);
  const agora = useAgora(60_000);
  const estado = estadoDoCard(todas, agora);
  const [sheet, setSheet] = useState<{ aberto: boolean; consulta: Consulta | null }>({ aberto: false, consulta: null });
  const { mostrar } = useToast();

  function realizada(c: Consulta) {
    consultas.salvar({ ...c, realizada: true });
    track("consulta_realizada", {});
    mostrar(consultasCopy.salva);
  }

  const borda = estado.tipo === "proxima" && estado.iminente ? "border-acento" : "border-transparent [[data-tema=escuro]_&]:border-fio";

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="tipo-titulo-secao text-texto">{copy.consulta.titulo}</h2>
        <Link href="/eu/consultas" className="tipo-titulo-secao flex min-h-11 items-center gap-0.5 text-primaria-texto">
          {copy.consulta.verTodas}
          <ChevronRight size={16} aria-hidden />
        </Link>
      </div>

      <div className={`rounded-card border-2 bg-superficie px-4 py-3.5 ${borda}`}>
        {estado.tipo === "nenhuma" && (
          <div className="flex items-center gap-3">
            <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-primaria-suave text-primaria-texto">
              <CalendarDays size={18} />
            </span>
            <p className="tipo-corpo flex-1 text-texto-mudo">{copy.consulta.nenhuma}</p>
            <Botao variant="secundario" onClick={() => setSheet({ aberto: true, consulta: null })}>
              {copy.consulta.adicionar}
            </Botao>
          </div>
        )}

        {estado.tipo === "proxima" && (
          <button type="button" onClick={() => setSheet({ aberto: true, consulta: estado.consulta })} className="flex w-full items-center gap-3 text-left">
            <span aria-hidden className={`grid size-10 shrink-0 place-items-center rounded-full ${estado.iminente ? "bg-acento text-white" : "bg-primaria-suave text-primaria-texto"}`}>
              <CalendarDays size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-medium text-texto">{formatarQuando(estado.consulta.data, agora)}</span>
              <span className="tipo-meta block truncate">
                {tiposConsulta[estado.consulta.tipo]}
                {estado.consulta.profissional ? ` · ${estado.consulta.profissional}` : ""}
                {estado.consulta.local ? ` · ${estado.consulta.local}` : ""}
              </span>
            </span>
            <ChevronRight size={18} aria-hidden className="text-texto-mudo" />
          </button>
        )}

        {estado.tipo === "passada" && (
          <div>
            <p className="tipo-saudacao text-texto">{copy.consulta.foiBem}</p>
            <p className="tipo-meta mt-0.5">
              {tiposConsulta[estado.consulta.tipo]} · {formatarQuando(estado.consulta.data, agora)}
            </p>
            <div className="mt-3 flex gap-2">
              <Botao largura="total" onClick={() => realizada(estado.consulta)}>
                {copy.consulta.sim}
              </Botao>
              <Botao largura="total" variant="secundario" onClick={() => setSheet({ aberto: true, consulta: estado.consulta })}>
                {copy.consulta.remarcar}
              </Botao>
            </div>
          </div>
        )}
      </div>

      <SheetConsulta aberto={sheet.aberto} consulta={sheet.consulta} onFechar={() => setSheet((s) => ({ ...s, aberto: false }))} />
    </section>
  );
}
