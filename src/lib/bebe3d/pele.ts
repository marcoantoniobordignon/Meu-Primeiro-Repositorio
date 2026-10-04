import * as THREE from "three";

import { paleta } from "./paleta";

/**
 * Pele com dispersão subsuperficial aproximada (modelo de translucidez por
 * contraluz, à la Frostbite): quando o sol fica atrás do bebê, a luz "entra"
 * pela pele e sai avermelhada nas partes finas (dedos, orelhas, pálpebras).
 * A espessura vem do atributo `espessura` da malha (ou do mapa, no glTF).
 */
export interface UniformsPele {
  uLuzPos: { value: THREE.Vector3 };
  uLuzCor: { value: THREE.Color };
  uCorSss: { value: THREE.Color };
  uDistorcao: { value: number };
  uPotencia: { value: number };
  uEscala: { value: number };
  uAmbienteSss: { value: number };
  uTempo: { value: number };
  uUltrassom: { value: number };
}

export function criarMaterialPele(): { material: THREE.MeshPhysicalMaterial; uniforms: UniformsPele } {
  const uniforms: UniformsPele = {
    uLuzPos: { value: new THREE.Vector3(0, 30, -20) },
    uLuzCor: { value: new THREE.Color(paleta.sol) },
    uCorSss: { value: new THREE.Color(paleta.peleSss) },
    uDistorcao: { value: 0.3 },
    uPotencia: { value: 3.0 },
    uEscala: { value: 0.9 },
    uAmbienteSss: { value: 0.08 },
    uTempo: { value: 0 },
    uUltrassom: { value: 0 },
  };

  const material = new THREE.MeshPhysicalMaterial({
    color: paleta.pele,
    roughness: 0.55,
    metalness: 0,
    sheen: 0.25,
    sheenRoughness: 0.8,
    sheenColor: new THREE.Color(0xffd2c2),
    specularIntensity: 0.6,
    envMapIntensity: 0.9,
  });

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        attribute float espessura;
        varying float vEspessura;
        varying vec3 vPosMundo;`,
      )
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        vEspessura = espessura;
        vPosMundo = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform vec3 uLuzPos;
        uniform vec3 uLuzCor;
        uniform vec3 uCorSss;
        uniform float uDistorcao;
        uniform float uPotencia;
        uniform float uEscala;
        uniform float uAmbienteSss;
        uniform float uTempo;
        uniform float uUltrassom;
        varying float vEspessura;
        varying vec3 vPosMundo;`,
      )
      .replace(
        "#include <opaque_fragment>",
        `
        {
          vec3 L = normalize(uLuzPos - vPosMundo);
          vec3 V = normalize(cameraPosition - vPosMundo);
          vec3 N = normalize(normal);
          vec3 H = normalize(L + N * uDistorcao);
          float contraluz = pow(clamp(dot(V, -H), 0.0, 1.0), uPotencia) * uEscala;
          float fino = 1.0 - smoothstep(0.0, 1.0, vEspessura);
          // Partes finas deixam passar mais; a borda (Fresnel) acende um pouco de qualquer ângulo.
          float borda = pow(1.0 - clamp(dot(V, N), 0.0, 1.0), 4.0) * 0.22;
          float sss = (contraluz + uAmbienteSss + borda) * (0.2 + 0.8 * fino);
          // A cor da dispersão é mais rosada que vermelha: sangue atrás de pele clara.
          vec3 corSss = mix(uCorSss, vec3(1.0, 0.55, 0.45), 0.5) * uLuzCor * sss;
          outgoingLight += corSss * (0.35 + 0.65 * diffuseColor.rgb);
          // Vérnix: brilho úmido e leve nas zonas voltadas para a luz.
          float vernix = pow(clamp(dot(N, L), 0.0, 1.0), 6.0) * 0.08;
          outgoingLight += vec3(vernix);
          // Modo ultrassom: tudo vira valor luminoso sépia e difuso.
          float lum = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
          vec3 sepia = vec3(1.0, 0.86, 0.62) * pow(lum, 0.8) * 1.15;
          outgoingLight = mix(outgoingLight, sepia, uUltrassom);
        }
        #include <opaque_fragment>`,
      );
  };
  material.customProgramCacheKey = () => "pele-bebe-v1";

  return { material, uniforms };
}
