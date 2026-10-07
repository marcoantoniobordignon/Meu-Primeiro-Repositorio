"use client";

import { ExternalLink, LifeBuoy, Share2, Star } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { direitosCopy as copy } from "@/copy/direitos";
import { track, type Eventos } from "@/lib/analytics";
import { blocos, type Trecho } from "@/lib/conteudo/markdown";
import { formatarLonga } from "@/lib/dates";
import { alternarFavoritoDireito } from "@/lib/direitos/acoes";
import { useDireitos } from "@/lib/direitos/useDireitos";
import { useFuso } from "@/lib/hooks/useFuso";
import { dataNoFuso } from "@dominio/tempo.ts";
import { mostrarAtualizado, precisaConferir, textoParaCompartilhar } from "@dominio/direitos.ts";

const ORIGENS: Eventos["rights_card_opened"]["source"][] = ["search", "home", "link"];

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

function Markdown({ md }: { md: string }) {
  return (
    <div className="flex flex-col gap-2">
      {blocos(md, { titulos: true }).map((b, i) =>
        b.tipo === "lista" ? (
          <ul key={i} className={`tipo-corpo ml-5 text-texto ${b.ordenada ? "list-decimal" : "list-disc"}`}>
            {b.itens.map((item, j) => (
              <li key={j} className="py-0.5">
                <Trechos t={item} />
              </li>
            ))}
          </ul>
        ) : (
          <p key={i} className={`tipo-corpo text-texto ${b.tipo === "titulo" ? "font-semibold" : ""}`}>
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
  const de = ORIGENS.find((o) => o === params.get("de")) ?? "link";
  const tz = useFuso();
  const { cartoes, favoritadoEm } = useDireitos();
  const { mostrar } = useToast();
  const c = cartoes.find((x) => x.slug === slug);

  useEffect(() => {
    if (c) track("rights_card_opened", { slug: c.slug, source: de });
    // Uma vez por cartão aberto.
  }, [c?.slug]);

  if (!c)
    return (
      <div>
        <Cabecalho titulo={copy.titulo} voltarPara="/direitos" />
        <p className="tipo-corpo px-5 text-texto-mudo">{copy.cartao.naoEncontrado}</p>
      </div>
    );

  const agora = new Date();
  const favorito = favoritadoEm.has(c.id);
  const atualizado = mostrarAtualizado(c, favoritadoEm.get(c.id), agora);
  const conferir = precisaConferir(c.reviewed_on, dataNoFuso(agora, tz));

  // RN-05: Web Share API com o texto; sem ela, copia.
  async function compartilhar() {
    const texto = textoParaCompartilhar(c!);
    try {
      if (navigator.share) await navigator.share({ text: texto });
      else {
        await navigator.clipboard.writeText(texto);
        mostrar(copy.cartao.copiado);
      }
      track("rights_card_shared", {});
    } catch {
      /* cancelou */
    }
  }

  return (
    <div>
      <Cabecalho titulo={copy.titulo} voltarPara="/direitos" />
      <article className="flex flex-col gap-4 px-5 pb-8 pt-1">
        <header className="flex flex-col gap-1.5">
          <p className="tipo-meta">{copy.temas[c.topic]}</p>
          <h2 className="font-serifa text-[26px] leading-tight text-texto">{c.question}</h2>
          <div className="flex flex-wrap gap-2">
            {c.rascunho && <span className="rounded-pilula bg-acento-suave px-2 py-0.5 text-[12px] font-medium text-texto">{copy.cartao.rascunho}</span>}
            {atualizado && <span className="rounded-pilula bg-primaria-suave px-2 py-0.5 text-[12px] font-medium text-primaria-texto">{copy.cartao.atualizado}</span>}
            {conferir && <span className="rounded-pilula bg-acento-suave px-2 py-0.5 text-[12px] font-medium text-texto">{copy.cartao.conferir}</span>}
          </div>
        </header>

        <p className="text-[17px] font-medium leading-snug text-texto">{c.answer}</p>
        {atualizado && <p className="tipo-meta">{copy.cartao.atualizadoApoio}</p>}
        {conferir && <p className="tipo-meta">{copy.cartao.conferirApoio}</p>}

        {c.details_md && (
          <section aria-labelledby="direito-detalhes">
            <h3 id="direito-detalhes" className="tipo-titulo-secao mb-1 text-texto-mudo">
              {copy.cartao.detalhes}
            </h3>
            <Markdown md={c.details_md} />
          </section>
        )}

        <section aria-labelledby="direito-lei">
          <h3 id="direito-lei" className="tipo-titulo-secao mb-1 text-texto-mudo">
            {copy.cartao.baseLegal}
          </h3>
          <ul className="flex flex-col">
            {c.legal_basis.map((lei, i) => (
              <li key={lei} className="tipo-corpo text-texto">
                {c.legal_links[i] ? (
                  <a href={c.legal_links[i]} target="_blank" rel="noopener noreferrer" aria-label={copy.cartao.abrirLei(lei)} className="inline-flex min-h-11 items-center gap-1.5 text-primaria-texto">
                    {lei}
                    <ExternalLink size={14} aria-hidden />
                  </a>
                ) : (
                  <span className="inline-flex min-h-11 items-center">{lei}</span>
                )}
              </li>
            ))}
          </ul>
        </section>

        <Card tom="suave">
          <h3 className="text-[16px] font-medium text-texto">{copy.cartao.seNaoRespeitarem}</h3>
          <div className="mt-1">
            <Markdown md={c.what_to_do_md} />
          </div>
          <Link href="/direitos/ajuda" className="mt-2 inline-flex min-h-11 items-center gap-2 text-[15px] font-medium text-primaria-texto">
            <LifeBuoy size={16} aria-hidden />
            {copy.ajuda}
          </Link>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Botao
            variant="secundario"
            icone={<Star size={16} aria-hidden fill={favorito ? "currentColor" : "none"} />}
            onClick={() => {
              if (alternarFavoritoDireito(c.id)) {
                track("rights_favorited", {});
                mostrar(copy.cartao.favoritado);
              }
            }}
          >
            {favorito ? copy.cartao.desfavoritar : copy.cartao.favoritar}
          </Botao>
          <Botao variant="secundario" icone={<Share2 size={16} aria-hidden />} onClick={() => void compartilhar()}>
            {copy.cartao.compartilhar}
          </Botao>
        </div>

        <footer className="flex flex-col gap-2 border-t border-fio pt-3">
          <p className="tipo-meta" role="note">
            {copy.aviso}
          </p>
          <p className="tipo-meta">{c.reviewed_on ? copy.cartao.revisado(formatarLonga(c.reviewed_on)) : copy.cartao.rascunhoRodape}</p>
        </footer>
      </article>
    </div>
  );
}

/** Tela 2 "Cartão": pergunta, resposta, detalhes, base legal, "Se não respeitarem", favoritar, compartilhar e revisão. */
export default function PaginaCartao() {
  return (
    <Suspense>
      <Conteudo />
    </Suspense>
  );
}
