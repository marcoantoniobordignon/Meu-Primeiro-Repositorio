"use client";

import { Film, Images } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { MiniaturaRetro } from "@/components/features/retrospectiva/Miniatura";
import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { Card } from "@/components/ui/Card";
import { ProgressoContinuo } from "@/components/ui/Progresso";
import { retroCopy as copy } from "@/copy/retrospectiva";
import { track } from "@/lib/analytics";
import { montarZip } from "@/lib/cartas/zip";
import { compartilharArquivo } from "@/lib/compartilhar";
import { useFamilia } from "@/lib/familia/useFamilia";
import { marcarExportada } from "@/lib/retrospectiva/acoes";
import { carregarRecursos, fontesProntas, formatoDeVideo, gerarPngs, gravarVideo } from "@/lib/retrospectiva/midia";
import { estiloDoDocumento, type Recursos } from "@/lib/retrospectiva/render";
import { useRetrospectiva } from "@/lib/retrospectiva/useRetrospectiva";
import { fotosDosSlides, SEGUNDOS_POR_SLIDE, type TipoRetro } from "@dominio/retrospectiva.ts";

const X = copy.exportar;

type Etapa = { tipo: "parado" } | { tipo: "baixando"; feitas: number; total: number } | { tipo: "gravando"; segundos: number; total: number } | { tipo: "gerando" } | { tipo: "pronto" } | { tipo: "erro"; mensagem: string };

/** RN-08: Web Share API com arquivo(s); sem suporte, baixa. Devolve se compartilhou de verdade. */
async function compartilharVarios(arquivos: File[], nomeZip: string): Promise<boolean> {
  const nav = typeof navigator === "undefined" ? undefined : navigator;
  if (arquivos.length > 1 && nav?.canShare?.({ files: arquivos }) && typeof nav.share === "function") {
    try {
      await nav.share({ files: arquivos });
      return true;
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return false;
    }
  }
  if (arquivos.length === 1) return (await compartilharArquivo(arquivos[0]!)) === "compartilhado";
  const zip = montarZip(await Promise.all(arquivos.map(async (a) => ({ nome: a.name, dados: new Uint8Array(await a.arrayBuffer()) }))));
  await compartilharArquivo(new File([zip as BlobPart], nomeZip, { type: "application/zip" }));
  return false;
}

function Conteudo() {
  const params = useSearchParams();
  const kind: TipoRetro = params.get("kind") === "final" ? "final" : "preview";
  const r = useRetrospectiva(kind);
  const { papel } = useFamilia();
  const [etapa, setEtapa] = useState<Etapa>({ tipo: "parado" });
  const [formato, setFormato] = useState<string | null | undefined>(undefined);
  const cancelar = useRef<AbortController | null>(null);

  useEffect(() => setFormato(formatoDeVideo()), []);
  useEffect(() => () => cancelar.current?.abort(), []);

  if (!r.perfil) return null;
  if (papel !== "mae") return <p className="tipo-corpo px-5 pt-10 text-texto-mudo">{copy.player.soGestante}</p>;

  const slides = r.paraExportar;
  const fotos = fotosDosSlides(slides);
  const tier = r.premium ? "premium" : "free";
  const ocupado = etapa.tipo === "baixando" || etapa.tipo === "gravando" || etapa.tipo === "gerando";

  /** RN-07: antes de exportar, todas as fotos (com progresso). RN-11: sem rede, pede conexão. */
  async function prepararFotos(): Promise<Recursos | null> {
    if (fotos.length && typeof navigator !== "undefined" && !navigator.onLine) {
      setEtapa({ tipo: "erro", mensagem: X.semRede });
      return null;
    }
    setEtapa({ tipo: "baixando", feitas: 0, total: fotos.length });
    const [{ recursos, faltando }] = await Promise.all([carregarRecursos(fotos, (feitas, total) => setEtapa({ tipo: "baixando", feitas, total })), fontesProntas()]);
    if (faltando.length) {
      setEtapa({ tipo: "erro", mensagem: X.semRede });
      return null;
    }
    return recursos;
  }

  const estilo = () => estiloDoDocumento({ semMovimento: false, marca: !r.premium, kind });

  async function exportarVideo() {
    try {
      const rec = await prepararFotos();
      if (!rec) return;
      cancelar.current = new AbortController();
      const total = slides.length * SEGUNDOS_POR_SLIDE;
      setEtapa({ tipo: "gravando", segundos: 0, total });
      const { blob, extensao } = await gravarVideo(slides, rec, estilo(), (segundos) => setEtapa({ tipo: "gravando", segundos, total }), cancelar.current.signal);
      track("retro_exported", { format: "video", tier });
      marcarExportada(r.semente, kind, r.meuId);
      setEtapa({ tipo: "pronto" });
      if ((await compartilharArquivo(new File([blob], `${X.nomeVideo}.${extensao}`, { type: blob.type }))) === "compartilhado") track("retro_shared", {});
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setEtapa({ tipo: "erro", mensagem: X.erro });
    }
  }

  async function exportarImagens() {
    try {
      const rec = await prepararFotos();
      if (!rec) return;
      setEtapa({ tipo: "gerando" });
      const pngs = await gerarPngs(slides, rec, estilo());
      track("retro_exported", { format: "png", tier });
      marcarExportada(r.semente, kind, r.meuId);
      setEtapa({ tipo: "pronto" });
      const arquivos = pngs.map((b, i) => new File([b], `${X.nomeVideo}-${String(i + 1).padStart(2, "0")}.png`, { type: "image/png" }));
      if (await compartilharVarios(arquivos, `${X.nomeVideo}.zip`)) track("retro_shared", {});
    } catch {
      setEtapa({ tipo: "erro", mensagem: X.erro });
    }
  }

  return (
    <div className="flex flex-col gap-5 pb-8">
      <Cabecalho titulo={X.titulo} voltarPara={`/memorias/retrospectiva?kind=${kind}`} />
      <div className="flex justify-center px-5">
        <MiniaturaRetro slide={slides[0]} kind={kind} largura={132} />
      </div>
      <div className="flex flex-col gap-3 px-5">
        <Card>
          <div className="flex items-start gap-3">
            <Film size={20} aria-hidden className="mt-0.5 shrink-0 text-primaria-texto" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h2 className="text-[15px] font-medium text-texto">{X.video}</h2>
              <p className="tipo-meta">{X.videoApoio(slides.length * SEGUNDOS_POR_SLIDE)}</p>
              {formato === null && <p className="tipo-meta text-texto">{X.semVideo}</p>}
            </div>
            <Botao onClick={exportarVideo} disabled={ocupado || !formato}>
              {X.exportarBotao}
            </Botao>
          </div>
        </Card>
        <Card>
          <div className="flex items-start gap-3">
            <Images size={20} aria-hidden className="mt-0.5 shrink-0 text-primaria-texto" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h2 className="text-[15px] font-medium text-texto">{X.imagens}</h2>
              <p className="tipo-meta">{X.imagensApoio}</p>
            </div>
            <Botao variant="secundario" onClick={exportarImagens} disabled={ocupado}>
              {X.exportarBotao}
            </Botao>
          </div>
        </Card>
        {!r.premium && <p className="tipo-meta text-center">{X.marca}</p>}

        <div aria-live="polite" className="flex min-h-12 flex-col gap-2">
          {etapa.tipo === "baixando" && (
            <>
              <ProgressoContinuo fracao={etapa.total ? etapa.feitas / etapa.total : 1} rotulo={X.baixando(etapa.feitas, etapa.total)} />
              <p className="tipo-meta">{X.baixando(etapa.feitas, etapa.total)}</p>
            </>
          )}
          {etapa.tipo === "gravando" && (
            <>
              <ProgressoContinuo fracao={etapa.segundos / etapa.total} rotulo={X.gravando(etapa.segundos)} />
              <p className="tipo-meta">
                {X.gravando(etapa.segundos)} · {X.manterAberta}
              </p>
            </>
          )}
          {etapa.tipo === "gerando" && <p className="tipo-meta">{X.gerando}</p>}
          {etapa.tipo === "pronto" && <p className="tipo-corpo text-sucesso">{X.pronto}</p>}
          {etapa.tipo === "erro" && (
            <p role="alert" className="tipo-corpo text-erro">
              {etapa.mensagem}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Tela 5 · exportar: vídeo vertical ou imagens, e compartilhar (RN-07/08). */
export default function PaginaExportar() {
  return (
    <Suspense>
      <Conteudo />
    </Suspense>
  );
}
