"use client";

import { CameraControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";

import { useCena } from "./contexto";

export type Enquadramento = "corpo" | "rosto" | "maos";

interface Props {
  raio: number;
  escala: number;
  enquadramento: Enquadramento;
  reduzirMovimento: boolean;
}

const OCIOSO_S = 6;
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();

/** Largura (em unidades do modelo) que cada enquadramento precisa mostrar, e inclinação da câmera. */
const quadros: Record<Enquadramento, { largura: number; polar: number; alvo: "corpo" | "cabeca" | "maos" }> = {
  corpo: { largura: 1.15, polar: 1.4, alvo: "corpo" },
  rosto: { largura: 0.78, polar: 1.3, alvo: "cabeca" },
  maos: { largura: 0.62, polar: 1.45, alvo: "maos" },
};

/**
 * Órbita com inércia (camera-controls), pinça para zoom, auto-órbita lenta
 * quando ninguém toca, e enquadramentos com transição suave.
 * A distância sai da largura que precisa caber na tela, considerando o
 * aspecto (no celular em pé o campo horizontal é o limitante).
 */
export function Camera({ raio, escala, enquadramento, reduzirMovimento }: Props) {
  const cena = useCena();
  const controles = useRef<CameraControls>(null);
  const ultimoToque = useRef(0);
  const tocando = useRef(false);
  const posAnterior = useRef(new THREE.Vector3());
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const velocidadeOrbita = useRef(0);
  const enquadradoPara = useRef<Enquadramento | null>(null);
  const maxDistancia = raio * 0.9;

  function enquadrar(e: Enquadramento, transicao: boolean) {
    const c = controles.current;
    if (!c) return;
    const q = quadros[e];
    const alvo = q.alvo === "cabeca" ? cena.cabeca : q.alvo === "maos" ? cena.maos : cena.corpo;
    const meioFovV = THREE.MathUtils.degToRad(camera.fov / 2);
    const meioFovH = Math.atan(Math.tan(meioFovV) * camera.aspect);
    const largura = q.largura * escala;
    const dist = Math.min(maxDistancia, (largura / 2 / Math.tan(meioFovH)) * 1.08);
    // Rosto e mãos: a câmera vai para a frente do rosto/do corpo, não para o azimute atual.
    // Corpo: três quartos de frente, que é o ângulo mais bonito do bebê encolhido.
    const frente = q.alvo === "cabeca" ? cena.dirRosto : cena.dirCorpo;
    const azFrente = Math.atan2(frente.x, frente.z);
    let az = q.alvo === "corpo" ? azFrente + 0.75 : q.alvo === "maos" ? azFrente + 0.35 : azFrente - 0.12;
    // Desenvolvimento (?vista=sol): câmera do lado oposto ao sol, olhando para ele através do bebê.
    if (cena.vistaInicialSol && enquadradoPara.current === null) az = Math.atan2(-cena.sol.x, -cena.sol.z);
    tmpA.set(Math.sin(az) * Math.sin(q.polar), Math.cos(q.polar), Math.cos(az) * Math.sin(q.polar)).multiplyScalar(dist).add(alvo);
    void c.setLookAt(tmpA.x, tmpA.y, tmpA.z, alvo.x, alvo.y, alvo.z, transicao);
    ultimoToque.current = performance.now() / 1000;
  }

  useEffect(() => {
    // Só enquadra depois que o bebê já informou onde está (primeiro quadro); o resto é lido por ref.
    if (enquadradoPara.current !== null) {
      enquadrar(enquadramento, true);
      enquadradoPara.current = enquadramento;
    }
  }, [enquadramento]);

  useFrame((_, dt) => {
    const c = controles.current;
    if (!c) return;
    if (enquadradoPara.current === null && cena.corpo.lengthSq() > 0) {
      enquadrar(enquadramento, false);
      enquadradoPara.current = enquadramento;
    }
    // O foco da profundidade de campo segue o alvo do enquadramento, com atraso suave.
    const q = quadros[enquadramento];
    const alvoFoco = q.alvo === "cabeca" ? cena.cabeca : q.alvo === "maos" ? cena.maos : cena.corpo;
    cena.foco.lerp(alvoFoco, 1 - Math.exp(-3 * dt));
    const agora = performance.now() / 1000;
    const ocioso = !tocando.current && agora - ultimoToque.current > OCIOSO_S;
    const alvoVel = ocioso && !reduzirMovimento ? 0.07 : 0;
    velocidadeOrbita.current += (alvoVel - velocidadeOrbita.current) * (1 - Math.exp(-0.8 * dt));
    if (velocidadeOrbita.current > 1e-4) c.azimuthAngle += velocidadeOrbita.current * dt;
    // Velocidade da câmera para o líquido reagir.
    tmpB.copy(camera.position).sub(posAnterior.current).divideScalar(Math.max(dt, 1e-3));
    cena.velocidadeCamera.lerp(tmpB, 0.2);
    posAnterior.current.copy(camera.position);
  });

  return (
    <CameraControls
      ref={controles}
      makeDefault
      minDistance={escala * 0.8}
      maxDistance={maxDistancia}
      minPolarAngle={0.3}
      maxPolarAngle={Math.PI - 0.3}
      smoothTime={0.45}
      draggingSmoothTime={0.14}
      dollyToCursor={false}
      truckSpeed={0}
      onControlStart={() => {
        tocando.current = true;
      }}
      onControlEnd={() => {
        tocando.current = false;
        ultimoToque.current = performance.now() / 1000;
      }}
    />
  );
}
