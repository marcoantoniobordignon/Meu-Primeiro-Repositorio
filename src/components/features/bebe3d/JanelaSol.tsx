"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { paleta } from "@/lib/bebe3d/paleta";

import { useCena } from "./contexto";

interface Props {
  raio: number;
}

/** Disco suave de luz na parede, no lado do sol: é a fonte dos god rays e do bloom. */
export function JanelaSol({ raio }: Props) {
  const cena = useCena();
  const ref = useRef<THREE.Mesh>(null);

  const textura = useMemo(() => {
    const n = 128;
    const dados = new Uint8Array(n * n * 4);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const dx = (x + 0.5) / n - 0.5;
        const dy = (y + 0.5) / n - 0.5;
        const d = Math.sqrt(dx * dx + dy * dy) * 2;
        const a = Math.max(0, 1 - d);
        const v = Math.round(255 * a * a * (3 - 2 * a));
        const i = (y * n + x) * 4;
        dados[i] = 255;
        dados[i + 1] = 255;
        dados[i + 2] = 255;
        dados[i + 3] = v;
      }
    }
    const t = new THREE.DataTexture(dados, n, n, THREE.RGBAFormat);
    t.needsUpdate = true;
    return t;
  }, []);

  const { posicao, quaternion } = useMemo(() => {
    const dir = cena.sol.clone().normalize();
    const p = dir.clone().multiplyScalar(raio * 0.9);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().multiplyScalar(-1));
    return { posicao: p, quaternion: q };
  }, [cena.sol, raio]);

  useEffect(() => {
    cena.janelaSol = ref.current;
    return () => {
      cena.janelaSol = null;
    };
  }, [cena]);

  return (
    <mesh ref={ref} position={posicao} quaternion={quaternion} frustumCulled={false}>
      <circleGeometry args={[raio * 0.38, 48]} />
      <meshBasicMaterial color={paleta.janelaSol} map={textura} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}
