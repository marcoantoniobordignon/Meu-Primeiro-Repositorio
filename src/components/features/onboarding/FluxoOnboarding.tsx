"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Progresso } from "@/components/ui/Progresso";
import { onboarding as copy } from "@/copy/onboarding";
import { track } from "@/lib/analytics";
import { novoId } from "@/lib/dados/colecao";
import { sintomas } from "@/lib/dados/colecoes";
import { contarAnonimo } from "@/lib/fe/contadores";
import { paraISO } from "@/lib/dates";
import {
  concluir,
  estadoInicial,
  guardarEstado,
  lerEstado,
  podePular,
  podeVoltar,
  TOTAL_TELAS,
  type EstadoOnboarding,
} from "@/lib/onboarding/estado";
import { garantirSessaoAnonima, sessaoAtual } from "@/lib/sessao";

import { TelaBoasVindas } from "./TelaBoasVindas";
import { TelaComoEsta } from "./TelaComoEsta";
import { TelaData } from "./TelaData";
import { TelaFe } from "./TelaFe";
import { TelaGuardar } from "./TelaGuardar";
import { TelaInstalar } from "./TelaInstalar";
import { TelaNome } from "./TelaNome";
import { TelaValor } from "./TelaValor";

export type Avancar = (mudancas?: Partial<EstadoOnboarding>) => void;

export interface PropsTela {
  estado: EstadoOnboarding;
  avancar: Avancar;
  atualizar: (mudancas: Partial<EstadoOnboarding>) => void;
}

/** Orquestra as 8 telas: uma pergunta por tela, progresso sempre visível, retoma onde parou. */
export function FluxoOnboarding() {
  const router = useRouter();
  const [estado, setEstado] = useState<EstadoOnboarding | null>(null);
  const [direcao, setDirecao] = useState<"frente" | "tras">("frente");
  const telaAnterior = useRef<number | null>(null);
  const areaRolavel = useRef<HTMLElement>(null);

  // Hidratação: retoma o rascunho (ONB-04) e cria a sessão anônima em silêncio.
  useEffect(() => {
    const salvo = lerEstado();
    const inicial = salvo ?? guardarEstado(estadoInicial());
    if (!salvo) track("onb_iniciado", {});
    setEstado(inicial);
    void garantirSessaoAnonima();
  }, []);

  // Um evento por tela vista.
  useEffect(() => {
    if (!estado || telaAnterior.current === estado.tela) return;
    telaAnterior.current = estado.tela;
    track("onb_tela_vista", { n: estado.tela });
    areaRolavel.current?.scrollTo({ top: 0 });
  }, [estado]);

  const atualizar = useCallback((mudancas: Partial<EstadoOnboarding>) => {
    setEstado((e) => (e ? guardarEstado({ ...e, ...mudancas }) : e));
  }, []);

  const finalizar = useCallback(
    (e: EstadoOnboarding) => {
      const sessao = sessaoAtual();
      concluir(e, sessao?.anonima ?? true);
      // Funcionalidade 17 RN-10: só a contagem anônima, nunca evento de analytics.
      if (e.fe === "sim") contarAnonimo("faith_on");
      // Tela 5: "isso vira seu diário". Grava com a data de hoje (spec 06).
      const hoje = paraISO(new Date());
      for (const slug of e.sintomas ?? []) {
        sintomas.salvar({ id: novoId(), data: hoje, slug, intensidade: 1, origem: "onboarding" });
        track("sintoma_registrado", { slug, intensidade: 1, origem: "onboarding" });
      }
      track("onb_concluido", {
        segundos: Math.round((Date.now() - e.iniciadoEm) / 1000),
        telas_puladas: e.puladas.length,
      });
      router.replace("/hoje");
    },
    [router],
  );

  const avancar = useCallback<Avancar>(
    (mudancas = {}) => {
      setDirecao("frente");
      setEstado((e) => {
        if (!e) return e;
        const proximo = { ...e, ...mudancas };
        if (proximo.tela >= TOTAL_TELAS) {
          finalizar(proximo);
          return proximo;
        }
        return guardarEstado({ ...proximo, tela: proximo.tela + 1 });
      });
    },
    [finalizar],
  );

  const voltar = useCallback(() => {
    setDirecao("tras");
    setEstado((e) => (e && podeVoltar(e) ? guardarEstado({ ...e, tela: e.tela - 1 }) : e));
  }, []);

  const pular = useCallback(() => {
    if (!estado) return;
    track("onb_pulou", { n: estado.tela });
    avancar({ puladas: [...estado.puladas, estado.tela] });
  }, [estado, avancar]);

  if (!estado) {
    return <div className="min-h-dvh bg-fundo" aria-busy="true" />;
  }

  const props: PropsTela = { estado, avancar, atualizar };
  const mostrarVoltar = podeVoltar(estado);
  const mostrarPular = podePular(estado.tela);

  return (
    // Shell em h-dvh com rolagem interna: o rodapé sticky ancora no espaço
    // realmente visível, mesmo com a barra dinâmica do Safari no iPhone.
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col bg-fundo">
      <header className="safe-top z-10 shrink-0 bg-fundo px-4">
        <div className="flex h-11 items-center">
          <div className="w-16">
            {mostrarVoltar && (
              <button
                type="button"
                onClick={voltar}
                aria-label={copy.voltar}
                className="-ml-2 grid size-11 place-items-center rounded-pilula text-texto active:bg-primaria-suave"
              >
                <ArrowLeft size={22} />
              </button>
            )}
          </div>
          <div className="flex-1 px-2">
            <Progresso atual={estado.tela} total={TOTAL_TELAS} rotulo={copy.progresso} />
          </div>
          <div className="flex w-16 justify-end">
            {mostrarPular && (
              <button
                type="button"
                onClick={pular}
                className="-mr-2 min-h-11 rounded-pilula px-2 text-[14px] font-medium text-texto-mudo active:bg-primaria-suave"
              >
                {copy.pular}
              </button>
            )}
          </div>
        </div>
      </header>

      <main ref={areaRolavel} className="flex-1 overflow-y-auto overscroll-contain px-5">
        <div
          key={estado.tela}
          className={`flex min-h-full flex-col pt-4 ${direcao === "frente" ? "anim-tela-entra" : "anim-tela-entra-volta"}`}
        >
          {estado.tela === 1 && <TelaBoasVindas {...props} />}
          {estado.tela === 2 && <TelaData {...props} />}
          {estado.tela === 3 && <TelaValor {...props} />}
          {estado.tela === 4 && <TelaNome {...props} />}
          {estado.tela === 5 && <TelaComoEsta {...props} />}
          {estado.tela === 6 && <TelaFe {...props} />}
          {estado.tela === 7 && <TelaInstalar {...props} />}
          {estado.tela === 8 && <TelaGuardar {...props} />}
        </div>
      </main>
    </div>
  );
}
