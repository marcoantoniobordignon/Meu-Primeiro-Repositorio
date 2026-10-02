"use client";

import { createContext, useContext } from "react";
import type * as THREE from "three";

/**
 * Estado compartilhado da cena, mutável e fora do React (lido em useFrame):
 * posições de interesse para câmera, foco e cordão, e o pulso do coração
 * para a parede do útero acompanhar.
 */
export interface EstadoCena {
  cabeca: THREE.Vector3;
  maos: THREE.Vector3;
  corpo: THREE.Vector3;
  umbigo: THREE.Vector3;
  /** Ponto em foco (profundidade de campo): segue o enquadramento atual, suavemente. */
  foco: THREE.Vector3;
  /** Para onde o rosto aponta e para onde o corpo aponta (frente), no mundo. */
  dirRosto: THREE.Vector3;
  dirCorpo: THREE.Vector3;
  sol: THREE.Vector3;
  pulso: number;
  tempo: number;
  /** Malha do disco de luz, fonte dos god rays. */
  janelaSol: THREE.Mesh | null;
  /** Desenvolvimento: primeira vista olhando para o sol (contraluz com god rays). */
  vistaInicialSol: boolean;
  /** Deslocamento recente da câmera, para o líquido reagir. */
  velocidadeCamera: THREE.Vector3;
  fps: number;
}

export const CenaCtx = createContext<EstadoCena | null>(null);

export function useCena(): EstadoCena {
  const c = useContext(CenaCtx);
  if (!c) throw new Error("useCena fora do provedor");
  return c;
}
