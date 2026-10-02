"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import { paleta } from "@/lib/bebe3d/paleta";
import { fbm1d } from "@/lib/bebe3d/ruido";

import { useCena } from "./contexto";

interface Props {
  raio: number;
  placenta: THREE.Vector3;
  reduzirMovimento: boolean;
}

const SEGMENTOS = 72;
const RADIAL = 9;

/**
 * Cordão umbilical: tubo espiralado do umbigo até a placenta, com três vasos
 * torcidos desenhados no shader. Segue o bebê e balança com deriva própria.
 */
export function Cordao({ raio, placenta, reduzirMovimento }: Props) {
  const cena = useCena();
  const malha = useRef<THREE.Mesh>(null);
  const pontos = useMemo(() => Array.from({ length: 7 }, () => new THREE.Vector3()), []);
  const curva = useMemo(() => new THREE.CatmullRomCurve3(pontos, false, "centripetal", 0.5), [pontos]);
  const acumulado = useRef(0);
  const espessura = Math.max(0.12, raio * 0.022);
  const base = useMemo(() => new THREE.Vector3(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const lado = useMemo(() => new THREE.Vector3(), []);
  const cima = useMemo(() => new THREE.Vector3(), []);

  const material = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({
      color: paleta.cordao,
      roughness: 0.42,
      metalness: 0,
      clearcoat: 0.35,
      clearcoatRoughness: 0.4,
      sheen: 0.3,
      sheenColor: new THREE.Color(paleta.placentaBrilho),
      envMapIntensity: 1.2,
      // Cordão também deixa a luz passar: um brilho interno quente evita que fique preto no lado da sombra.
      emissive: new THREE.Color(paleta.cordaoVaso),
      emissiveIntensity: 0.12,
    });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uCorVaso = { value: new THREE.Color(paleta.cordaoVaso) };
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vUvCordao;")
        .replace("#include <uv_vertex>", "#include <uv_vertex>\nvUvCordao = uv;");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform vec3 uCorVaso;\nvarying vec2 vUvCordao;")
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          {
            // Três vasos em espiral: duas faixas finas (artérias) e uma larga (veia), girando ao longo do tubo.
            float giro = vUvCordao.y * 6.2831 + vUvCordao.x * 6.2831 * 9.0;
            float veia = smoothstep(0.35, 0.75, 0.5 + 0.5 * sin(giro));
            float arteria = smoothstep(0.55, 0.9, 0.5 + 0.5 * sin(giro * 2.0 + 2.1));
            float vaso = max(veia * 0.7, arteria * 0.5);
            diffuseColor.rgb = mix(diffuseColor.rgb, uCorVaso, vaso * 0.55);
          }`,
        );
    };
    m.customProgramCacheKey = () => "cordao-v1";
    return m;
  }, []);

  useFrame((_, dt) => {
    const m = malha.current;
    if (!m) return;
    acumulado.current += dt;
    // Regenera o tubo a ~24 Hz: barato e invisível.
    if (acumulado.current < 1 / 24) return;
    acumulado.current = 0;
    const t = cena.tempo;
    const amp = reduzirMovimento ? 0.3 : 1;
    // Caminho: sai do umbigo para a frente e para baixo, dá uma volta solta e sobe até a placenta,
    // com uma hélice larga em volta da reta (cordão de verdade é espiralado) e deriva lenta.
    dir.copy(placenta).sub(cena.umbigo);
    const comprimento = dir.length();
    dir.normalize();
    cima.set(0, 1, 0);
    lado.crossVectors(dir, cima).normalize();
    cima.crossVectors(lado, dir).normalize();
    const n = pontos.length;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const p = pontos[i]!;
      base.copy(cena.umbigo).addScaledVector(dir, comprimento * u);
      // Sai do umbigo para baixo e para o lado (longe dos braços, que ficam na frente do peito),
      // depois sobe em curva larga até a placenta.
      const saida = Math.sin(u * Math.PI) * raio * 0.2;
      const ang = u * Math.PI * 2.0 + t * 0.08 * amp;
      const helice = Math.sin(u * Math.PI) * raio * 0.08;
      p.copy(base)
        .addScaledVector(lado, Math.cos(ang) * helice + saida * 0.6 + fbm1d(t * 0.12 + u * 3.0, 21 + i) * raio * 0.04 * amp)
        .addScaledVector(cima, Math.sin(ang) * helice - saida * 0.9 + fbm1d(t * 0.1 + u * 2.0, 31 + i) * raio * 0.04 * amp);
      p.z += saida * 0.5 * (1 - u);
    }
    pontos[0]!.copy(cena.umbigo);
    pontos[n - 1]!.copy(placenta);
    curva.points = pontos;
    const nova = new THREE.TubeGeometry(curva, SEGMENTOS, espessura, RADIAL, false);
    m.geometry.dispose();
    m.geometry = nova;
  });

  return <mesh ref={malha} material={material} frustumCulled={false} />;
}
