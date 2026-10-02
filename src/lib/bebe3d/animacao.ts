import * as THREE from "three";

import type { NomeOsso } from "./esqueleto";
import { fbm1d, prng } from "./ruido";
import { bpmDaSemana } from "./semanas";

/**
 * Controlador de movimento do bebê. Tudo procedural, em camadas:
 *  1. repouso flutuante (sempre)
 *  2. respiração torácica e batimento cardíaco (sempre, por semana)
 *  3. um "gesto" ativo por vez, escolhido por peso que depende da semana,
 *     com entrada e saída suaves e sem repetir o anterior.
 * As rotações alvo são seguidas com amortecimento, então a troca de gesto
 * nunca dá tranco. Com "reduzir movimento", só a camada 1 fica, bem lenta.
 */
export type Gesto = "maos" | "polegar" | "chute" | "espreguicar" | "soluco" | "virar" | "piscar" | "repouso";

interface DefGesto {
  nome: Gesto;
  /** Semana a partir da qual aparece. */
  desde: number;
  /** Peso relativo de sorteio. */
  peso: number;
  /** Duração em segundos [min, max]. */
  duracao: [number, number];
}

export const gestos: DefGesto[] = [
  { nome: "repouso", desde: 4, peso: 3, duracao: [2.5, 5] },
  { nome: "maos", desde: 14, peso: 3, duracao: [2.5, 4.5] },
  { nome: "polegar", desde: 16, peso: 2, duracao: [3, 6] },
  { nome: "chute", desde: 18, peso: 3, duracao: [0.9, 1.6] },
  { nome: "espreguicar", desde: 20, peso: 1, duracao: [2.5, 4] },
  { nome: "soluco", desde: 22, peso: 1.2, duracao: [3, 6] },
  { nome: "virar", desde: 20, peso: 2, duracao: [2.5, 4.5] },
  { nome: "piscar", desde: 26, peso: 2, duracao: [0.3, 0.4] },
];

/** Gestos disponíveis para a semana, com peso. Regra testável (B3D-01). */
export function gestosDaSemana(semana: number): DefGesto[] {
  return gestos.filter((g) => semana >= g.desde);
}

export function sortearGesto(semana: number, anterior: Gesto | null, aleatorio: () => number): DefGesto {
  const lista = gestosDaSemana(semana).filter((g) => g.nome !== anterior || g.nome === "repouso");
  const total = lista.reduce((a, g) => a + g.peso, 0);
  let r = aleatorio() * total;
  for (const g of lista) {
    r -= g.peso;
    if (r <= 0) return g;
  }
  return lista[lista.length - 1]!;
}

type Pose = Partial<Record<NomeOsso, [number, number, number]>>;

/** Poses alvo de cada gesto, em radianos, relativas à pose fetal de repouso. */
const poses: Record<Gesto, Pose> = {
  repouso: {},
  maos: { dedos_E: [0.9, 0, 0.2], dedos_D: [0.9, 0, -0.2], mao_E: [0.3, 0, 0], mao_D: [0.3, 0, 0] },
  polegar: { braco_D: [-0.25, 0.1, -0.35], antebraco_D: [-0.55, 0.25, 0], mao_D: [-0.3, 0.2, 0], dedos_D: [0.7, 0, 0], cabeca: [0.12, -0.15, 0.05] },
  chute: { coxa_E: [-0.55, 0.15, 0.1], canela_E: [0.75, 0, 0], pe_E: [-0.3, 0, 0] },
  espreguicar: { coluna: [-0.18, 0, 0], torax: [-0.14, 0, 0], braco_E: [0.35, -0.3, 0.4], braco_D: [0.35, 0.3, -0.4], antebraco_E: [0.3, 0, 0], antebraco_D: [0.3, 0, 0], coxa_E: [-0.35, 0.1, 0.15], coxa_D: [-0.35, -0.1, -0.15], canela_E: [0.45, 0, 0], canela_D: [0.45, 0, 0], cabeca: [-0.15, 0, 0] },
  soluco: {},
  virar: { pescoco: [0.08, 0.5, 0.1], cabeca: [0.05, 0.35, 0.08] },
  piscar: {},
};

function suave(t: number): number {
  return t * t * (3 - 2 * t);
}

export interface EstadoAnimacao {
  gesto: Gesto;
  progresso: number;
  pulsoCoracao: number;
  respiracao: number;
  piscada: number;
}

export class ControladorBebe {
  private readonly ossos: Map<NomeOsso, THREE.Bone>;
  private readonly alvos = new Map<NomeOsso, THREE.Quaternion>();
  private readonly atuais = new Map<NomeOsso, THREE.Quaternion>();
  private readonly repouso = new Map<NomeOsso, THREE.Quaternion>();
  private readonly aleatorio: () => number;
  private gesto: DefGesto = gestos[0]!;
  private inicioGesto = 0;
  private fimGesto = 0;
  private proximoGesto = 0;
  private tempo = 0;
  private faseCoracao = 0;
  private solucoProximo = 0;
  private piscadaFim = 0;
  private readonly e = new THREE.Euler();
  private readonly q = new THREE.Quaternion();
  public estado: EstadoAnimacao = { gesto: "repouso", progresso: 0, pulsoCoracao: 0, respiracao: 0, piscada: 0 };

  constructor(ossos: Map<NomeOsso, THREE.Bone>, semente = 7) {
    this.ossos = ossos;
    this.aleatorio = prng(semente);
    for (const [nome, osso] of ossos) {
      this.repouso.set(nome, osso.quaternion.clone());
      this.alvos.set(nome, osso.quaternion.clone());
      this.atuais.set(nome, osso.quaternion.clone());
    }
    this.proximoGesto = 1.2;
  }

  private definirAlvo(pose: Pose, intensidade: number) {
    for (const [nome, base] of this.repouso) {
      const rot = pose[nome];
      const alvo = this.alvos.get(nome)!;
      if (!rot) {
        alvo.copy(base);
        continue;
      }
      this.e.set(rot[0] * intensidade, rot[1] * intensidade, rot[2] * intensidade);
      this.q.setFromEuler(this.e);
      alvo.copy(base).multiply(this.q);
    }
  }

  /** Avança a animação. `semana` decide quais gestos existem e a amplitude. */
  atualizar(dt: number, semana: number, reduzirMovimento: boolean) {
    this.tempo += dt;
    const t = this.tempo;

    // Coração: pulso curto e assimétrico (sístole rápida, diástole lenta).
    const bpm = bpmDaSemana(semana);
    this.faseCoracao = (this.faseCoracao + (dt * bpm) / 60) % 1;
    const f = this.faseCoracao;
    const pulso = f < 0.18 ? Math.sin((f / 0.18) * Math.PI) : f < 0.4 ? Math.sin(((f - 0.18) / 0.22) * Math.PI) * 0.35 : 0;
    this.estado.pulsoCoracao = pulso;

    // Respiração: movimentos "de treino" do tórax, a partir da semana 12.
    const respira = semana >= 12 ? (Math.sin(t * 1.3) * 0.5 + 0.5) * Math.min(1, (semana - 10) / 14) : 0;
    this.estado.respiracao = respira;

    if (reduzirMovimento) {
      this.definirAlvo({}, 0);
      this.aplicar(dt, 1.5);
      this.estado.gesto = "repouso";
      return;
    }

    // Troca de gesto.
    if (t >= this.proximoGesto) {
      const anterior = this.gesto.nome;
      this.gesto = sortearGesto(semana, anterior, this.aleatorio);
      const [a, b] = this.gesto.duracao;
      const dur = a + this.aleatorio() * (b - a);
      this.inicioGesto = t;
      this.fimGesto = t + dur;
      this.proximoGesto = this.fimGesto + 0.6 + this.aleatorio() * 2.2;
      if (this.gesto.nome === "soluco") this.solucoProximo = t + 0.3;
      if (this.gesto.nome === "piscar") this.piscadaFim = t + dur;
    }

    const dentro = t < this.fimGesto;
    const dur = Math.max(0.01, this.fimGesto - this.inicioGesto);
    const p = Math.min(1, (t - this.inicioGesto) / dur);
    // Envelope: entra em 30 %, segura, sai em 30 %. Chute é mais seco.
    const rampa = this.gesto.nome === "chute" ? 0.15 : 0.3;
    const env = !dentro ? 0 : p < rampa ? suave(p / rampa) : p > 1 - rampa ? suave((1 - p) / rampa) : 1;
    this.estado.gesto = dentro ? this.gesto.nome : "repouso";
    this.estado.progresso = p;

    // Amplitude cresce com a idade (um bebê de 14 semanas mexe pouco).
    const amplitude = 0.55 + 0.45 * Math.min(1, (semana - 12) / 20);
    this.definirAlvo(poses[this.gesto.nome], env * amplitude);

    // Piscar: pálpebras fecham e abrem rápido; o Bebe.tsx lê `estado.piscada`.
    this.estado.piscada = this.gesto.nome === "piscar" && dentro ? Math.sin(p * Math.PI) : 0;

    // Soluço: tranco curto no diafragma, séries de 3 a 8.
    let tranco = 0;
    if (this.gesto.nome === "soluco" && dentro && t >= this.solucoProximo) {
      this.solucoProximo = t + 0.55 + this.aleatorio() * 0.5;
      tranco = 1;
    }

    // Camadas sempre ativas: deriva orgânica no tronco e cabeça + respiração + soluço.
    const deriva = 0.03 + 0.02 * Math.min(1, (semana - 8) / 20);
    this.somarEuler("pelvis", fbm1d(t * 0.12, 1) * deriva, fbm1d(t * 0.09, 2) * deriva, fbm1d(t * 0.1, 3) * deriva * 0.6);
    this.somarEuler("coluna", fbm1d(t * 0.15, 4) * deriva * 0.5 - respira * 0.015 + tranco * 0.03, fbm1d(t * 0.11, 5) * deriva * 0.3, 0);
    this.somarEuler("torax", -respira * 0.03 + tranco * 0.06, 0, 0);
    this.somarEuler("cabeca", fbm1d(t * 0.2, 6) * 0.05, fbm1d(t * 0.17, 7) * 0.08, fbm1d(t * 0.13, 8) * 0.04);
    this.somarEuler("braco_E", fbm1d(t * 0.25, 9) * 0.05, 0, fbm1d(t * 0.21, 10) * 0.05);
    this.somarEuler("braco_D", fbm1d(t * 0.23, 11) * 0.05, 0, fbm1d(t * 0.19, 12) * 0.05);
    this.somarEuler("coxa_E", fbm1d(t * 0.18, 13) * 0.06, 0, 0);
    this.somarEuler("coxa_D", fbm1d(t * 0.16, 14) * 0.06, 0, 0);

    this.aplicar(dt, this.gesto.nome === "chute" ? 14 : 6);
  }

  private somarEuler(nome: NomeOsso, x: number, y: number, z: number) {
    const alvo = this.alvos.get(nome);
    if (!alvo) return;
    this.e.set(x, y, z);
    this.q.setFromEuler(this.e);
    alvo.multiply(this.q);
  }

  /** Segue os alvos com amortecimento exponencial (independente do fps). */
  private aplicar(dt: number, rigidez: number) {
    const k = 1 - Math.exp(-rigidez * dt);
    for (const [nome, osso] of this.ossos) {
      const atual = this.atuais.get(nome)!;
      atual.slerp(this.alvos.get(nome)!, k);
      osso.quaternion.copy(atual);
    }
  }
}
