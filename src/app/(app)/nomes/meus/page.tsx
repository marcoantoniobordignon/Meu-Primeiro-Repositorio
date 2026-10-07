"use client";

import { ArrowDown, ArrowUp, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { SheetEscolherNome } from "@/components/features/nomes/SheetEscolherNome";
import { Abas } from "@/components/ui/Abas";
import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { Card } from "@/components/ui/Card";
import { nomesCopy as copy } from "@/copy/nomes";
import { track } from "@/lib/analytics";
import type { NameVote } from "@/lib/dados/colecoes";
import { salvarRanking, votar } from "@/lib/nomes/acoes";
import { useCatalogoDeNomes } from "@/lib/nomes/catalogo";
import { useNomes } from "@/lib/nomes/useNomes";
import { MAX_RANKING, mover } from "@dominio/nomes.ts";

type Aba = "curtidos" | "descartados" | "match";
const ABAS: Aba[] = ["curtidos", "descartados", "match"];

function Conteudo() {
  const params = useSearchParams();
  const router = useRouter();
  const { catalogo } = useCatalogoDeNomes();
  const { curtidos, descartados, top, matches, temParceiro } = useNomes();
  const pedida = params.get("aba") as Aba | null;
  const [aba, setAba] = useState<Aba>(pedida && ABAS.includes(pedida) ? pedida : "curtidos");
  const [escolhendo, setEscolhendo] = useState<{ chave: string; nome: string } | null>(null);
  const porId = new Map(catalogo.map((n) => [n.id, n]));
  const nomeDe = (v: { name_id: string | null; custom_name: string | null }) => (v.name_id ? (porId.get(v.name_id)?.name ?? "") : (v.custom_name ?? ""));
  const href = (v: { name_id: string | null; custom_name: string | null }) => (v.name_id ? `/nomes/nome?id=${v.name_id}` : `/nomes/nome?proprio=${encodeURIComponent(v.custom_name ?? "")}`);
  const ordem = top.map((v) => v.id);
  const foraDoTop = curtidos.filter((v) => v.rank === null).sort((a, b) => nomeDe(a).localeCompare(nomeDe(b)));

  function reordenar(nova: string[]) {
    if (salvarRanking(nova)) track("names_ranked", {});
  }

  const linha = (v: NameVote, acoes: React.ReactNode) => (
    <li key={v.id} className="flex items-center gap-1">
      <Link href={href(v)} className="flex min-h-13 min-w-0 flex-1 items-center gap-2 py-2 text-[16px] font-medium text-texto">
        {v.rank !== null && <span className="tipo-meta w-6 shrink-0 text-right">{v.rank}.</span>}
        <span className="truncate">{nomeDe(v)}</span>
      </Link>
      {acoes}
    </li>
  );
  const icone = "grid size-11 shrink-0 place-items-center rounded-pilula text-texto-mudo disabled:opacity-30";

  return (
    <div>
      <Cabecalho titulo={copy.meus.titulo} voltarPara="/nomes" />
      <div className="flex flex-col gap-4 px-5 pb-8 pt-1">
        <Abas
          rotulo={copy.meus.titulo}
          valor={aba}
          onMudar={(a) => {
            setAba(a);
            router.replace(`/nomes/meus?aba=${a}`);
          }}
          opcoes={ABAS.map((a) => ({ valor: a, rotulo: copy.meus.abas[a] }))}
        />

        {aba === "curtidos" && (
          <div role="tabpanel" aria-label={copy.meus.abas.curtidos} className="flex flex-col gap-4">
            {curtidos.length === 0 ? (
              <Card>
                <p className="tipo-corpo text-texto-mudo">{copy.meus.curtidosVazio}</p>
              </Card>
            ) : (
              <>
                {/* RN-04: até 10 favoritos, na ordem dela (setas no lugar do arrastar, acessíveis). */}
                <section aria-labelledby="top-10">
                  <h2 id="top-10" className="tipo-titulo-secao text-texto-mudo">
                    {copy.meus.top}
                  </h2>
                  <p className="tipo-meta">{copy.meus.topApoio}</p>
                  <ol className="divide-y divide-fio" aria-label={copy.meus.top}>
                    {top.map((v, i) =>
                      linha(
                        v,
                        <>
                          <button type="button" className={icone} aria-label={copy.meus.subir(nomeDe(v))} disabled={i === 0} onClick={() => reordenar(mover(ordem, v.id, -1))}>
                            <ArrowUp size={18} />
                          </button>
                          <button type="button" className={icone} aria-label={copy.meus.descer(nomeDe(v))} disabled={i === top.length - 1} onClick={() => reordenar(mover(ordem, v.id, 1))}>
                            <ArrowDown size={18} />
                          </button>
                          <button type="button" className={icone} aria-label={copy.meus.tirarDoTop(nomeDe(v))} onClick={() => reordenar(ordem.filter((x) => x !== v.id))}>
                            <X size={18} />
                          </button>
                        </>,
                      ),
                    )}
                  </ol>
                </section>
                {foraDoTop.length > 0 && (
                  <section aria-labelledby="outros-curtidos">
                    <h2 id="outros-curtidos" className="tipo-titulo-secao text-texto-mudo">
                      {copy.meus.outros}
                    </h2>
                    <ul className="divide-y divide-fio">
                      {foraDoTop.map((v) =>
                        linha(
                          v,
                          <Botao variant="fantasma" disabled={top.length >= MAX_RANKING} onClick={() => reordenar([...ordem, v.id])} aria-label={`${copy.meus.porNoTop}: ${nomeDe(v)}`}>
                            {top.length >= MAX_RANKING ? copy.meus.topCheio : copy.meus.porNoTop}
                          </Botao>,
                        ),
                      )}
                    </ul>
                  </section>
                )}
              </>
            )}
            <Link href="/nomes/adicionar" className="inline-flex min-h-11 items-center text-[15px] font-medium text-primaria-texto">
              {copy.meus.adicionar}
            </Link>
          </div>
        )}

        {aba === "descartados" && (
          <div role="tabpanel" aria-label={copy.meus.abas.descartados}>
            {descartados.length === 0 ? (
              <Card>
                <p className="tipo-corpo text-texto-mudo">{copy.meus.descartadosVazio}</p>
              </Card>
            ) : (
              <ul className="divide-y divide-fio">
                {descartados.map((v) =>
                  linha(
                    v,
                    // RN-03: descartados podem ser recuperados.
                    <Botao variant="fantasma" aria-label={`${copy.meus.recuperar}: ${nomeDe(v)}`} onClick={() => votar({ name_id: v.name_id, custom_name: v.custom_name }, "like")}>
                      {copy.meus.recuperar}
                    </Botao>,
                  ),
                )}
              </ul>
            )}
          </div>
        )}

        {aba === "match" && (
          // Tela 5 "Matches": só o que os dois curtiram (RN-05/06).
          <div role="tabpanel" aria-label={copy.meus.abas.match}>
            {matches.length === 0 ? (
              <Card>
                <p className="tipo-corpo text-texto-mudo">{temParceiro ? copy.meus.matchVazio : copy.meus.matchSemParceiro}</p>
              </Card>
            ) : (
              <ul className="divide-y divide-fio">
                {matches.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 py-1">
                    <Link href={href(m)} className="flex min-h-13 min-w-0 flex-1 items-center gap-2 text-[16px] font-medium text-texto">
                      <span className="truncate">{nomeDe(m)}</span>
                      <ChevronRight size={16} aria-hidden className="text-texto-mudo" />
                    </Link>
                    <Botao variant="secundario" onClick={() => setEscolhendo({ chave: m.chave, nome: nomeDe(m) })}>
                      {copy.escolher.botao}
                    </Botao>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      <SheetEscolherNome alvo={escolhendo} onFechar={() => setEscolhendo(null)} />
    </div>
  );
}

/** Tela 3 "Meus nomes": Curtidos (com o top 10), Descartados e Match. */
export default function PaginaMeusNomes() {
  return (
    <Suspense>
      <Conteudo />
    </Suspense>
  );
}
