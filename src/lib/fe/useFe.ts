"use client";

import bruto from "../../../supabase/seed/oracoes.json";
import { useColecao } from "@/lib/dados/colecao";
import { faithFavoritos, oracoesRemotas, type OracaoRemota } from "@/lib/dados/colecoes";
import { usePerfil } from "@/lib/perfil";
import { supabaseConfigurado } from "@/lib/supabase/client";
import { idDaOracao, type Oracao } from "@dominio/fe.ts";
import { prefsCompletas } from "@dominio/prefs.ts";

/** Oração com a marca de rascunho (sem servidor, a semente aparece, sempre identificada). */
export type OracaoVisivel = OracaoRemota & { rascunho: boolean };

const SEMENTE: OracaoVisivel[] = (bruto as Oracao[]).map((o) => ({
  ...o,
  id: idDaOracao(o.slug),
  atualizado_em: "1970-01-01T00:00:00Z",
  status: "draft",
  reviewed_by: null,
  reviewed_on: null,
  rascunho: true,
}));

/**
 * RN-05: com servidor, só o publicado (a cópia local, para ler sem rede, RN-11). Sem servidor, a semente
 * em rascunho, com o selo. `ligado` é o modo fé de quem usa este aparelho (RN-01: padrão desligado).
 */
export function useFe() {
  const perfil = usePerfil();
  const remotas = useColecao(oracoesRemotas);
  const favoritos = useColecao(faithFavoritos);
  const comServidor = supabaseConfigurado();
  const oracoes: OracaoVisivel[] = comServidor ? remotas.filter((o) => o.status === "published").map((o) => ({ ...o, rascunho: false })) : SEMENTE;
  const idsFavoritos = new Set(favoritos.map((f) => f.prayer_id));
  const prefs = prefsCompletas(perfil?.prefs);
  return {
    perfil,
    ligado: prefs.faith_mode,
    oracaoNoPush: prefs.faith_weekly_push,
    oracoes,
    favoritos: oracoes.filter((o) => idsFavoritos.has(o.id)),
    idsFavoritos,
    comServidor,
  };
}
