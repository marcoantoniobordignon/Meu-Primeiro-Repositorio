"use client";

import { fusoDe } from "@/lib/medicamentos/acoes";
import { usePerfil } from "@/lib/perfil";

/** Fuso de `profiles.tz` (ou do aparelho): doses, lembretes e "hoje" seguem ele. */
export function useFuso(): string {
  const perfil = usePerfil();
  return fusoDe(perfil?.tz);
}
