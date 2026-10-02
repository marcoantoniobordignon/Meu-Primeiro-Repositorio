"use client";

import { PerformanceMonitor } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Activity, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { bebe3dCopy as copy } from "@/copy/bebe3d";
import { descer, lerRenderer, nivelInicial, niveis, prefereReduzirMovimento, subir, type Nivel } from "@/lib/bebe3d/qualidade";
import { dadosDaSemana, escalaDaSemana, raioUteroDaSemana } from "@/lib/bebe3d/semanas";

import type { Enquadramento } from "./Camera";
import { Carregando } from "./Carregando";
import { Cena } from "./Cena";
import { CenaCtx, type EstadoCena } from "./contexto";
import { Ficha } from "./Ficha";
import { MedidorFps } from "./Medidor";
import { Pos } from "./Pos";

interface Props {
  semana: number;
}

function temWebgl2(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2"));
  } catch {
    return false;
  }
}

/** A aba inteira: cena, carregamento, UI sobreposta. Lazy: só entra no bundle quando aberta. */
export function Bebe3D({ semana }: Props) {
  const router = useRouter();
  const dados = dadosDaSemana(semana);
  const [nivel, setNivel] = useState<Nivel>("medio");
  const [pronto, setPronto] = useState(false);
  const [enquadramento, setEnquadramento] = useState<Enquadramento>("corpo");
  const [reduzir, setReduzir] = useState(false);
  const [suporta, setSuporta] = useState<boolean | null>(null);
  const [fps, setFps] = useState(0);
  const [verMedidor, setVerMedidor] = useState(false);
  const [inspecao, setInspecao] = useState(false);
  const qualidade = niveis[nivel];
  const forcado = useRef(false);

  const estado = useMemo<EstadoCena>(
    () => ({
      cabeca: new THREE.Vector3(0, escalaDaSemana(semana) * 0.5, 0),
      maos: new THREE.Vector3(),
      corpo: new THREE.Vector3(),
      umbigo: new THREE.Vector3(),
      foco: new THREE.Vector3(0, escalaDaSemana(semana) * 0.5, 0),
      dirRosto: new THREE.Vector3(0, 0, 1),
      dirCorpo: new THREE.Vector3(0, 0, 1),
      sol: new THREE.Vector3(0.35, 0.8, -0.5).normalize(),
      pulso: 0,
      tempo: 0,
      janelaSol: null,
      vistaInicialSol: typeof location !== "undefined" && new URLSearchParams(location.search).get("vista") === "sol",
      velocidadeCamera: new THREE.Vector3(),
      fps: 0,
    }),
    [semana],
  );

  useEffect(() => {
    setSuporta(temWebgl2());
    setReduzir(prefereReduzirMovimento());
    const params = new URLSearchParams(location.search);
    const q = params.get("qualidade");
    if (q === "alto" || q === "medio" || q === "baixo") {
      setNivel(q);
      forcado.current = true;
    }
    // Modo de inspeção (desenvolvimento): só o bebê, sem útero nem pós, para avaliar a malha.
    setInspecao(params.get("inspecao") === "1");
  }, []);

  useEffect(() => {
    // A tela de carregamento some quando o bebê já está na cena (corpo posicionado) e houve quadros.
    const id = window.setInterval(() => {
      setFps(estado.fps);
      if (estado.corpo.lengthSq() > 0 && estado.tempo > 0.2) setPronto(true);
    }, 250);
    return () => window.clearInterval(id);
  }, [estado]);

  if (!dados) return null;

  if (suporta === false) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 bg-fundo px-5 pt-6 text-texto">
        <p className="tipo-saudacao">{copy.semWebgl.titulo}</p>
        <p className="tipo-corpo text-texto-mudo">{copy.semWebgl.apoio}</p>
        <p className="tipo-corpo">{dados.descricao_cena}</p>
        <Ficha dados={dados} />
      </div>
    );
  }

  return (
    <CenaCtx.Provider value={estado}>
      <div className="relative h-dvh w-full overflow-hidden bg-utero-fundo text-utero-texto">
        {suporta && (
          <Canvas
            dpr={qualidade.dpr}
            gl={{ antialias: !qualidade.pos, toneMapping: THREE.AgXToneMapping, toneMappingExposure: 1.05, powerPreference: "high-performance", stencil: false }}
            camera={{ fov: 58, near: 0.3, far: 400, position: [3, 3, raioUteroDaSemana(semana) * 0.8] }}
            onCreated={({ gl }) => {
              if (!forcado.current) setNivel(nivelInicial(lerRenderer(gl.getContext()), navigator.hardwareConcurrency, (navigator as { deviceMemory?: number }).deviceMemory));
            }}
            className="touch-none"
          >
            <PerformanceMonitor
              flipflops={3}
              onDecline={() => !forcado.current && setNivel((n) => descer(n))}
              onIncline={() => !forcado.current && setNivel((n) => subir(n))}
              onFallback={() => !forcado.current && setNivel("baixo")}
            />
            <Cena semana={semana} qualidade={qualidade} enquadramento={enquadramento} reduzirMovimento={reduzir} inspecao={inspecao} />
            {!inspecao && <Pos qualidade={qualidade} />}
            <MedidorFps />
          </Canvas>
        )}

        <Carregando visivel={!pronto} semana={semana} />

        {/* Topo: fechar, semana, medidor. */}
        <header className="safe-top pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between px-3">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label={copy.fechar}
            className="pointer-events-auto grid size-11 place-items-center rounded-pilula bg-utero-vidro text-utero-texto backdrop-blur-md"
          >
            <X size={20} />
          </button>
          <div className="pointer-events-auto flex flex-col items-center">
            <span className="rounded-pilula bg-utero-vidro px-4 py-2 text-[14px] font-medium backdrop-blur-md">{copy.semana(semana)}</span>
          </div>
          <button
            type="button"
            onClick={() => setVerMedidor((v) => !v)}
            aria-label={copy.medidor.rotulo}
            aria-pressed={verMedidor}
            className="pointer-events-auto grid size-11 place-items-center rounded-pilula bg-utero-vidro text-utero-texto-mudo backdrop-blur-md"
          >
            <Activity size={18} />
          </button>
        </header>
        {verMedidor && (
          <div role="status" className="absolute right-3 top-[calc(env(safe-area-inset-top,0px)+64px)] z-10 rounded-pilula bg-utero-vidro px-3 py-1.5 text-[12px] tabular-nums text-utero-texto backdrop-blur-md">
            {fps} fps · {copy.medidor.nivel[nivel]}
          </div>
        )}

        {/* Base: enquadramentos e ficha. */}
        <div className="safe-bottom pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col gap-3 px-4 pb-3">
          <div role="radiogroup" aria-label={copy.enquadramentos.rotulo} className="pointer-events-auto flex justify-center gap-2">
            {(["rosto", "maos", "corpo"] as Enquadramento[]).map((e) => (
              <button
                key={e}
                type="button"
                role="radio"
                aria-checked={enquadramento === e}
                onClick={() => setEnquadramento(e)}
                className={`min-h-10 rounded-pilula px-4 text-[13px] font-medium backdrop-blur-md transition-colors ${enquadramento === e ? "bg-utero-ambar text-utero-fundo" : "bg-utero-vidro text-utero-texto"}`}
              >
                {copy.enquadramentos[e]}
              </button>
            ))}
          </div>
          <div className="pointer-events-auto">
            <Ficha dados={dados} />
          </div>
          {reduzir && <p className="tipo-meta text-center text-utero-texto-mudo">{copy.reduzido}</p>}
        </div>
        <p className="sr-only">
          {copy.descricaoCena}: {dados.descricao_cena}
        </p>
      </div>
    </CenaCtx.Provider>
  );
}
