"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { CameraBarriga } from "@/components/features/barriga/CameraBarriga";
import { ConfirmarFoto } from "@/components/features/barriga/ConfirmarFoto";
import { dataDaFoto, useBarriga } from "@/lib/barriga/useBarriga";
import { fotoFantasma } from "@/lib/barriga/regras";
import { useColecao } from "@/lib/dados/colecao";
import { bellyPhotos } from "@/lib/dados/colecoes";
import { useFamilia } from "@/lib/familia/useFamilia";
import type { FotoProcessada } from "@/lib/midia/imagem";
import { atualizarPerfil } from "@/lib/perfil";
import { semanaPermitida } from "@dominio/barriga.ts";

function Conteudo() {
  const router = useRouter();
  const params = useSearchParams();
  const fotos = useColecao(bellyPhotos);
  const { perfil, tz, hoje, semanaAtual, dum, prefs } = useBarriga();
  const { permissoes } = useFamilia();
  const [capturada, setCapturada] = useState<{ foto: FotoProcessada; origem: "camera" | "gallery"; arquivo?: File } | null>(null);
  const [opacidade, setOpacidade] = useState(prefs.belly_ghost_opacity);
  const salvarOpacidade = useRef<number | null>(null);

  const pedida = Number(params.get("semana") ?? semanaAtual ?? NaN);
  const semana = semanaPermitida(pedida, semanaAtual) ? pedida : null;

  useEffect(() => {
    if (perfil === null) router.replace("/onboarding");
    else if (perfil && (semana === null || !permissoes.tirarFotosBarriga)) router.replace("/barriga");
  }, [perfil, semana, permissoes.tirarFotosBarriga, router]);

  if (!perfil || semana === null) return <div className="min-h-dvh bg-fundo" aria-busy="true" />;

  if (capturada) {
    return (
      <ConfirmarFoto
        foto={capturada.foto}
        semana={semana}
        origem={capturada.origem}
        takenOn={dataDaFoto(hoje, dum, tz, capturada.arquivo)}
        onRefazer={() => setCapturada(null)}
        onConcluido={() => router.replace("/barriga")}
      />
    );
  }

  return (
    <CameraBarriga
      semana={semana}
      fantasma={fotoFantasma(fotos, semana)}
      opacidade={opacidade}
      grade={prefs.belly_grid}
      onOpacidade={(v) => {
        setOpacidade(v);
        if (salvarOpacidade.current) window.clearTimeout(salvarOpacidade.current);
        salvarOpacidade.current = window.setTimeout(() => atualizarPerfil({ prefs: { ...perfil.prefs, belly_ghost_opacity: v } }), 400);
      }}
      onGrade={(v) => atualizarPerfil({ prefs: { ...perfil.prefs, belly_grid: v } })}
      onFoto={(foto, origem, arquivo) => setCapturada({ foto, origem, arquivo })}
      onFechar={() => router.replace("/barriga")}
    />
  );
}

/** Tela 2 "Câmera" em tela cheia (fora do shell com a TabBar). */
export default function PaginaCameraBarriga() {
  return (
    <div className="mx-auto w-full max-w-md">
      <Suspense fallback={<div className="min-h-dvh bg-fundo" aria-busy="true" />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}
