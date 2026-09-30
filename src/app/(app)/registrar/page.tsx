"use client";

import { Activity, Baby, Bath, CalendarDays, Droplets, Footprints, HeartPulse, Milk, Moon } from "lucide-react";
import { useEffect, useState } from "react";

import { SheetsRegistro, type EstadoSheet } from "@/components/features/bebe/SheetsRegistro";
import { SheetConsulta } from "@/components/features/consultas/SheetConsulta";
import { SheetNascimento } from "@/components/features/nascimento/SheetNascimento";
import { SheetChutes } from "@/components/features/registrar/SheetChutes";
import { SheetContracoes } from "@/components/features/registrar/SheetContracoes";
import { SheetSintomas } from "@/components/features/sintomas/SheetSintomas";
import { BotaoVoz } from "@/components/features/voz/BotaoVoz";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { bebeCopy } from "@/copy/bebe";
import { nascimentoCopy } from "@/copy/nascimento";
import { registrarCopy as copy } from "@/copy/registrar";
import { track } from "@/lib/analytics";
import { useBebes } from "@/lib/bebe/useBebes";
import type { TipoRegistroBebe } from "@/lib/dados/colecoes";
import { paraISO, semanaGestacional } from "@/lib/dates";
import { useFamilia } from "@/lib/familia/useFamilia";
import { usePerfil } from "@/lib/perfil";

type TipoGestacao = "sintoma" | "chutes" | "contracoes" | "consulta" | "nascimento";

interface Opcao {
  tipo: string;
  Icone: typeof Activity;
  cor: string;
  titulo: string;
  desc: string;
}

/** Tela do "+": microfone em cima (spec 08) e os tipos manuais por modo (NAV-04). */
export default function PaginaRegistrar() {
  const perfil = usePerfil();
  const { ativo, bebes, modo } = useBebes();
  const { permissoes } = useFamilia();
  const [gestacao, setGestacao] = useState<TipoGestacao | null>(null);
  const [bebe, setBebe] = useState<EstadoSheet>({ tipo: null });

  useEffect(() => {
    track("plus_aberto", { modo, origem: "tab" });
  }, [modo]);

  if (!perfil) return null;

  const semana = perfil.dpp ? semanaGestacional(perfil.dpp, paraISO(new Date())).semana : 0;
  const opcoesGestacao: Opcao[] = [
    ...(permissoes.verSintomas ? [{ tipo: "sintoma", Icone: HeartPulse, cor: "bg-acento", ...copy.sintoma }] : []),
    { tipo: "chutes", Icone: Footprints, cor: "bg-banho", ...copy.chutes },
    { tipo: "contracoes", Icone: Activity, cor: "bg-fralda", ...copy.contracoes },
    { tipo: "consulta", Icone: CalendarDays, cor: "bg-primaria", ...copy.consulta },
    ...(semana >= 36 ? [{ tipo: "nascimento", Icone: Baby, cor: "bg-sono", titulo: nascimentoCopy.nasceu, desc: nascimentoCopy.nasceuDesc }] : []),
  ];
  const opcoesBebe: Opcao[] = [
    { tipo: "sono", Icone: Moon, cor: "bg-sono", titulo: bebeCopy.tiles.sono, desc: bebeCopy.sono.comecarAgora },
    { tipo: "mamada", Icone: Milk, cor: "bg-mamada", titulo: bebeCopy.tiles.mamada, desc: `${bebeCopy.mamada.peito} · ${bebeCopy.mamada.mamadeira}` },
    { tipo: "fralda", Icone: Droplets, cor: "bg-fralda", titulo: bebeCopy.tiles.fralda, desc: `${bebeCopy.fralda.xixi} · ${bebeCopy.fralda.coco}` },
    { tipo: "banho", Icone: Bath, cor: "bg-banho", titulo: bebeCopy.tiles.banho, desc: bebeCopy.banho.agora },
  ];
  const opcoes = modo === "bebe" ? opcoesBebe : opcoesGestacao;

  function abrir(tipo: string) {
    if (modo === "bebe") setBebe({ tipo: tipo as TipoRegistroBebe });
    else setGestacao(tipo as TipoGestacao);
  }

  function manual(sugestao: string) {
    const mapa: Record<string, string> = { mamada: "mamada", fralda: "fralda", sono: "sono", banho: "banho", sintoma: "sintoma", chute: "chutes", contracao: "contracoes" };
    abrir(mapa[sugestao] ?? sugestao);
  }

  return (
    <div>
      <Cabecalho titulo={copy.titulo} voltarPara="/hoje" />
      <div className="flex flex-col gap-6 px-5 pt-2">
        <BotaoVoz
          modo={modo}
          bebes={bebes.map((b) => ({ id: b.id, nome: b.nome }))}
          bebeAtivoId={ativo?.id}
          onCorrigir={(r) => setBebe({ tipo: r.tipo === "outro" ? null : r.tipo, registro: r })}
          onManual={manual}
        />

        <div className="grid grid-cols-2 gap-3">
          {opcoes.map(({ tipo, Icone, cor, titulo, desc }) => (
            <button
              key={tipo}
              type="button"
              onClick={() => abrir(tipo)}
              className="flex min-h-[112px] flex-col items-start justify-between rounded-card bg-superficie p-4 text-left transition-transform active:scale-[0.97] [[data-tema=escuro]_&]:border [[data-tema=escuro]_&]:border-fio"
            >
              <span aria-hidden className={`grid size-10 place-items-center rounded-full text-white ${cor}`}>
                <Icone size={18} />
              </span>
              <span>
                <span className="block text-[16px] font-medium text-texto">{titulo}</span>
                <span className="tipo-meta mt-0.5 block">{desc}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {ativo && <SheetsRegistro estado={bebe} onFechar={() => setBebe({ tipo: null })} bebeId={ativo.id} />}
      <SheetSintomas aberto={gestacao === "sintoma"} onFechar={() => setGestacao(null)} onEspecial={(e) => setGestacao(e)} />
      <SheetChutes aberto={gestacao === "chutes"} onFechar={() => setGestacao(null)} />
      <SheetContracoes aberto={gestacao === "contracoes"} onFechar={() => setGestacao(null)} />
      <SheetConsulta aberto={gestacao === "consulta"} onFechar={() => setGestacao(null)} />
      <SheetNascimento aberto={gestacao === "nascimento"} onFechar={() => setGestacao(null)} />
    </div>
  );
}
