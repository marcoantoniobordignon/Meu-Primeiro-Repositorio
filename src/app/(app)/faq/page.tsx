"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { LinhaVerbete } from "@/components/features/faq/LinhaVerbete";
import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { Card } from "@/components/ui/Card";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { faqCopy as copy } from "@/copy/faq";
import { track } from "@/lib/analytics";
import { useFaq } from "@/lib/faq/useFaq";
import { buscar, CATEGORIAS_FAQ, maisBuscados } from "@dominio/faq.ts";

function Conteudo() {
  const params = useSearchParams();
  const router = useRouter();
  const { verbetes, favoritos } = useFaq();
  const [q, setQ] = useState(params.get("q") ?? "");
  const resultados = buscar(verbetes, q);
  const buscando = q.trim().length >= 2;

  // Só o tamanho da busca e quantos resultados: nunca o texto (spec 09).
  useEffect(() => {
    if (!buscando) return;
    const t = setTimeout(() => track("faq_search", { query_len: q.trim().length, results: resultados.length }), 800);
    return () => clearTimeout(t);
  }, [q, buscando, resultados.length]);

  return (
    <div>
      <Cabecalho titulo={copy.titulo} voltarPara="/eu" />
      <div className="flex flex-col gap-5 px-5 pb-8 pt-1">
        <div role="search">
          <CampoTexto rotulo={copy.busca} type="search" value={q} placeholder={copy.buscaPlaceholder} onChange={(e) => setQ(e.target.value)} autoComplete="off" enterKeyHint="search" />
        </div>

        {buscando ? (
          resultados.length ? (
            <section aria-label={copy.resultados(resultados.length)}>
              <p className="tipo-meta" aria-live="polite">
                {copy.resultados(resultados.length)}
              </p>
              <ul className="divide-y divide-fio">{resultados.map((v) => <LinhaVerbete key={v.id} v={v} />)}</ul>
            </section>
          ) : (
            // RN-04: "Não achei. Perguntar" com o texto já preenchido.
            <Card>
              <p className="tipo-corpo text-texto" aria-live="polite">
                {copy.naoAchei}
              </p>
              <div className="mt-2">
                <Botao icone={<Search size={16} aria-hidden />} onClick={() => router.push(`/faq/perguntar?texto=${encodeURIComponent(q.trim())}`)}>
                  {copy.perguntar}
                </Botao>
              </div>
            </Card>
          )
        ) : (
          <>
            <section aria-labelledby="faq-categorias">
              <h2 id="faq-categorias" className="tipo-titulo-secao mb-2 text-texto-mudo">
                {copy.categorias}
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIAS_FAQ.map((c) => (
                  <Link key={c} href={`/faq/categoria?c=${c}`} className="flex min-h-13 items-center rounded-card bg-superficie px-4 text-[14px] font-medium text-texto [[data-tema=escuro]_&]:border [[data-tema=escuro]_&]:border-fio">
                    {copy.categoria[c]}
                  </Link>
                ))}
              </div>
            </section>
            {favoritos.length > 0 && (
              <section aria-labelledby="faq-favoritos">
                <h2 id="faq-favoritos" className="tipo-titulo-secao mb-1 text-texto-mudo">
                  {copy.favoritos}
                </h2>
                <ul className="divide-y divide-fio">{favoritos.map((v) => <LinhaVerbete key={v.id} v={v} />)}</ul>
              </section>
            )}
            <section aria-labelledby="faq-mais">
              <h2 id="faq-mais" className="tipo-titulo-secao mb-1 text-texto-mudo">
                {copy.maisBuscados}
              </h2>
              <ul className="divide-y divide-fio">{maisBuscados(verbetes, 10).map((v) => <LinhaVerbete key={v.id} v={v} />)}</ul>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

/** Tela 1 "FAQ" e tela 2 "Resultado da busca": nunca vazia (categorias e mais buscados). */
export default function PaginaFaq() {
  return (
    <Suspense>
      <Conteudo />
    </Suspense>
  );
}
