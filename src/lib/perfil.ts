"use client";

import { useSyncExternalStore } from "react";

import { apagarPerfil, guardarPerfil, lerPerfil, type Perfil } from "@/lib/onboarding/estado";

const ouvintes = new Set<() => void>();
const ganchos = new Set<(p: Perfil) => void>();
let cache: Perfil | null | undefined;

function ler(): Perfil | null {
  if (cache === undefined) cache = lerPerfil();
  return cache;
}

function avisar() {
  ouvintes.forEach((cb) => cb());
}

function assinar(cb: () => void) {
  ouvintes.add(cb);
  return () => ouvintes.delete(cb);
}

/** Perfil reativo. `undefined` enquanto hidrata no servidor; `null` sem onboarding. */
export function usePerfil(): Perfil | null | undefined {
  return useSyncExternalStore(assinar, ler, () => undefined);
}

/** A sincronização se registra aqui para mandar o perfil ao servidor. */
export function aoMudarPerfil(cb: (p: Perfil) => void): () => void {
  ganchos.add(cb);
  return () => ganchos.delete(cb);
}

export function atualizarPerfil(mudancas: Partial<Perfil>): Perfil | null {
  const atual = ler();
  if (!atual) return null;
  cache = guardarPerfil({ ...atual, ...mudancas });
  avisar();
  ganchos.forEach((g) => g(cache!));
  return cache;
}

export function limparPerfil() {
  apagarPerfil();
  cache = null;
  avisar();
}

/** Spec 14 decide o plano; até lá, 'ativo', 'trial' e a cortesia pós-parto (VIR-02) liberam o Completo. */
export function temPlano(perfil: Perfil | null | undefined, agora: Date = new Date()): boolean {
  if (perfil?.plano === "ativo" || perfil?.plano === "trial") return true;
  return Boolean(perfil?.cortesiaFim && new Date(perfil.cortesiaFim).getTime() > agora.getTime());
}

export type { Perfil };
