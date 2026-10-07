"use client";

import { Heart, ListFilter, Plus, Undo2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { CartaNome } from "@/components/features/nomes/CartaNome";
import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { Card } from "@/components/ui/Card";
import { Escolha } from "@/components/ui/Escolha";
import { Sheet } from "@/components/ui/Sheet";
import { nomesCopy as copy } from "@/copy/nomes";
import { track } from "@/lib/analytics";
import { desfazerVoto, votar } from "@/lib/nomes/acoes";
import { useCatalogoDeNomes } from "@/lib/nomes/catalogo";
import { useNomes } from "@/lib/nomes/useNomes";
import { usePerfil } from "@/lib/perfil";
import { catalogoTemPopularidade, montarBaralho, origensDoCatalogo, SEM_FILTROS, type Filtros, type Popularidade } from "@dominio/nomes.ts";

const CHAVE_SESSAO = "ninho.nomes.baralho";
const LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

interface Sessao {
  filtros: Filtros;
  semente: string;
  ids: string[];
}

function lerSessao(): Sessao | null {
  try {
    return JSON.parse(sessionStorage.getItem(CHAVE_SESSAO) ?? "null") as Sessao | null;
  } catch {
    return null;
  }
}
function guardarSessao(s: Sessao) {
  try {
    sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(s));
  } catch {
    /* nada */
  }
}

/** Tela 1 "Descobrir": 20 nomes por rodada (RN-01), curtir/descartar por gesto ou botão e desfazer (RN-02). */
export default function PaginaNomes() {
  const router = useRouter();
  const perfil = usePerfil();
  const { catalogo, comServidor } = useCatalogoDeNomes();
  const { votos } = useNomes();
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [rascunho, setRascunho] = useState<Filtros>(SEM_FILTROS);
  const [ultimo, setUltimo] = useState<string | null>(null);
  const comPopularidade = catalogoTemPopularidade(catalogo);
  const origens = useMemo(() => origensDoCatalogo(catalogo), [catalogo]);
  const votados = useMemo(() => new Set(votos.filter((v) => v.name_id).map((v) => v.name_id!)), [votos]);

  function novaRodada(filtros: Filtros) {
    const semente = `${Date.now()}-${Math.random()}`;
    const s = { filtros, semente, ids: montarBaralho(catalogo, votados, filtros, semente).map((n) => n.id) };
    guardarSessao(s);
    setSessao(s);
  }

  // A rodada sobrevive a recarregar a tela (sessionStorage); sem rodada, monta uma.
  useEffect(() => {
    const s = lerSessao();
    if (s) setSessao(s);
    else novaRodada(SEM_FILTROS);
    // Só ao abrir.
  }, []);

  if (!perfil || !sessao) return null;
  const porId = new Map(catalogo.map((n) => [n.id, n]));
  const restantes = sessao.ids.filter((id) => !votados.has(id));
  const atual = restantes[0] ? porId.get(restantes[0]) : undefined;
  const vistos = sessao.ids.length - restantes.length;
  const semVotos = votos.length === 0;
  const temMais = montarBaralho(catalogo, votados, sessao.filtros, "conferir", 1).length > 0;

  function votarAtual(vote: "like" | "dislike") {
    if (!atual) return;
    const v = votar({ name_id: atual.id, custom_name: null }, vote);
    setUltimo(v.id);
    track("names_swipe", { vote });
  }

  return (
    <div>
      <Cabecalho
        titulo={copy.titulo}
        voltarPara="/eu"
        acao={
          <button
            type="button"
            aria-label={copy.filtros}
            onClick={() => {
              setRascunho(sessao.filtros);
              setFiltrosAbertos(true);
            }}
            className="grid size-11 place-items-center rounded-pilula text-texto"
          >
            <ListFilter size={20} />
          </button>
        }
      />
      <div className="flex flex-col gap-4 px-5 pb-8 pt-1">
        {semVotos && (
          <div>
            <h2 className="text-[18px] font-medium text-texto">{copy.comece}</h2>
            <p className="tipo-corpo text-texto-mudo">{copy.comeceApoio}</p>
          </div>
        )}

        {atual ? (
          <>
            <p className="tipo-meta text-center" aria-live="polite">
              {copy.progresso(vistos + 1, sessao.ids.length)}
            </p>
            <CartaNome
              key={atual.id}
              nome={atual}
              comServidor={comServidor}
              modoFe={Boolean(perfil.prefs?.faith_mode)}
              mostrarPopularidade={comPopularidade}
              onVotar={votarAtual}
              onAbrir={() => router.push(`/nomes/nome?id=${atual.id}`)}
            />
            <div className="flex items-center justify-center gap-4">
              <button type="button" onClick={() => votarAtual("dislike")} aria-label={copy.descartar} className="grid size-16 place-items-center rounded-full border-2 border-acento bg-superficie text-acento">
                <X size={28} />
              </button>
              <button type="button" onClick={() => votarAtual("like")} aria-label={copy.curtir} className="grid size-16 place-items-center rounded-full border-2 border-sucesso bg-superficie text-sucesso">
                <Heart size={28} />
              </button>
            </div>
          </>
        ) : (
          <Card>
            <p className="tipo-corpo text-texto">{temMais ? copy.sessaoFim : copy.acabou}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {temMais && <Botao onClick={() => novaRodada(sessao.filtros)}>{copy.maisVinte}</Botao>}
              {!temMais && JSON.stringify(sessao.filtros) !== JSON.stringify(SEM_FILTROS) && (
                <Botao variant="secundario" onClick={() => novaRodada(SEM_FILTROS)}>
                  {copy.limparFiltros}
                </Botao>
              )}
            </div>
          </Card>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Botao
            variant="fantasma"
            icone={<Undo2 size={16} aria-hidden />}
            disabled={!ultimo}
            onClick={() => {
              if (!ultimo) return;
              desfazerVoto(ultimo);
              setUltimo(null);
              track("names_undo", {});
            }}
          >
            {copy.desfazer}
          </Botao>
          <Link href="/nomes/meus" className="inline-flex min-h-11 items-center px-2 text-[15px] font-medium text-primaria-texto">
            {copy.meus.titulo}
          </Link>
          <Link href="/nomes/adicionar" className="inline-flex min-h-11 items-center gap-1 px-2 text-[15px] font-medium text-primaria-texto">
            <Plus size={16} aria-hidden />
            {copy.meus.adicionar}
          </Link>
        </div>
      </div>

      <Sheet
        aberto={filtrosAbertos}
        onFechar={() => setFiltrosAbertos(false)}
        titulo={copy.filtros}
        rodape={
          <Botao
            largura="total"
            tamanho="lg"
            onClick={() => {
              novaRodada(rascunho);
              setFiltrosAbertos(false);
            }}
          >
            {copy.aplicar}
          </Botao>
        }
      >
        <div className="flex flex-col gap-4">
          <Escolha
            rotulo={copy.sexo.rotulo}
            valor={rascunho.sexo ?? "todos"}
            onMudar={(v) => setRascunho({ ...rascunho, sexo: v === "todos" ? null : v })}
            opcoes={[
              { valor: "f" as const, rotulo: copy.sexo.f },
              { valor: "m" as const, rotulo: copy.sexo.m },
              { valor: "todos" as const, rotulo: copy.sexo.todos },
            ]}
          />
          <label className="flex flex-col gap-1.5">
            <span className="tipo-titulo-secao text-texto-mudo">{copy.letra}</span>
            <select
              value={rascunho.letra ?? ""}
              onChange={(e) => setRascunho({ ...rascunho, letra: e.target.value || null })}
              className="min-h-12 rounded-pilula border border-fio bg-superficie px-4 text-[15px] text-texto"
            >
              <option value="">{copy.letraTodas}</option>
              {LETRAS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <Escolha
            rotulo={copy.silabas.rotulo}
            valor={rascunho.silabas ?? 0}
            onMudar={(v) => setRascunho({ ...rascunho, silabas: v || null })}
            opcoes={[{ valor: 0, rotulo: copy.silabas.todas }, ...[1, 2, 3, 4].map((n) => ({ valor: n, rotulo: copy.silabas.n(n) }))]}
          />
          <label className="flex flex-col gap-1.5">
            <span className="tipo-titulo-secao text-texto-mudo">{copy.origem.rotulo}</span>
            <select
              value={rascunho.origem ?? ""}
              onChange={(e) => setRascunho({ ...rascunho, origem: e.target.value || null })}
              className="min-h-12 rounded-pilula border border-fio bg-superficie px-4 text-[15px] text-texto"
            >
              <option value="">{copy.origem.todas}</option>
              {origens.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
          {comPopularidade && (
            <Escolha
              rotulo={copy.popularidade.rotulo}
              valor={rascunho.popularidade ?? "todas"}
              onMudar={(v) => setRascunho({ ...rascunho, popularidade: v === "todas" ? null : (v as Popularidade) })}
              opcoes={[
                { valor: "todas", rotulo: copy.popularidade.todas },
                { valor: "muito_comum", rotulo: copy.popularidade.muito_comum },
                { valor: "comum", rotulo: copy.popularidade.comum },
                { valor: "raro", rotulo: copy.popularidade.raro },
              ]}
            />
          )}
        </div>
      </Sheet>
    </div>
  );
}
