"use client";

import { ChevronRight, MoonStar } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { bebeCopy as copy } from "@/copy/bebe";
import { track } from "@/lib/analytics";
import { doBebe } from "@/lib/bebe/registros";
import { preverSoneca } from "@/lib/bebe/soneca";
import { useColecao } from "@/lib/dados/colecao";
import { registrosBebe, type Bebe } from "@/lib/dados/colecoes";
import { formatarHora, formatarMinutos } from "@/lib/dates";
import { useAgora } from "@/lib/hooks/useAgora";

/** SON-05/06/07: card "Próxima soneca"; coral dentro e depois da janela, sem tom de alarme. */
export function CardSoneca({ bebe }: { bebe: Bebe }) {
  const todos = useColecao(registrosBebe);
  const agora = useAgora(30_000);
  const p = preverSoneca(doBebe(todos, bebe.id), bebe, agora);
  const ultimoEstado = useRef<string | null>(null);

  useEffect(() => {
    if (ultimoEstado.current === p.estado) return;
    ultimoEstado.current = p.estado;
    track("previsao_vista", { estado: p.estado, base: p.base });
  }, [p.estado, p.base]);

  const hora = (ms: number) => formatarHora(new Date(ms).toISOString());
  const coral = p.estado === "na_janela" || p.estado === "passou";

  let principal = "";
  let secundaria = "";
  if (p.estado === "sem_dados") principal = copy.soneca.semDados;
  else if (p.estado === "dormindo") principal = copy.soneca.dormindo(p.dormindoHa ?? 0);
  else if (p.estado === "antes") {
    principal = copy.soneca.provavel(hora(p.janelaInicio!), hora(p.janelaFim!));
    secundaria = copy.soneca.linha(formatarMinutos(p.vigiliaMin ?? 0), formatarHora(p.acordouEm!));
  } else if (p.estado === "na_janela") {
    principal = copy.soneca.agora(hora(p.janelaFim!));
    secundaria = copy.soneca.linha(formatarMinutos(p.vigiliaMin ?? 0), formatarHora(p.acordouEm!));
  } else {
    principal = copy.soneca.passou(Math.round((agora.getTime() - p.janelaFim!) / 60_000));
    secundaria = copy.soneca.linha(formatarMinutos(p.vigiliaMin ?? 0), formatarHora(p.acordouEm!));
  }

  return (
    <Link
      href="/bebe/sono"
      className={`flex items-center gap-3 rounded-card px-4 py-3.5 transition-transform active:scale-[0.99] ${
        coral ? "bg-acento text-white" : "bg-superficie text-texto [[data-tema=escuro]_&]:border [[data-tema=escuro]_&]:border-fio"
      }`}
    >
      <span aria-hidden className={`grid size-10 shrink-0 place-items-center rounded-full ${coral ? "bg-white/20" : "bg-sono/15 text-sono"}`}>
        <MoonStar size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`tipo-titulo-secao block ${coral ? "text-white/85" : "text-texto-mudo"}`}>{copy.soneca.titulo}</span>
        <span className="mt-0.5 block text-[15px] font-medium leading-tight">{principal}</span>
        {secundaria && <span className={`tipo-meta mt-0.5 block ${coral ? "text-white/80" : ""}`}>{secundaria} · {p.base === "mediana" ? copy.soneca.baseMediana : copy.soneca.baseTabela}</span>}
      </span>
      <ChevronRight size={18} aria-hidden className={coral ? "text-white/80" : "text-texto-mudo"} />
    </Link>
  );
}
