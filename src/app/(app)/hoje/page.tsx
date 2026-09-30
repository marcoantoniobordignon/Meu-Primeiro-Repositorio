"use client";

import { ChevronRight, Mic, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { AnelPrimeiroAno } from "@/components/features/bebe/AnelPrimeiroAno";
import { CardSoneca } from "@/components/features/bebe/CardSoneca";
import { SeletorBebe } from "@/components/features/bebe/SeletorBebe";
import { SheetsRegistro, type EstadoSheet } from "@/components/features/bebe/SheetsRegistro";
import { TilesBebe } from "@/components/features/bebe/TilesBebe";
import { StoriesDoDia } from "@/components/features/conteudo/StoriesDoDia";
import { AnelSemana } from "@/components/features/home/AnelSemana";
import { CardConsulta } from "@/components/features/home/CardConsulta";
import { CardsAtivos } from "@/components/features/home/CardsAtivos";
import { CardCheckin } from "@/components/features/nascimento/CardCheckin";
import { SheetNascimento } from "@/components/features/nascimento/SheetNascimento";
import { SheetChutes } from "@/components/features/registrar/SheetChutes";
import { SheetContracoes } from "@/components/features/registrar/SheetContracoes";
import { ChipsSintomas } from "@/components/features/sintomas/ChipsSintomas";
import { SheetSintomas } from "@/components/features/sintomas/SheetSintomas";
import { Botao } from "@/components/ui/Botao";
import { bebeCopy } from "@/copy/bebe";
import { home as copy } from "@/copy/home";
import { nascimentoCopy } from "@/copy/nascimento";
import { track } from "@/lib/analytics";
import { sonoEmAndamento } from "@/lib/bebe/registros";
import { useBebes } from "@/lib/bebe/useBebes";
import { registrosBebe } from "@/lib/dados/colecoes";
import { idadeDetalhada, paraISO, saudacaoPorHora, semanaGestacional } from "@/lib/dates";
import { useFamilia } from "@/lib/familia/useFamilia";
import { usePerfil } from "@/lib/perfil";
import type { Especial } from "@/lib/sintomas/catalogo";

const CHAVE_FAIXA = "ninho.faixa-guardar-dispensada";

type SheetAberto = "sintomas" | "chutes" | "contracoes" | "nascimento" | null;

export default function PaginaHoje() {
  const perfil = usePerfil();
  const { ativo, bebes, modo } = useBebes();
  const { permissoes } = useFamilia();
  const [sheet, setSheet] = useState<SheetAberto>(null);
  const [sheetBebe, setSheetBebe] = useState<EstadoSheet>({ tipo: null });
  const [faixa, setFaixa] = useState(false);
  const hoje = paraISO(new Date());
  const g = perfil?.dpp && modo === "gestacao" ? semanaGestacional(perfil.dpp, hoje) : null;

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
  }, [perfil]);

  useEffect(() => {
    if (modo === "bebe" && ativo) track("home_bebe_vista", { bebes: bebes.length, sono_em_andamento: Boolean(sonoEmAndamento(registrosBebe.listar(), ativo.id)) });
    else if (g) track("home_gestacao_vista", { semana: g.semana, trimestre: g.trimestre });
    // Uma vez por abertura da home: só o modo e o bebê ativo disparam.
  }, [modo, ativo?.id]);

  if (!perfil) return null;

  const abrirEspecial = (e: Especial) => setSheet(e);
  const saudacao = saudacaoPorHora(new Date().getHours());

  return (
    <div className="flex flex-col gap-6 px-5">
      <header className="safe-top flex flex-col gap-3">
        <p className="tipo-saudacao text-texto">
          {saudacao}
          {perfil.nome && (
            <>
              , <span className="font-serifa italic">{perfil.nome}</span>
            </>
          )}
        </p>
        <SeletorBebe />
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

      {modo === "bebe" && ativo ? (
        <>
          <AnelPrimeiroAno bebe={ativo} />
          <CardSoneca bebe={ativo} />
          <TilesBebe bebeId={ativo.id} onAbrir={(tipo) => setSheetBebe({ tipo })} />
          <Link href="/registrar" className="tipo-meta flex items-center gap-2 rounded-pilula bg-superficie px-4 py-2.5 [[data-tema=escuro]_&]:border [[data-tema=escuro]_&]:border-fio">
            <Mic size={14} aria-hidden className="shrink-0 text-primaria-texto" />
            {bebeCopy.dicaVoz}
          </Link>
          {permissoes.verCheckinPosParto && <CardCheckin bebe={ativo} />}
          <StoriesDoDia mesBebe={idadeDetalhada(ativo.nascido_em, hoje).meses} />
          <SheetsRegistro estado={sheetBebe} onFechar={() => setSheetBebe({ tipo: null })} bebeId={ativo.id} />
        </>
      ) : (
        <>
          {g && g.diasParaDpp < 0 && (
            <div className="flex items-center gap-3 rounded-card bg-acento-suave px-4 py-3">
              <p className="tipo-corpo flex-1 text-texto">{nascimentoCopy.faixaDpp}</p>
              <Botao onClick={() => setSheet("nascimento")}>{nascimentoCopy.faixaDppCta}</Botao>
            </div>
          )}
          <CardsAtivos onAbrirChutes={() => setSheet("chutes")} onAbrirContracoes={() => setSheet("contracoes")} />
          {g && <AnelSemana g={g} />}

          {permissoes.verSintomas && (
            <section className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setSheet("sintomas")}
                className="flex min-h-13 w-full items-center justify-between rounded-pilula bg-superficie px-5 text-left text-[15px] font-medium text-texto active:brightness-95 [[data-tema=escuro]_&]:border [[data-tema=escuro]_&]:border-fio"
              >
                {copy.comoEsta}
                <ChevronRight size={18} aria-hidden className="text-texto-mudo" />
              </button>
              <ChipsSintomas semana={g?.semana ?? 0} onMais={() => setSheet("sintomas")} onEspecial={abrirEspecial} />
              <Link href="/hoje/diario" className="tipo-titulo-secao flex min-h-11 items-center gap-0.5 self-end text-primaria-texto">
                {copy.verTodas}
                <ChevronRight size={16} aria-hidden />
              </Link>
            </section>
          )}

          <StoriesDoDia semana={g?.semana} />
          <CardConsulta />

          <SheetSintomas aberto={sheet === "sintomas"} onFechar={() => setSheet(null)} onEspecial={abrirEspecial} />
          <SheetChutes aberto={sheet === "chutes"} onFechar={() => setSheet(null)} />
          <SheetContracoes aberto={sheet === "contracoes"} onFechar={() => setSheet(null)} />
          <SheetNascimento aberto={sheet === "nascimento"} onFechar={() => setSheet(null)} />
        </>
      )}
    </div>
  );
}
