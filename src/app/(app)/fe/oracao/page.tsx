"use client";

import { Minus, Plus, Share2, Star } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { FeDesligado } from "@/components/features/fe/FeDesligado";
import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { feCopy as copy } from "@/copy/fe";
import { formatarLonga } from "@/lib/dates";
import { alternarFavoritoOracao } from "@/lib/fe/acoes";
import { contarAnonimo } from "@/lib/fe/contadores";
import { useFe } from "@/lib/fe/useFe";
import { ajustarFonte, diaDoSanto, FONTE_MAX, FONTE_MIN, oracaoDaSemana, textoParaCompartilhar } from "@dominio/fe.ts";

const CHAVE_FONTE = "ninho.fe.fonte";
const FONTE_PADRAO = 18;

function lerFonte(): number {
  try {
    const n = Number(localStorage.getItem(CHAVE_FONTE));
    return n ? ajustarFonte(n, 0) : FONTE_PADRAO;
  } catch {
    return FONTE_PADRAO;
  }
}

function Conteudo() {
  const params = useSearchParams();
  const { perfil, ligado, oracoes, idsFavoritos } = useFe();
  const { mostrar } = useToast();
  const [fonte, setFonte] = useState(FONTE_PADRAO);
  const slug = params.get("slug");
  const semana = Number(params.get("semana"));
  const o = slug ? oracoes.find((x) => x.slug === slug) : semana ? oracaoDaSemana(oracoes, semana) : undefined;

  useEffect(() => setFonte(lerFonte()), []);
  // RN-10: só a contagem anônima, uma por oração aberta.
  useEffect(() => {
    if (o && ligado) contarAnonimo("prayer_viewed");
  }, [o?.id, ligado]);

  if (!perfil) return null;
  if (!ligado)
    return (
      <div>
        <Cabecalho titulo={copy.titulo} voltarPara="/eu" />
        <FeDesligado />
      </div>
    );
  if (!o)
    return (
      <div>
        <Cabecalho titulo={copy.titulo} voltarPara="/fe" />
        <p className="tipo-corpo px-5 text-texto-mudo">{copy.naoEncontrada}</p>
      </div>
    );

  const favorita = idsFavoritos.has(o.id);
  const dia = diaDoSanto(o.saint_day);
  const mudarFonte = (passo: number) => {
    const nova = ajustarFonte(fonte, passo);
    setFonte(nova);
    try {
      localStorage.setItem(CHAVE_FONTE, String(nova));
    } catch {
      /* nada */
    }
  };

  async function compartilhar() {
    const texto = textoParaCompartilhar(o!);
    try {
      if (navigator.share) {
        await navigator.share({ text: texto });
        return;
      }
      await navigator.clipboard.writeText(texto);
      mostrar(copy.copiado);
    } catch {
      /* cancelou */
    }
  }

  return (
    <div>
      <Cabecalho
        titulo={copy.titulo}
        voltarPara="/fe"
        acao={
          // RN-04: modo leitura com fonte de 16 a 28 px.
          <div role="group" aria-label={copy.fonte} className="flex items-center">
            <button type="button" aria-label={copy.diminuir} disabled={fonte <= FONTE_MIN} onClick={() => mudarFonte(-2)} className="grid size-11 place-items-center rounded-pilula text-texto disabled:opacity-40">
              <Minus size={18} />
            </button>
            <button type="button" aria-label={copy.aumentar} disabled={fonte >= FONTE_MAX} onClick={() => mudarFonte(2)} className="grid size-11 place-items-center rounded-pilula text-texto disabled:opacity-40">
              <Plus size={18} />
            </button>
          </div>
        }
      />
      <article className="flex flex-col gap-4 px-5 pb-8 pt-1">
        <header className="flex flex-col gap-1.5">
          {o.week && <p className="tipo-meta">{copy.semana(o.week)}</p>}
          <h2 className="font-serifa text-[28px] leading-tight text-texto">{o.title}</h2>
          {dia && <p className="tipo-meta">{copy.diaDoSanto(dia)}</p>}
          {o.rascunho && <span className="self-start rounded-pilula bg-acento-suave px-2 py-0.5 text-[12px] font-medium text-texto">{copy.rascunho}</span>}
        </header>

        {o.kind === "blessing" && (
          <Card tom="suave">
            <p className="tipo-corpo text-texto" role="note">
              {copy.avisoBencao}
            </p>
          </Card>
        )}

        <div data-texto-oracao className="flex flex-col gap-3 font-serifa leading-relaxed text-texto" style={{ fontSize: `${fonte}px` }}>
          {o.body.split(/\n\s*\n/).map((p, i) => (
            <p key={i} className="whitespace-pre-line">
              {p}
            </p>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Botao
            variant="secundario"
            icone={<Star size={16} aria-hidden fill={favorita ? "currentColor" : "none"} />}
            onClick={() => {
              if (alternarFavoritoOracao(o.id)) mostrar(copy.favoritado);
            }}
          >
            {favorita ? copy.desfavoritar : copy.favoritar}
          </Botao>
          <Botao variant="secundario" icone={<Share2 size={16} aria-hidden />} onClick={() => void compartilhar()}>
            {copy.compartilhar}
          </Botao>
        </div>

        {/* RN-05: fonte e revisão no rodapé; sem revisão, o rascunho diz isso. */}
        <footer className="flex flex-col gap-1 border-t border-fio pt-3">
          <p className="tipo-meta">{copy.origem(o.source_label)}</p>
          {o.reviewed_by && o.reviewed_on ? <p className="tipo-meta">{copy.revisado(o.reviewed_by, formatarLonga(o.reviewed_on))}</p> : <p className="tipo-meta">{copy.rascunhoRodape}</p>}
        </footer>
      </article>
    </div>
  );
}

/** Leitura de uma oração (por slug ou pela semana): fonte ajustável, favoritar e compartilhar (RN-04). */
export default function PaginaOracao() {
  return (
    <Suspense>
      <Conteudo />
    </Suspense>
  );
}
