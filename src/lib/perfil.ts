"use client";

import { useSyncExternalStore } from "react";

import { apagarPerfil, guardarPerfil, lerPerfil, type Perfil } from "@/lib/onboarding/estado";

const ouvintes = new Set<() => void>();
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

export function atualizarPerfil(mudancas: Partial<Perfil>): Perfil | null {
  const atual = ler();
  if (!atual) return null;
  cache = guardarPerfil({ ...atual, ...mudancas });
  avisar();
  return cache;
}

export function limparPerfil() {
  apagarPerfil();
  cache = null;
  avisar();
}

/** Spec 14 decide o plano; até lá, 'ativo' e 'trial' liberam o conteúdo premium. */
export function temPlano(perfil: Perfil | null | undefined): boolean {
  return perfil?.plano === "ativo" || perfil?.plano === "trial";
}
