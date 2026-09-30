"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Anel } from "@/components/ui/Anel";
import { Card } from "@/components/ui/Card";
import { home as copy } from "@/copy/home";
import { conteudoDaSemana } from "@/lib/conteudo-semanas";
import { idadeBebe, paraISO, semanaGestacional, SEMANAS_GESTACAO } from "@/lib/dates";
import { lerPerfil, type Perfil } from "@/lib/onboarding/estado";

const CHAVE_FAIXA = "ninho.faixa-guardar-dispensada";

/**
 * Destino do onboarding. A home completa é a spec 05; aqui fica o mínimo
 * para a linha do tempo continuar visível e a faixa da ONB-06.
 */
export default function PaginaHoje() {
  const router = useRouter();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [faixa, setFaixa] = useState(false);

  useEffect(() => {
    const p = lerPerfil();
    if (!p) {
      router.replace("/onboarding");
      return;
    }
    setPerfil(p);
    const dispensada = localStorage.getItem(CHAVE_FAIXA) === "1";
    const dias = (Date.now() - new Date(p.onboardingConcluidoEm).getTime()) / 86_400_000;
    setFaixa(p.anonima && !dispensada && dias <= 3);
  }, [router]);

  if (!perfil) return <div className="min-h-dvh bg-fundo" aria-busy="true" />;

  const hoje = paraISO(new Date());
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? copy.bomDia : hora < 18 ? copy.boaTarde : copy.boaNoite;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-fundo px-5 pb-8">
      <header className="safe-top">
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
        <div className="mt-4 flex items-center gap-2 rounded-pilula bg-primaria-suave py-1.5 pl-4 pr-1.5">
          <button type="button" className="flex-1 text-left text-[13px] font-medium text-primaria-texto">
            {copy.guardarLinha}
          </button>
          <button
            type="button"
            aria-label={copy.dispensar}
            onClick={() => {
              localStorage.setItem(CHAVE_FAIXA, "1");
              setFaixa(false);
            }}
            className="grid size-9 place-items-center rounded-pilula text-primaria-texto"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {perfil.modo === "gestacao" && perfil.dpp ? <Gestacao dpp={perfil.dpp} hoje={hoje} /> : null}
      {perfil.modo === "bebe" && perfil.nascidoEm ? <Bebe nascidoEm={perfil.nascidoEm} hoje={hoje} /> : null}

      <p className="tipo-meta mt-auto pt-10 text-center">{copy.emBreve}</p>
    </div>
  );
}

function Gestacao({ dpp, hoje }: { dpp: string; hoje: string }) {
  const g = semanaGestacional(dpp, hoje);
  const c = conteudoDaSemana(g.semana);
  return (
    <>
      <div className="mt-8 flex justify-center">
        <Anel total={SEMANAS_GESTACAO} atual={g.semana + g.dia / 7} segmentos={[13, 27]} rotulo={`${g.semana} semanas`}>
          <div className="text-center">
            <p className="tipo-heroi text-texto">{g.semana}</p>
            <p className="tipo-heroi-rotulo text-texto-mudo">{copy.semanas}</p>
          </div>
        </Anel>
      </div>
      <div className="mt-5">
        <Card>
          <div className="flex items-center gap-3">
            <span aria-hidden className="text-[28px] leading-none">{c.emoji}</span>
            <p className="tipo-corpo text-texto">
              {copy.tamanhoDe} {c.tamanho}
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}

function Bebe({ nascidoEm, hoje }: { nascidoEm: string; hoje: string }) {
  const i = idadeBebe(nascidoEm, hoje);
  return (
    <div className="mt-10 text-center">
      <p className="tipo-heroi text-texto">{i.dias}</p>
      <p className="tipo-heroi-rotulo text-texto-mudo">{copy.diasDeVida}</p>
    </div>
  );
}
