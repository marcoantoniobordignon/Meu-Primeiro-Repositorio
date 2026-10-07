"use client";

import { ChevronRight, NotebookPen, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { CardMarco } from "@/components/features/diario/CardMarco";
import { LinhaEntrada } from "@/components/features/diario/LinhaEntrada";
import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { Escolha } from "@/components/ui/Escolha";
import { Vazio } from "@/components/ui/Vazio";
import { diarioCopy as copy } from "@/copy/diario";
import { track } from "@/lib/analytics";
import { manterDiario } from "@/lib/diario/acoes";
import { cardsDoDiario, linhaDoTempo, visivelPara } from "@/lib/diario/regras";
import { useDiario } from "@/lib/diario/useDiario";
import { marcoDoCatalogo, marcoVisivel } from "@dominio/diario.ts";

/** Tela 1 "Diário": card do próximo marco no topo (até 3), "+ Escrever", busca e filtro por marco. */
export default function PaginaDiario() {
  const { entradas, perfil, eu, papel, membros, hoje, agora, semanaAtual, modoFe, situacao, permissoes } = useDiario();
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [marco, setMarco] = useState<string>("");
  const buscou = useRef(false);

  useEffect(() => manterDiario(), [entradas.length]);
  useEffect(() => {
    if (busca.trim() && !buscou.current) {
      buscou.current = true;
      track("diary_search_used", {});
    }
  }, [busca]);

  if (!perfil || !permissoes.verDiario) return null;
  const visiveis = entradas.filter((e) => visivelPara(e, eu, papel));
  const lista = linhaDoTempo(entradas, eu, papel, { marco: marco || null, busca });
  const cards = perfil.dpp ? cardsDoDiario(semanaAtual, modoFe, situacao, agora) : [];
  const marcosComEntrada = [...new Set(visiveis.map((e) => e.milestone_code).filter((c): c is string => Boolean(c)))]
    .map((c) => marcoDoCatalogo(c))
    .filter((m): m is NonNullable<typeof m> => Boolean(m) && marcoVisivel(m!, modoFe));
  const semNada = visiveis.length === 0;

  return (
    <div>
      <Cabecalho titulo={copy.titulo} voltarPara="/eu" acao={<Botao variant="secundario" onClick={() => router.push("/diario/escrever")}>{copy.escrever}</Botao>} />
      <div className="flex flex-col gap-4 px-5 pt-1">
        {semNada && !situacao("discovery").respondido && !situacao("discovery").skipped_at ? (
          <Vazio icone={<NotebookPen size={24} />} frase={copy.vazio} acao={<Botao onClick={() => router.push("/diario/escrever?marco=discovery")}>{copy.vazioBotao}</Botao>} />
        ) : (
          cards.map((m) => <CardMarco key={m.code} marco={m} modoFe={modoFe} autor={eu} />)
        )}

        {perfil.dpp && (
          <Link href="/diario/marcos" className="tipo-titulo-secao flex min-h-11 items-center gap-0.5 self-end text-primaria-texto">
            {copy.verMarcos}
            <ChevronRight size={16} aria-hidden />
          </Link>
        )}

        {!semNada && (
          <>
            <div className="relative">
              <CampoTexto rotulo={copy.buscar} placeholder={copy.buscarPlaceholder} type="search" value={busca} onChange={(e) => setBusca(e.target.value)} autoComplete="off" />
              <Search size={16} aria-hidden className="pointer-events-none absolute right-4 top-[42px] text-texto-mudo" />
            </div>
            {marcosComEntrada.length > 0 && (
              <div className="scroll-x-sem-barra -mx-5 px-5">
                <Escolha rotulo={copy.filtro} semRotulo opcoes={[{ valor: "", rotulo: copy.todos }, ...marcosComEntrada.map((m) => ({ valor: m.code, rotulo: m.title }))]} valor={marco} onMudar={setMarco} />
              </div>
            )}
            {lista.length === 0 ? (
              <p className="tipo-corpo text-texto-mudo">{copy.semResultado}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {lista.map((e) => (
                  <LinhaEntrada key={e.id} entrada={e} dpp={perfil.dpp} hoje={hoje} eu={eu} membros={membros} />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
