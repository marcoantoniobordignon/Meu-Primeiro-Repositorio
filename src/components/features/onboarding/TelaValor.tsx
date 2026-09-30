"use client";

import { Sparkles } from "lucide-react";
import { useEffect } from "react";

import { Anel } from "@/components/ui/Anel";
import { Botao } from "@/components/ui/Botao";
import { Card } from "@/components/ui/Card";
import { onboarding as copy } from "@/copy/onboarding";
import { track } from "@/lib/analytics";
import { conteudoDaSemana } from "@/lib/conteudo-semanas";
import { idadeBebe, paraISO, semanaGestacional, SEMANAS_GESTACAO } from "@/lib/dates";

import type { PropsTela } from "./FluxoOnboarding";
import { Rodape } from "./Pergunta";

/** Tela 3: o momento de valor. Anel, semana, tamanho e o que muda, antes de pedir nome. */
export function TelaValor({ estado, avancar }: PropsTela) {
  const hoje = paraISO(new Date());
  const modoBebe = estado.momento === "bebe" && estado.nascidoEm;

  const gest = estado.dpp ? semanaGestacional(estado.dpp, hoje) : null;
  const conteudo = gest ? conteudoDaSemana(gest.semana) : null;
  const bebe = modoBebe ? idadeBebe(estado.nascidoEm!, hoje) : null;

  useEffect(() => {
    track("onb_valor_visto", { semana: gest?.semana ?? 0 });
  }, [gest?.semana]);

  const rodape = (
    <Botao tamanho="lg" largura="total" onClick={() => avancar()}>
      {copy.valor.cta}
    </Botao>
  );

  if (bebe) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
          <span aria-hidden className="text-[64px] leading-none">👶</span>
          <p className="tipo-heroi mt-6 text-texto">{bebe.dias}</p>
          <p className="tipo-heroi-rotulo mt-1 text-texto-mudo">{copy.valor.bebeTitulo(bebe.dias)}</p>
          <p className="tipo-corpo mt-6 max-w-[28ch] text-texto-mudo">{copy.valor.bebeApoio}</p>
        </div>
        <Rodape>{rodape}</Rodape>
      </div>
    );
  }

  if (!gest || !conteudo) return null;

  const faltam =
    gest.diasParaDpp < 0
      ? copy.valor.passouDpp
      : gest.diasParaDpp < 14
        ? copy.valor.faltamDias(gest.diasParaDpp)
        : copy.valor.faltam(gest.semanasParaDpp);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-col items-center pt-2">
        <Anel
          total={SEMANAS_GESTACAO}
          atual={gest.semana + gest.dia / 7}
          segmentos={[13, 27]}
          tamanho={200}
          rotulo={`${gest.semana} ${copy.valor.semanas} ${copy.valor.eDias(gest.dia)}`}
        >
          <div className="text-center anim-surge">
            <p className="tipo-heroi text-texto">{gest.semana}</p>
            <p className="tipo-heroi-rotulo text-texto-mudo">
              {gest.semana === 1 ? copy.valor.semana : copy.valor.semanas}
              {gest.dia > 0 && <> {copy.valor.eDias(gest.dia)}</>}
            </p>
          </div>
        </Anel>

        <div className="mt-4 flex items-center gap-2">
          <span className="rounded-pilula bg-primaria-suave px-3 py-1 text-[12px] font-medium text-primaria-texto">
            {copy.valor.trimestre(gest.trimestre)}
          </span>
          <span className="tipo-corpo text-texto-mudo">{faltam}</span>
        </div>
      </div>

      <div className="mt-7 flex flex-col gap-3">
        <Card>
          <div className="flex items-center gap-4">
            <span
              aria-hidden
              className="grid size-14 shrink-0 place-items-center rounded-full bg-acento-suave text-[30px] leading-none"
            >
              {conteudo.emoji}
            </span>
            <div className="min-w-0">
              <p className="tipo-titulo-secao text-texto-mudo">{copy.valor.tamanhoTitulo}</p>
              <p className="mt-0.5 text-[20px] font-medium leading-tight text-texto">{conteudo.tamanho}</p>
              {conteudo.comprimento !== "—" && (
                <p className="tipo-meta mt-1">{copy.valor.medidas(conteudo.comprimento, conteudo.peso)}</p>
              )}
            </div>
          </div>
        </Card>

        <Card tom="suave">
          <div className="flex items-start gap-3">
            <span aria-hidden className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-primaria text-white">
              <Sparkles size={14} />
            </span>
            <div>
              <p className="tipo-titulo-secao text-primaria-texto">{copy.valor.estaSemana}</p>
              <p className="tipo-corpo mt-1 text-texto">{conteudo.frase}</p>
              <p className="tipo-meta mt-2">{conteudo.dica}</p>
            </div>
          </div>
        </Card>
      </div>

      <Rodape>{rodape}</Rodape>
    </div>
  );
}
