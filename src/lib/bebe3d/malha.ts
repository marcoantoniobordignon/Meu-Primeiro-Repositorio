import * as THREE from "three";
import { MarchingCubes } from "three/examples/jsm/objects/MarchingCubes.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { capsulas, ossos, type NomeOsso, type V3 } from "./esqueleto";

/**
 * Bebê placeholder: campo implícito de cápsulas (metaballs alongadas) extraído
 * por marching cubes uma única vez, suavizado, e "pelado" aos ossos por
 * proximidade. É o melhor que dá sem um artista; o modelo definitivo em glTF
 * substitui esta malha mantendo o esqueleto.
 */
export interface MalhaBebe {
  geometria: THREE.BufferGeometry;
  esqueleto: THREE.Skeleton;
  raiz: THREE.Bone;
  ossosPorNome: Map<NomeOsso, THREE.Bone>;
}

function distSegmento2(px: number, py: number, pz: number, a: V3, b: V3): number {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const abz = b[2] - a[2];
  const apx = px - a[0];
  const apy = py - a[1];
  const apz = pz - a[2];
  const len2 = abx * abx + aby * aby + abz * abz;
  let t = len2 > 0 ? (apx * abx + apy * aby + apz * abz) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = apx - abx * t;
  const dy = apy - aby * t;
  const dz = apz - abz * t;
  return dx * dx + dy * dy + dz * dz;
}

/**
 * Campo implícito com kernel de Wyvill (alcance limitado): cada cápsula só
 * influencia até ALCANCE × raio, então braços, pernas e cabeça continuam
 * legíveis e se fundem apenas onde encostam. Superfície onde a soma vale ISO
 * (que cai a ~1,03 × raio para uma cápsula isolada).
 */
const ALCANCE = 1.9;
const ISO = 0.35;

function campo(px: number, py: number, pz: number): number {
  let soma = 0;
  for (const c of capsulas) {
    const R = c.raio * ALCANCE;
    const d2 = distSegmento2(px, py, pz, c.a, c.b);
    if (d2 >= R * R) continue;
    const t = 1 - d2 / (R * R);
    soma += t * t * t * (c.peso ?? 1);
  }
  return soma;
}

/**
 * O modelo vai de y≈-0.5 (pés) a y≈1.15 (topo da cabeça); a caixa do marching
 * cubes é [-1,1]³. Então amostramos o campo em (grade + DESLOCAMENTO_Y) e
 * devolvemos os vértices somando o mesmo deslocamento.
 */
const DESLOCAMENTO_Y = 0.3;
const ESCALA_CAIXA = 1.0;

function extrair(resolucao: number): THREE.BufferGeometry {
  const mc = new MarchingCubes(resolucao, new THREE.MeshBasicMaterial(), false, false, 200_000);
  mc.isolation = ISO;
  const n = resolucao;
  const campoArr = mc.field as Float32Array;
  for (let z = 0; z < n; z++) {
    const fz = ((z - n / 2) / (n / 2)) * ESCALA_CAIXA;
    for (let y = 0; y < n; y++) {
      const fy = ((y - n / 2) / (n / 2)) * ESCALA_CAIXA + DESLOCAMENTO_Y;
      const base = n * n * z + n * y;
      for (let x = 0; x < n; x++) {
        const fx = ((x - n / 2) / (n / 2)) * ESCALA_CAIXA;
        campoArr[base + x] = campo(fx, fy, fz);
      }
    }
  }
  mc.update();
  const total = mc.count;
  const pos = (mc.geometry.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
  const posicoes = new Float32Array(total * 3);
  for (let i = 0; i < total * 3; i += 3) {
    posicoes[i] = pos[i]! * ESCALA_CAIXA;
    posicoes[i + 1] = pos[i + 1]! * ESCALA_CAIXA + DESLOCAMENTO_Y;
    posicoes[i + 2] = pos[i + 2]! * ESCALA_CAIXA;
  }
  const bruta = new THREE.BufferGeometry();
  bruta.setAttribute("position", new THREE.BufferAttribute(posicoes, 3));
  mc.geometry.dispose();
  const unida = mergeVertices(bruta, 1e-4);
  bruta.dispose();
  return unida;
}

/** Suavização laplaciana: tira o "serrilhado" da grade sem perder volume demais. */
function suavizar(geo: THREE.BufferGeometry, iteracoes: number, fator = 0.5) {
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const idx = geo.getIndex()!.array;
  const n = pos.count;
  const vizinhos: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i]!;
    const b = idx[i + 1]!;
    const c = idx[i + 2]!;
    vizinhos[a]!.push(b, c);
    vizinhos[b]!.push(a, c);
    vizinhos[c]!.push(a, b);
  }
  const arr = pos.array as Float32Array;
  const novo = new Float32Array(arr.length);
  for (let it = 0; it < iteracoes; it++) {
    for (let v = 0; v < n; v++) {
      const viz = vizinhos[v]!;
      if (viz.length === 0) {
        novo[v * 3] = arr[v * 3]!;
        novo[v * 3 + 1] = arr[v * 3 + 1]!;
        novo[v * 3 + 2] = arr[v * 3 + 2]!;
        continue;
      }
      let sx = 0;
      let sy = 0;
      let sz = 0;
      for (const w of viz) {
        sx += arr[w * 3]!;
        sy += arr[w * 3 + 1]!;
        sz += arr[w * 3 + 2]!;
      }
      const k = viz.length;
      novo[v * 3] = arr[v * 3]! + (sx / k - arr[v * 3]!) * fator;
      novo[v * 3 + 1] = arr[v * 3 + 1]! + (sy / k - arr[v * 3 + 1]!) * fator;
      novo[v * 3 + 2] = arr[v * 3 + 2]! + (sz / k - arr[v * 3 + 2]!) * fator;
    }
    arr.set(novo);
  }
  pos.needsUpdate = true;
}

/**
 * Pesos de pele por proximidade ao osso (gaussiana no raio do osso), os 4
 * maiores por vértice, normalizados. Suavizados pela vizinhança para a
 * articulação dobrar sem quebra.
 */
function pelar(geo: THREE.BufferGeometry) {
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const n = pos.count;
  const indices = new Uint16Array(n * 4);
  const pesos = new Float32Array(n * 4);
  const espessura = new Float32Array(n);
  const brutos = new Float32Array(n * ossos.length);

  for (let v = 0; v < n; v++) {
    const px = pos.getX(v);
    const py = pos.getY(v);
    const pz = pos.getZ(v);
    for (let o = 0; o < ossos.length; o++) {
      const osso = ossos[o]!;
      const d2 = distSegmento2(px, py, pz, osso.inicio, osso.fim);
      const r = osso.raio * 1.6;
      brutos[v * ossos.length + o] = Math.exp(-d2 / (r * r));
    }
    // Espessura: raio da cápsula mais próxima da superfície (dedos e orelhas finos, cabeça grossa).
    let melhor = Infinity;
    let raio = 0.3;
    for (const c of capsulas) {
      if ((c.peso ?? 1) < 0) continue;
      const d = Math.sqrt(distSegmento2(px, py, pz, c.a, c.b)) - c.raio;
      if (d < melhor) {
        melhor = d;
        raio = c.raio;
      }
    }
    espessura[v] = Math.min(1, raio / 0.22);
  }

  // Suaviza os pesos brutos pela vizinhança (2 passadas).
  const idx = geo.getIndex()!.array;
  const vizinhos: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i]!;
    const b = idx[i + 1]!;
    const c = idx[i + 2]!;
    vizinhos[a]!.push(b, c);
    vizinhos[b]!.push(a, c);
    vizinhos[c]!.push(a, b);
  }
  // A espessura também é suavizada (6 passadas): sem degrau entre cabeça e pescoço.
  const espTmp = new Float32Array(n);
  for (let passada = 0; passada < 6; passada++) {
    for (let v = 0; v < n; v++) {
      const viz = vizinhos[v]!;
      let s = espessura[v]!;
      for (const w of viz) s += espessura[w]!;
      espTmp[v] = s / (viz.length + 1);
    }
    espessura.set(espTmp);
  }

  const tmp = new Float32Array(brutos.length);
  for (let passada = 0; passada < 2; passada++) {
    for (let v = 0; v < n; v++) {
      const viz = vizinhos[v]!;
      for (let o = 0; o < ossos.length; o++) {
        let s = brutos[v * ossos.length + o]!;
        for (const w of viz) s += brutos[w * ossos.length + o]!;
        tmp[v * ossos.length + o] = s / (viz.length + 1);
      }
    }
    brutos.set(tmp);
  }

  for (let v = 0; v < n; v++) {
    const cand: { o: number; p: number }[] = [];
    for (let o = 0; o < ossos.length; o++) cand.push({ o, p: brutos[v * ossos.length + o]! });
    cand.sort((a, b) => b.p - a.p);
    let soma = 0;
    for (let k = 0; k < 4; k++) soma += cand[k]!.p;
    for (let k = 0; k < 4; k++) {
      indices[v * 4 + k] = cand[k]!.o;
      pesos[v * 4 + k] = soma > 0 ? cand[k]!.p / soma : k === 0 ? 1 : 0;
    }
  }

  geo.setAttribute("skinIndex", new THREE.BufferAttribute(indices, 4));
  geo.setAttribute("skinWeight", new THREE.BufferAttribute(pesos, 4));
  geo.setAttribute("espessura", new THREE.BufferAttribute(espessura, 1));
}

export function montarEsqueleto(): { esqueleto: THREE.Skeleton; raiz: THREE.Bone; ossosPorNome: Map<NomeOsso, THREE.Bone> } {
  const porNome = new Map<NomeOsso, THREE.Bone>();
  const lista: THREE.Bone[] = [];
  for (const o of ossos) {
    const b = new THREE.Bone();
    b.name = o.nome;
    porNome.set(o.nome, b);
    lista.push(b);
  }
  let raiz: THREE.Bone | null = null;
  for (const o of ossos) {
    const b = porNome.get(o.nome)!;
    if (o.pai) {
      const pai = ossos.find((x) => x.nome === o.pai)!;
      b.position.set(o.inicio[0] - pai.inicio[0], o.inicio[1] - pai.inicio[1], o.inicio[2] - pai.inicio[2]);
      porNome.get(o.pai)!.add(b);
    } else {
      b.position.set(o.inicio[0], o.inicio[1], o.inicio[2]);
      raiz = b;
    }
  }
  raiz!.updateMatrixWorld(true);
  const esqueleto = new THREE.Skeleton(lista);
  return { esqueleto, raiz: raiz!, ossosPorNome: porNome };
}

/** Gera a malha completa. Leva de 150 a 600 ms conforme a resolução; rodar uma vez. */
export function gerarMalhaBebe(resolucao = 80): MalhaBebe {
  const geometria = extrair(resolucao);
  // Pouca suavização: o bastante para tirar o serrilhado da grade sem apagar nariz e boca.
  suavizar(geometria, 2, 0.35);
  geometria.computeVertexNormals();
  pelar(geometria);
  geometria.computeBoundingSphere();
  const { esqueleto, raiz, ossosPorNome } = montarEsqueleto();
  return { geometria, esqueleto, raiz, ossosPorNome };
}

export interface BuffersMalha {
  posicoes: Float32Array;
  normais: Float32Array;
  indices: Uint32Array;
  skinIndex: Uint16Array;
  skinWeight: Float32Array;
  espessura: Float32Array;
}

/** Remonta a malha a partir dos buffers que o worker devolveu. */
export function malhaDeBuffers(b: BuffersMalha): MalhaBebe {
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute("position", new THREE.BufferAttribute(b.posicoes, 3));
  geometria.setAttribute("normal", new THREE.BufferAttribute(b.normais, 3));
  geometria.setAttribute("skinIndex", new THREE.BufferAttribute(b.skinIndex, 4));
  geometria.setAttribute("skinWeight", new THREE.BufferAttribute(b.skinWeight, 4));
  geometria.setAttribute("espessura", new THREE.BufferAttribute(b.espessura, 1));
  geometria.setIndex(new THREE.BufferAttribute(b.indices, 1));
  geometria.computeBoundingSphere();
  const { esqueleto, raiz, ossosPorNome } = montarEsqueleto();
  return { geometria, esqueleto, raiz, ossosPorNome };
}
