"use client";

import { Bookmark, Lock, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { useToast } from "@/components/ui/Toast";
import { conteudoCopy as copy } from "@/copy/conteudo";
import { track } from "@/lib/analytics";
import { novoId } from "@/lib/dados/colecao";
import { useColecao } from "@/lib/dados/colecao";
import { conteudosLidos } from "@/lib/dados/colecoes";
import { conteudoPorId, nomeCategoria, type Conteudo } from "@/lib/conteudo/banco";
import { blocos, type Trecho } from "@/lib/conteudo/markdown";
import { cardsParaLeitura } from "@/lib/conteudo/stories";
import { paraISO, semanaGestacional } from "@/lib/dates";
import { temPlano, usePerfil } from "@/lib/perfil";

interface Props {
  id: string;
  posicao: number;
}

const tinta = {
  primaria: "bg-primaria/10",
  acento: "bg-acento/10",
  banho: "bg-banho/12",
  fralda: "bg-fralda/14",
  sono: "bg-sono/10",
  mamada: "bg-mamada/10",
};

const bolinha = {
  primaria: "bg-primaria",
  acento: "bg-acento",
  banho: "bg-banho",
  fralda: "bg-fralda",
  sono: "bg-sono",
  mamada: "bg-mamada",
};

/**
 * Leitor de story em tela cheia: cards por toque, progresso segmentado,
 * guardar, e o card de bloqueio para conteúdo premium (CON-05).
 */
export function LeitorStory({ id, posicao }: Props) {
  const router = useRouter();
  const perfil = usePerfil();
  const lidos = useColecao(conteudosLidos);
  const { mostrar } = useToast();
  const conteudo = conteudoPorId(id);
  const [indice, setIndice] = useState(0);
  const inicio = useRef(Date.now());
  const registroLido = lidos.find((l) => l.conteudo_id === id);

  useEffect(() => {
    if (!conteudo) return;
    const semana = perfil?.dpp ? semanaGestacional(perfil.dpp, paraISO(new Date())).semana : 0;
    track("story_vista", { id: conteudo.id, categoria: conteudo.categoria, semana, posicao });
  }, [conteudo, perfil?.dpp, posicao]);

  if (!conteudo) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center bg-fundo px-6 text-center">
        <p className="tipo-corpo text-texto-mudo">{copy.naoEncontrada}</p>
        <div className="mt-4">
          <Botao variant="secundario" onClick={() => router.replace("/hoje")}>
            {copy.fechar}
          </Botao>
        </div>
      </div>
    );
  }

  const { cards, bloqueada } = cardsParaLeitura(conteudo, temPlano(perfil));
  const total = cards.length + (bloqueada ? 1 : 0);
  const noBloqueio = bloqueada && indice === cards.length;
  const ultimo = indice === total - 1;

  function marcarLida() {
    conteudosLidos.salvar({
      id: registroLido?.id ?? novoId(),
      conteudo_id: conteudo!.id,
      lido_em: new Date().toISOString(),
      guardado: registroLido?.guardado ?? false,
    });
    track("story_concluida", { id: conteudo!.id, cards: total, segundos: Math.round((Date.now() - inicio.current) / 1000) });
  }

  function fechar() {
    router.replace("/hoje");
  }

  function avancar() {
    if (ultimo) {
      if (!noBloqueio) marcarLida();
      fechar();
      return;
    }
    const proximo = indice + 1;
    if (proximo === total - 1 && !bloqueada) marcarLida();
    if (bloqueada && proximo === cards.length) track("story_bloqueada_premium", { id: conteudo!.id });
    setIndice(proximo);
  }

  function voltar() {
    setIndice((i) => Math.max(0, i - 1));
  }

  function alternarGuardar() {
    const guardar = !(registroLido?.guardado ?? false);
    conteudosLidos.salvar({
      id: registroLido?.id ?? novoId(),
      conteudo_id: conteudo!.id,
      lido_em: registroLido?.lido_em ?? "",
      guardado: guardar,
    });
    if (guardar) track("story_guardada", { id: conteudo!.id });
    mostrar(guardar ? copy.guardada : copy.removida);
  }

  return (
    <div className={`mx-auto flex h-dvh w-full max-w-md flex-col ${tinta[conteudo.cor_token]} bg-fundo`}>
      <header className="safe-top shrink-0 px-4">
        <div role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={indice + 1} className="flex gap-1">
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={`h-1 flex-1 rounded-pilula ${i <= indice ? bolinha[conteudo.cor_token] : "bg-texto/15"}`} />
          ))}
        </div>
        <div className="mt-2 flex h-11 items-center justify-between">
          <div className="flex items-center gap-2">
            <span aria-hidden className={`size-2.5 rounded-full ${bolinha[conteudo.cor_token]}`} />
            <span className="tipo-titulo-secao text-texto-mudo">{nomeCategoria[conteudo.categoria]}</span>
          </div>
          <div className="flex">
            <button
              type="button"
              onClick={alternarGuardar}
              aria-label={registroLido?.guardado ? copy.desguardar : copy.guardar}
              aria-pressed={registroLido?.guardado ?? false}
              className="grid size-11 place-items-center rounded-pilula text-texto active:bg-texto/10"
            >
              <Bookmark size={22} fill={registroLido?.guardado ? "currentColor" : "none"} />
            </button>
            <button
              type="button"
              onClick={fechar}
              aria-label={copy.fechar}
              className="-mr-2 grid size-11 place-items-center rounded-pilula text-texto active:bg-texto/10"
            >
              <X size={22} />
            </button>
          </div>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col px-6 pb-4 pt-2">
        <h1 className="shrink-0 text-[15px] font-medium text-texto-mudo">{conteudo.titulo}</h1>
        <div key={indice} className="anim-surge mt-6 min-h-0 flex-1 overflow-y-auto">
          {noBloqueio ? (
            <CardBloqueio />
          ) : (
            <Card md={cards[indice] ?? ""} />
          )}
        </div>

        {/* Zonas de toque: um terço à esquerda volta, o resto avança. */}
        <button type="button" aria-label={copy.voltarCard} onClick={voltar} className="absolute inset-y-0 left-0 w-1/3 opacity-0" />
        <button type="button" aria-label={ultimo ? copy.concluir : copy.avancar} onClick={avancar} className="absolute inset-y-0 right-0 w-2/3 opacity-0" />
      </div>

      <div className="safe-bottom relative z-10 shrink-0 px-6 pt-2">
        <Botao largura="total" tamanho="lg" onClick={avancar}>
          {ultimo ? copy.concluir : copy.proxima}
        </Botao>
      </div>
    </div>
  );
}

function Card({ md }: { md: string }) {
  return (
    <div className="flex flex-col gap-4">
      {blocos(md).map((b, i) =>
        b.tipo === "lista" ? (
          <ul key={i} className="flex flex-col gap-2 pl-1">
            {b.itens.map((item, j) => (
              <li key={j} className="flex gap-3 text-[19px] leading-[1.4] text-texto">
                <span aria-hidden className="mt-[11px] size-1.5 shrink-0 rounded-full bg-texto-mudo" />
                <span>{renderTrechos(item)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p key={i} className={`text-texto ${ehSoEmoji(b.trechos) ? "text-[56px] leading-none" : "text-[22px] leading-[1.35] tracking-[-0.01em]"}`}>
            {renderTrechos(b.trechos)}
          </p>
        ),
      )}
    </div>
  );
}

function ehSoEmoji(t: Trecho[]): boolean {
  const texto = t.map((x) => x.valor).join("").trim();
  return texto.length <= 4 && /\p{Extended_Pictographic}/u.test(texto);
}

function renderTrechos(t: Trecho[]) {
  return t.map((x, i) =>
    x.tipo === "negrito" ? (
      <strong key={i} className="font-medium">
        {x.valor}
      </strong>
    ) : x.tipo === "italico" ? (
      <em key={i} className="font-serifa">
        {x.valor}
      </em>
    ) : (
      <span key={i}>{x.valor}</span>
    ),
  );
}

function CardBloqueio() {
  const { mostrar } = useToast();
  return (
    <div className="flex flex-col items-start gap-4">
      <span aria-hidden className="grid size-12 place-items-center rounded-full bg-primaria text-white">
        <Lock size={20} />
      </span>
      <p className="text-[22px] leading-[1.3] text-texto">{copy.bloqueio.titulo}</p>
      <p className="tipo-corpo text-texto-mudo">{copy.bloqueio.apoio}</p>
      <div className="relative z-10">
        <Botao variant="secundario" onClick={() => mostrar(copy.bloqueio.emBreve)}>
          {copy.bloqueio.cta}
        </Botao>
      </div>
    </div>
  );
}

export type { Conteudo };
