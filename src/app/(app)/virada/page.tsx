"use client";

import { ChevronRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";

import { Botao } from "@/components/ui/Botao";
import { artigosCopy } from "@/copy/artigos";
import { track } from "@/lib/analytics";
import { useArtigos } from "@/lib/artigos/useArtigos";
import { useColecao } from "@/lib/dados/colecao";
import { appointments, bellyPhotos, diaryEntries } from "@/lib/dados/colecoes";
import { useFuso } from "@/lib/hooks/useFuso";
import { atualizarPerfil, usePerfil } from "@/lib/perfil";
import { marcarVirada, numerosDoTrimestre, oQueEsperar } from "@dominio/trimestre.ts";

const copy = artigosCopy.virada;

function Conteudo() {
  const params = useSearchParams();
  const router = useRouter();
  const para: 2 | 3 = params.get("t") === "3" ? 3 : 2;
  const perfil = usePerfil();
  const tz = useFuso();
  const { artigos } = useArtigos();
  const fotos = useColecao(bellyPhotos);
  const entradas = useColecao(diaryEntries);
  const consultas = useColecao(appointments);
  const marcado = useRef(false);

  // RN-06: vista uma vez (e a do 3º dá a do 2º por vista); o perfil leva para o servidor (t2/t3_seen_at).
  useEffect(() => {
    if (!perfil || marcado.current) return;
    marcado.current = true;
    const v = marcarVirada(para, { t2: perfil.t2VistoEm, t3: perfil.t3VistoEm }, new Date().toISOString());
    if (v.t2 !== perfil.t2VistoEm || v.t3 !== (perfil.t3VistoEm ?? null)) atualizarPerfil({ t2VistoEm: v.t2, t3VistoEm: v.t3 });
    track("trimester_transition_viewed", { to: para });
  }, [perfil, para]);

  if (!perfil?.dpp) return null;
  const n = numerosDoTrimestre(para === 2 ? 1 : 2, { dpp: perfil.dpp, tz, fotos, entradas, consultas });
  const esperar = oQueEsperar(artigos, para);
  const cta = (target: string) => track("trimester_transition_cta", { target });

  return (
    <div className="safe-top flex flex-col gap-6 px-5 pb-12 pt-8">
      <header className="flex flex-col items-center gap-3 text-center">
        <span aria-hidden className="grid size-20 place-items-center rounded-full bg-primaria-suave text-primaria-texto">
          <Sparkles size={34} />
        </span>
        <h1 className="font-serifa text-[30px] leading-tight text-texto">{copy.titulo(para)}</h1>
        <p className="tipo-corpo text-texto-mudo">{copy.sub(para)}</p>
      </header>

      <section aria-label={copy.numeros} className="grid grid-cols-3 gap-2">
        {(
          [
            [n.fotos, copy.fotos(n.fotos)],
            [n.marcos, copy.marcos(n.marcos)],
            [n.consultas, copy.consultas(n.consultas)],
          ] as const
        ).map(([valor, rotulo]) => (
          <div key={rotulo} className="flex flex-col items-center rounded-card bg-superficie px-2 py-3 text-center [[data-tema=escuro]_&]:border [[data-tema=escuro]_&]:border-fio">
            <span className="tipo-heroi text-primaria-texto">{valor}</span>
            <span className="tipo-meta">{rotulo}</span>
          </div>
        ))}
      </section>

      {esperar.length > 0 && (
        <section aria-labelledby="o-que-esperar" className="flex flex-col gap-2">
          <h2 id="o-que-esperar" className="tipo-titulo-secao text-texto-mudo">
            {copy.oQueEsperar}
          </h2>
          {esperar.map((a) => (
            <Link
              key={a.id}
              href={`/artigos/ler?slug=${a.slug}&de=virada`}
              onClick={() => cta("artigo")}
              className="flex min-h-16 items-center gap-3 rounded-card bg-superficie px-4 py-3 [[data-tema=escuro]_&]:border [[data-tema=escuro]_&]:border-fio"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium text-texto">{a.title}</span>
                <span className="tipo-meta line-clamp-2 block">{a.summary}</span>
              </span>
              <ChevronRight size={18} aria-hidden className="shrink-0 text-texto-mudo" />
            </Link>
          ))}
        </section>
      )}

      <div className="flex flex-col gap-2">
        <Botao
          largura="total"
          tamanho="lg"
          onClick={() => {
            cta("home");
            router.replace("/hoje");
          }}
        >
          {copy.irParaHome}
        </Botao>
        <Botao
          largura="total"
          variant="fantasma"
          onClick={() => {
            cta("biblioteca");
            router.push(`/artigos?t=${para}`);
          }}
        >
          {copy.verBiblioteca}
        </Botao>
      </div>
    </div>
  );
}

/** Tela 5 "Virada de trimestre": celebração, números do trimestre que acabou e 3 cards "o que esperar" (RN-06). */
export default function PaginaVirada() {
  return (
    <Suspense>
      <Conteudo />
    </Suspense>
  );
}
