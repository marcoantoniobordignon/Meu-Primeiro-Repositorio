"use client";

import { Bloom, DepthOfField, EffectComposer, GodRays, Noise, Vignette } from "@react-three/postprocessing";
import { BlendFunction, KernelSize } from "postprocessing";
import { useEffect, useState } from "react";
import type * as THREE from "three";

import type { Qualidade } from "@/lib/bebe3d/qualidade";

import { useCena } from "./contexto";

interface Props {
  qualidade: Qualidade;
  ultrassom?: boolean;
}

/**
 * Pós-processamento cinematográfico, discreto: god rays da janela de sol,
 * profundidade de campo com foco no rosto, bloom contido, vinheta e grão.
 * O tone mapping (AgX) vem do renderer e é aplicado no fim pela composer.
 */
export function Pos({ qualidade, ultrassom = false }: Props) {
  const cena = useCena();
  const [sol, setSol] = useState<THREE.Mesh | null>(null);

  useEffect(() => {
    // A janela de sol monta depois; espera ela existir.
    const id = window.setInterval(() => {
      if (cena.janelaSol) {
        setSol(cena.janelaSol);
        window.clearInterval(id);
      }
    }, 50);
    return () => window.clearInterval(id);
  }, [cena]);

  if (!qualidade.pos) return null;

  return (
    <EffectComposer multisampling={qualidade.nivel === "alto" ? 4 : 0} enableNormalPass={false} autoClear={false}>
      {qualidade.godRays && sol ? (
        <GodRays sun={sol} exposure={0.22} decay={0.94} density={0.92} weight={0.32} samples={36} clampMax={1} blur kernelSize={KernelSize.SMALL} />
      ) : (
        <></>
      )}
      {qualidade.profundidadeDeCampo ? (
        <DepthOfField target={cena.foco} focalLength={0.015} bokehScale={ultrassom ? 0.8 : 1.2} worldFocusRange={16} resolutionScale={qualidade.nivel === "alto" ? 0.75 : 0.5} />
      ) : (
        <></>
      )}
      <Bloom luminanceThreshold={0.82} luminanceSmoothing={0.25} intensity={ultrassom ? 0.25 : 0.5} mipmapBlur radius={0.6} />
      <Vignette eskil={false} offset={0.22} darkness={ultrassom ? 0.75 : 0.55} />
      <Noise opacity={ultrassom ? 0.12 : 0.045} premultiply blendFunction={BlendFunction.SOFT_LIGHT} />
    </EffectComposer>
  );
}
