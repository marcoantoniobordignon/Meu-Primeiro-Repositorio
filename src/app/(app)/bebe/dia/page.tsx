"use client";

import { ChevronLeft, ChevronRight, NotebookPen } from "lucide-react";
import { useEffect, useState } from "react";

import { SheetsRegistro, type EstadoSheet } from "@/components/features/bebe/SheetsRegistro";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { Vazio } from "@/components/ui/Vazio";
import { bebeCopy as copy } from "@/copy/bebe";
import { track } from "@/lib/analytics";
import { blocosDoDia, detalheDoRegistro } from "@/lib/bebe/registros";
import { useBebes } from "@/lib/bebe/useBebes";
import { useColecao } from "@/lib/dados/colecao";
import { registrosBebe } from "@/lib/dados/colecoes";
import { formatarHora, paraISO, rotuloDia, somarDias } from "@/lib/dates";
import { nomeDoAutor } from "@/lib/familia/regras";
import { useFamilia } from "@/lib/familia/useFamilia";
import { useAgora } from "@/lib/hooks/useAgora";

const cor = { sono: "bg-sono", mamada: "bg-mamada", fralda: "bg-fralda", banho: "bg-banho", outro: "bg-texto-mudo" } as const;

/** BEB-08: linha do tempo do dia, 0h–24h, blocos coloridos; toque para editar. */
export default function PaginaDia() {
  const { ativo } = useBebes();
  const todos = useColecao(registrosBebe);
  const { membros, meuId } = useFamilia();
  const agora = useAgora(30_000);
  const hoje = paraISO(agora);
  const [dia, setDia] = useState(hoje);
  const [sheet, setSheet] = useState<EstadoSheet>({ tipo: null });

  const blocos = ativo ? blocosDoDia(todos, ativo.id, dia, agora) : [];

  useEffect(() => {
    track("dia_visto", { registros: blocos.length });
    // Um evento por dia visto, não por registro novo.
  }, [dia]);

  if (!ativo) return null;

  return (
    <div>
      <Cabecalho titulo={copy.dia.titulo} voltarPara="/bebe" />
      <div className="flex flex-col gap-4 px-5 pt-1">
        <div className="flex items-center justify-between">
          <button type="button" aria-label="Dia anterior" onClick={() => setDia((d) => somarDias(d, -1))} className="grid size-11 place-items-center rounded-pilula text-texto active:bg-primaria-suave">
            <ChevronLeft size={20} />
          </button>
          <p className="tipo-saudacao text-texto">{rotuloDia(dia, hoje)}</p>
          <button type="button" aria-label="Dia seguinte" disabled={dia >= hoje} onClick={() => setDia((d) => somarDias(d, 1))} className="grid size-11 place-items-center rounded-pilula text-texto active:bg-primaria-suave disabled:opacity-30">
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="rounded-card bg-superficie p-3 [[data-tema=escuro]_&]:border [[data-tema=escuro]_&]:border-fio">
          <div className="relative h-8 overflow-hidden rounded-pilula bg-fio">
            {blocos.map((b) => (
              <span
                key={b.registro.id}
                aria-hidden
                className={`absolute inset-y-0 ${cor[b.registro.tipo]} ${b.emAndamento ? "bg-[repeating-linear-gradient(135deg,transparent,transparent_4px,rgba(255,255,255,.35)_4px,rgba(255,255,255,.35)_8px)]" : ""}`}
                style={{ left: `${(b.inicioMin / 1440) * 100}%`, width: `${Math.max(0.6, ((b.fimMin - b.inicioMin) / 1440) * 100)}%` }}
              />
            ))}
          </div>
          <div className="tipo-meta mt-1 flex justify-between text-[10px]">
            {["0h", "6h", "12h", "18h", "24h"].map((h) => (
              <span key={h}>{h}</span>
            ))}
          </div>
        </div>

        {blocos.length === 0 ? (
          <Vazio icone={<NotebookPen size={24} />} frase={copy.dia.vazio} />
        ) : (
          <ul className="flex flex-col gap-2">
            {[...blocos].reverse().map((b) => {
              const r = b.registro;
              return (
                <li key={r.id}>
                  <button type="button" onClick={() => setSheet({ tipo: r.tipo === "outro" ? null : r.tipo, registro: r })} className="flex w-full items-center gap-3 rounded-card bg-superficie px-4 py-3 text-left [[data-tema=escuro]_&]:border [[data-tema=escuro]_&]:border-fio">
                    <span aria-hidden className={`size-3 shrink-0 rounded-full ${cor[r.tipo]}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-medium text-texto">
                        {copy.tiles[r.tipo as keyof typeof copy.tiles] ?? copy.outro.titulo}
                        {b.emAndamento && <span className="tipo-meta"> · {copy.dia.emAndamento}</span>}
                      </span>
                      <span className="tipo-meta block truncate">
                        {formatarHora(r.inicio)}
                        {r.fim && r.fim !== r.inicio ? ` – ${formatarHora(r.fim)}` : ""}
                        {detalheDoRegistro(r) ? ` · ${detalheDoRegistro(r)}` : ""}
                        {r.criado_por !== meuId ? ` · ${copy.dia.por(nomeDoAutor(r.criado_por, meuId, membros))}` : ""}
                      </span>
                    </span>
                    <span className="tipo-meta">{copy.editar}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <SheetsRegistro estado={sheet} onFechar={() => setSheet({ tipo: null })} bebeId={ativo.id} />
    </div>
  );
}
