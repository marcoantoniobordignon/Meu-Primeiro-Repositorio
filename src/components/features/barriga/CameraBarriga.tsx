"use client";

import { Grid3x3, ImagePlus, SwitchCamera, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { Foto } from "@/components/ui/Foto";
import { barrigaCopy as copy } from "@/copy/barriga";
import type { BellyPhoto } from "@/lib/dados/colecoes";
import { exportarJpeg, processarFoto, type FotoProcessada } from "@/lib/midia/imagem";
import { OPACIDADE_FANTASMA_MAX } from "@dominio/prefs.ts";

export const PROPORCAO = 3 / 4;

interface Props {
  semana: number;
  fantasma?: BellyPhoto;
  opacidade: number;
  grade: boolean;
  onOpacidade: (v: number) => void;
  onGrade: (v: boolean) => void;
  onFoto: (foto: FotoProcessada, origem: "camera" | "gallery", arquivo?: File) => void;
  onFechar: () => void;
}

type Estado = "iniciando" | "camera" | "sem_camera" | "processando";

/**
 * RN-03: getUserMedia com a câmera traseira por padrão e botão para virar; 3:4; grade 3×3
 * que liga e desliga; fantasma com a última foto (0 a 60 %). Sem permissão ou sem suporte,
 * `<input type="file" capture>` e a galeria. Funciona sem rede (RN-13).
 */
export function CameraBarriga({ semana, fantasma, opacidade, grade, onOpacidade, onGrade, onFoto, onFechar }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const entradaCamera = useRef<HTMLInputElement>(null);
  const entradaGaleria = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<Estado>("iniciando");
  const [frente, setFrente] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const parar = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  useEffect(() => {
    let vivo = true;
    async function abrir() {
      parar();
      if (!navigator.mediaDevices?.getUserMedia) {
        setEstado("sem_camera");
        return;
      }
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: frente ? "user" : "environment", width: { ideal: 1920 }, height: { ideal: 1440 } },
          audio: false,
        });
        if (!vivo) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = s;
        if (video.current) {
          video.current.srcObject = s;
          await video.current.play().catch(() => undefined);
        }
        setEstado("camera");
      } catch {
        if (vivo) setEstado("sem_camera");
      }
    }
    void abrir();
    return () => {
      vivo = false;
      parar();
    };
  }, [frente, parar]);

  async function disparar() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    setEstado("processando");
    try {
      const foto = await exportarJpeg(v, { proporcao: PROPORCAO, espelhar: frente });
      parar();
      onFoto(foto, "camera");
    } catch {
      setErro(copy.erroFoto);
      setEstado("camera");
    }
  }

  async function doArquivo(arquivo: File | undefined, origem: "camera" | "gallery") {
    if (!arquivo) return;
    setEstado("processando");
    try {
      const foto = await processarFoto(arquivo, { proporcao: PROPORCAO });
      parar();
      onFoto(foto, origem, arquivo);
    } catch {
      setErro(copy.erroFoto);
      setEstado(stream.current ? "camera" : "sem_camera");
    }
  }

  const entradas = (
    <>
      <input ref={entradaCamera} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-label={copy.usarCameraDoCelular} onChange={(e) => void doArquivo(e.target.files?.[0], "camera")} />
      <input ref={entradaGaleria} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-label={copy.escolherDaGaleria} onChange={(e) => void doArquivo(e.target.files?.[0], "gallery")} />
    </>
  );

  return (
    <div className="flex min-h-dvh flex-col bg-fundo">
      <header className="safe-top flex items-center gap-1 px-2 pb-2">
        <button type="button" aria-label={copy.fechar} onClick={onFechar} className="grid size-11 place-items-center rounded-pilula text-texto active:bg-primaria-suave">
          <X size={22} />
        </button>
        <h1 className="tipo-saudacao flex-1 text-texto">{copy.semana(semana)}</h1>
        {estado === "camera" && (
          <>
            <button type="button" aria-label={copy.grade} aria-pressed={grade} onClick={() => onGrade(!grade)} className={`grid size-11 place-items-center rounded-pilula ${grade ? "bg-primaria-suave text-primaria-texto" : "text-texto"}`}>
              <Grid3x3 size={20} />
            </button>
            <button type="button" aria-label={copy.virar} onClick={() => setFrente((f) => !f)} className="grid size-11 place-items-center rounded-pilula text-texto active:bg-primaria-suave">
              <SwitchCamera size={20} />
            </button>
          </>
        )}
      </header>

      {entradas}

      {estado === "sem_camera" ? (
        <div className="flex flex-1 flex-col justify-center gap-3 px-6 text-center">
          <p className="tipo-corpo text-texto-mudo">{copy.semCamera}</p>
          {erro && <p className="text-[13px] text-erro">{erro}</p>}
          <Botao largura="total" tamanho="lg" onClick={() => entradaCamera.current?.click()}>
            {copy.usarCameraDoCelular}
          </Botao>
          <Botao largura="total" variant="secundario" onClick={() => entradaGaleria.current?.click()}>
            {copy.escolherDaGaleria}
          </Botao>
        </div>
      ) : (
        <>
          <div className="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden bg-fio">
            <video ref={video} playsInline muted autoPlay aria-label={copy.semana(semana)} className={`size-full object-cover ${frente ? "-scale-x-100" : ""}`} />
            {fantasma && opacidade > 0 && (
              <div aria-hidden className="pointer-events-none absolute inset-0" style={{ opacity: opacidade }}>
                <Foto caminho={fantasma.storage_path} alt="" />
              </div>
            )}
            {grade && (
              <div aria-hidden className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                {Array.from({ length: 9 }, (_, i) => (
                  <span key={i} className="border-[0.5px] border-superficie/50" />
                ))}
              </div>
            )}
            {estado !== "camera" && <div aria-busy className="absolute inset-0 grid place-items-center bg-fundo/60 text-[14px] text-texto">{estado === "processando" ? copy.processando : null}</div>}
          </div>

          <div className="safe-bottom mt-auto flex flex-col gap-4 px-6 pt-4">
            {erro && <p className="text-center text-[13px] text-erro">{erro}</p>}
            {fantasma && (
              <label className="flex items-center gap-3">
                <span className="tipo-meta w-28 shrink-0">{copy.fantasmaDa(fantasma.gest_week)}</span>
                <input
                  type="range"
                  min={0}
                  max={OPACIDADE_FANTASMA_MAX}
                  step={0.05}
                  value={opacidade}
                  aria-label={copy.fantasma}
                  onChange={(e) => onOpacidade(Number(e.target.value))}
                  className="h-11 flex-1 accent-[var(--cor-primaria)]"
                />
              </label>
            )}
            <div className="flex items-center justify-between">
              <button type="button" aria-label={copy.escolherDaGaleria} onClick={() => entradaGaleria.current?.click()} className="grid size-12 place-items-center rounded-full bg-primaria-suave text-primaria-texto">
                <ImagePlus size={20} />
              </button>
              <button
                type="button"
                aria-label={copy.disparar}
                disabled={estado !== "camera"}
                onClick={() => void disparar()}
                className="grid size-[72px] place-items-center rounded-full border-4 border-primaria bg-superficie active:scale-95 disabled:opacity-45"
              >
                <span aria-hidden className="size-14 rounded-full bg-primaria" />
              </button>
              <span className="size-12" aria-hidden />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
