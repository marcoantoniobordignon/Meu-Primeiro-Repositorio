"use client";

import { useFuso } from "@/lib/hooks/useFuso";
import { usePerfil } from "@/lib/perfil";
import { semanaDaFoto } from "@dominio/barriga.ts";
import { prefsCompletas } from "@dominio/prefs.ts";
import { dataNoFuso, dumDaDpp, type DataISO } from "@dominio/tempo.ts";

/** Semana atual (`ga_week(hoje)` limitada a 4..42), hoje no fuso, DUM e prefs da barriga. */
export function useBarriga() {
  const perfil = usePerfil();
  const tz = useFuso();
  const hoje = dataNoFuso(new Date(), tz);
  const semanaAtual = perfil?.dpp ? semanaDaFoto(perfil.dpp, hoje) : null;
  return { perfil, tz, hoje, semanaAtual, dum: perfil?.dpp ? dumDaDpp(perfil.dpp) : null, prefs: prefsCompletas(perfil?.prefs) };
}

/** Data da foto: hoje; da galeria, a data do arquivo quando cabe entre a DUM e hoje. */
export function dataDaFoto(hoje: DataISO, dum: DataISO | null, tz: string, arquivo?: File): DataISO {
  if (!arquivo?.lastModified || !dum) return hoje;
  const d = dataNoFuso(new Date(arquivo.lastModified), tz);
  return d >= dum && d <= hoje ? d : hoje;
}
