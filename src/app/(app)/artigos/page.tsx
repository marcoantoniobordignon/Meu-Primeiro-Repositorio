"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { LinhaArtigo } from "@/components/features/artigos/LinhaArtigo";
import { Abas } from "@/components/ui/Abas";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { Card } from "@/components/ui/Card";
import { artigosCopy as copy } from "@/copy/artigos";
import { useArtigos } from "@/lib/artigos/useArtigos";
import { useFuso } from "@/lib/hooks/useFuso";
import { usePerfil } from "@/lib/perfil";
import { dataNoFuso, idadeGestacional } from "@dominio/tempo.ts";
import { artigosDaAba, buscarArtigos, paraEstaSemana, trimestreDaSemana, type Trimestre } from "@dominio/trimestre.ts";

function Conteudo() {
  const params = useSearchParams();
  const perfil = usePerfil();
  const tz = useFuso();
  const { artigos, lidos, favoritos } = useArtigos();
  const semana = perfil?.dpp && perfil.modo === "gestacao" ? idadeGestacional(perfil.dpp, dataNoFuso(new Date(), tz)).semana : null;
  const atual: Trimestre = semana !== null ? trimestreDaSemana(semana) : 1;
  const pedida = Number(params.get("t"));
  // RN-05: a aba do trimestre atual abre primeiro; as outras ficam abertas para leitura.
  const [aba, setAba] = useState<Trimestre>(pedida === 1 || pedida === 2 || pedida === 3 ? pedida : atual);
  const [q, setQ] = useState("");
  const buscando = q.trim().length > 0;
  const resultados = buscarArtigos(artigos, q);
  const semana3 = semana !== null ? paraEstaSemana(artigos, lidos, semana) : [];

  return (
    <div>
      <Cabecalho titulo={copy.titulo} voltarPara="/hoje" />
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
              {resultados.map((a) => (
                <LinhaArtigo key={a.id} a={a} lido={lidos.has(a.id)} de="busca" />
              ))}
            </ul>
          </section>
        ) : (
          <>
            {semana !== null && (
              // Tela 2 · RN-03: até 3 artigos da semana; o que foi lido sai da lista.
              <section aria-labelledby="para-esta-semana">
                <h2 id="para-esta-semana" className="tipo-titulo-secao mb-1 text-texto-mudo">
                  {copy.paraEstaSemana}
                </h2>
                {semana3.length ? (
                  <ul className="divide-y divide-fio">
                    {semana3.map((a) => (
                      <LinhaArtigo key={a.id} a={a} lido={false} de="para_esta_semana" />
                    ))}
                  </ul>
                ) : (
                  <Card>
                    <p className="tipo-corpo text-texto-mudo">{copy.todosLidos}</p>
                  </Card>
                )}
              </section>
            )}

            {favoritos.length > 0 && (
              <section aria-labelledby="artigos-favoritos">
                <h2 id="artigos-favoritos" className="tipo-titulo-secao mb-1 text-texto-mudo">
                  {copy.favoritos}
                </h2>
                <ul className="divide-y divide-fio">
                  {favoritos.map((a) => (
                    <LinhaArtigo key={a.id} a={a} lido={lidos.has(a.id)} de="favoritos" />
                  ))}
                </ul>
              </section>
            )}

            <section aria-labelledby="biblioteca" className="flex flex-col gap-2">
              <h2 id="biblioteca" className="tipo-titulo-secao text-texto-mudo">
                {copy.biblioteca}
              </h2>
              <Abas
                rotulo={copy.biblioteca}
                valor={aba}
                onMudar={setAba}
                opcoes={([1, 2, 3] as const).map((t) => ({ valor: t, rotulo: copy.aba(t), rotuloLongo: copy.abaRotulo(t) }))}
              />
              <div role="tabpanel" aria-label={copy.abaRotulo(aba)}>
                {artigosDaAba(artigos, aba).length ? (
                  <ul className="divide-y divide-fio">
                    {artigosDaAba(artigos, aba).map((a) => (
                      <LinhaArtigo key={a.id} a={a} lido={lidos.has(a.id)} de="biblioteca" />
                    ))}
                  </ul>
                ) : (
                  <p className="tipo-corpo py-4 text-texto-mudo">{copy.semArtigos}</p>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

/** Telas 2 e 3: "Para esta semana", favoritos e a biblioteca com abas T1/T2/T3 e busca. */
export default function PaginaArtigos() {
  return (
    <Suspense>
      <Conteudo />
    </Suspense>
  );
}
