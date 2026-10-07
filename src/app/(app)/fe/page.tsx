"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { FeDesligado } from "@/components/features/fe/FeDesligado";
import { LinhaOracao } from "@/components/features/fe/LinhaOracao";
import { Abas } from "@/components/ui/Abas";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { Card } from "@/components/ui/Card";
import { feCopy as copy } from "@/copy/fe";
import { contarAnonimo } from "@/lib/fe/contadores";
import { useFe } from "@/lib/fe/useFe";
import { useFuso } from "@/lib/hooks/useFuso";
import { dataNoFuso, idadeGestacional } from "@dominio/tempo.ts";
import { ABAS_FE, buscarOracoes, linkDoVerbum, oracaoDaSemana, oracoesDaAba, type AbaFe } from "@dominio/fe.ts";

const VERBUM = linkDoVerbum(process.env.NEXT_PUBLIC_VERBUM_URL);

function Conteudo() {
  const params = useSearchParams();
  const tz = useFuso();
  const { perfil, ligado, oracoes, favoritos } = useFe();
  const pedida = params.get("aba") as AbaFe | null;
  const [aba, setAba] = useState<AbaFe>(pedida && ABAS_FE.includes(pedida) ? pedida : "fixed");
  const [q, setQ] = useState("");

  // RN-10: só a contagem anônima.
  useEffect(() => {
    if (ligado) contarAnonimo("library_opened");
  }, [ligado]);

  if (!perfil) return null;
  if (!ligado)
    return (
      <div>
        <Cabecalho titulo={copy.biblioteca} voltarPara="/eu" />
        <FeDesligado />
      </div>
    );

  const semana = perfil.dpp && perfil.modo === "gestacao" ? idadeGestacional(perfil.dpp, dataNoFuso(new Date(), tz)).semana : null;
  const daSemana = semana !== null ? oracaoDaSemana(oracoes, semana) : undefined;
  const buscando = q.trim().length > 0;
  const resultados = buscarOracoes(oracoes, q);
  const daAba = oracoesDaAba(oracoes, aba);

  return (
    <div>
      <Cabecalho titulo={copy.biblioteca} voltarPara="/eu" />
      <div className="flex flex-col gap-5 px-5 pb-8 pt-1">
        <div role="search">
          <CampoTexto rotulo={copy.busca} type="search" value={q} placeholder={copy.buscaPlaceholder} onChange={(e) => setQ(e.target.value)} autoComplete="off" enterKeyHint="search" />
        </div>

        {buscando ? (
          <section aria-label={copy.resultados(resultados.length)}>
            <p className="tipo-meta" aria-live="polite">
              {resultados.length ? copy.resultados(resultados.length) : copy.nenhum}
            </p>
            <ul className="divide-y divide-fio">
              {resultados.map((o) => (
                <LinhaOracao key={o.id} o={o} />
              ))}
            </ul>
          </section>
        ) : (
          <>
            {daSemana && (
              <Link href={`/fe/oracao?slug=${daSemana.slug}`} className="block rounded-card bg-primaria-suave px-4 py-3.5">
                <span className="tipo-titulo-secao block text-primaria-texto">{copy.daSemana}</span>
                <span className="mt-0.5 block text-[16px] font-medium text-texto">{daSemana.title}</span>
              </Link>
            )}

            {favoritos.length > 0 && (
              <section aria-labelledby="fe-favoritos">
                <h2 id="fe-favoritos" className="tipo-titulo-secao mb-1 text-texto-mudo">
                  {copy.favoritos}
                </h2>
                <ul className="divide-y divide-fio">
                  {favoritos.map((o) => (
                    <LinhaOracao key={o.id} o={o} />
                  ))}
                </ul>
              </section>
            )}

            <section className="flex flex-col gap-2" aria-label={copy.biblioteca}>
              <Abas rotulo={copy.biblioteca} valor={aba} onMudar={setAba} opcoes={ABAS_FE.map((a) => ({ valor: a, rotulo: copy.abas[a] }))} />
              <div role="tabpanel" aria-label={copy.abas[aba]}>
                {aba === "blessing" && (
                  <p className="tipo-meta mt-2" role="note">
                    {copy.avisoBencao}
                  </p>
                )}
                {daAba.length ? (
                  <ul className="divide-y divide-fio">
                    {daAba.map((o) => (
                      <LinhaOracao key={o.id} o={o} />
                    ))}
                  </ul>
                ) : (
                  <p className="tipo-corpo py-4 text-texto-mudo">{copy.vazio}</p>
                )}
              </div>
            </section>

            {VERBUM && (
              // RN-09: o Verbum é outro app; só o link, com UTM.
              <Card>
                <h2 className="text-[16px] font-medium text-texto">{copy.verbum.titulo}</h2>
                <p className="tipo-corpo mt-1 text-texto-mudo">{copy.verbum.texto}</p>
                <a
                  href={VERBUM}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => contarAnonimo("verbum_link_tapped")}
                  className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium text-primaria-texto"
                >
                  <ExternalLink size={16} aria-hidden />
                  {copy.verbum.abrir}
                </a>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Tela 3 "Biblioteca de fé": oração da semana, favoritas, abas Orações/Intercessores/Bênção, busca e o Verbum. */
export default function PaginaFe() {
  return (
    <Suspense>
      <Conteudo />
    </Suspense>
  );
}
