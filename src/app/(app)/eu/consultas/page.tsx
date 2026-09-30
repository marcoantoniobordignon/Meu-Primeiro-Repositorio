"use client";

import { CalendarDays, Check, ChevronRight } from "lucide-react";
import { useState } from "react";

import { SheetConsulta } from "@/components/features/consultas/SheetConsulta";
import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { Vazio } from "@/components/ui/Vazio";
import { consultasCopy as copy } from "@/copy/consultas";
import { ordenarParaLista, tiposConsulta } from "@/lib/consultas";
import { useColecao } from "@/lib/dados/colecao";
import { consultas, type Consulta } from "@/lib/dados/colecoes";
import { formatarQuando } from "@/lib/dates";
import { useAgora } from "@/lib/hooks/useAgora";

export default function PaginaConsultas() {
  const todas = useColecao(consultas);
  const agora = useAgora(60_000);
  const { futuras, passadas } = ordenarParaLista(todas, agora);
  const [sheet, setSheet] = useState<{ aberto: boolean; consulta: Consulta | null }>({ aberto: false, consulta: null });

  const linha = (c: Consulta) => (
    <li key={c.id}>
      <button type="button" onClick={() => setSheet({ aberto: true, consulta: c })} className="flex w-full items-center gap-3 rounded-card bg-superficie px-4 py-3 text-left [[data-tema=escuro]_&]:border [[data-tema=escuro]_&]:border-fio">
        <span aria-hidden className={`grid size-10 shrink-0 place-items-center rounded-full ${c.realizada ? "bg-sucesso text-white" : "bg-primaria-suave text-primaria-texto"}`}>
          {c.realizada ? <Check size={18} strokeWidth={3} /> : <CalendarDays size={18} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium text-texto">{formatarQuando(c.data, agora)}</span>
          <span className="tipo-meta block truncate">
            {tiposConsulta[c.tipo]}
            {c.profissional ? ` · ${c.profissional}` : ""}
            {c.realizada ? ` · ${copy.realizada}` : ""}
          </span>
        </span>
        <ChevronRight size={18} aria-hidden className="text-texto-mudo" />
      </button>
    </li>
  );

  return (
    <div>
      <Cabecalho titulo={copy.titulo} voltarPara="/eu" />
      {todas.length === 0 ? (
        <Vazio icone={<CalendarDays size={24} />} frase={copy.vazio} acao={<Botao onClick={() => setSheet({ aberto: true, consulta: null })}>{copy.adicionar}</Botao>} />
      ) : (
        <div className="flex flex-col gap-5 px-5 pt-2">
          {futuras.length > 0 && (
            <section>
              <h2 className="tipo-titulo-secao mb-2 text-texto-mudo">{copy.futuras}</h2>
              <ul className="flex flex-col gap-2">{futuras.map(linha)}</ul>
            </section>
          )}
          {passadas.length > 0 && (
            <section>
              <h2 className="tipo-titulo-secao mb-2 text-texto-mudo">{copy.passadas}</h2>
              <ul className="flex flex-col gap-2">{passadas.map(linha)}</ul>
            </section>
          )}
          <Botao largura="total" variant="secundario" onClick={() => setSheet({ aberto: true, consulta: null })}>
            {copy.adicionar}
          </Botao>
        </div>
      )}
      <SheetConsulta aberto={sheet.aberto} consulta={sheet.consulta} onFechar={() => setSheet((s) => ({ ...s, aberto: false }))} />
    </div>
  );
}
