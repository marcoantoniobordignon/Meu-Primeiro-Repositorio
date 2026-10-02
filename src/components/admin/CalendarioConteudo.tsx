"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Story } from "@/components/ui/Story";
import { adminCopy as copy } from "@/copy/admin";
import { DIAS_DA_SEMANA } from "@/lib/admin/conteudo";
import type { Conteudo } from "@/lib/conteudo/banco";
import { elegivel, storiesDoDia } from "@/lib/conteudo/stories";
import { paraISO, somarDias } from "@/lib/dates";

import { Segmentado } from "./Segmentado";

interface Props {
  conteudos: Conteudo[];
}

const cal = copy.conteudo.calendario;

/**
 * "Por dia": simula o carrossel de cada um dos próximos 7 dias para uma
 * gestante numa semana (ou um bebê num mês). Usa a mesma função do app.
 */
export function CalendarioConteudo({ conteudos }: Props) {
  const [modo, setModo] = useState<"gestacao" | "bebe">("gestacao");
  const [semana, setSemana] = useState(20);
  const [mes, setMes] = useState(1);
  const hoje = paraISO(new Date());

  const publicados = useMemo(() => conteudos.filter((c) => c.publicado), [conteudos]);
  const ctx = modo === "gestacao" ? { semana } : { mesBebe: mes };
  const elegiveis = publicados.filter((c) => c.categoria !== "semana" && elegivel(c, { hoje, ...ctx }));
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(hoje, i));

  return (
    <div className="flex flex-col gap-4">
      <p className="tipo-corpo text-texto-mudo">{cal.apoio}</p>
      <div className="flex flex-wrap items-end gap-3">
        <Segmentado
          rotulo={cal.modo}
          valor={modo}
          onMudar={setModo}
          opcoes={[
            { valor: "gestacao", rotulo: cal.gestacao },
            { valor: "bebe", rotulo: cal.bebe },
          ]}
        />
        <label className="flex items-center gap-2 text-[13px] text-texto-mudo">
          {modo === "gestacao" ? cal.semana : cal.mes}
          <input
            type="range"
            min={modo === "gestacao" ? 1 : 0}
            max={modo === "gestacao" ? 42 : 24}
            value={modo === "gestacao" ? semana : mes}
            onChange={(e) => (modo === "gestacao" ? setSemana(Number(e.target.value)) : setMes(Number(e.target.value)))}
            className="w-40 accent-primaria"
            aria-label={modo === "gestacao" ? cal.semana : cal.mes}
          />
          <span className="w-6 text-right font-medium tabular-nums text-texto">{modo === "gestacao" ? semana : mes}</span>
        </label>
        <span className="tipo-meta">{cal.elegiveis(elegiveis.length)}</span>
      </div>

      {elegiveis.length === 0 && (modo === "bebe" || !publicados.some((c) => c.categoria === "semana" && c.semana_min === semana)) ? (
        <p role="alert" className="rounded-card bg-acento-suave px-4 py-3 text-[13px] text-texto">
          {cal.semStories}
        </p>
      ) : null}

      <div className="scroll-x-sem-barra -mx-4 flex gap-3 px-4 pb-2 md:mx-0 md:grid md:grid-cols-7 md:px-0">
        {dias.map((dia, i) => {
          const stories = storiesDoDia([], { hoje: dia, ...ctx }, publicados);
          const diaSemana = new Date(`${dia}T12:00:00`).getDay();
          return (
            <div key={dia} className={`flex w-[134px] shrink-0 flex-col gap-2 rounded-card p-2 md:w-auto ${i === 0 ? "bg-primaria-suave/60" : "bg-superficie"}`}>
              <div className="px-1">
                <p className="text-[12px] font-medium text-texto">
                  {DIAS_DA_SEMANA[diaSemana]} {i === 0 && <span className="text-primaria-texto">· {cal.hoje}</span>}
                </p>
                <p className="tipo-meta">{dia.slice(8)}/{dia.slice(5, 7)}</p>
              </div>
              {stories.map((s) => (
                <div key={s.conteudo.id} className="relative">
                  <Story href={`/admin/conteudo/${s.conteudo.id}`} titulo={s.conteudo.titulo} meta={`${s.conteudo.minutos_leitura} min`} cor={s.conteudo.cor_token} />
                  {s.conteudo.dia_da_semana === diaSemana && (
                    <span className="absolute right-2 top-2 rounded-pilula bg-superficie px-1.5 text-[9px] font-medium text-texto-mudo">{cal.doDia}</span>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {elegiveis.length > 0 && (
        <details className="rounded-card bg-superficie px-4 py-3">
          <summary className="cursor-pointer text-[13px] font-medium text-texto">{cal.elegiveis(elegiveis.length)}</summary>
          <ul className="mt-2 flex flex-wrap gap-2">
            {elegiveis.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/conteudo/${c.id}`} className="inline-flex min-h-9 items-center rounded-pilula border border-fio px-3 text-[12px] text-texto hover:bg-primaria-suave">
                  {c.titulo}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
