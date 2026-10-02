"use client";

import { useMemo } from "react";
import * as THREE from "three";

import { paleta } from "@/lib/bebe3d/paleta";

interface Props {
  raio: number;
  /** Direção (normalizada) do centro do útero até a placenta. */
  direcao: THREE.Vector3;
}

function hash(x: number, y: number, z: number) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Disco orgânico com lóbulos, preso à parede, úmido. Sem sangue, sem bisturi. */
export function Placenta({ raio, direcao }: Props) {
  const geometria = useMemo(() => {
    const g = new THREE.SphereGeometry(1, 64, 40);
    const pos = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      // Lóbulos: ondulação radial de baixa frequência, mais forte na face interna (y > 0).
      const ang = Math.atan2(z, x);
      // Lóbulos suaves e irregulares (cotilédones), sem padrão de estrela.
      const r = Math.sqrt(x * x + z * z);
      const lob = 1 + 0.035 * Math.sin(ang * 6 + r * 9) * Math.max(0, y) + 0.03 * Math.sin(ang * 11 + 2.0) * Math.sin(r * 14) * Math.max(0, y) + 0.02 * (hash(Math.round(x * 6), Math.round(y * 6), Math.round(z * 6)) - 0.5);
      pos.setXYZ(i, x * lob, y * (y > 0 ? 0.38 : 0.16) * lob, z * lob);
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  }, []);

  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion();
    // O "y" local aponta para dentro do útero (face fetal), ou seja, contra a direção da parede.
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direcao.clone().multiplyScalar(-1).normalize());
    return q;
  }, [direcao]);

  const posicao = useMemo(() => direcao.clone().normalize().multiplyScalar(raio * 0.97), [direcao, raio]);
  const tamanho = raio * 0.42;

  return (
    <mesh geometry={geometria} position={posicao} quaternion={quaternion} scale={[tamanho, tamanho, tamanho]}>
      <meshPhysicalMaterial color={paleta.placenta} roughness={0.45} metalness={0} clearcoat={0.4} clearcoatRoughness={0.35} sheen={0.5} sheenColor={new THREE.Color(paleta.placentaBrilho)} envMapIntensity={0.8} />
    </mesh>
  );
}
