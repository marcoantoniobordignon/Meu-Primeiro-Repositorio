"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import { paleta } from "@/lib/bebe3d/paleta";

import { useCena } from "./contexto";

interface Props {
  raio: number;
  quantidade: number;
  reduzirMovimento: boolean;
}

const vertex = /* glsl */ `
  attribute float semente;
  attribute float tamanho;
  uniform float uTempo;
  uniform float uDpr;
  uniform vec3 uArrasto;
  uniform float uMovimento;
  varying float vBrilho;
  varying float vFog;

  void main() {
    float s = semente * 6.2831;
    // Deriva lenta e orgânica: três senos desencontrados por partícula.
    vec3 p = position;
    p.x += sin(uTempo * 0.11 + s) * 0.9 * uMovimento;
    p.y += sin(uTempo * 0.08 + s * 1.7) * 0.7 * uMovimento + sin(uTempo * 0.05 + s * 0.3) * 0.4;
    p.z += cos(uTempo * 0.1 + s * 2.3) * 0.9 * uMovimento;
    // A câmera "empurra" o líquido quando se mexe.
    p -= uArrasto * (0.4 + 0.6 * fract(semente * 7.3));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = tamanho * uDpr * (46.0 / max(1.0, -mv.z));
    float cintila = 0.6 + 0.4 * sin(uTempo * (0.6 + semente) + s);
    vBrilho = cintila * (0.5 + 0.5 * fract(semente * 3.1));
    vFog = -mv.z;
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uCor;
  uniform vec3 uCorNevoa;
  uniform float uNevoa;
  varying float vBrilho;
  varying float vFog;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float alpha = smoothstep(0.5, 0.05, d) * 0.7 * vBrilho;
    float nucleo = smoothstep(0.18, 0.0, d) * 0.5;
    float f = 1.0 - exp(-uNevoa * uNevoa * vFog * vFog);
    vec3 cor = mix(uCor * (1.0 + nucleo), uCorNevoa, f);
    gl_FragColor = vec4(cor, alpha * (1.0 - f * 0.7));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** Partículas em suspensão: a "água" do útero, com deriva lenta e reação à câmera. */
export function Liquido({ raio, quantidade, reduzirMovimento }: Props) {
  const cena = useCena();
  const dpr = useThree((s) => s.viewport.dpr);
  const ref = useRef<THREE.ShaderMaterial>(null);
  const arrasto = useMemo(() => new THREE.Vector3(), []);

  const geometria = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(quantidade * 3);
    const sem = new Float32Array(quantidade);
    const tam = new Float32Array(quantidade);
    let semente = 1234;
    const rnd = () => {
      semente = (semente * 16807) % 2147483647;
      return semente / 2147483647;
    };
    for (let i = 0; i < quantidade; i++) {
      // Distribuição uniforme no volume da esfera, evitando o centro (onde está o bebê).
      const r = raio * 0.92 * Math.cbrt(0.08 + rnd() * 0.92);
      const u = rnd() * 2 - 1;
      const t = rnd() * Math.PI * 2;
      const k = Math.sqrt(1 - u * u);
      pos[i * 3] = r * k * Math.cos(t);
      pos[i * 3 + 1] = r * u;
      pos[i * 3 + 2] = r * k * Math.sin(t);
      sem[i] = rnd();
      tam[i] = 0.35 + Math.pow(rnd(), 2.2) * 1.6;
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("semente", new THREE.BufferAttribute(sem, 1));
    g.setAttribute("tamanho", new THREE.BufferAttribute(tam, 1));
    return g;
  }, [quantidade, raio]);

  const uniforms = useMemo(
    () => ({
      uTempo: { value: 0 },
      uDpr: { value: 1 },
      uArrasto: { value: new THREE.Vector3() },
      uMovimento: { value: 1 },
      uCor: { value: new THREE.Color(paleta.particula) },
      uCorNevoa: { value: new THREE.Color(paleta.nevoa) },
      uNevoa: { value: 0.03 },
    }),
    [],
  );

  useFrame((_, dt) => {
    const m = ref.current;
    if (!m) return;
    m.uniforms.uTempo!.value = cena.tempo;
    m.uniforms.uDpr!.value = dpr;
    m.uniforms.uMovimento!.value = reduzirMovimento ? 0.15 : 1;
    // Arrasto segue a velocidade da câmera e decai devagar.
    arrasto.lerp(cena.velocidadeCamera, 1 - Math.exp(-2.5 * dt));
    (m.uniforms.uArrasto!.value as THREE.Vector3).copy(arrasto).multiplyScalar(0.12);
  });

  return (
    <points geometry={geometria} frustumCulled={false}>
      <shaderMaterial ref={ref} vertexShader={vertex} fragmentShader={fragment} uniforms={uniforms} transparent depthWrite={false} blending={THREE.NormalBlending} />
    </points>
  );
}
