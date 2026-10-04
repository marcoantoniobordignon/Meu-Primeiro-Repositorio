"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { supabaseConfigurado } from "@/lib/supabase/client";

import { fonteDemo } from "./demo";
import { fonteSupabase } from "./supabase";
import type { FonteAdmin } from "./tipos";

/** Sem Supabase, o painel mostra a demonstração e avisa (faixa no topo). */
export function fonteAdmin(): FonteAdmin {
  return supabaseConfigurado() ? fonteSupabase : fonteDemo;
}

export interface Dados<T> {
  dados: T | undefined;
  carregando: boolean;
  erro: string | null;
  atualizadoEm: Date | null;
  recarregar: () => void;
}

/**
 * Carrega uma consulta da fonte e mantém o resultado anterior enquanto
 * recarrega (nada de skeleton piscando a cada filtro).
 */
export function useDados<T>(consulta: (fonte: FonteAdmin) => Promise<T>, deps: unknown[] = []): Dados<T> {
  const [dados, setDados] = useState<T>();
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [versao, setVersao] = useState(0);
  const consultaRef = useRef(consulta);
  consultaRef.current = consulta;

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    consultaRef
      .current(fonteAdmin())
      .then((d) => {
        if (!vivo) return;
        setDados(d);
        setErro(null);
        setAtualizadoEm(new Date());
      })
      .catch((e: unknown) => {
        if (vivo) setErro(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (vivo) setCarregando(false);
      });
    return () => {
      vivo = false;
    };
    // A consulta é lida por ref; só os deps declarados e o "recarregar" disparam.
  }, [versao, ...deps]);

  const recarregar = useCallback(() => setVersao((v) => v + 1), []);
  return { dados, carregando, erro, atualizadoEm, recarregar };
}
