"use client";

import { Baby, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { SeletorBebe } from "@/components/features/bebe/SeletorBebe";
import { SheetsRegistro, type EstadoSheet } from "@/components/features/bebe/SheetsRegistro";
import { TilesBebe } from "@/components/features/bebe/TilesBebe";
import { SheetNascimento } from "@/components/features/nascimento/SheetNascimento";
import { Botao } from "@/components/ui/Botao";
import { Vazio } from "@/components/ui/Vazio";
import { bebeCopy } from "@/copy/bebe";
import { euCopy } from "@/copy/eu";
import { nascimentoCopy } from "@/copy/nascimento";
import { nav } from "@/copy/nav";
import { useBebes } from "@/lib/bebe/useBebes";
import { formatarCurta } from "@/lib/dates";
import { usePerfil } from "@/lib/perfil";

/** NAV-02: em gestação, estado vazio com "Registrar nascimento"; em modo bebê, tiles e atalhos. */
export default function PaginaBebe() {
  const perfil = usePerfil();
  const { ativo, modo } = useBebes();
  const [nascimento, setNascimento] = useState(false);
  const [sheet, setSheet] = useState<EstadoSheet>({ tipo: null });

  return (
    <div className="flex flex-col gap-5 px-5">
      <header className="safe-top flex flex-col gap-3">
        <h1 className="tipo-saudacao text-texto">{nav.bebe}</h1>
        <SeletorBebe />
      </header>

      {modo === "bebe" && ativo ? (
        <>
          <TilesBebe bebeId={ativo.id} onAbrir={(tipo) => setSheet({ tipo })} />
          <div className="flex flex-col gap-2">
            {[
              { href: "/bebe/dia", t: bebeCopy.verDia },
              { href: "/bebe/sono", t: bebeCopy.verSono },
            ].map(({ href, t }) => (
              <Link key={href} href={href} className="flex min-h-13 items-center justify-between rounded-card bg-superficie px-4 text-[15px] font-medium text-texto [[data-tema=escuro]_&]:border [[data-tema=escuro]_&]:border-fio">
                {t}
                <ChevronRight size={18} aria-hidden className="text-texto-mudo" />
              </Link>
            ))}
          </div>
          {perfil?.cortesiaFim && new Date(perfil.cortesiaFim) > new Date() && <p className="tipo-meta text-center">{nascimentoCopy.cortesia(formatarCurta(perfil.cortesiaFim.slice(0, 10)))}</p>}
          <SheetsRegistro estado={sheet} onFechar={() => setSheet({ tipo: null })} bebeId={ativo.id} />
        </>
      ) : (
        <Vazio icone={<Baby size={24} />} frase={euCopy.placeholders.bebe} acao={<Botao onClick={() => setNascimento(true)}>{euCopy.placeholders.registrarNascimento}</Botao>} />
      )}
      <SheetNascimento aberto={nascimento} onFechar={() => setNascimento(false)} />
    </div>
  );
}
