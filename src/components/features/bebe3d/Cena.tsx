"use client";

import { Environment, Lightformer } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

import { paleta } from "@/lib/bebe3d/paleta";
import type { Qualidade } from "@/lib/bebe3d/qualidade";
import { escalaDaSemana, raioUteroDaSemana } from "@/lib/bebe3d/semanas";

import { Bebe } from "./Bebe";
import { Camera, type Enquadramento } from "./Camera";
import { useCena } from "./contexto";
import { Cordao } from "./Cordao";
import { JanelaSol } from "./JanelaSol";
import { Liquido } from "./Liquido";
import { Placenta } from "./Placenta";
import { Utero } from "./Utero";

interface Props {
  semana: number;
  qualidade: Qualidade;
  enquadramento: Enquadramento;
  reduzirMovimento: boolean;
  ultrassom?: boolean;
  /** Desenvolvimento: só o bebê, luz neutra, câmera livre. */
  inspecao?: boolean;
}

/**
 * A cena inteira: sol quente fora da barriga, preenchimento frio por baixo,
 * névoa do líquido, útero, placenta, cordão, bebê e partículas.
 */
export function Cena({ semana, qualidade, enquadramento, reduzirMovimento, ultrassom = false, inspecao = false }: Props) {
  const cena = useCena();
  const raio = raioUteroDaSemana(semana);
  const escala = escalaDaSemana(semana);
  const dirPlacenta = useMemo(() => new THREE.Vector3(-0.62, 0.42, -0.66).normalize(), []);
  const placentaPos = useMemo(() => dirPlacenta.clone().multiplyScalar(raio * 0.93), [dirPlacenta, raio]);
  const sol = useMemo(() => cena.sol.clone().normalize().multiplyScalar(raio * 3), [cena.sol, raio]);

  if (inspecao) {
    return (
      <>
        <color attach="background" args={[0x6b6b6b]} />
        <hemisphereLight args={[0xffffff, 0x444444, 2]} />
        <directionalLight position={[sol.x, sol.y, sol.z]} intensity={2} />
        <Bebe semana={semana} resolucao={qualidade.resolucaoMarchingCubes} reduzirMovimento={reduzirMovimento} inspecao />
        <Camera raio={raio * 3} escala={escala} enquadramento={enquadramento} reduzirMovimento={reduzirMovimento} />
      </>
    );
  }

  return (
    <>
      <color attach="background" args={[paleta.fundo]} />
      <fogExp2 attach="fog" args={[paleta.nevoa, ultrassom ? 0.05 : 0.5 / raio]} />

      {/* Sol quente, fora da barriga: key light. */}
      <directionalLight position={[sol.x, sol.y, sol.z]} color={paleta.sol} intensity={ultrassom ? 1.2 : 2.2} />
      {/* Luz que a própria parede iluminada devolve, do lado do sol, mais perto e mais suave. */}
      <pointLight position={[sol.x * 0.28, sol.y * 0.28, sol.z * 0.28]} color={paleta.uteroClaro} intensity={raio * raio * 0.6} distance={raio * 3} decay={2} />
      {/* Preenchimento frio e fraco por baixo. */}
      <pointLight position={[0, -raio * 0.9, raio * 0.6]} color={paleta.preenchimento} intensity={raio * raio * 0.3} distance={raio * 3} decay={2} />
      <ambientLight color={paleta.uteroEscuro} intensity={0.3} />

      {/* Ambiente sintético: tecido iluminado em cima, escuro embaixo. Sem HDRI de estúdio. */}
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={3} color={paleta.uteroClaro} position={[0, 5, -4]} rotation={[Math.PI / 2.4, 0, 0]} scale={[14, 10, 1]} />
        <Lightformer form="rect" intensity={0.8} color={paleta.sol} position={[5, 2, 3]} rotation={[0, -Math.PI / 3, 0]} scale={[6, 6, 1]} />
        <Lightformer form="rect" intensity={0.35} color={paleta.preenchimento} position={[0, -5, 2]} rotation={[-Math.PI / 2, 0, 0]} scale={[12, 12, 1]} />
      </Environment>

      <Utero raio={raio} ultrassom={ultrassom} />
      <JanelaSol raio={raio} />
      <Placenta raio={raio} direcao={dirPlacenta} />
      <Cordao raio={raio} placenta={placentaPos} reduzirMovimento={reduzirMovimento} />
      <Bebe semana={semana} resolucao={qualidade.resolucaoMarchingCubes} reduzirMovimento={reduzirMovimento} ultrassom={ultrassom} />
      <Liquido raio={raio} quantidade={qualidade.particulas} reduzirMovimento={reduzirMovimento} />
      <Camera raio={raio} escala={escala} enquadramento={enquadramento} reduzirMovimento={reduzirMovimento} />
    </>
  );
}
