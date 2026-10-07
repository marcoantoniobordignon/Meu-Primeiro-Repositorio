"use client";

import { ExternalLink, Star } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

import { Semaforo } from "@/components/features/faq/Semaforo";
import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { faqCopy as copy } from "@/copy/faq";
import { track } from "@/lib/analytics";
import { formatarComAno } from "@/lib/dates";
import { alternarFavorito, contarVisualizacao } from "@/lib/faq/acoes";
import { useFaq } from "@/lib/faq/useFaq";

function Conteudo() {
  const params = useSearchParams();
  const slug = params.get("slug");
  const doAviso = params.get("origem") === "lembrete" && params.get("categoria") === "faq";
  const { verbetes, idsFavoritos } = useFaq();
  const { mostrar } = useToast();
  const v = verbetes.find((x) => x.slug === slug);

  useEffect(() => {
    if (!v) return;
    track("faq_item_viewed", { slug: v.slug, verdict: v.verdict });
    if (doAviso) track("faq_answer_push_opened", {});
    void contarVisualizacao(v.slug);
    // Uma vez por verbete aberto.
  }, [v?.slug]);

  if (!v)
    return (
      <div>
        <Cabecalho titulo={copy.titulo} voltarPara="/faq" />
        <p className="tipo-corpo px-5 text-texto-mudo">{copy.naoEncontrado}</p>
      </div>
    );
  const favorito = idsFavoritos.has(v.id);

  return (
    <div>
      <Cabecalho titulo={v.name} voltarPara="/faq" />
      <div className="flex flex-col gap-4 px-5 pb-8 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          <Semaforo veredito={v.verdict} grande />
          {v.rascunho && <span className="rounded-pilula bg-acento-suave px-2 py-0.5 text-[12px] font-medium text-texto">{copy.rascunho}</span>}
        </div>
        <p className="text-[18px] font-medium leading-snug text-texto">{v.short_answer}</p>
        {v.condition_note && (
          <Card tom="suave">
            <p className="tipo-titulo-secao text-texto-mudo">{copy.condicao}</p>
            <p className="tipo-corpo mt-1 text-texto">{v.condition_note}</p>
          </Card>
        )}
        {v.details && (
          <section>
            <h2 className="tipo-titulo-secao mb-1 text-texto-mudo">{copy.detalhes}</h2>
            <p className="tipo-corpo whitespace-pre-line text-texto">{v.details}</p>
          </section>
        )}
        <div className="flex flex-col gap-1">
          <p className="tipo-meta">{copy.fonte(v.source_label)}</p>
          {v.source_url && (
            <a href={v.source_url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-medium text-primaria-texto">
              <ExternalLink size={14} aria-hidden />
              {copy.abrirFonte}
            </a>
          )}
          {v.reviewed_by && v.reviewed_on && <p className="tipo-meta">{copy.revisado(v.reviewed_by, formatarComAno(v.reviewed_on))}</p>}
          {(v.asked_count ?? 0) > 0 && <p className="tipo-meta">{copy.perguntadoPor(v.asked_count!)}</p>}
        </div>
        <Card tom="acento">
          <p className="tipo-corpo text-texto" role="note">
            {copy.aviso}
          </p>
        </Card>
        <Botao
          variant="secundario"
          icone={<Star size={16} aria-hidden fill={favorito ? "currentColor" : "none"} />}
          onClick={() => {
            if (alternarFavorito(v.id)) {
              track("faq_favorite_added", {});
              mostrar(copy.favoritado);
            }
          }}
        >
          {favorito ? copy.desfavoritar : copy.favoritar}
        </Botao>
      </div>
    </div>
  );
}

/** Tela 3 "Verbete": semáforo, resposta, condição, detalhes, fonte, "Perguntado por N mães", favoritar e o aviso fixo (RN-03). */
export default function PaginaVerbete() {
  return (
    <Suspense>
      <Conteudo />
    </Suspense>
  );
}
