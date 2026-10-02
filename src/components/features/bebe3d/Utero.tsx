"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import { paleta } from "@/lib/bebe3d/paleta";

import { useCena } from "./contexto";

interface Props {
  raio: number;
  ultrassom?: boolean;
}

const vertex = /* glsl */ `
  #include <fog_pars_vertex>
  varying vec3 vPosMundo;
  varying vec3 vNormalMundo;
  varying vec3 vPosLocal;
  uniform float uTempo;
  uniform float uPulso;

  float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float ruido(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }

  void main() {
    vPosLocal = position;
    vec3 n = normalize(position);
    // Parede orgânica: ondulação lenta de baixa frequência mais o pulso do coração.
    float d = ruido(n * 2.3 + uTempo * 0.03) * 0.5 + ruido(n * 5.1 - uTempo * 0.02) * 0.2;
    vec3 p = position * (1.0 + d * 0.06 + uPulso * 0.004);
    vec4 mundo = modelMatrix * vec4(p, 1.0);
    vPosMundo = mundo.xyz;
    vNormalMundo = normalize(mat3(modelMatrix) * n);
    vec4 mvPosition = viewMatrix * mundo;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const fragment = /* glsl */ `
  #include <common>
  #include <fog_pars_fragment>
  varying vec3 vPosMundo;
  varying vec3 vNormalMundo;
  varying vec3 vPosLocal;
  uniform vec3 uSolDir;
  uniform vec3 uCorEscura;
  uniform vec3 uCorClara;
  uniform vec3 uCorVeia;
  uniform float uTempo;
  uniform float uPulso;
  uniform float uUltrassom;

  float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float ruido(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { s += ruido(p) * a; p = p * 2.07 + 11.3; a *= 0.5; }
    return s;
  }

  void main() {
    vec3 n = normalize(vPosLocal);
    // Luz atravessando o tecido: a parede voltada para o sol acende.
    float atravessa = smoothstep(-0.35, 1.0, dot(n, uSolDir));
    atravessa = pow(atravessa, 1.6);
    // Mosqueado do tecido (duas escalas) e veias ramificadas: ruído "ridged"
    // com domínio deformado, para não parecer curva de nível.
    float textura = fbm(n * 5.0) * 0.6 + fbm(n * 17.0 + 4.2) * 0.4;
    vec3 deform = vec3(fbm(n * 4.0 + 1.7), fbm(n * 4.0 + 9.1), fbm(n * 4.0 + 3.3)) - 0.5;
    vec3 q = n * 9.0 + deform * 1.6;
    float r1 = abs(ruido(q) - 0.5);
    float r2 = abs(ruido(q * 2.3 + 5.0) - 0.5);
    float veia = (1.0 - smoothstep(0.0, 0.06, r1)) * 0.7 + (1.0 - smoothstep(0.0, 0.04, r2)) * 0.4;
    veia *= 0.5 + 0.5 * fbm(n * 2.5 + 8.0);
    vec3 cor = mix(uCorEscura, uCorClara, atravessa * (0.6 + 0.4 * textura));
    cor *= 0.85 + 0.3 * textura;
    cor = mix(cor, uCorVeia, clamp(veia, 0.0, 1.0) * (0.3 + 0.2 * uPulso) * (0.5 + 0.5 * atravessa));
    // Luz direta do sol varrendo a parede de raspão + brilho úmido na borda.
    vec3 V = normalize(cameraPosition - vPosMundo);
    vec3 Nv = -vNormalMundo;
    float raspao = pow(clamp(dot(Nv, uSolDir), 0.0, 1.0), 2.0) * 0.18;
    vec3 H = normalize(uSolDir + V);
    float espec = pow(clamp(dot(Nv, H), 0.0, 1.0), 48.0) * 0.25;
    float fresnel = pow(1.0 - clamp(dot(V, Nv), 0.0, 1.0), 4.0);
    cor += uCorClara * (fresnel * 0.1 + raspao) * (0.5 + 0.5 * atravessa) + vec3(espec);
    // Ultrassom: sépia granulado.
    float lum = dot(cor, vec3(0.299, 0.587, 0.114));
    vec3 sepia = vec3(1.0, 0.84, 0.58) * lum * 0.9;
    cor = mix(cor, sepia, uUltrassom);
    gl_FragColor = vec4(cor, 1.0);
    #include <fog_fragment>
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** Parede do útero vista de dentro: tecido quente, mais claro onde o sol bate. */
export function Utero({ raio, ultrassom = false }: Props) {
  const cena = useCena();
  const ref = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uSolDir: { value: new THREE.Vector3(0.3, 0.8, -0.55).normalize() },
      uCorEscura: { value: new THREE.Color(paleta.uteroEscuro) },
      uCorClara: { value: new THREE.Color(paleta.uteroClaro) },
      uCorVeia: { value: new THREE.Color(paleta.uteroVeia) },
      uTempo: { value: 0 },
      uPulso: { value: 0 },
      uUltrassom: { value: 0 },
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    }),
    [],
  );

  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    m.uniforms.uTempo!.value = cena.tempo;
    m.uniforms.uPulso!.value = cena.pulso;
    m.uniforms.uUltrassom!.value = ultrassom ? 1 : 0;
    (m.uniforms.uSolDir!.value as THREE.Vector3).copy(cena.sol).normalize();
  });

  return (
    <mesh scale={[raio, raio * 1.08, raio * 0.96]}>
      <sphereGeometry args={[1, 96, 64]} />
      <shaderMaterial ref={ref} vertexShader={vertex} fragmentShader={fragment} uniforms={uniforms} side={THREE.BackSide} fog />
    </mesh>
  );
}
