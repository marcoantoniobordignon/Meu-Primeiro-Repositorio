"use client";

import { LifeBuoy, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { LinhaDireito } from "@/components/features/direitos/LinhaDireito";
import { Abas } from "@/components/ui/Abas";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { Card } from "@/components/ui/Card";
import { Escolha } from "@/components/ui/Escolha";
import { direitosCopy as copy } from "@/copy/direitos";
import { track } from "@/lib/analytics";
import { dispensarDaHome } from "@/lib/direitos/acoes";
import { useDireitos } from "@/lib/direitos/useDireitos";
import { useFuso } from "@/lib/hooks/useFuso";
import { usePerfil } from "@/lib/perfil";
import { dataNoFuso, idadeGestacional } from "@dominio/tempo.ts";
import { buscarDireitos, paraEstaFase, TEMAS_DIREITOS, type TemaDireito } from "@dominio/direitos.ts";

type Aba = "todos" | "favoritos";
/** Atalhos da aba Favoritos vazia: os direitos que mais pesam no dia a dia. */
const ATALHOS = ["estabilidade-gestante", "acompanhante-no-parto", "licenca-maternidade", "licenca-paternidade"];

function Conteudo() {
  const params = useSearchParams();
  const router = useRouter();
  const perfil = usePerfil();
  const tz = useFuso();
  const { cartoes, favoritos } = useDireitos();
  const [aba, setAba] = useState<Aba>(params.get("aba") === "favoritos" ? "favoritos" : "todos");
  const [q, setQ] = useState("");
  const [tema, setTema] = useState<TemaDireito | "todos">("todos");
  const buscando = q.trim().length > 0 || tema !== "todos";
  const resultados = buscarDireitos(cartoes, q, tema === "todos" ? null : tema);
  const semana = perfil?.dpp && perfil.modo === "gestacao" ? idadeGestacional(perfil.dpp, dataNoFuso(new Date(), tz)).semana : null;
  const fase = semana !== null ? paraEstaFase(cartoes, semana, perfil?.prefs?.rights_dismissed ?? []) : [];

  // Só o tamanho da busca e quantos resultados: nunca o texto.
  useEffect(() => {
    if (!q.trim()) return;
    const t = setTimeout(() => track("rights_search", { query_len: q.trim().length, results: resultados.length }), 800);
    return () => clearTimeout(t);
  }, [q, resultados.length]);

  const mudarAba = (a: Aba) => {
    setAba(a);
    router.replace(a === "favoritos" ? "/direitos?aba=favoritos" : "/direitos");
  };

  return (
    <div>
      <Cabecalho titulo={copy.titulo} voltarPara="/eu" />
      <div className="flex flex-col gap-5 px-5 pb-8 pt-1">
        <Abas rotulo={copy.titulo} valor={aba} onMudar={mudarAba} opcoes={[{ valor: "todos", rotulo: copy.abas.todos }, { valor: "favoritos", rotulo: copy.abas.favoritos }]} />

        {aba === "favoritos" ? (
          <div role="tabpanel" aria-label={copy.abas.favoritos}>
            {favoritos.length ? (
              <ul className="divide-y divide-fio">
                {favoritos.map((c) => (
                  <LinhaDireito key={c.id} c={c} de="link" />
                ))}
              </ul>
            ) : (
              <Card>
                <p className="tipo-corpo text-texto">{copy.favoritosVazio}</p>
                <p className="tipo-meta mt-2">{copy.favoritosAtalhos}</p>
                <ul className="divide-y divide-fio">
                  {cartoes
                    .filter((c) => ATALHOS.includes(c.slug))
                    .slice(0, 3)
                    .map((c) => (
                      <LinhaDireito key={c.id} c={c} de="link" />
                    ))}
                </ul>
              </Card>
            )}
          </div>
        ) : (
          <div role="tabpanel" aria-label={copy.abas.todos} className="flex flex-col gap-5">
            <div role="search" className="flex flex-col gap-3">
              <CampoTexto rotulo={copy.busca} type="search" value={q} placeholder={copy.buscaPlaceholder} onChange={(e) => setQ(e.target.value)} autoComplete="off" enterKeyHint="search" />
              <Escolha
                rotulo={copy.temaRotulo}
                semRotulo
                valor={tema}
                onMudar={setTema}
                opcoes={[{ valor: "todos" as const, rotulo: copy.todosOsTemas }, ...TEMAS_DIREITOS.map((t) => ({ valor: t, rotulo: copy.temas[t] }))]}
              />
            </div>

            {buscando ? (
              <section aria-label={copy.resultados(resultados.length)}>
                <p className="tipo-meta" aria-live="polite">
                  {resultados.length ? copy.resultados(resultados.length) : copy.nenhum}
                </p>
                <ul className="divide-y divide-fio">
                  {resultados.map((c) => (
                    <LinhaDireito key={c.id} c={c} de="search" />
                  ))}
                </ul>
              </section>
            ) : (
              <>
                {fase.length > 0 && (
                  <section aria-labelledby="direitos-fase">
                    <h2 id="direitos-fase" className="tipo-titulo-secao mb-1 text-texto-mudo">
                      {copy.paraEstaFase}
                    </h2>
                    <ul className="divide-y divide-fio">
                      {fase.map((c) => (
                        <LinhaDireito
                          key={c.id}
                          c={c}
                          de="link"
                          acao={
                            <button type="button" aria-label={copy.dispensar(c.question)} onClick={() => dispensarDaHome(c.slug)} className="grid size-11 shrink-0 place-items-center rounded-pilula text-texto-mudo">
                              <X size={16} />
                            </button>
                          }
                        />
                      ))}
                    </ul>
                  </section>
                )}
                <ul className="divide-y divide-fio" aria-label={copy.titulo}>
                  {cartoes.map((c) => (
                    <LinhaDireito key={c.id} c={c} de="link" />
                  ))}
                </ul>
              </>
            )}

            <Link href="/direitos/ajuda" className="flex min-h-13 items-center gap-3 rounded-card bg-primaria-suave px-4 text-[15px] font-medium text-primaria-texto">
              <LifeBuoy size={18} aria-hidden />
              {copy.ajuda}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

/** Tela 1 "Direitos": busca, temas, "Para esta fase", lista e favoritos. */
export default function PaginaDireitos() {
  return (
    <Suspense>
      <Conteudo />
    </Suspense>
  );
}
