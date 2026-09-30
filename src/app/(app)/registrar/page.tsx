"use client";

import { Activity, CalendarDays, Footprints, HeartPulse } from "lucide-react";
import { useEffect, useState } from "react";

import { SheetConsulta } from "@/components/features/consultas/SheetConsulta";
import { SheetChutes } from "@/components/features/registrar/SheetChutes";
import { SheetContracoes } from "@/components/features/registrar/SheetContracoes";
import { SheetSintomas } from "@/components/features/sintomas/SheetSintomas";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { home as homeCopy } from "@/copy/home";
import { registrarCopy as copy } from "@/copy/registrar";
import { track } from "@/lib/analytics";
import { usePerfil } from "@/lib/perfil";

type Tipo = "sintoma" | "chutes" | "contracoes" | "consulta";

const opcoes: { tipo: Tipo; Icone: typeof Activity; cor: string; titulo: string; desc: string }[] = [
  { tipo: "sintoma", Icone: HeartPulse, cor: "bg-acento", ...copy.sintoma },
  { tipo: "chutes", Icone: Footprints, cor: "bg-banho", ...copy.chutes },
  { tipo: "contracoes", Icone: Activity, cor: "bg-fralda", ...copy.contracoes },
  { tipo: "consulta", Icone: CalendarDays, cor: "bg-primaria", ...copy.consulta },
];

/** Tela do "+" (NAV-04): em modo gestação, sintoma, chute, contração e consulta. */
export default function PaginaRegistrar() {
  const perfil = usePerfil();
  const [aberto, setAberto] = useState<Tipo | null>(null);

  useEffect(() => {
    track("plus_aberto", { modo: perfil?.modo ?? "gestacao", origem: "tab" });
  }, [perfil?.modo]);

  if (!perfil) return null;

  return (
    <div>
      <Cabecalho titulo={copy.titulo} voltarPara="/hoje" />
      {perfil.modo === "bebe" ? (
        <p className="tipo-corpo px-5 pt-4 text-texto-mudo">{homeCopy.bebe.emBreve}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 px-5 pt-2">
          {opcoes.map(({ tipo, Icone, cor, titulo, desc }) => (
            <button
              key={tipo}
              type="button"
              onClick={() => setAberto(tipo)}
              className="flex aspect-square flex-col items-start justify-between rounded-card bg-superficie p-4 text-left transition-transform active:scale-[0.97] [[data-tema=escuro]_&]:border [[data-tema=escuro]_&]:border-fio"
            >
              <span aria-hidden className={`grid size-12 place-items-center rounded-full text-white ${cor}`}>
                <Icone size={22} />
              </span>
              <span>
                <span className="block text-[17px] font-medium text-texto">{titulo}</span>
                <span className="tipo-meta mt-0.5 block">{desc}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      <SheetSintomas aberto={aberto === "sintoma"} onFechar={() => setAberto(null)} onEspecial={(e) => setAberto(e)} />
      <SheetChutes aberto={aberto === "chutes"} onFechar={() => setAberto(null)} />
      <SheetContracoes aberto={aberto === "contracoes"} onFechar={() => setAberto(null)} />
      <SheetConsulta aberto={aberto === "consulta"} onFechar={() => setAberto(null)} />
    </div>
  );
}
