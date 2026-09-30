"use client";

import { arredondar5min } from "@/lib/bebe/registros";
import { paraISO } from "@/lib/dates";

interface Props {
  rotulo: string;
  valor: Date;
  onChange: (d: Date) => void;
  /** Padrão: últimas 24 h (BEB-06). */
  agora?: Date;
  erro?: string;
  hoje?: string;
  ontem?: string;
}

/** Seletor de hora de 5 em 5 min, limitado às últimas 24 h: dia (hoje/ontem) + hora nativa. */
export function SeletorHora({ rotulo, valor, onChange, agora = new Date(), erro, hoje = "Hoje", ontem = "Ontem" }: Props) {
  const diaHoje = paraISO(agora);
  const diaValor = paraISO(valor);
  const ehHoje = diaValor === diaHoje;
  const hora = `${String(valor.getHours()).padStart(2, "0")}:${String(valor.getMinutes()).padStart(2, "0")}`;
  const id = `hora-${rotulo.toLowerCase().replace(/\s+/g, "-")}`;

  function mudarDia(paraHoje: boolean) {
    const d = new Date(valor);
    d.setDate(d.getDate() + (paraHoje ? 1 : -1));
    if (paraISO(d) !== (paraHoje ? diaHoje : paraISO(new Date(agora.getTime() - 86_400_000)))) return;
    onChange(d);
  }

  return (
    <div>
      <span className="tipo-titulo-secao mb-1.5 block text-texto-mudo">{rotulo}</span>
      <div className="flex gap-2">
        <div role="radiogroup" aria-label={rotulo} className="flex shrink-0 rounded-pilula bg-primaria-suave p-1">
          {[
            { v: false, t: ontem },
            { v: true, t: hoje },
          ].map(({ v, t }) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={ehHoje === v}
              onClick={() => ehHoje !== v && mudarDia(v)}
              className={`min-h-11 rounded-pilula px-3 text-[13px] font-medium ${ehHoje === v ? "bg-superficie text-primaria-texto" : "text-primaria-texto/80"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <input
          id={id}
          aria-label={`${rotulo}, hora`}
          type="time"
          step={300}
          value={hora}
          onChange={(e) => {
            const [h, m] = e.target.value.split(":").map(Number);
            if (Number.isNaN(h) || Number.isNaN(m)) return;
            const d = new Date(valor);
            d.setHours(h!, m!, 0, 0);
            onChange(arredondar5min(d));
          }}
          className={`min-h-13 flex-1 rounded-card border bg-superficie px-4 text-[16px] text-texto focus:outline-none focus:ring-2 focus:ring-primaria ${erro ? "border-erro" : "border-fio"}`}
        />
      </div>
      {erro && <span className="mt-1.5 block text-[12px] text-erro">{erro}</span>}
    </div>
  );
}
