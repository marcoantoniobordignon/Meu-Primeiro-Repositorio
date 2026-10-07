"use client";

import { calendarioCopy as copy } from "@/copy/calendario";
import { formatarLonga } from "@/lib/dates";
import { itensDoDia, rotuloGestacional, type ItemCalendario } from "@dominio/calendario.ts";
import type { DataISO } from "@dominio/tempo.ts";

import { LinhaItem } from "./LinhaItem";

/** Tela 2 "Agenda": lista cronológica a partir de hoje, com "Hoje, 22s3d" em cada cabeçalho de dia (RN-02). */
export function Agenda({ itens, hoje, dpp }: { itens: ItemCalendario[]; hoje: DataISO; dpp: DataISO | null }) {
  const dias = [...new Set(itens.filter((i) => i.data >= hoje).map((i) => i.data))].sort().slice(0, 60);
  if (!dias.includes(hoje)) dias.unshift(hoje);
  return (
    <div className="flex flex-col gap-4">
      {dias.map((d) => {
        const doDia = itensDoDia(itens, d);
        const g = rotuloGestacional(dpp, d);
        return (
          <section key={d} aria-labelledby={`dia-${d}`}>
            <h2 id={`dia-${d}`} className="tipo-titulo-secao mb-1 text-texto-mudo">
              {d === hoje ? copy.hojeCabecalho(g) : copy.diaCabecalho(formatarLonga(d), g)}
            </h2>
            {doDia.length ? <ul className="flex flex-col">{doDia.map((i) => <LinhaItem key={`${i.tipo}-${i.id}`} item={i} />)}</ul> : <p className="tipo-meta px-2">{copy.semItens}</p>}
          </section>
        );
      })}
      {dias.length === 1 && !itensDoDia(itens, hoje).length && <p className="tipo-corpo text-texto-mudo">{copy.agendaVazia}</p>}
    </div>
  );
}
