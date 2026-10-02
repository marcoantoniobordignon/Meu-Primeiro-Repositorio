"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { ControladorBebe } from "@/lib/bebe3d/animacao";
import { CENTRO_CABECA, CENTRO_MAOS, UMBIGO } from "@/lib/bebe3d/esqueleto";
import { type MalhaBebe } from "@/lib/bebe3d/malha";
import { gerarMalhaBebeAsync } from "@/lib/bebe3d/malha.async";
import { criarMaterialPele } from "@/lib/bebe3d/pele";
import { escalaDaSemana } from "@/lib/bebe3d/semanas";

import { useCena } from "./contexto";

interface Props {
  semana: number;
  resolucao: number;
  reduzirMovimento: boolean;
  ultrassom?: boolean;
  inspecao?: boolean;
}

const tmp = new THREE.Vector3();
const materialInspecao = new THREE.MeshStandardMaterial({ color: 0xd9c4b4, roughness: 0.7, metalness: 0 });

/**
 * O bebê: malha gerada uma vez, pele com SSS, esqueleto animado pelo controlador.
 * Trocar pelo modelo definitivo: carregar o glTF, usar `nodes.Bebe` como
 * skinnedMesh e os ossos pelo nome; o resto deste arquivo não muda.
 */
export function Bebe({ semana, resolucao, reduzirMovimento, ultrassom = false, inspecao = false }: Props) {
  const cena = useCena();
  const grupo = useRef<THREE.Group>(null);
  const malhaRef = useRef<THREE.SkinnedMesh>(null);
  const [malha, setMalha] = useState<MalhaBebe | null>(null);
  const { material, uniforms } = useMemo(() => criarMaterialPele(), []);
  const controlador = useMemo(() => (malha ? new ControladorBebe(malha.ossosPorNome) : null), [malha]);
  const escala = escalaDaSemana(semana);

  useEffect(() => {
    let viva = true;
    void gerarMalhaBebeAsync(resolucao).then((m) => {
      if (viva) setMalha(m);
      else m.geometria.dispose();
    });
    return () => {
      viva = false;
    };
  }, [resolucao]);

  useEffect(() => {
    const m = malhaRef.current;
    if (!m || !malha) return;
    malha.raiz.updateMatrixWorld(true);
    m.bind(malha.esqueleto);
    return () => {
      malha.geometria.dispose();
    };
  }, [malha]);

  useEffect(() => {
    uniforms.uUltrassom.value = ultrassom ? 1 : 0;
  }, [ultrassom, uniforms]);

  useFrame((_, dt) => {
    if (!malha || !controlador) return;
    const d = Math.min(dt, 0.05);
    controlador.atualizar(d, semana, reduzirMovimento);
    cena.pulso = controlador.estado.pulsoCoracao;
    cena.tempo += d;
    uniforms.uTempo.value = cena.tempo;
    uniforms.uLuzPos.value.copy(cena.sol);

    // Coração: o tórax incha 1,5 % no pulso; a respiração soma um pouco.
    const torax = malha.ossosPorNome.get("torax");
    if (torax) {
      const s = 1 + cena.pulso * 0.015 + controlador.estado.respiracao * 0.012;
      torax.scale.set(s, s, s);
    }

    const g = grupo.current;
    if (!g) return;
    const cabeca = malha.ossosPorNome.get("cabeca");
    if (cabeca) {
      cabeca.getWorldPosition(cena.cabeca);
      // O centro do rosto fica acima e à frente da articulação do pescoço, no eixo do osso.
      cabeca.getWorldDirection(cena.dirRosto);
      // Centro do rosto: olhos ficam ~0.06 acima da articulação e 0.2 à frente do eixo.
      tmp.copy(cena.dirRosto).multiplyScalar(0.2 * escala);
      cena.cabeca.add(tmp);
      cena.cabeca.y += 0.05 * escala;
    } else {
      cena.cabeca.set(...CENTRO_CABECA).multiplyScalar(escala);
      g.localToWorld(cena.cabeca);
    }
    cena.maos.set(...CENTRO_MAOS);
    g.localToWorld(cena.maos);
    cena.umbigo.set(...UMBIGO);
    g.localToWorld(cena.umbigo);
    cena.corpo.set(0, 0.42, 0.18);
    g.localToWorld(cena.corpo);
    g.getWorldDirection(cena.dirCorpo);
  });

  if (!malha) return null;

  return (
    <group ref={grupo} scale={escala} position={[0, -0.3 * escala, 0]} rotation={[0.08, -0.35, 0.12]}>
      <skinnedMesh key={malha.geometria.uuid} ref={malhaRef} geometry={malha.geometria} material={inspecao ? materialInspecao : material} skeleton={malha.esqueleto} frustumCulled={false}>
        <primitive object={malha.raiz} />
      </skinnedMesh>
    </group>
  );
}
