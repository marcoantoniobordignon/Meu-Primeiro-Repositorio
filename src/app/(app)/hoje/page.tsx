"use client";

import { ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { StoriesDoDia } from "@/components/features/conteudo/StoriesDoDia";
import { AnelSemana } from "@/components/features/home/AnelSemana";
import { CardConsulta } from "@/components/features/home/CardConsulta";
import { CardsAtivos } from "@/components/features/home/CardsAtivos";
import { SheetChutes } from "@/components/features/registrar/SheetChutes";
import { SheetContracoes } from "@/components/features/registrar/SheetContracoes";
import { ChipsSintomas } from "@/components/features/sintomas/ChipsSintomas";
import { SheetSintomas } from "@/components/features/sintomas/SheetSintomas";
import { home as copy } from "@/copy/home";
import { track } from "@/lib/analytics";
import { idadeBebe, paraISO, saudacaoPorHora, semanaGestacional } from "@/lib/dates";
import { usePerfil } from "@/lib/perfil";
import type { Especial } from "@/lib/sintomas/catalogo";

const CHAVE_FAIXA = "ninho.faixa-guardar-dispensada";

type SheetAberto = "sintomas" | "chutes" | "contracoes" | null;

export default function PaginaHoje() {
  const perfil = usePerfil();
  const [sheet, setSheet] = useState<SheetAberto>(null);
  const [faixa, setFaixa] = useState(false);
  const hoje = paraISO(new Date());
  const g = perfil?.dpp ? semanaGestacional(perfil.dpp, hoje) : null;
  const modoBebe = perfil?.modo === "bebe";
  const bebe = modoBebe && perfil?.nascidoEm ? idadeBebe(perfil.nascidoEm, hoje) : null;

  useEffect(() => {
    if (!perfil) return;
    let dispensada = false;
    try {
      dispensada = localStorage.getItem(CHAVE_FAIXA) === "1";
    } catch {
      /* nada */
    }
    const dias = (Date.now() - new Date(perfil.onboardingConcluidoEm).getTime()) / 86_400_000;
    setFaixa(perfil.anonima && !dispensada && dias <= 3);
    if (g) track("home_gestacao_vista", { semana: g.semana, trimestre: g.trimestre });
  }, [perfil?.onboardingConcluidoEm]);

  if (!perfil) return null;

  const abrirEspecial = (e: Especial) => setSheet(e);
  const saudacao = saudacaoPorHora(new Date().getHours());

  return (
    <div className="flex flex-col gap-6 px-5">
      <header className="safe-top flex items-center justify-between">
        <p className="tipo-saudacao text-texto">
          {saudacao}
          {perfil.nome && (
            <>
              , <span className="font-serifa italic">{perfil.nome}</span>
            </>
          )}
        </p>
      </header>

      {faixa && (
        <div className="-mt-2 flex items-center gap-2 rounded-pilula bg-primaria-suave py-1.5 pl-4 pr-1.5">
          <Link href="/eu" className="flex-1 text-left text-[13px] font-medium text-primaria-texto">
            {copy.guardarLinha}
          </Link>
          <button
            type="button"
            aria-label={copy.dispensar}
            onClick={() => {
              try {
                localStorage.setItem(CHAVE_FAIXA, "1");
              } catch {
                /* nada */
              }
              setFaixa(false);
            }}
            className="grid size-9 place-items-center rounded-pilula text-primaria-texto"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <CardsAtivos onAbrirChutes={() => setSheet("chutes")} onAbrirContracoes={() => setSheet("contracoes")} />

      {g && !modoBebe && <AnelSemana g={g} />}

      {bebe && (
        <div className="py-2 text-center">
          <p className="tipo-heroi text-texto">{bebe.dias}</p>
          <p className="tipo-heroi-rotulo text-texto-mudo">{bebe.dias === 1 ? copy.bebe.diaDeVida : copy.bebe.diasDeVida}</p>
          <p className="tipo-meta mt-3">{copy.bebe.emBreve}</p>
        </div>
      )}

      <section className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setSheet("sintomas")}
          className="flex min-h-13 w-full items-center justify-between rounded-pilula bg-superficie px-5 text-left text-[15px] font-medium text-texto active:brightness-95 [[data-tema=escuro]_&]:border [[data-tema=escuro]_&]:border-fio"
        >
          {copy.comoEsta}
          <ChevronRight size={18} aria-hidden className="text-texto-mudo" />
        </button>
        <ChipsSintomas semana={g?.semana ?? 0} modoBebe={modoBebe} onMais={() => setSheet("sintomas")} onEspecial={abrirEspecial} />
        <Link href="/hoje/diario" className="tipo-titulo-secao flex min-h-11 items-center gap-0.5 self-end text-primaria-texto">
          {copy.verTodas}
          <ChevronRight size={16} aria-hidden />
        </Link>
      </section>

      <StoriesDoDia semana={modoBebe ? undefined : g?.semana} mesBebe={bebe?.meses} />

      {!modoBebe && <CardConsulta />}

      <SheetSintomas aberto={sheet === "sintomas"} onFechar={() => setSheet(null)} onEspecial={abrirEspecial} />
      <SheetChutes aberto={sheet === "chutes"} onFechar={() => setSheet(null)} />
      <SheetContracoes aberto={sheet === "contracoes"} onFechar={() => setSheet(null)} />
    </div>
  );
}
