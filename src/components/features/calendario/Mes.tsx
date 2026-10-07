"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { calendarioCopy as copy } from "@/copy/calendario";
import { formatarLonga } from "@/lib/dates";
import { gradeDoMes, itensDoDia, pontosDoDia, viradaDeSemana, type ItemCalendario } from "@dominio/calendario.ts";
import type { DataISO } from "@dominio/tempo.ts";

import { FUNDO_DA_COR } from "./cores";

interface Props {
  ano: number;
  mes: number;
  itens: ItemCalendario[];
  hoje: DataISO;
  dpp: DataISO | null;
  onMudarMes: (passo: number) => void;
}

/** Tela 1 "Mês": pontos coloridos (até 3 e "+n", RN-01), marcador "22s" na virada (RN-02); toque abre o dia. */
export function Mes({ ano, mes, itens, hoje, dpp, onMudarMes }: Props) {
  const semanas = gradeDoMes(ano, mes);
  return (
    <section aria-label={`${copy.meses[mes - 1]} de ${ano}`}>
      <div className="mb-2 flex items-center gap-1">
        <button type="button" aria-label={copy.mesAnterior} onClick={() => onMudarMes(-1)} className="grid size-11 place-items-center rounded-pilula text-texto active:bg-primaria-suave">
          <ChevronLeft size={20} />
        </button>
        <h2 className="flex-1 text-center text-[17px] font-medium capitalize text-texto" aria-live="polite">
          {copy.meses[mes - 1]} {ano}
        </h2>
        <button type="button" aria-label={copy.proximoMes} onClick={() => onMudarMes(1)} className="grid size-11 place-items-center rounded-pilula text-texto active:bg-primaria-suave">
          <ChevronRight size={20} />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center" aria-hidden>
        {copy.diasDaSemana.map((d, i) => (
          <span key={i} className="tipo-meta py-1">
            {d}
          </span>
        ))}
      </div>
      <div role="grid" className="grid grid-cols-7 gap-y-1">
        {semanas.flat().map((data, i) => {
          if (!data) return <span key={`v${i}`} />;
          const doDia = itensDoDia(itens, data);
          const { cores, mais } = pontosDoDia(doDia);
          const virada = viradaDeSemana(dpp, data);
          const ehHoje = data === hoje;
          const rotulo = [formatarLonga(data), virada ? copy.viradaRotulo(virada) : null, doDia.length ? doDia.map((x) => x.titulo).join(", ") : null].filter(Boolean).join(" · ");
          return (
            <Link
              key={data}
              role="gridcell"
              href={`/calendario/dia?d=${data}`}
              aria-label={rotulo}
              aria-current={ehHoje ? "date" : undefined}
              className={`relative flex min-h-14 flex-col items-center justify-start gap-0.5 rounded-card pt-1 active:bg-primaria-suave ${ehHoje ? "bg-primaria-suave" : ""}`}
            >
              <span className={`text-[15px] ${ehHoje ? "font-semibold text-primaria-texto" : "text-texto"}`}>{Number(data.slice(8))}</span>
              {virada && <span className="text-[10px] font-medium leading-none text-acento">{copy.marcadorSemana(virada)}</span>}
              <span className="flex items-center gap-0.5">
                {cores.map((c, j) => (
                  <span key={j} className={`size-1.5 rounded-full ${FUNDO_DA_COR[c]}`} />
                ))}
                {mais > 0 && <span className="text-[10px] leading-none text-texto-mudo">{copy.mais(mais)}</span>}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
