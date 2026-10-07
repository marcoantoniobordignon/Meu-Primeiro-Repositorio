"use client";

import { Star } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { SheetPaywall } from "@/components/features/paywall/SheetPaywall";
import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { artigosCopy as copy } from "@/copy/artigos";
import { track, type Eventos } from "@/lib/analytics";
import { alternarFavoritoArtigo, marcarLido, registrarAbertura } from "@/lib/artigos/acoes";
import { useArtigos } from "@/lib/artigos/useArtigos";
import { blocos, type Trecho } from "@/lib/conteudo/markdown";
import { formatarComAno } from "@/lib/dates";
import { temPlano, usePerfil } from "@/lib/perfil";
import { fracaoRolada, leituraConcluida, podeLerArtigo } from "@dominio/trimestre.ts";

const ORIGENS: Eventos["article_opened"]["source"][] = ["home", "para_esta_semana", "biblioteca", "busca", "favoritos", "virada"];

function Trechos({ t }: { t: Trecho[] }) {
  return (
    <>
      {t.map((x, i) =>
        x.tipo === "negrito" ? (
          <strong key={i} className="font-semibold">
            {x.valor}
          </strong>
        ) : x.tipo === "italico" ? (
          <em key={i}>{x.valor}</em>
        ) : (
          <span key={i}>{x.valor}</span>
        ),
      )}
    </>
  );
}

function Corpo({ md }: { md: string }) {
  return (
    <div className="flex flex-col gap-3">
      {blocos(md, { titulos: true }).map((b, i) =>
        b.tipo === "titulo" ? (
          <h3 key={i} className="mt-2 text-[17px] font-semibold text-texto">
            <Trechos t={b.trechos} />
          </h3>
        ) : b.tipo === "lista" ? (
          b.ordenada ? (
            <ol key={i} className="tipo-corpo ml-5 list-decimal text-texto">
              {b.itens.map((item, j) => (
                <li key={j} className="py-0.5">
                  <Trechos t={item} />
                </li>
              ))}
            </ol>
          ) : (
            <ul key={i} className="tipo-corpo ml-5 list-disc text-texto">
              {b.itens.map((item, j) => (
                <li key={j} className="py-0.5">
                  <Trechos t={item} />
                </li>
              ))}
            </ul>
          )
        ) : (
          <p key={i} className="tipo-corpo text-texto">
            <Trechos t={b.trechos} />
          </p>
        ),
      )}
    </div>
  );
}

function Conteudo() {
  const params = useSearchParams();
  const slug = params.get("slug");
  const de = params.get("de");
  const origem = ORIGENS.find((o) => o === de) ?? "link";
  const perfil = usePerfil();
  const { artigos, leituras } = useArtigos();
  const { mostrar } = useToast();
  const [paywall, setPaywall] = useState(false);
  const a = artigos.find((x) => x.slug === slug);
  const leitura = a ? leituras.get(a.id) : undefined;
  const liberado = a ? podeLerArtigo(a, temPlano(perfil)) : false;
  const lidoRef = useRef(false);

  // Abertura: guarda a primeira vez e manda o evento (uma vez por artigo aberto).
  useEffect(() => {
    if (!a) return;
    registrarAbertura(a.id);
    track("article_opened", { slug: a.slug, source: origem });
    // Só o artigo dispara.
  }, [a?.id]);

  // RN-04: lido com 20 s na tela (contando só com a aba visível) ou rolado até 80%.
  useEffect(() => {
    if (!a || !liberado) return;
    lidoRef.current = false;
    let segundos = 0;
    let rolada = 0;
    const conferir = () => {
      if (lidoRef.current || !leituraConcluida({ segundos, fracaoRolada: rolada })) return;
      lidoRef.current = true;
      if (marcarLido(a.id)) track("article_read", { slug: a.slug });
    };
    const tique = window.setInterval(() => {
      if (document.visibilityState === "visible") segundos += 1;
      conferir();
    }, 1000);
    const aoRolar = () => {
      rolada = Math.max(rolada, fracaoRolada({ topo: window.scrollY, alturaJanela: window.innerHeight, alturaTotal: document.documentElement.scrollHeight }));
      conferir();
    };
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => {
      window.clearInterval(tique);
      window.removeEventListener("scroll", aoRolar);
    };
  }, [a?.id, liberado]);

  if (!a)
    return (
      <div>
        <Cabecalho titulo={copy.voltar} voltarPara="/artigos" />
        <p className="tipo-corpo px-5 text-texto-mudo">{copy.naoEncontrado}</p>
      </div>
    );
  const favorito = Boolean(leitura?.is_favorite);

  return (
    <div>
      <Cabecalho titulo={copy.voltar} voltarPara="/artigos" />
      <article className="flex flex-col gap-4 px-5 pb-8 pt-1">
        <header className="flex flex-col gap-1.5">
          <p className="tipo-meta">
            {copy.semanas(a.week_from, a.week_to)} · {copy.minutos(a.reading_minutes)}
          </p>
          <h2 className="font-serifa text-[28px] leading-tight text-texto">{a.title}</h2>
          {a.rascunho && <span className="self-start rounded-pilula bg-acento-suave px-2 py-0.5 text-[12px] font-medium text-texto">{copy.rascunho}</span>}
        </header>

        {liberado ? (
          <Corpo md={a.body_md} />
        ) : (
          // RN-11: o free vê o resumo e o paywall (na v1 nenhum artigo é premium).
          <Card tom="suave">
            <p className="tipo-meta">{copy.premium}</p>
            <p className="tipo-corpo mt-1 text-texto">{a.summary}</p>
            <div className="mt-3">
              <Botao onClick={() => setPaywall(true)}>{copy.premiumCta}</Botao>
            </div>
          </Card>
        )}

        <Botao
          variant="secundario"
          icone={<Star size={16} aria-hidden fill={favorito ? "currentColor" : "none"} />}
          onClick={() => {
            if (alternarFavoritoArtigo(a.id)) {
              track("article_favorited", {});
              mostrar(copy.favoritado);
            }
          }}
        >
          {favorito ? copy.desfavoritar : copy.favoritar}
        </Botao>

        {/* RN-09: revisor e data no rodapé; sem revisão, o rascunho diz isso com todas as letras. */}
        <footer className="flex flex-col gap-2 border-t border-fio pt-3">
          {a.reviewed_by && a.reviewed_on ? <p className="tipo-meta">{copy.revisado(a.reviewed_by, formatarComAno(a.reviewed_on))}</p> : <p className="tipo-meta">{copy.rascunhoRodape}</p>}
          <p className="tipo-meta" role="note">
            {copy.aviso}
          </p>
        </footer>
      </article>
      <SheetPaywall aberto={paywall} gatilho={{ feature: "articles", trigger: "premium_article" }} onFechar={() => setPaywall(false)} />
    </div>
  );
}

/** Tela 4 "Artigo": título, tempo de leitura, corpo, revisor e data, favoritar; lido some de "Para esta semana". */
export default function PaginaArtigo() {
  return (
    <Suspense>
      <Conteudo />
    </Suspense>
  );
}
