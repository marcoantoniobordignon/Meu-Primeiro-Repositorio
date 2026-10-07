"use client";

import { useEffect, useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { SheetConfirmar } from "@/components/ui/SheetConfirmar";
import { useToast } from "@/components/ui/Toast";
import { barrigaCopy as copy } from "@/copy/barriga";
import { track } from "@/lib/analytics";
import { salvarFotoDaSemana } from "@/lib/barriga/acoes";
import { useColecao } from "@/lib/dados/colecao";
import { bellyPhotos } from "@/lib/dados/colecoes";
import { meuId } from "@/lib/familia/useFamilia";
import type { FotoProcessada } from "@/lib/midia/imagem";
import type { DataISO } from "@dominio/tempo.ts";

interface Props {
  foto: FotoProcessada;
  semana: number;
  origem: "camera" | "gallery";
  takenOn: DataISO;
  onRefazer: () => void;
  onConcluido: () => void;
}

/** Tela 3 "Confirmar": foto capturada, legenda opcional, "Usar esta" ou "Refazer". Semana com foto pergunta antes (RN-01). */
export function ConfirmarFoto({ foto, semana, origem, takenOn, onRefazer, onConcluido }: Props) {
  const fotos = useColecao(bellyPhotos);
  const [legenda, setLegenda] = useState("");
  const [url, setUrl] = useState<string | null>(null);
  const [perguntando, setPerguntando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const { mostrar } = useToast();
  const jaTem = fotos.some((f) => f.gest_week === semana);

  useEffect(() => {
    const u = URL.createObjectURL(foto.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [foto.blob]);

  async function salvar() {
    setSalvando(true);
    try {
      const r = await salvarFotoDaSemana({ blob: foto.blob, largura: foto.largura, altura: foto.altura, semana, takenOn, caption: legenda }, meuId());
      track("belly_photo_added", { source: origem, replaced: r.substituiu, week: semana });
      mostrar(copy.salva(semana));
      onConcluido();
    } catch {
      mostrar(copy.erroFoto);
      setSalvando(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-fundo">
      <div className="safe-top px-5">
        <h1 className="tipo-saudacao text-texto">{copy.confirmarTitulo(semana)}</h1>
      </div>
      <div className="mx-5 mt-3 aspect-[3/4] overflow-hidden rounded-card bg-fio">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url && <img src={url} alt={copy.confirmarTitulo(semana)} className="size-full object-cover" />}
      </div>
      <div className="safe-bottom mt-auto flex flex-col gap-3 px-5 pt-4">
        <CampoTexto rotulo={copy.legenda} value={legenda} maxLength={100} onChange={(e) => setLegenda(e.target.value)} autoComplete="off" />
        <div className="flex gap-2">
          <Botao largura="total" variant="secundario" onClick={onRefazer} disabled={salvando}>
            {copy.refazer}
          </Botao>
          <Botao largura="total" carregando={salvando} onClick={() => (jaTem ? setPerguntando(true) : void salvar())}>
            {copy.usarEsta}
          </Botao>
        </div>
      </div>
      <SheetConfirmar
        aberto={perguntando}
        titulo={copy.substituirTitulo(semana)}
        texto={copy.substituirTexto}
        confirmar={copy.substituir}
        cancelar={copy.cancelar}
        onFechar={() => setPerguntando(false)}
        onConfirmar={() => void salvar()}
      />
    </div>
  );
}
